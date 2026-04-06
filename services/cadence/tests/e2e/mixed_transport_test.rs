/// E2E tests for mixed transport topology:
///
/// - **Cloud** (K8s): WS-only, no QUIC endpoint — accepts incoming WS connections
/// - **Desktop**: WS + QUIC — connects to cloud via WS, accepts QUIC from mobile
/// - **Mobile**: QUIC-only — connects to desktop via QUIC
///
/// Data propagation chain: `mobile ←QUIC→ desktop ←WS→ cloud`
use cadence::applier::tracker::ApplierTracker;
use cadence::auth::JwtValidator;
use cadence::config::{CadenceConfig, CollectionConfig, ConflictStrategy};
use cadence::peer_status::{PeerTracker, PeerTransport};
use cadence::primary_reader::{PrimaryDbReader, SqlitePrimaryReader};
use cadence::protocol::CADENCE_ALPN;
use cadence::schema::SchemaFingerprint;
use cadence::state::{ChangeBroadcaster, RowChange, SyncState};
use cadence::storage::MetadataBackend;
use cadence::storage::Storage;
use cadence::stream::{WsSyncRead, WsSyncWrite};
use cadence::sync::SyncEngine;
use cadence::token::TokenStore;
use cadence::watcher::ChangeWatcher;
use cadence::ws;
use iroh::{Endpoint, NodeAddr};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::timeout;

const COLLECTION: &str = "test-items";
const WATCHER_POLL_MS: u64 = 50;
const APPLIER_POLL_MS: u64 = 50;
const E2E_SECRET: &[u8] = b"e2e-test-secret";

// ---------------------------------------------------------------------------
// Config & JWT
// ---------------------------------------------------------------------------

fn test_config() -> CadenceConfig {
    let mut collections = BTreeMap::new();
    collections.insert(
        COLLECTION.to_string(),
        CollectionConfig {
            strategy: ConflictStrategy::Lww,
            scope_columns: BTreeMap::from([(
                "organization".to_string(),
                "organization".to_string(),
            )]),
            scope_rules: None,
        },
    );
    CadenceConfig {
        collections,
        poll_interval_ms: WATCHER_POLL_MS,
        keepalive_interval_secs: 1,
        liveness_timeout_secs: 2,
        ..Default::default()
    }
}

fn make_wildcard_jwt() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    jsonwebtoken::encode(
        &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
        &serde_json::json!({
            "sub": "e2e-user",
            "aud": "cadence-sync",
            "exp": now + 3600,
            "scopes": {"organization": ["*"]},
            "read_only": false
        }),
        &jsonwebtoken::EncodingKey::from_secret(E2E_SECRET),
    )
    .unwrap()
}

// ---------------------------------------------------------------------------
// MixedPeer — full-stack peer with optional QUIC endpoint
// ---------------------------------------------------------------------------

struct MixedPeer {
    engine: Arc<SyncEngine>,
    endpoint: Option<Endpoint>,
    storage: Arc<Storage>,
    #[allow(dead_code)]
    broadcaster: Arc<ChangeBroadcaster>,
    jwt: String,
    db_conn: Arc<std::sync::Mutex<rusqlite::Connection>>,
    _watcher_handle: tokio::task::JoinHandle<()>,
    _applier_handle: tokio::task::JoinHandle<()>,
}

impl Drop for MixedPeer {
    fn drop(&mut self) {
        self._watcher_handle.abort();
        self._applier_handle.abort();
    }
}

impl MixedPeer {
    /// Create a peer with QUIC endpoint (desktop/mobile).
    async fn with_quic(name: &str) -> Self {
        Self::new(name, true).await
    }

    /// Create a peer without QUIC endpoint (cloud/K8s).
    async fn ws_only(name: &str) -> Self {
        Self::new(name, false).await
    }

    async fn new(name: &str, quic_enabled: bool) -> Self {
        let config = test_config();
        let jwt = make_wildcard_jwt();

        // Create temp SQLite DB
        let tmp = tempfile::Builder::new()
            .suffix(".db")
            .tempfile()
            .expect("tempfile");
        let path = tmp.path().to_path_buf();
        std::mem::forget(tmp);

        {
            let conn = rusqlite::Connection::open(&path).unwrap();
            conn.execute_batch(
                "PRAGMA journal_mode=WAL;
                 CREATE TABLE IF NOT EXISTS test_items (
                     id TEXT PRIMARY KEY,
                     name TEXT,
                     organization TEXT,
                     created_at TEXT DEFAULT (datetime('now')),
                     updated_at TEXT
                 );",
            )
            .unwrap();
        }

        let db_conn = Arc::new(std::sync::Mutex::new(
            rusqlite::Connection::open(&path).unwrap(),
        ));

        // Optional QUIC endpoint
        let endpoint = if quic_enabled {
            Some(
                Endpoint::builder()
                    .alpns(vec![CADENCE_ALPN.to_vec()])
                    .discovery_local_network()
                    .bind()
                    .await
                    .unwrap(),
            )
        } else {
            None
        };

        let peer_id = if let Some(ref ep) = endpoint {
            ep.node_id().to_string()
        } else {
            format!("ws-only-{}", name)
        };

        let primary_reader = Arc::new(SqlitePrimaryReader::new(
            db_conn.clone(),
            peer_id.clone(),
        )) as Arc<dyn PrimaryDbReader>;

        let storage = Arc::new(Storage::in_memory().unwrap());
        let state = Arc::new(SyncState::new());
        let broadcaster = Arc::new(ChangeBroadcaster::new(256));
        let applier_tracker = ApplierTracker::new();

        let key = jsonwebtoken::DecodingKey::from_secret(E2E_SECRET);
        let validator = Arc::new(JwtValidator::permissive(key));
        let token_store = Arc::new(TokenStore::new(storage.clone(), validator.clone()));

        let (engine, _) = SyncEngine::new(
            Arc::new(config.clone()),
            state.clone(),
            storage.clone(),
            primary_reader,
            validator,
            peer_id.clone(),
            SchemaFingerprint::empty(),
            token_store,
            Arc::new(PeerTracker::new()),
        );
        let engine = Arc::new(engine);

        let collections: Vec<String> = config.collections.keys().cloned().collect();
        let scope_columns = config.all_scope_column_names();

        // Spawn SQLite watcher
        let _watcher_handle = {
            let watcher_broadcaster = broadcaster.clone();
            let watcher_storage = storage.clone();
            let watcher_state = state.clone();
            let watcher_tracker = applier_tracker.clone();
            let poll_interval = Duration::from_millis(WATCHER_POLL_MS);
            let sqlite_conn = {
                let c = rusqlite::Connection::open(&path).unwrap();
                c.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")
                    .unwrap();
                Arc::new(std::sync::Mutex::new(c))
            };
            let mut watcher = cadence::watcher::sqlite::SqliteWatcher::new(
                sqlite_conn,
                collections.clone(),
                peer_id.clone(),
                watcher_state,
                scope_columns,
            );
            tokio::spawn(async move {
                loop {
                    tokio::time::sleep(poll_interval).await;
                    match watcher.poll_changes().await {
                        Ok(output) if !output.changes.is_empty() => {
                            let mut changes = output.changes;
                            for change in &mut changes {
                                if let Some(origin) = watcher_tracker
                                    .take_origin(&change.collection, &change.document_id)
                                {
                                    if let cadence::state::SyncPayload::Fields(ref mut fields) =
                                        change.payload
                                    {
                                        for fc in fields.iter_mut() {
                                            fc.peer_id = origin.clone();
                                        }
                                    }
                                }
                            }
                            if output.is_incremental {
                                for change in &changes {
                                    let _ = watcher_storage.append_change(change).await;
                                }
                            }
                            watcher_broadcaster.broadcast(changes);
                        }
                        Ok(_) => {}
                        Err(e) => {
                            tracing::warn!("Watcher error: {}", e);
                        }
                    }
                }
            })
        };

        // Spawn SQLite applier
        let _applier_handle = cadence::applier::sqlite::start_sqlite_applier(
            storage.clone(),
            path,
            collections,
            Duration::from_millis(APPLIER_POLL_MS),
            applier_tracker,
            10,
            1000,
            60000,
        );

        MixedPeer {
            engine,
            endpoint,
            storage,
            broadcaster,
            jwt,
            db_conn,
            _watcher_handle,
            _applier_handle,
        }
    }

    fn insert_record(&self, id: &str, name: &str, organization: &str) {
        let conn = self.db_conn.lock().unwrap();
        conn.execute(
            "INSERT INTO test_items (id, name, organization, created_at, updated_at) \
             VALUES (?1, ?2, ?3, datetime('now'), NULL)",
            rusqlite::params![id, name, organization],
        )
        .unwrap();
    }

    fn has_record(&self, id: &str) -> bool {
        let conn = self.db_conn.lock().unwrap();
        conn.query_row(
            "SELECT COUNT(*) FROM test_items WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0)
            > 0
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn oneshot_change_rx() -> tokio::sync::broadcast::Receiver<Vec<RowChange>> {
    let (tx, rx) = tokio::sync::broadcast::channel(1);
    drop(tx);
    rx
}

fn node_addr_direct(ep: &Endpoint) -> NodeAddr {
    let (v4, v6) = ep.bound_sockets();
    let mut addrs = BTreeSet::new();
    let v4 = if v4.ip().is_unspecified() {
        std::net::SocketAddr::new(std::net::Ipv4Addr::LOCALHOST.into(), v4.port())
    } else {
        v4
    };
    addrs.insert(v4);
    if let Some(v6) = v6 {
        let v6 = if v6.ip().is_unspecified() {
            std::net::SocketAddr::new(std::net::Ipv6Addr::LOCALHOST.into(), v6.port())
        } else {
            v6
        };
        addrs.insert(v6);
    }
    NodeAddr {
        node_id: ep.node_id(),
        relay_url: None,
        direct_addresses: addrs,
    }
}

/// Start a WS server for a peer. Uses oneshot_change_rx for snapshot-based
/// sync (session ends after initial exchange completes).
async fn start_ws_server(peer: &MixedPeer) -> String {
    let engine = peer.engine.clone();

    let app = axum::Router::new().route(
        "/sync",
        axum::routing::get(move |ws: axum::extract::ws::WebSocketUpgrade| {
            let engine = engine.clone();
            async move {
                ws.on_upgrade(move |socket| async move {
                    let (ws_send, ws_recv) = futures_util::StreamExt::split(socket);
                    let mut send = WsSyncWrite::new(ws_send);
                    let mut recv = WsSyncRead::new(ws_recv);
                    let change_rx = oneshot_change_rx();
                    let _ = engine
                        .handle_incoming_stream(
                            &mut send,
                            &mut recv,
                            change_rx,
                            "ws-incoming",
                            PeerTransport::WebSocket,
                        )
                        .await;
                })
            }
        }),
    );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    format!("ws://127.0.0.1:{}/sync", addr.port())
}

/// One-shot QUIC sync between two peers (both must have endpoints).
async fn sync_quic_once(initiator: &MixedPeer, acceptor: &MixedPeer) {
    let ep_a = initiator.endpoint.as_ref().expect("initiator needs QUIC endpoint");
    let ep_b = acceptor.endpoint.as_ref().expect("acceptor needs QUIC endpoint");

    let addr_b = node_addr_direct(ep_b);
    let engine_b = acceptor.engine.clone();
    let ep_b = ep_b.clone();

    let accept_handle = tokio::spawn(async move {
        let incoming = ep_b.accept().await.expect("accept incoming");
        let conn = incoming.await.expect("await incoming conn");
        engine_b
            .handle_incoming(conn, oneshot_change_rx(), "quic-accept")
            .await
    });

    ep_a.add_node_addr(addr_b.clone()).ok();
    let conn = ep_a
        .connect(addr_b, CADENCE_ALPN)
        .await
        .expect("QUIC connect");
    initiator
        .engine
        .initiate_sync(conn, &initiator.jwt, oneshot_change_rx(), "quic-init")
        .await
        .expect("initiate_sync");

    accept_handle
        .await
        .expect("accept task join")
        .expect("accept task");
}

/// One-shot WS sync: client connects to a WS URL and syncs.
async fn ws_sync_once(client: &MixedPeer, url: &str) {
    let result = timeout(
        Duration::from_secs(10),
        ws::connect_ws_peer(url, &client.engine, &client.jwt, oneshot_change_rx(), "ws-client"),
    )
    .await;
    match &result {
        Ok(Ok(())) => {}
        Ok(Err(e)) => panic!("WS sync error: {}", e),
        Err(_) => panic!("WS sync timed out after 10s connecting to {}", url),
    }
}

/// Poll until `peer.has_record(id)` returns true or timeout elapses.
async fn wait_for_record(peer: &MixedPeer, id: &str, deadline: Duration) -> bool {
    let id = id.to_string();
    timeout(deadline, async {
        loop {
            if peer.has_record(&id) {
                return true;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    })
    .await
    .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Test 1 — 3-way sync: cloud ←WS→ desktop ←QUIC→ mobile
// ---------------------------------------------------------------------------

/// Each peer inserts data, then syncs through the transport chain.
/// All three peers should converge to the same dataset.
///
/// Topology:
///   cloud (WS-only) ←WS→ desktop (WS+QUIC) ←QUIC→ mobile (QUIC-only)
#[tokio::test]
async fn test_mixed_transport_3way_sync() {
    let cloud = MixedPeer::ws_only("cloud").await;
    let desktop = MixedPeer::with_quic("desktop").await;
    let mobile = MixedPeer::with_quic("mobile").await;

    // Each peer inserts its own data
    cloud.insert_record("cloud-rec", "CloudData", "org-1");
    desktop.insert_record("desktop-rec", "DesktopData", "org-1");
    mobile.insert_record("mobile-rec", "MobileData", "org-1");

    // Wait for watchers to detect changes
    tokio::time::sleep(Duration::from_millis(WATCHER_POLL_MS * 4)).await;

    // Cloud exposes WS endpoint
    let cloud_ws_url = start_ws_server(&cloud).await;

    // Phase 1: desktop ←WS→ cloud (bidirectional exchange)
    ws_sync_once(&desktop, &cloud_ws_url).await;

    // Phase 2: mobile ←QUIC→ desktop (bidirectional exchange)
    sync_quic_once(&mobile, &desktop).await;

    // Phase 3: desktop ←WS→ cloud again (propagate mobile's data to cloud)
    ws_sync_once(&desktop, &cloud_ws_url).await;

    // Verify all peers have all records
    // Cloud should have all 3 records in its change log
    let cloud_changes = cloud.storage.query_since(0).await.unwrap();
    let cloud_ids: Vec<&str> = cloud_changes.iter().map(|c| c.document_id.as_str()).collect();
    assert!(cloud_ids.contains(&"desktop-rec"), "Cloud missing desktop-rec");
    assert!(cloud_ids.contains(&"mobile-rec"), "Cloud missing mobile-rec");

    // Desktop should have all 3 records
    let desktop_changes = desktop.storage.query_since(0).await.unwrap();
    let desktop_ids: Vec<&str> = desktop_changes.iter().map(|c| c.document_id.as_str()).collect();
    assert!(desktop_ids.contains(&"cloud-rec"), "Desktop missing cloud-rec");
    assert!(desktop_ids.contains(&"mobile-rec"), "Desktop missing mobile-rec");

    // Mobile should have all 3 records
    let mobile_changes = mobile.storage.query_since(0).await.unwrap();
    let mobile_ids: Vec<&str> = mobile_changes.iter().map(|c| c.document_id.as_str()).collect();
    assert!(mobile_ids.contains(&"cloud-rec"), "Mobile missing cloud-rec");
    assert!(mobile_ids.contains(&"desktop-rec"), "Mobile missing desktop-rec");

    // Verify applier writes records to each peer's primary DB
    assert!(
        wait_for_record(&cloud, "mobile-rec", Duration::from_secs(3)).await,
        "Cloud primary DB should have mobile-rec after applier"
    );
    assert!(
        wait_for_record(&mobile, "cloud-rec", Duration::from_secs(3)).await,
        "Mobile primary DB should have cloud-rec after applier"
    );
}

// ---------------------------------------------------------------------------
// Test 2 — Cloud → mobile propagation (cloud inserts, reaches mobile)
// ---------------------------------------------------------------------------

/// Data flows: cloud → desktop (via WS) → mobile (via QUIC)
#[tokio::test]
async fn test_mixed_transport_cloud_to_mobile_propagation() {
    let cloud = MixedPeer::ws_only("cloud").await;
    let desktop = MixedPeer::with_quic("desktop").await;
    let mobile = MixedPeer::with_quic("mobile").await;

    // Cloud inserts data
    cloud.insert_record("from-cloud", "CloudPatient", "org-1");
    tokio::time::sleep(Duration::from_millis(WATCHER_POLL_MS * 4)).await;

    let cloud_ws_url = start_ws_server(&cloud).await;

    // Desktop pulls from cloud via WS
    ws_sync_once(&desktop, &cloud_ws_url).await;

    // Mobile pulls from desktop via QUIC
    sync_quic_once(&mobile, &desktop).await;

    // Mobile should have cloud's data
    let mobile_changes = mobile.storage.query_since(0).await.unwrap();
    let mobile_ids: Vec<&str> = mobile_changes.iter().map(|c| c.document_id.as_str()).collect();
    assert!(
        mobile_ids.contains(&"from-cloud"),
        "Mobile should receive cloud's data through desktop relay"
    );

    assert!(
        wait_for_record(&mobile, "from-cloud", Duration::from_secs(3)).await,
        "Mobile primary DB should have from-cloud after applier"
    );
}

// ---------------------------------------------------------------------------
// Test 3 — Mobile → cloud propagation (mobile inserts, reaches cloud)
// ---------------------------------------------------------------------------

/// Data flows: mobile → desktop (via QUIC) → cloud (via WS)
#[tokio::test]
async fn test_mixed_transport_mobile_to_cloud_propagation() {
    let cloud = MixedPeer::ws_only("cloud").await;
    let desktop = MixedPeer::with_quic("desktop").await;
    let mobile = MixedPeer::with_quic("mobile").await;

    // Mobile inserts data
    mobile.insert_record("from-mobile", "MobilePatient", "org-1");
    tokio::time::sleep(Duration::from_millis(WATCHER_POLL_MS * 4)).await;

    let cloud_ws_url = start_ws_server(&cloud).await;

    // Desktop pulls from mobile via QUIC
    sync_quic_once(&desktop, &mobile).await;

    // Desktop pushes to cloud via WS
    ws_sync_once(&desktop, &cloud_ws_url).await;

    // Cloud should have mobile's data
    let cloud_changes = cloud.storage.query_since(0).await.unwrap();
    let cloud_ids: Vec<&str> = cloud_changes.iter().map(|c| c.document_id.as_str()).collect();
    assert!(
        cloud_ids.contains(&"from-mobile"),
        "Cloud should receive mobile's data through desktop relay"
    );

    assert!(
        wait_for_record(&cloud, "from-mobile", Duration::from_secs(3)).await,
        "Cloud primary DB should have from-mobile after applier"
    );
}
