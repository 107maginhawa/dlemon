//! High-level runtime for Cadence sync engine.
//!
//! Provides `Cadence` struct and `CadenceBuilder` for easy initialization
//! with auto-wiring of watchers, appliers, and connection management.
//!
//! # Example (CLI with full config)
//!
//! ```ignore
//! let config = CadenceConfig::from_yaml_file("cadence.yml")?;
//!
//! let cadence = Cadence::builder()
//!     .config(config)
//!     .resolve_wildcards()  // ← connects to the primary DB; only call if you need schema discovery
//!     .await?
//!     .build()
//!     .await?;
//! ```
//!
//! # Example (Embedded with builder, full sync)
//!
//! ```ignore
//! let mut cadence = Cadence::builder()
//!     .primary_db("sqlite:///path/to/db.sqlite")
//!     .metadata_db("/path/to/metadata.db")
//!     .scope_rules([("facility", "organization"), ("created_by", "user")])
//!     .api_server(false)
//!     .resolve_wildcards()  // ← discover wildcard tables from the primary DB
//!     .await?
//!     .build()
//!     .await?;
//! cadence.start_sync().await?;
//! ```
//!
//! # Example (Embedded, metadata-only — no primary DB connection)
//!
//! ```ignore
//! // Short-lived CLI invocation: peer-token / peers / local-identity CRUD.
//! // `.build()` performs no network I/O — the primary DB may be unreachable.
//! let cadence = Cadence::builder()
//!     .primary_db("postgres://...")
//!     .metadata_db("/path/to/metadata.db")
//!     .build()
//!     .await?;
//! cadence.sync_engine().set_peer_token(jwt).await?;
//! ```

use anyhow::{Context, Result};
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::task::{AbortHandle, JoinHandle};

use crate::applier::tracker::ApplierTracker;
use crate::auth::JwtValidator;
use crate::config::{CadenceConfig, CollectionConfig, ConflictStrategy};
use crate::conn::ConnectionManager;
use crate::identity::load_or_create_identity;
use crate::peer_status::PeerTracker;
use crate::primary_reader::{PgPrimaryReader, PrimaryDbReader, SqlitePrimaryReader};
use crate::schema::SchemaFingerprint;
use crate::state::{ChangeBroadcaster, RowChange, SyncPayload, SyncState};
use crate::storage::{self, MetadataBackend, SqliteBackend, ValkeyBackend};
use crate::sync::SyncEngine;
use crate::token::TokenStore;
use crate::transport;
use crate::watcher::ChangeWatcher;

/// Database type detected from URL.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DbType {
    Sqlite,
    Postgres,
}

impl DbType {
    /// Detect database type from URL.
    pub fn from_url(url: &str) -> Self {
        if url.starts_with("sqlite://") {
            DbType::Sqlite
        } else {
            DbType::Postgres
        }
    }

    /// Extract the path/connection string.
    pub fn connection_target(url: &str) -> &str {
        if url.starts_with("sqlite://") {
            url.trim_start_matches("sqlite://")
        } else {
            url
        }
    }
}

/// High-level Cadence runtime with all components wired up.
///
/// Created via `Cadence::builder()`. The lifecycle is:
///
/// 1. **`builder().resolve_wildcards()`** *(optional)* — connects to the
///    primary DB to expand any `"*"` wildcard collection into the discovered
///    table list. **This is the only builder step that opens a primary-DB
///    connection.** Omit it for short-lived metadata-only operations
///    (peer/token CRUD, local-identity inspection) where the primary DB may
///    not be reachable.
/// 2. **`build()`** — pure construction: opens metadata storage, constructs
///    the sync engine, loads the persisted peer token / peers / local
///    identity. **No background tasks are spawned and no primary-DB
///    connection is opened.** The returned instance is fully functional for
///    metadata reads/writes, making it suitable for short-lived CLI
///    invocations that just want to mutate state and exit.
/// 3. **`start_sync()`** — spawns all background sync tasks (primary DB
///    watcher, change log watcher, applier, peer-tracker reaper, connection
///    manager). After this call the instance is actively syncing.
///
/// Long-running embedders (servers, desktop apps) call all three in
/// sequence:
/// `Cadence::builder()....resolve_wildcards().await?.build().await?.start_sync().await?`.
pub struct Cadence {
    config: Arc<CadenceConfig>,
    sync_engine: Arc<SyncEngine>,
    token_store: Arc<TokenStore>,
    state: Arc<SyncState>,
    broadcaster: Arc<ChangeBroadcaster>,
    peer_tracker: Arc<PeerTracker>,
    iroh_endpoint: Option<Arc<iroh::Endpoint>>,
    // Fields needed by `start_sync()` — populated by `build()`.
    storage: Arc<dyn MetadataBackend>,
    db_type: DbType,
    peer_id: String,
    applier_tracker: ApplierTracker,
    peer_change_rx: Option<tokio::sync::watch::Receiver<Vec<String>>>,
    // Task handles, populated by `start_sync()`. Empty after `build()`.
    handles: Vec<JoinHandle<()>>,
    conn_handle: Option<AbortHandle>,
    reaper_handle: Option<AbortHandle>,
    started: bool,
}

impl Cadence {
    /// Create a new builder for Cadence.
    pub fn builder() -> CadenceBuilder {
        CadenceBuilder::new()
    }

    /// Get the configuration.
    pub fn config(&self) -> &Arc<CadenceConfig> {
        &self.config
    }

    /// Get the sync engine.
    pub fn sync_engine(&self) -> &Arc<SyncEngine> {
        &self.sync_engine
    }

    /// Get the token store.
    pub fn token_store(&self) -> &Arc<TokenStore> {
        &self.token_store
    }

    /// Get the sync state.
    pub fn state(&self) -> &Arc<SyncState> {
        &self.state
    }

    /// Get the change broadcaster.
    pub fn broadcaster(&self) -> &Arc<ChangeBroadcaster> {
        &self.broadcaster
    }

    /// Get the peer tracker.
    pub fn peer_tracker(&self) -> &Arc<PeerTracker> {
        &self.peer_tracker
    }

    /// Get the Iroh endpoint (if configured).
    pub fn iroh_endpoint(&self) -> Option<&Arc<iroh::Endpoint>> {
        self.iroh_endpoint.as_ref()
    }

    /// Get the persistent local peer ID (created on first build, stable across
    /// restarts).
    pub fn peer_id(&self) -> &str {
        &self.peer_id
    }

    /// Get the metadata storage backend. Useful for short-lived CLI invocations
    /// that want to read/write metadata without touching the sync engine.
    pub fn storage(&self) -> &Arc<dyn MetadataBackend> {
        &self.storage
    }

    /// Spawn all background sync tasks: primary DB watcher, change log watcher,
    /// applier, peer-tracker reaper, and connection manager. After this call
    /// the instance is actively syncing.
    ///
    /// Calling this method is optional: a `Cadence` instance from `build()`
    /// alone is fully functional for metadata reads/writes (token store,
    /// peers list, change-log queries) — useful for short-lived CLI
    /// invocations that just want to mutate state and exit.
    ///
    /// Idempotent: calling `start_sync()` on an already-started instance is a
    /// no-op and logs a warning.
    pub async fn start_sync(&mut self) -> Result<()> {
        if self.started {
            tracing::warn!("Cadence::start_sync() called on already-started instance; ignoring");
            return Ok(());
        }

        let peer_change_rx = self
            .peer_change_rx
            .take()
            .context("peer_change_rx missing; start_sync() already consumed it")?;

        // Start peer tracker reaper
        if self.config.peer_idle_timeout_ms > 0 {
            self.reaper_handle = Some(self.peer_tracker.start_reaper(
                self.config.peer_idle_timeout_ms,
                self.config.peer_idle_timeout_ms / 2,
            ));
        }

        // Start primary DB watcher
        self.handles.push(start_primary_watcher(
            self.db_type,
            &self.config,
            &self.peer_id,
            self.state.clone(),
            self.storage.clone(),
            self.broadcaster.clone(),
            self.applier_tracker.clone(),
        )?);

        // Start change log watcher (bookkeeping)
        self.handles.push(start_changelog_watcher(
            self.storage.clone(),
            self.config.poll_interval_ms,
        ));

        // Start applier
        self.handles.push(start_applier(
            self.db_type,
            &self.config,
            self.storage.clone(),
            self.applier_tracker.clone(),
            self.peer_id.clone(),
        ));

        // Start connection manager
        let conn_manager = ConnectionManager::new(
            self.sync_engine.clone(),
            self.token_store.clone(),
            self.broadcaster.clone(),
            &self.config,
            self.iroh_endpoint.clone(),
        );
        self.conn_handle = Some(conn_manager.start(peer_change_rx));

        // Merge bootstrap peers
        if !self.config.bootstrap_peers.is_empty() {
            let mut all = self.sync_engine.get_peers().await;
            for bp in &self.config.bootstrap_peers {
                if !all.contains(bp) {
                    all.push(bp.clone());
                }
            }
            self.sync_engine.set_peers(all).await?;
        }

        self.started = true;
        tracing::info!("Cadence sync started");
        Ok(())
    }

    /// Stop all background tasks. No-op if `start_sync()` was never called.
    pub async fn stop(&mut self) {
        if !self.started && self.handles.is_empty() && self.conn_handle.is_none() {
            return;
        }
        tracing::info!("Stopping cadence...");
        for handle in self.handles.drain(..) {
            handle.abort();
        }
        if let Some(handle) = self.conn_handle.take() {
            handle.abort();
        }
        if let Some(handle) = self.reaper_handle.take() {
            handle.abort();
        }
        self.started = false;
    }

    /// Run the accept loop for incoming QUIC connections.
    ///
    /// This is a blocking call that runs until shutdown.
    /// Requires an Iroh endpoint to be configured.
    pub async fn accept_loop(&self) -> Result<()> {
        let endpoint = self
            .iroh_endpoint
            .as_ref()
            .context("accept_loop requires iroh_endpoint to be configured")?;

        let (shutdown_tx, mut shutdown_rx) = tokio::sync::oneshot::channel::<()>();

        // Handle Ctrl+C
        tokio::spawn(async move {
            tokio::signal::ctrl_c()
                .await
                .expect("Failed to install CTRL+C handler");
            tracing::info!("Shutdown signal received");
            let _ = shutdown_tx.send(());
        });

        let mut accept_counter = 0u64;
        loop {
            tokio::select! {
                incoming = crate::transport::accept_connection(endpoint.as_ref()) => {
                    match incoming {
                        Ok(conn) => {
                            accept_counter += 1;
                            let session_key = format!("in:quic:{}", accept_counter);
                            let engine = self.sync_engine.clone();
                            let change_rx = self.broadcaster.subscribe();
                            tokio::spawn(async move {
                                if let Err(e) = engine.handle_incoming(conn, change_rx, &session_key).await {
                                    tracing::error!("Incoming sync failed: {}", e);
                                }
                            });
                        }
                        Err(e) => {
                            tracing::error!("Accept error: {}", e);
                            break;
                        }
                    }
                }
                _ = &mut shutdown_rx => {
                    tracing::info!("Shutting down gracefully...");
                    break;
                }
            }
        }

        Ok(())
    }
}

/// Builder for creating a `Cadence` instance.
///
/// Supports two modes:
/// 1. **Config mode**: Pass a full `CadenceConfig` via `.config()`
/// 2. **Builder mode**: Build config incrementally via `.primary_db()`, `.scope_rules()`, etc.
#[derive(Default)]
pub struct CadenceBuilder {
    // Full config (mutually exclusive with builder fields)
    config: Option<CadenceConfig>,

    // Builder-based config fields
    primary_db_url: Option<String>,
    metadata_db_path: Option<PathBuf>,
    scope_rules: BTreeMap<String, String>,
    collections: BTreeMap<String, CollectionConfig>,

    // Optional overrides
    api_server_enabled: Option<bool>,
    apply_env_overrides: bool,
    poll_interval_ms: Option<u64>,
    jwks_urls: Option<Vec<String>>,

    // P2P configuration
    p2p_enabled: Option<bool>,

    // Legacy: externally provided endpoint (deprecated, use p2p_enabled instead)
    #[deprecated(note = "Use p2p_enabled() instead; endpoint is now created internally with persistent identity")]
    legacy_iroh_endpoint: Option<Arc<iroh::Endpoint>>,
}

impl CadenceBuilder {
    /// Create a new builder.
    pub fn new() -> Self {
        Self::default()
    }

    /// Set a full configuration (CLI mode).
    ///
    /// When using this, builder methods like `primary_db()` and `scope_rules()` are ignored.
    pub fn config(mut self, config: CadenceConfig) -> Self {
        self.config = Some(config);
        self
    }

    /// Set the primary database URL (builder mode).
    ///
    /// SQLite URLs must start with `sqlite://`.
    pub fn primary_db(mut self, url: impl Into<String>) -> Self {
        self.primary_db_url = Some(url.into());
        self
    }

    /// Set the metadata database path (builder mode).
    pub fn metadata_db(mut self, path: impl Into<PathBuf>) -> Self {
        self.metadata_db_path = Some(path.into());
        self
    }

    /// Add a scope rule for wildcard collection discovery.
    ///
    /// Maps a DB column name to a scope dimension name.
    pub fn scope_rule(mut self, column: &str, dimension: &str) -> Self {
        self.scope_rules
            .insert(column.to_string(), dimension.to_string());
        self
    }

    /// Add multiple scope rules at once.
    pub fn scope_rules<I, S1, S2>(mut self, rules: I) -> Self
    where
        I: IntoIterator<Item = (S1, S2)>,
        S1: AsRef<str>,
        S2: AsRef<str>,
    {
        for (col, dim) in rules {
            self.scope_rules
                .insert(col.as_ref().to_string(), dim.as_ref().to_string());
        }
        self
    }

    /// Add an explicit collection configuration.
    pub fn collection(mut self, name: &str, config: CollectionConfig) -> Self {
        self.collections.insert(name.to_string(), config);
        self
    }

    /// Enable/disable API server (default: true for config mode, false for builder mode).
    pub fn api_server(mut self, enabled: bool) -> Self {
        self.api_server_enabled = Some(enabled);
        self
    }

    /// Apply environment variable overrides (CADENCE_PEER_TOKEN, etc).
    pub fn apply_env_overrides(mut self) -> Self {
        self.apply_env_overrides = true;
        self
    }

    /// Enable or disable P2P (QUIC/Iroh) transport.
    ///
    /// When enabled, the builder will create an Iroh endpoint using a persistent
    /// identity stored in the metadata database. This ensures the node ID remains
    /// stable across restarts.
    pub fn p2p_enabled(mut self, enabled: bool) -> Self {
        self.p2p_enabled = Some(enabled);
        self
    }

    /// Set an Iroh endpoint for QUIC transport.
    ///
    /// **Deprecated**: Use `p2p_enabled(true)` instead. The builder now creates
    /// the endpoint internally using a persistent identity from the metadata database.
    /// This method is kept for backward compatibility but the endpoint's identity
    /// may not match the persisted peer ID.
    #[deprecated(note = "Use p2p_enabled(true) instead; endpoint is now created internally with persistent identity")]
    #[allow(deprecated)]
    pub fn iroh_endpoint(mut self, endpoint: Arc<iroh::Endpoint>) -> Self {
        self.legacy_iroh_endpoint = Some(endpoint);
        self
    }

    /// Override poll interval in milliseconds.
    pub fn poll_interval_ms(mut self, ms: u64) -> Self {
        self.poll_interval_ms = Some(ms);
        self
    }

    /// Set JWKS URLs for JWT signature verification.
    ///
    /// **Authoritative**: applied AFTER `apply_env_overrides()`, so a
    /// builder-set value cannot be overridden by `CADENCE_JWKS_URL`. This
    /// is intentional — embedders that hardcode a JWKS URL (e.g. desktop
    /// apps shipped to end users) must not allow runtime override, or any
    /// user could mint tokens validated against their own keys.
    pub fn jwks_urls(mut self, urls: impl IntoIterator<Item = impl Into<String>>) -> Self {
        self.jwks_urls = Some(urls.into_iter().map(Into::into).collect());
        self
    }

    /// Resolve `"*"` wildcard collection patterns by querying the primary
    /// database schema.
    ///
    /// **This is the only builder step that connects to the primary database.**
    /// Call it before `.build()` if any collection uses the `"*"` wildcard
    /// (which `scope_rules(...)` adds implicitly); omit it for short-lived
    /// metadata-only invocations (peer/token CRUD, local-identity inspection)
    /// where the primary DB may be unreachable.
    ///
    /// No-op when no wildcard entry is configured — safe to call defensively.
    ///
    /// After this returns, the in-progress config is cached on the builder
    /// and subsequent collection-mutating builder methods will not affect
    /// the resolved set.
    pub async fn resolve_wildcards(mut self) -> Result<Self> {
        // Materialise the in-progress config so we can mutate it. This mirrors
        // the same `config.take().or_else(|| build_config())` shape that
        // `build()` performs internally — ensures `.config(...)` and the
        // fluent setters both work as the source.
        let mut config = match self.config.take() {
            Some(c) => c,
            None => self.build_config()?,
        };
        // CadenceConfig::resolve_wildcard already short-circuits when there's
        // no `"*"` entry, so this is safe to call defensively.
        config.resolve_wildcard().await?;
        self.config = Some(config);
        Ok(self)
    }

    /// Build the Cadence instance.
    ///
    /// **Pure construction.** Opens the metadata storage backend, builds the
    /// sync engine, loads persisted peer / token / identity state. Performs
    /// **no primary-DB I/O** — if any collections use the `"*"` wildcard and
    /// you need them expanded, call [`Self::resolve_wildcards`] first.
    #[allow(deprecated)]
    pub async fn build(mut self) -> Result<Cadence> {
        // Resolve config
        let mut config = if let Some(config) = self.config {
            config
        } else {
            self.build_config()?
        };

        // Apply optional overrides
        if let Some(enabled) = self.api_server_enabled {
            config.api_server.enabled = enabled;
        }
        if let Some(ms) = self.poll_interval_ms {
            config.poll_interval_ms = ms;
        }
        if self.apply_env_overrides {
            config.apply_env_overrides();
        }
        // jwks_urls is applied AFTER env overrides on purpose: when an
        // embedder (e.g. maestroapp) hardcodes a JWKS URL via the builder,
        // it must be authoritative. Otherwise a malicious user could set
        // CADENCE_JWKS_URL to their own endpoint and mint tokens signed
        // with their own keys.
        if let Some(urls) = self.jwks_urls.take() {
            config.jwks_urls = urls;
        }

        // Validate required config
        if config.primary_db_url.is_empty() {
            anyhow::bail!(
                "primary_db_url is required. Set via .primary_db() or in config."
            );
        }

        // NOTE: wildcard collection expansion is intentionally NOT performed
        // here. It opens a primary-DB connection, which would make `build()`
        // unusable for metadata-only callers. Callers that need wildcard
        // expansion must call `CadenceBuilder::resolve_wildcards().await?`
        // explicitly before `.build()`.

        // Resolve metadata DB path
        let metadata_db_path = if let Some(ref path) = self.metadata_db_path {
            path.clone()
        } else {
            storage::path::resolve_metadata_db_path(&config)
        };

        // Create parent directory
        if let Some(parent) = metadata_db_path.parent() {
            std::fs::create_dir_all(parent)
                .context(format!("Failed to create data directory: {:?}", parent))?;
        }

        let config = Arc::new(config);
        let db_type = DbType::from_url(&config.primary_db_url);

        // Open metadata storage backend
        let storage: Arc<dyn MetadataBackend> = match config.metadata_backend.as_str() {
            "valkey" => {
                let url = config
                    .valkey_url
                    .as_deref()
                    .context("valkey_url required when metadata_backend is 'valkey'")?;
                tracing::info!("Using Valkey metadata backend: {}", url);
                Arc::new(
                    ValkeyBackend::connect(url, &config.primary_db_url)
                        .await
                        .context("Failed to connect to Valkey")?,
                )
            }
            _ => {
                tracing::info!("Using SQLite metadata backend: {:?}", metadata_db_path);
                Arc::new(
                    SqliteBackend::open(&metadata_db_path)
                        .context("Failed to open metadata database")?,
                )
            }
        };

        // Initialize sync state and broadcaster
        let state = Arc::new(SyncState::new());
        let broadcaster = Arc::new(ChangeBroadcaster::new(config.broadcast_channel_capacity));

        // Create JWT validator
        let jwt_validator = Arc::new(if config.jwks_urls.is_empty() {
            tracing::warn!(
                "No jwks_urls configured — JWT signature verification is disabled."
            );
            JwtValidator::no_verify()
        } else {
            tracing::info!(
                "JWT validation enabled with {} JWKS endpoint(s)",
                config.jwks_urls.len()
            );
            JwtValidator::new(config.jwks_urls.clone(), Arc::clone(&storage))
        });

        // Create token store and load token
        let token_store = Arc::new(TokenStore::new(storage.clone(), jwt_validator.clone()));
        if !token_store.load_from_config(&config).await? {
            if token_store.load_from_storage().await? {
                tracing::info!("Loaded persisted peer token from metadata DB");
            }
        }

        // Determine if P2P is enabled
        #[allow(deprecated)]
        let p2p_enabled = self.p2p_enabled
            .unwrap_or_else(|| self.legacy_iroh_endpoint.is_some() || config.p2p.enabled);

        // Load or create persistent identity
        let identity = load_or_create_identity(storage.as_ref(), p2p_enabled).await?;
        let peer_id = identity.peer_id.clone();

        // Create Iroh endpoint if P2P is enabled
        #[allow(deprecated)]
        let iroh_endpoint = if let Some(ep) = self.legacy_iroh_endpoint.take() {
            // Legacy path: use externally provided endpoint (deprecated)
            tracing::warn!(
                "Using externally provided Iroh endpoint (deprecated). \
                 Peer ID from endpoint ({}) may differ from persisted ID ({}).",
                ep.node_id(),
                peer_id
            );
            Some(ep)
        } else if p2p_enabled {
            // New path: create endpoint with persistent identity
            let secret_key = identity.iroh_secret_key();
            let endpoint = transport::create_endpoint(secret_key)
                .await
                .context("Failed to create Iroh endpoint")?;
            Some(Arc::new(endpoint))
        } else {
            tracing::info!("P2P (QUIC/Iroh) transport disabled");
            None
        };

        // Create peer tracker (reaper is started later in `start_sync()`)
        let peer_tracker = Arc::new(PeerTracker::new());

        // Create primary DB reader
        let primary_reader = create_primary_reader(&config, &peer_id)?;

        // Create sync engine
        let (sync_engine, peer_change_rx) = SyncEngine::new(
            config.clone(),
            state.clone(),
            storage.clone(),
            primary_reader,
            jwt_validator.clone(),
            peer_id.clone(),
            SchemaFingerprint::empty(),
            token_store.clone(),
            peer_tracker.clone(),
        );
        let sync_engine = Arc::new(sync_engine);

        // Load persisted peers
        if let Err(e) = sync_engine.load_peers_from_storage().await {
            tracing::warn!("Failed to load persisted peers: {}", e);
        }

        // Create applier tracker for echo suppression
        let applier_tracker = ApplierTracker::new();

        tracing::info!("Cadence built (background tasks not yet started)");

        Ok(Cadence {
            config,
            sync_engine,
            token_store,
            state,
            broadcaster,
            peer_tracker,
            iroh_endpoint,
            storage,
            db_type,
            peer_id,
            applier_tracker,
            peer_change_rx: Some(peer_change_rx),
            handles: Vec::new(),
            conn_handle: None,
            reaper_handle: None,
            started: false,
        })
    }

    /// Build CadenceConfig from builder fields.
    fn build_config(&self) -> Result<CadenceConfig> {
        let primary_db_url = self
            .primary_db_url
            .clone()
            .context("primary_db() is required when not using .config()")?;

        let mut config = CadenceConfig::default();
        config.primary_db_url = primary_db_url;

        if let Some(ref path) = self.metadata_db_path {
            config.metadata_db_path = path.to_string_lossy().to_string();
        }

        // Add wildcard collection with scope rules
        if !self.scope_rules.is_empty() {
            config.collections.insert(
                "*".to_string(),
                CollectionConfig {
                    strategy: ConflictStrategy::Lww,
                    scope_columns: BTreeMap::new(),
                    scope_rules: Some(self.scope_rules.clone()),
                },
            );
        }

        // Add explicit collections
        for (name, cfg) in &self.collections {
            config.collections.insert(name.clone(), cfg.clone());
        }

        // Default: API server disabled for builder mode
        config.api_server.enabled = false;

        Ok(config)
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal helper functions
// ═══════════════════════════════════════════════════════════════════════════

fn create_primary_reader(
    config: &CadenceConfig,
    peer_id: &str,
) -> Result<Arc<dyn PrimaryDbReader>> {
    let db_type = DbType::from_url(&config.primary_db_url);

    match db_type {
        DbType::Sqlite => {
            let db_path = DbType::connection_target(&config.primary_db_url);
            let conn = Arc::new(std::sync::Mutex::new(
                rusqlite::Connection::open(db_path)
                    .context("Failed to open SQLite for primary reader")?,
            ));
            Ok(Arc::new(SqlitePrimaryReader::new(conn, peer_id.to_string())))
        }
        DbType::Postgres => Ok(Arc::new(PgPrimaryReader::new(
            config.primary_db_url.clone(),
            peer_id.to_string(),
        ))),
    }
}

fn start_primary_watcher(
    db_type: DbType,
    config: &Arc<CadenceConfig>,
    peer_id: &str,
    state: Arc<SyncState>,
    storage: Arc<dyn MetadataBackend>,
    broadcaster: Arc<ChangeBroadcaster>,
    tracker: ApplierTracker,
) -> Result<JoinHandle<()>> {
    let poll_interval = Duration::from_millis(config.poll_interval_ms);
    let collections: Vec<String> = config.collections.keys().cloned().collect();
    let scope_columns = config.scope_columns_by_collection();
    let max_failures = config.max_reconnect_attempts;
    let lru_capacity = config.watcher_lru_capacity;

    match db_type {
        DbType::Sqlite => {
            let db_path = DbType::connection_target(&config.primary_db_url).to_string();
            let conn = Arc::new(std::sync::Mutex::new(
                rusqlite::Connection::open(&db_path).context("Failed to open SQLite for watcher")?,
            ));
            let watcher = crate::watcher::sqlite::SqliteWatcher::with_capacity(
                conn,
                collections,
                peer_id.to_string(),
                state,
                scope_columns,
                lru_capacity,
            );
            Ok(tokio::spawn(run_watcher_loop(
                watcher,
                poll_interval,
                storage,
                broadcaster,
                tracker,
                max_failures,
            )))
        }
        DbType::Postgres => {
            let watcher = crate::watcher::pg_poll::PgPollWatcher::with_capacity(
                config.primary_db_url.clone(),
                collections,
                peer_id.to_string(),
                state,
                scope_columns,
                lru_capacity,
            );
            Ok(tokio::spawn(run_watcher_loop(
                watcher,
                poll_interval,
                storage,
                broadcaster,
                tracker,
                max_failures,
            )))
        }
    }
}

async fn run_watcher_loop<W: ChangeWatcher + 'static>(
    mut watcher: W,
    poll_interval: Duration,
    storage: Arc<dyn MetadataBackend>,
    broadcaster: Arc<ChangeBroadcaster>,
    tracker: ApplierTracker,
    max_failures: u32,
) {
    let mut consecutive_failures = 0u32;

    loop {
        tokio::time::sleep(poll_interval).await;

        match watcher.poll_changes().await {
            Ok(output) if !output.changes.is_empty() => {
                consecutive_failures = 0;
                tracing::debug!(
                    "Primary DB watcher detected {} changes (incremental: {})",
                    output.changes.len(),
                    output.is_incremental
                );

                // Re-tag applier-written changes with the origin peer_id and
                // remember which are applier-writes so we can skip logging
                // their non-tombstone form below (applier writes are echoes
                // of what an upstream peer pushed — the upstream peer already
                // logged them, and the row is now in our primary DB so future
                // reconnecting peers will see it via primary-reader catch-up;
                // re-logging here causes write amplification that bloats the
                // change log unboundedly under normal traffic).
                let changes_with_origin: Vec<(RowChange, bool)> = output
                    .changes
                    .into_iter()
                    .map(|mut change| {
                        let origin = tracker.take_origin(&change.collection, &change.document_id);
                        let is_applier_write = origin.is_some();
                        if let Some(origin_peer_id) = origin {
                            if let SyncPayload::Fields(ref mut fields) = change.payload {
                                for fc in fields.iter_mut() {
                                    fc.peer_id = origin_peer_id.clone();
                                }
                            }
                        }
                        (change, is_applier_write)
                    })
                    .collect();

                // Persist incremental changes to change log AND broadcast
                // them to peers. The non-incremental baseline scan is neither
                // persisted nor broadcast — broadcasting a baseline (which can
                // be 100k+ rows on a fresh node) instantly overflows the
                // broadcast channel and leaves every subscriber permanently
                // `Lagged`, silently starving the live-phase send loop. Peers
                // receive baseline state via `send_catchup_batch`'s primary-DB
                // path instead.
                //
                // Skip rule: applier-written non-tombstone changes are
                // already covered by primary-reader catch-up. Tombstones
                // ALWAYS log — primary-reader's `SELECT *` cannot see deleted
                // rows, so the change log is the only place reconnecting
                // peers can learn about them.
                if output.is_incremental {
                    let mut appended = 0usize;
                    let mut skipped_echoes = 0usize;
                    for (change, is_applier_write) in &changes_with_origin {
                        if *is_applier_write && !change.deleted {
                            skipped_echoes += 1;
                            continue;
                        }
                        if let Err(e) = storage.append_change(change).await {
                            tracing::error!("Failed to append change to log: {}", e);
                        } else {
                            appended += 1;
                        }
                    }
                    if skipped_echoes > 0 {
                        tracing::debug!(
                            appended,
                            skipped_echoes,
                            "Watcher: appended local + tombstone changes; skipped applier-echo non-tombstones"
                        );
                    }
                    let changes: Vec<RowChange> =
                        changes_with_origin.into_iter().map(|(c, _)| c).collect();
                    broadcaster.broadcast(changes);
                } else {
                    tracing::info!(
                        count = changes_with_origin.len(),
                        "watcher baseline scan complete; not broadcasting or \
                         persisting to change log (peers catch up via primary DB)"
                    );
                }
            }
            Ok(_) => {
                consecutive_failures = 0;
            }
            Err(e) => {
                consecutive_failures += 1;
                tracing::error!(
                    "Primary DB watcher error ({}x): {}",
                    consecutive_failures,
                    e
                );
                if max_failures > 0 && consecutive_failures >= max_failures {
                    tracing::error!(
                        "Watcher: {} consecutive failures, exiting process",
                        consecutive_failures
                    );
                    std::process::exit(1);
                }
            }
        }
    }
}

fn start_changelog_watcher(storage: Arc<dyn MetadataBackend>, poll_interval_ms: u64) -> JoinHandle<()> {
    let poll_interval = Duration::from_millis(poll_interval_ms);

    tokio::spawn(async move {
        let mut last_known_seq = storage.max_seq().await.unwrap_or(0);

        loop {
            tokio::time::sleep(poll_interval).await;

            match storage.max_seq().await {
                Ok(seq) if seq > last_known_seq => {
                    tracing::debug!(
                        "Change log watcher: seq advanced {}..{}",
                        last_known_seq + 1,
                        seq,
                    );
                    last_known_seq = seq;
                }
                Ok(_) => {}
                Err(e) => {
                    tracing::error!("Change log watcher poll error: {}", e);
                }
            }
        }
    })
}

fn start_applier(
    db_type: DbType,
    config: &Arc<CadenceConfig>,
    storage: Arc<dyn MetadataBackend>,
    tracker: ApplierTracker,
    local_peer_id: String,
) -> JoinHandle<()> {
    let collections: Vec<String> = config.collections.keys().cloned().collect();
    let blacklisted_collections: Vec<String> = config.collections_blacklist.clone();
    let poll_interval = Duration::from_millis(500);

    match db_type {
        DbType::Sqlite => {
            let db_path = DbType::connection_target(&config.primary_db_url);
            crate::applier::sqlite::start_sqlite_applier(
                storage,
                PathBuf::from(db_path),
                collections,
                blacklisted_collections,
                poll_interval,
                tracker,
                config.max_reconnect_attempts,
                config.reconnect_base_delay_ms,
                config.reconnect_max_delay_ms,
                config.query_batch_size,
                local_peer_id,
            )
        }
        DbType::Postgres => crate::applier::pg::start_pg_applier(
            storage,
            config.primary_db_url.clone(),
            collections,
            blacklisted_collections,
            poll_interval,
            tracker,
            config.max_reconnect_attempts,
            config.reconnect_base_delay_ms,
            config.reconnect_max_delay_ms,
            config.query_batch_size,
            local_peer_id,
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn db_type_from_sqlite_url() {
        assert_eq!(DbType::from_url("sqlite:///path/to/db.sqlite"), DbType::Sqlite);
        assert_eq!(DbType::from_url("sqlite://relative.db"), DbType::Sqlite);
    }

    #[test]
    fn db_type_from_postgres_url() {
        assert_eq!(
            DbType::from_url("postgresql://localhost/test"),
            DbType::Postgres
        );
        assert_eq!(DbType::from_url("postgres://localhost/test"), DbType::Postgres);
        assert_eq!(DbType::from_url("localhost:5432/test"), DbType::Postgres);
    }

    #[test]
    fn connection_target_sqlite() {
        assert_eq!(
            DbType::connection_target("sqlite:///path/to/db.sqlite"),
            "/path/to/db.sqlite"
        );
    }

    #[test]
    fn connection_target_postgres() {
        let url = "postgresql://localhost/test";
        assert_eq!(DbType::connection_target(url), url);
    }

    #[test]
    fn builder_scope_rules() {
        let builder = CadenceBuilder::new()
            .primary_db("sqlite://test.db")
            .scope_rule("facility", "organization")
            .scope_rule("created_by", "user");

        assert_eq!(builder.scope_rules.len(), 2);
        assert_eq!(builder.scope_rules.get("facility"), Some(&"organization".to_string()));
        assert_eq!(builder.scope_rules.get("created_by"), Some(&"user".to_string()));
    }

    #[test]
    fn builder_scope_rules_batch() {
        let builder = CadenceBuilder::new()
            .primary_db("sqlite://test.db")
            .scope_rules([
                ("facility", "organization"),
                ("created_by", "user"),
            ]);

        assert_eq!(builder.scope_rules.len(), 2);
    }
}
