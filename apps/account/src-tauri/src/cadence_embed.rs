use anyhow::{Context, Result};
use std::sync::Arc;
use std::time::Duration;
use cadence::auth::JwtValidator;
use cadence::config::CadenceConfig;
use cadence::primary_reader::SqlitePrimaryReader;
use cadence::schema::SchemaFingerprint;
use cadence::state::{ChangeBroadcaster, SyncState};
use cadence::storage::{MetadataBackend, SqliteBackend};
use cadence::conn::ConnectionManager;
use cadence::sync::SyncEngine;
use cadence::peer_status::PeerTracker;
use cadence::token::TokenStore;

use crate::config::AppConfig;

/// Cadence collection/scope config — single source of truth shared with the
/// cloud (`services/api-ts/cadence.yml` is mounted into the cadence pod
/// via the helm chart's configmap, and embedded into this binary at compile
/// time via `include_str!`). Keeping one canonical YAML eliminates the
/// silent drift class of bugs (e.g. "embedded scope filter rejects rows
/// the cloud's filter accepted because someone removed an explicit rule
/// from one side").
const CADENCE_YML: &str = include_str!("../../../../services/api-ts/cadence.yml");

pub struct EmbeddedCadence {
    pub sync_engine: Arc<SyncEngine>,
    pub token_store: Arc<TokenStore>,
    pub state: Arc<SyncState>,
    _handles: Vec<tokio::task::JoinHandle<()>>,
}

impl EmbeddedCadence {
    /// Start the embedded cadence sync engine.
    ///
    /// SQLite-only variant for the embedded backend.
    pub async fn start(app_config: &AppConfig) -> Result<Self> {
        // Load collections + scope rules + blacklist from the canonical
        // `services/api-ts/cadence.yml` (embedded at compile time via
        // `include_str!`). The cloud reads the same file via the helm
        // chart's configmap, so both sides see identical scope semantics.
        // Drift between the two used to cause "rejects rows the cloud
        // accepted" bugs — single source of truth fixes it permanently.
        let mut config = CadenceConfig::from_yaml_str(CADENCE_YML)
            .context("Failed to parse embedded cadence.yml — keep services/api-ts/cadence.yml valid")?;

        // Embedded-specific overrides (these are runtime/deployment
        // settings, not collection scope rules — they intentionally
        // diverge from the cloud).
        config.metadata_db_path = app_config.cadence_metadata_path.to_string_lossy().to_string();
        config.api_server.enabled = false;
        config.primary_db_url = app_config.embedded_database_url.clone();

        // Apply env overrides (CADENCE_PEER_TOKEN, CADENCE_BOOTSTRAP_PEERS, etc.)
        config.apply_env_overrides();

        // Resolve wildcard collections against the primary database
        config.resolve_wildcard().await?;

        let config = Arc::new(config);

        // Open metadata storage backend
        if let Some(parent) = app_config.cadence_metadata_path.parent() {
            std::fs::create_dir_all(parent)
                .context("Failed to create cadence metadata directory")?;
        }

        let storage: Arc<dyn MetadataBackend> = Arc::new(
            SqliteBackend::open(&app_config.cadence_metadata_path)
                .context("Failed to open cadence metadata database")?,
        );

        // Initialize sync state
        let state = Arc::new(SyncState::new());
        let broadcaster = Arc::new(ChangeBroadcaster::new(config.broadcast_channel_capacity));

        // Create JWT validator
        let jwt_validator = Arc::new(if config.jwks_urls.is_empty() {
            tracing::warn!("No jwks_urls configured — JWT verification disabled");
            JwtValidator::no_verify()
        } else {
            JwtValidator::new(config.jwks_urls.clone(), Arc::clone(&storage))
        });

        // Create token store and load token
        let token_store = Arc::new(TokenStore::new(storage.clone(), jwt_validator.clone()));
        if !token_store.load_from_config(&config).await? {
            if token_store.load_from_storage().await? {
                tracing::info!("Loaded persisted peer token from metadata DB");
            }
        }

        // Create sync engine
        let peer_id = uuid::Uuid::new_v4().to_string();
        let peer_tracker = Arc::new(PeerTracker::new());

        // Create primary DB reader (SQLite only for embedded mode)
        let db_path = config.primary_db_url.trim_start_matches("sqlite://");
        let conn = Arc::new(std::sync::Mutex::new(
            rusqlite::Connection::open(db_path)
                .context("Failed to open SQLite for primary reader")?,
        ));
        let primary_reader = Arc::new(SqlitePrimaryReader::new(conn, peer_id.clone()));

        // Start stale peer reaper
        if config.peer_idle_timeout_ms > 0 {
            peer_tracker.start_reaper(config.peer_idle_timeout_ms, config.peer_idle_timeout_ms / 2);
        }
        let (sync_engine, peer_change_rx) = SyncEngine::new(
            config.clone(),
            state.clone(),
            storage.clone(),
            primary_reader,
            jwt_validator.clone(),
            peer_id.clone(),
            SchemaFingerprint::empty(),
            token_store.clone(),
            peer_tracker,
        );
        let sync_engine = Arc::new(sync_engine);

        // Load persisted peers
        if let Err(e) = sync_engine.load_peers_from_storage().await {
            tracing::warn!("Failed to load persisted peers: {}", e);
        }

        let mut handles = Vec::new();

        // ApplierTracker for echo suppression
        let applier_tracker = cadence::applier::tracker::ApplierTracker::new();

        // Start primary DB watcher (SQLite)
        {
            let watcher_broadcaster = broadcaster.clone();
            let watcher_storage = storage.clone();
            let watcher_state = state.clone();
            let watcher_tracker = applier_tracker.clone();
            let poll_interval = Duration::from_millis(config.poll_interval_ms);
            let collections: Vec<String> = config.collections.keys().cloned().collect();
            let scope_columns = config.scope_columns_by_collection();

            let db_path = config.primary_db_url.trim_start_matches("sqlite://").to_string();
            let conn = Arc::new(std::sync::Mutex::new(
                rusqlite::Connection::open(&db_path)
                    .context("Failed to open SQLite for watcher")?,
            ));
            let mut watcher = cadence::watcher::sqlite::SqliteWatcher::new(
                conn,
                collections,
                peer_id.clone(),
                watcher_state,
                scope_columns,
            );
            handles.push(tokio::spawn(async move {
                use cadence::watcher::ChangeWatcher;
                loop {
                    tokio::time::sleep(poll_interval).await;
                    match watcher.poll_changes().await {
                        Ok(output) if !output.changes.is_empty() => {
                            tracing::debug!("Primary DB watcher detected {} changes (incremental: {})", output.changes.len(), output.is_incremental);
                            let mut changes = output.changes;
                            for change in &mut changes {
                                if let Some(origin_peer_id) = watcher_tracker.take_origin(&change.collection, &change.document_id) {
                                    if let cadence::state::SyncPayload::Fields(ref mut fields) = change.payload {
                                        for fc in fields.iter_mut() {
                                            fc.peer_id = origin_peer_id.clone();
                                        }
                                    }
                                }
                            }
                            if output.is_incremental {
                                for change in &changes {
                                    if let Err(e) = watcher_storage.append_change(change).await {
                                        tracing::error!("Failed to append change to log: {}", e);
                                    }
                                }
                            }
                            watcher_broadcaster.broadcast(changes);
                        }
                        Ok(_) => {}
                        Err(e) => {
                            tracing::error!("Primary DB watcher error: {}", e);
                        }
                    }
                }
            }));
        }

        // Change log watcher — tracks seq for bookkeeping only
        {
            let watcher_storage = Arc::clone(&storage);
            let poll_interval = Duration::from_millis(config.poll_interval_ms);
            handles.push(tokio::spawn(async move {
                let mut last_known_seq = watcher_storage.max_seq().await.unwrap_or(0);
                loop {
                    tokio::time::sleep(poll_interval).await;
                    match watcher_storage.max_seq().await {
                        Ok(seq) if seq > last_known_seq => {
                            last_known_seq = seq;
                        }
                        Ok(_) => {}
                        Err(e) => {
                            tracing::error!("Change log watcher poll error: {}", e);
                        }
                    }
                }
            }));
        }

        // Start SQLite applier
        {
            let applier_storage = Arc::clone(&storage);
            let collections: Vec<String> = config.collections.keys().cloned().collect();
            let db_path = config.primary_db_url.trim_start_matches("sqlite://");
            let handle = cadence::applier::sqlite::start_sqlite_applier(
                applier_storage,
                std::path::PathBuf::from(db_path),
                collections,
                config.collections_blacklist.clone(),
                Duration::from_millis(500),
                applier_tracker.clone(),
                config.max_reconnect_attempts,
                config.reconnect_base_delay_ms,
                config.reconnect_max_delay_ms,
                config.query_batch_size,
            );
            handles.push(handle);
        }

        // Start ConnectionManager (WS-only, no QUIC in embedded mode)
        let conn_manager = ConnectionManager::new(
            sync_engine.clone(),
            token_store.clone(),
            broadcaster.clone(),
            &config,
            None,
        );
        let _conn_handle = conn_manager.start(peer_change_rx);

        // Merge bootstrap peers into stored peers
        if !config.bootstrap_peers.is_empty() {
            let mut all = sync_engine.get_peers().await;
            for bp in &config.bootstrap_peers {
                if !all.contains(bp) {
                    all.push(bp.clone());
                }
            }
            sync_engine.set_peers(all).await?;
        }

        tracing::info!("Embedded cadence started — peer_id: {}", peer_id);

        Ok(Self {
            sync_engine,
            token_store,
            state,
            _handles: handles,
        })
    }

    pub async fn stop(&mut self) {
        tracing::info!("Stopping embedded cadence...");
        for handle in self._handles.drain(..) {
            handle.abort();
        }
    }
}
