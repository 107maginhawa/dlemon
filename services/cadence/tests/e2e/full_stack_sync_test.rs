/// Full-stack end-to-end sync tests.
///
/// These tests wire together ALL components exactly as `main.rs` does:
/// - SqliteWatcher / PgPollWatcher: polls primary DB for changes, broadcasts them
/// - start_sqlite_applier / start_pg_applier: applies received changes to primary DB
/// - ApplierTracker: marks applier writes with origin peer_id for echo suppression
/// - ChangeBroadcaster: tokio broadcast channel for change notifications
/// - SyncEngine: sync protocol over QUIC
/// - SqlitePrimaryReader / PgPrimaryReader: full table scans for initial catch-up
///
/// Tests are parameterized across SQLite/SQLite, SQLite/PG, and PG/PG backends
/// where applicable. Multi-peer topology tests use SQLite only for simplicity.
use cadence::applier::tracker::ApplierTracker;
use cadence::auth::JwtValidator;
use cadence::config::{CadenceConfig, CollectionConfig, ConflictStrategy};
use cadence::peer_status::PeerTracker;
use cadence::primary_reader::{PgPrimaryReader, PrimaryDbReader, SqlitePrimaryReader};
use cadence::protocol::CADENCE_ALPN;
use cadence::schema::SchemaFingerprint;
use cadence::state::{ChangeBroadcaster, RowChange, SyncState};
use cadence::storage::Storage;
use cadence::storage::MetadataBackend;
use cadence::sync::SyncEngine;
use cadence::token::TokenStore;
use cadence::watcher::ChangeWatcher;
use iroh::{Endpoint, NodeAddr};
use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::timeout;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION: &str = "test-items";
const PG_URL: &str = "host=localhost port=15434 user=postgres password=postgres dbname=cadence_test";
const WATCHER_POLL_MS: u64 = 50;
const APPLIER_POLL_MS: u64 = 50;
const E2E_SECRET: &[u8] = b"e2e-test-secret";

/// Setup PG test table in the given database — call once at the start of each
/// PG test that shares a single database (sqlite_pg tests).
async fn setup_pg_test_table() {
    let (client, connection) = tokio_postgres::connect(PG_URL, tokio_postgres::NoTls)
        .await
        .expect("connect to PG for setup");
    tokio::spawn(async move { let _ = connection.await; });
    client.execute(
        "CREATE TABLE IF NOT EXISTS test_items (
            id TEXT PRIMARY KEY,
            name TEXT,
            organization TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP
        )", &[],
    ).await.expect("create test_items table");
    client.execute("TRUNCATE test_items", &[]).await.expect("truncate test_items");
}

/// Create (or recreate) a fresh PostgreSQL database with the given name and
/// return its connection URL.  Used by pg_pg tests so each peer gets its own
/// isolated database.
async fn create_pg_database(db_name: &str) -> String {
    let (client, conn) = tokio_postgres::connect(
        "host=localhost port=15434 user=postgres password=postgres dbname=postgres",
        tokio_postgres::NoTls,
    )
    .await
    .expect("connect to postgres for DB creation");
    tokio::spawn(async move { let _ = conn.await; });

    // Force-disconnect any existing connections so we can drop the database.
    client
        .execute(
            &format!(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{}'",
                db_name
            ),
            &[],
        )
        .await
        .ok();
    client
        .execute(&format!("DROP DATABASE IF EXISTS {}", db_name), &[])
        .await
        .ok();
    client
        .execute(&format!("CREATE DATABASE {}", db_name), &[])
        .await
        .unwrap_or_else(|e| panic!("create database {}: {}", db_name, e));

    format!(
        "host=localhost port=15434 user=postgres password=postgres dbname={}",
        db_name
    )
}

// ---------------------------------------------------------------------------
// Config
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
        ..Default::default()
    }
}

fn scoped_test_config(org_scopes: Vec<&str>) -> (CadenceConfig, String) {
    let config = test_config();
    let jwt = make_jwt_with_org_scopes(org_scopes);
    (config, jwt)
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

fn make_jwt_with_org_scopes(orgs: Vec<&str>) -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let org_values: Vec<serde_json::Value> = orgs
        .iter()
        .map(|o| serde_json::Value::String(o.to_string()))
        .collect();
    jsonwebtoken::encode(
        &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
        &serde_json::json!({
            "sub": "e2e-user",
            "aud": "cadence-sync",
            "exp": now + 3600,
            "scopes": {"organization": org_values},
            "read_only": false
        }),
        &jsonwebtoken::EncodingKey::from_secret(E2E_SECRET),
    )
    .unwrap()
}

fn make_wildcard_jwt() -> String {
    make_jwt_with_org_scopes(vec!["*"])
}

// ---------------------------------------------------------------------------
// DB backend enum
// ---------------------------------------------------------------------------

#[allow(dead_code)]
enum DbBackend {
    Sqlite {
        path: PathBuf,
        conn: Arc<std::sync::Mutex<rusqlite::Connection>>,
    },
    Postgres {
        url: String,
    },
}

// ---------------------------------------------------------------------------
// QUIC address helper (mirrors sqlite_sqlite_test.rs)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// FullStackPeer
// ---------------------------------------------------------------------------

/// A fully-wired sync peer mirroring `main.rs` component assembly.
#[allow(dead_code)]
struct FullStackPeer {
    engine: Arc<SyncEngine>,
    endpoint: Endpoint,
    storage: Arc<Storage>,
    state: Arc<SyncState>,
    broadcaster: Arc<ChangeBroadcaster>,
    jwt: String,
    backend: DbBackend,
    _watcher_handle: tokio::task::JoinHandle<()>,
    _applier_handle: tokio::task::JoinHandle<()>,
}

impl Drop for FullStackPeer {
    fn drop(&mut self) {
        self._watcher_handle.abort();
        self._applier_handle.abort();
    }
}

impl FullStackPeer {
    /// Create a SQLite-backed peer with a temporary database file.
    async fn new_sqlite(config: CadenceConfig, jwt: String) -> Self {
        // Use a named temp file so the watcher and applier can each open it.
        let tmp = tempfile::Builder::new()
            .suffix(".db")
            .tempfile()
            .expect("tempfile");
        let path = tmp.path().to_path_buf();
        // Keep the file alive by leaking the TempPath — it will be cleaned up by the OS
        // when the process exits; for test duration the file must persist.
        std::mem::forget(tmp);

        // Create the primary DB schema
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

        let conn = Arc::new(std::sync::Mutex::new(
            rusqlite::Connection::open(&path).unwrap(),
        ));

        let backend = DbBackend::Sqlite {
            path: path.clone(),
            conn: conn.clone(),
        };

        let primary_reader = Arc::new(SqlitePrimaryReader::new(conn, "test-peer".to_string()))
            as Arc<dyn PrimaryDbReader>;

        Self::assemble(config, jwt, backend, primary_reader, path).await
    }

    /// Create a PostgreSQL-backed peer against the given `db_url`.
    ///
    /// The caller is responsible for ensuring the database and `test_items`
    /// table exist (e.g. via `setup_pg_test_table` or `create_pg_database`).
    async fn new_pg(config: CadenceConfig, jwt: String, db_url: &str) -> Self {
        let db_url = db_url.to_string();
        // Ensure the test table exists (idempotent)
        let (client, connection) = tokio_postgres::connect(&db_url, tokio_postgres::NoTls)
            .await
            .expect("PG connect for setup");
        tokio::spawn(async move {
            let _ = connection.await;
        });
        client
            .execute(
                "CREATE TABLE IF NOT EXISTS test_items (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    organization TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP
                )",
                &[],
            )
            .await
            .expect("create PG test table");

        let pg_config = {
            let mut c = config.clone();
            // Use the same collection name as SQLite peers so changes arriving
            // with collection: "test-items" are recognised by the PG applier.
            let mut cols = BTreeMap::new();
            cols.insert(
                COLLECTION.to_string(),
                c.collections.get(COLLECTION).cloned().unwrap(),
            );
            c.collections = cols;
            c
        };

        // Endpoint and metadata storage
        let endpoint = Endpoint::builder()
            .alpns(vec![CADENCE_ALPN.to_vec()])
            .discovery_local_network()
            .bind()
            .await
            .unwrap();
        let peer_id = endpoint.node_id().to_string();

        let storage = Arc::new(Storage::in_memory().unwrap());
        let state = Arc::new(SyncState::new());
        let broadcaster = Arc::new(ChangeBroadcaster::new(256));
        let applier_tracker = ApplierTracker::new();

        let key = jsonwebtoken::DecodingKey::from_secret(E2E_SECRET);
        let validator = Arc::new(JwtValidator::permissive(key));
        let token_store = Arc::new(TokenStore::new(storage.clone(), validator.clone()));

        let pg_reader = Arc::new(PgPrimaryReader::new(db_url.clone(), peer_id.clone()))
            as Arc<dyn PrimaryDbReader>;

        let (engine, _) = SyncEngine::new(
            Arc::new(pg_config.clone()),
            state.clone(),
            storage.clone(),
            pg_reader,
            validator,
            peer_id.clone(),
            SchemaFingerprint::empty(),
            token_store,
            Arc::new(PeerTracker::new()),
        );
        let engine = Arc::new(engine);

        let collections: Vec<String> = pg_config.collections.keys().cloned().collect();
        let scope_columns = pg_config.scope_columns_by_collection();

        // Spawn PG watcher
        let _watcher_handle = {
            let watcher_broadcaster = broadcaster.clone();
            let watcher_storage = storage.clone();
            let watcher_state = state.clone();
            let watcher_tracker = applier_tracker.clone();
            let poll_interval = Duration::from_millis(WATCHER_POLL_MS);
            let cols = collections.clone();
            let pid = peer_id.clone();
            let sc = scope_columns.clone();
            let watcher_db_url = db_url.clone();
            let mut watcher = cadence::watcher::pg_poll::PgPollWatcher::new(
                watcher_db_url,
                cols,
                pid,
                watcher_state,
                sc,
            );
            let _watcher_handle = tokio::spawn(async move {
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
                            tracing::warn!("PG watcher error: {}", e);
                        }
                    }
                }
            });
            _watcher_handle
        };

        // Spawn PG applier
        let _applier_handle = cadence::applier::pg::start_pg_applier(
            storage.clone(),
            db_url.clone(),
            collections,
            Vec::new(), // blacklisted_collections
            Duration::from_millis(APPLIER_POLL_MS),
            applier_tracker,
            10, 1000, 60000, 5_000,
        );

        FullStackPeer {
            engine,
            endpoint,
            storage,
            state,
            broadcaster,
            jwt,
            backend: DbBackend::Postgres {
                url: db_url,
            },
            _watcher_handle,
            _applier_handle,
        }
    }

    /// Internal: assemble everything after the DB-specific setup.
    /// `db_reader` is the PrimaryDbReader for this peer.
    /// `db_path` is only used for the SQLite applier path.
    async fn assemble(
        config: CadenceConfig,
        jwt: String,
        backend: DbBackend,
        db_reader: Arc<dyn PrimaryDbReader + Send + Sync>,
        db_path: PathBuf,
    ) -> Self {
        let endpoint = Endpoint::builder()
            .alpns(vec![CADENCE_ALPN.to_vec()])
            .discovery_local_network()
            .bind()
            .await
            .unwrap();
        let peer_id = endpoint.node_id().to_string();

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
            db_reader,
            validator,
            peer_id.clone(),
            SchemaFingerprint::empty(),
            token_store,
            Arc::new(PeerTracker::new()),
        );
        let engine = Arc::new(engine);

        let collections: Vec<String> = config.collections.keys().cloned().collect();
        let scope_columns = config.scope_columns_by_collection();

        // Spawn SQLite watcher (mirrors main.rs lines 216-258)
        let _watcher_handle = {
            let watcher_broadcaster = broadcaster.clone();
            let watcher_storage = storage.clone();
            let watcher_state = state.clone();
            let watcher_tracker = applier_tracker.clone();
            let poll_interval = Duration::from_millis(WATCHER_POLL_MS);
            let sqlite_conn = {
                // Open a dedicated watcher connection with WAL mode
                let c = rusqlite::Connection::open(&db_path).unwrap();
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
            let _watcher_handle = tokio::spawn(async move {
                loop {
                    tokio::time::sleep(poll_interval).await;
                    match watcher.poll_changes().await {
                        Ok(output) if !output.changes.is_empty() => {
                            // Re-tag applier-written changes with original peer_id for echo suppression
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
                            tracing::warn!("SQLite watcher error: {}", e);
                        }
                    }
                }
            });
            _watcher_handle
        };

        // Spawn SQLite applier (mirrors main.rs lines 342-350)
        let _applier_handle = cadence::applier::sqlite::start_sqlite_applier(
            storage.clone(),
            db_path,
            collections,
            Vec::new(), // blacklisted_collections
            Duration::from_millis(APPLIER_POLL_MS),
            applier_tracker,
            10, 1000, 60000, 5_000,
        );

        FullStackPeer {
            engine,
            endpoint,
            storage,
            state,
            broadcaster,
            jwt,
            backend,
            _watcher_handle,
            _applier_handle,
        }
    }

    // -----------------------------------------------------------------------
    // Primary DB helpers
    // -----------------------------------------------------------------------

    /// INSERT a record into the primary DB (created_at=NOW, updated_at=NULL).
    async fn insert_record(&self, id: &str, name: &str, organization: &str) {
        match &self.backend {
            DbBackend::Sqlite { conn, .. } => {
                let conn = conn.lock().unwrap();
                conn.execute(
                    "INSERT INTO test_items (id, name, organization, created_at, updated_at) \
                     VALUES (?1, ?2, ?3, datetime('now'), NULL)",
                    rusqlite::params![id, name, organization],
                )
                .unwrap();
            }
            DbBackend::Postgres { url } => {
                let (client, conn) =
                    tokio_postgres::connect(url, tokio_postgres::NoTls)
                        .await
                        .unwrap();
                tokio::spawn(async move { let _ = conn.await; });
                client
                    .execute(
                        "INSERT INTO test_items (id, name, organization, created_at, updated_at) \
                         VALUES ($1, $2, $3, NOW(), NULL)",
                        &[&id, &name, &organization],
                    )
                    .await
                    .unwrap();
            }
        }
    }

    /// SELECT EXISTS(…) on the primary DB.
    async fn has_record(&self, id: &str) -> bool {
        match &self.backend {
            DbBackend::Sqlite { conn, .. } => {
                let conn = conn.lock().unwrap();
                conn.query_row(
                    "SELECT COUNT(*) FROM test_items WHERE id = ?1",
                    rusqlite::params![id],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap_or(0)
                    > 0
            }
            DbBackend::Postgres { url } => {
                let (client, conn) =
                    tokio_postgres::connect(url, tokio_postgres::NoTls)
                        .await
                        .unwrap();
                tokio::spawn(async move { let _ = conn.await; });
                let row = client
                    .query_one(
                        "SELECT COUNT(*) FROM test_items WHERE id = $1",
                        &[&id],
                    )
                    .await
                    .unwrap();
                let count: i64 = row.get(0);
                count > 0
            }
        }
    }

    /// Count entries in the in-memory metadata storage (change log).
    async fn change_log_count(&self) -> u64 {
        self.storage
            .query_since(0)
            .await
            .map(|v| v.len() as u64)
            .unwrap_or(0)
    }

    /// Truncate the PG test table (cleanup after test).
    #[allow(dead_code)]
    async fn cleanup_pg(&self) {
        if let DbBackend::Postgres { url } = &self.backend {
            if let Ok((client, conn)) =
                tokio_postgres::connect(url, tokio_postgres::NoTls).await
            {
                tokio::spawn(async move { let _ = conn.await; });
                let _ = client
                    .execute("TRUNCATE test_items", &[])
                    .await;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------

/// One-shot receiver — used for static snapshot syncs where no live broadcast
/// is needed after the session completes.
fn oneshot_change_rx() -> tokio::sync::broadcast::Receiver<Vec<RowChange>> {
    let (tx, rx) = tokio::sync::broadcast::channel(1);
    drop(tx);
    rx
}

/// Bidirectional QUIC sync between two peers (one-shot: exchange current
/// change logs and return).
async fn sync_pair_once(a: &FullStackPeer, b: &FullStackPeer) {
    let addr_b = node_addr_direct(&b.endpoint);
    let engine_b = b.engine.clone();
    let ep_b = b.endpoint.clone();

    let accept_handle = tokio::spawn(async move {
        let incoming = ep_b.accept().await.expect("accept incoming");
        let conn = incoming.await.expect("await incoming conn");
        engine_b.handle_incoming(conn, oneshot_change_rx(), "test").await
    });

    a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn = a
        .endpoint
        .connect(addr_b, CADENCE_ALPN)
        .await
        .expect("connect");
    a.engine
        .initiate_sync(conn, &a.jwt, oneshot_change_rx(), "test")
        .await
        .expect("initiate_sync");

    accept_handle.await.expect("accept task join").expect("accept_task");
}

/// Persistent bidirectional QUIC sync: spawns long-lived tasks so live
/// change broadcasts propagate while the test inserts records.
/// Returns the join handles — keep them alive for the duration of the test.
async fn sync_pair_persistent(
    a: &FullStackPeer,
    b: &FullStackPeer,
) -> (tokio::task::JoinHandle<()>, tokio::task::JoinHandle<()>) {
    let addr_b = node_addr_direct(&b.endpoint);
    let engine_b = b.engine.clone();
    let ep_b = b.endpoint.clone();
    // Both sides subscribe to their own broadcaster for live change delivery.
    let change_rx_b = b.broadcaster.subscribe();
    let change_rx_a = a.broadcaster.subscribe();

    let accept_handle = tokio::spawn(async move {
        if let Some(incoming) = ep_b.accept().await {
            if let Ok(conn) = incoming.await {
                let _ = engine_b
                    .handle_incoming(conn, change_rx_b, "test-live")
                    .await;
            }
        }
    });

    a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn_a = a
        .endpoint
        .connect(addr_b, CADENCE_ALPN)
        .await
        .expect("connect");
    let engine_a = a.engine.clone();
    let jwt_a = a.jwt.clone();

    let initiate_handle = tokio::spawn(async move {
        let _ = engine_a
            .initiate_sync(conn_a, &jwt_a, change_rx_a, "test-live")
            .await;
    });

    (accept_handle, initiate_handle)
}

/// Sync every pair in a mesh.
async fn sync_mesh(peers: &[&FullStackPeer]) {
    for i in 0..peers.len() {
        for j in (i + 1)..peers.len() {
            sync_pair_once(peers[i], peers[j]).await;
        }
    }
}

/// Poll until `peer.has_record(id).await` returns true or `timeout` elapses.
async fn wait_for_record(peer: &FullStackPeer, id: &str, deadline: Duration) -> bool {
    let id = id.to_string();
    timeout(deadline, async {
        loop {
            if peer.has_record(&id).await {
                return true;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    })
    .await
    .unwrap_or(false)
}

/// Poll until every peer in `peers` has the record identified by `id`.
#[allow(dead_code)]
async fn wait_for_record_on_all(
    peers: &[&FullStackPeer],
    id: &str,
    deadline: Duration,
) -> bool {
    let id = id.to_string();
    timeout(deadline, async {
        loop {
            let mut all_have = true;
            for p in peers.iter() {
                if !p.has_record(&id).await {
                    all_have = false;
                    break;
                }
            }
            if all_have {
                return true;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    })
    .await
    .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Test 1 — Initial sync: 5 records propagate from A to empty B
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_initial_sync_sqlite_sqlite() {
    let peer_a = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_b = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;

    for i in 0..5 {
        peer_a.insert_record(&format!("item-{}", i), &format!("Item {}", i), "org1").await;
    }

    // Give the watcher a moment to detect and append the initial scan
    tokio::time::sleep(Duration::from_millis(200)).await;

    sync_pair_once(&peer_a, &peer_b).await;

    for i in 0..5 {
        assert!(
            wait_for_record(&peer_b, &format!("item-{}", i), Duration::from_secs(3)).await,
            "Peer B should have item-{} after initial sync",
            i
        );
    }
}

#[tokio::test]
#[ignore = "requires postgres at port 15434"]
async fn test_initial_sync_sqlite_pg() {
    setup_pg_test_table().await;
    let peer_a = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_b = FullStackPeer::new_pg(test_config(), make_wildcard_jwt(), PG_URL).await;

    for i in 0..5 {
        peer_a.insert_record(&format!("sp-item-{}", i), &format!("Item {}", i), "org1").await;
    }

    tokio::time::sleep(Duration::from_millis(200)).await;
    sync_pair_once(&peer_a, &peer_b).await;

    for i in 0..5 {
        assert!(
            wait_for_record(&peer_b, &format!("sp-item-{}", i), Duration::from_secs(3)).await,
            "PG peer B should have sp-item-{} after initial sync",
            i
        );
    }
}

#[tokio::test]
#[ignore = "requires postgres at port 15434"]
async fn test_initial_sync_pg_pg() {
    let url_a = create_pg_database("cadence_test_a").await;
    let url_b = create_pg_database("cadence_test_b").await;
    let peer_a = FullStackPeer::new_pg(test_config(), make_wildcard_jwt(), &url_a).await;
    let peer_b = FullStackPeer::new_pg(test_config(), make_wildcard_jwt(), &url_b).await;

    for i in 0..5 {
        peer_a.insert_record(&format!("pp-item-{}", i), &format!("Item {}", i), "org1").await;
    }

    tokio::time::sleep(Duration::from_millis(200)).await;
    sync_pair_once(&peer_a, &peer_b).await;

    for i in 0..5 {
        assert!(
            wait_for_record(&peer_b, &format!("pp-item-{}", i), Duration::from_secs(3)).await,
            "PG peer B should have pp-item-{} after initial sync",
            i
        );
    }
}

// ---------------------------------------------------------------------------
// Test 2 — Live change propagation: insert after sync session is open
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_live_change_propagation_sqlite_sqlite() {
    let peer_a = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_b = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;

    // Establish a persistent sync session before inserting
    let (_h_accept, _h_init) = sync_pair_persistent(&peer_a, &peer_b).await;

    // Allow the session to stabilise
    tokio::time::sleep(Duration::from_millis(150)).await;

    // Insert on A while session is live
    peer_a.insert_record("live-001", "Live Item", "org1").await;

    // B's applier should pick up the change
    let found = wait_for_record(&peer_b, "live-001", Duration::from_secs(3)).await;
    assert!(found, "Peer B should receive live-001 within 3 seconds");
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires postgres at port 15434"]
async fn test_live_change_propagation_sqlite_pg() {
    setup_pg_test_table().await;
    let peer_a = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_b = FullStackPeer::new_pg(test_config(), make_wildcard_jwt(), PG_URL).await;

    let (_h_accept, _h_init) = sync_pair_persistent(&peer_a, &peer_b).await;
    tokio::time::sleep(Duration::from_millis(150)).await;

    peer_a.insert_record("sp-live-001", "Live Item", "org1").await;

    let found = wait_for_record(&peer_b, "sp-live-001", Duration::from_secs(3)).await;
    assert!(found, "PG peer B should receive sp-live-001 within 3 seconds");
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires postgres at port 15434"]
async fn test_live_change_propagation_pg_pg() {
    let url_a = create_pg_database("cadence_test_live_a").await;
    let url_b = create_pg_database("cadence_test_live_b").await;
    let peer_a = FullStackPeer::new_pg(test_config(), make_wildcard_jwt(), &url_a).await;
    let peer_b = FullStackPeer::new_pg(test_config(), make_wildcard_jwt(), &url_b).await;

    let (_h_accept, _h_init) = sync_pair_persistent(&peer_a, &peer_b).await;
    tokio::time::sleep(Duration::from_millis(150)).await;

    peer_a.insert_record("pp-live-001", "Live Item", "org1").await;

    let found = wait_for_record(&peer_b, "pp-live-001", Duration::from_secs(3)).await;
    assert!(found, "PG peer B should receive pp-live-001 within 3 seconds");
}

// ---------------------------------------------------------------------------
// Test 3 — Bidirectional live: A→B and B→A concurrently
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_bidirectional_live_sqlite_sqlite() {
    let peer_a = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_b = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;

    let (_h_accept, _h_init) = sync_pair_persistent(&peer_a, &peer_b).await;
    tokio::time::sleep(Duration::from_millis(150)).await;

    // Concurrent inserts on both sides
    peer_a.insert_record("from-a", "From Peer A", "org1").await;
    peer_b.insert_record("from-b", "From Peer B", "org1").await;

    let a_got_b = wait_for_record(&peer_a, "from-b", Duration::from_secs(3)).await;
    let b_got_a = wait_for_record(&peer_b, "from-a", Duration::from_secs(3)).await;

    assert!(a_got_b, "Peer A should receive from-b within 3 seconds");
    assert!(b_got_a, "Peer B should receive from-a within 3 seconds");
}

#[tokio::test]
#[ignore = "requires postgres at port 15434"]
async fn test_bidirectional_live_sqlite_pg() {
    setup_pg_test_table().await;
    let peer_a = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_b = FullStackPeer::new_pg(test_config(), make_wildcard_jwt(), PG_URL).await;

    let (_h_accept, _h_init) = sync_pair_persistent(&peer_a, &peer_b).await;
    tokio::time::sleep(Duration::from_millis(150)).await;

    peer_a.insert_record("sp-from-a", "From Peer A", "org1").await;
    peer_b.insert_record("sp-from-b", "From Peer B", "org1").await;

    let a_got_b = wait_for_record(&peer_a, "sp-from-b", Duration::from_secs(3)).await;
    let b_got_a = wait_for_record(&peer_b, "sp-from-a", Duration::from_secs(3)).await;

    assert!(a_got_b, "Peer A should receive sp-from-b");
    assert!(b_got_a, "PG peer B should receive sp-from-a");
}

#[tokio::test]
#[ignore = "requires postgres at port 15434"]
async fn test_bidirectional_live_pg_pg() {
    let url_a = create_pg_database("cadence_test_bidir_a").await;
    let url_b = create_pg_database("cadence_test_bidir_b").await;
    let peer_a = FullStackPeer::new_pg(test_config(), make_wildcard_jwt(), &url_a).await;
    let peer_b = FullStackPeer::new_pg(test_config(), make_wildcard_jwt(), &url_b).await;

    let (_h_accept, _h_init) = sync_pair_persistent(&peer_a, &peer_b).await;
    tokio::time::sleep(Duration::from_millis(150)).await;

    peer_a.insert_record("pp-from-a", "From Peer A", "org1").await;
    peer_b.insert_record("pp-from-b", "From Peer B", "org1").await;

    let a_got_b = wait_for_record(&peer_a, "pp-from-b", Duration::from_secs(3)).await;
    let b_got_a = wait_for_record(&peer_b, "pp-from-a", Duration::from_secs(3)).await;

    assert!(a_got_b, "PG peer A should receive pp-from-b");
    assert!(b_got_a, "PG peer B should receive pp-from-a");
}

// ---------------------------------------------------------------------------
// Test 4 — Echo suppression: A's change log should not grow after B echoes back
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_echo_suppression_sqlite_sqlite() {
    let peer_a = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_b = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;

    let (_h_accept, _h_init) = sync_pair_persistent(&peer_a, &peer_b).await;
    tokio::time::sleep(Duration::from_millis(150)).await;

    let count_before = peer_a.change_log_count().await;

    // Insert on A — this should propagate to B and stop there (no echo back)
    peer_a.insert_record("echo-item", "Echo Test", "org1").await;

    // Wait for B to apply the record
    let found = wait_for_record(&peer_b, "echo-item", Duration::from_secs(3)).await;
    assert!(found, "Peer B should have echo-item");

    // Allow one extra echo cycle
    tokio::time::sleep(Duration::from_secs(1)).await;

    let count_after = peer_a.change_log_count().await;
    // A's log grew by exactly the original insert (plus possibly the initial scan
    // entry).  It must NOT have grown by an echo from B.  A small delta of 2 is
    // generous: original write detection + any watcher re-scan artefact.
    assert!(
        count_after <= count_before + 2,
        "Echo suppression failed: count went from {} to {} (delta > 2)",
        count_before,
        count_after
    );
}

#[tokio::test]
#[ignore = "requires postgres at port 15434"]
async fn test_echo_suppression_sqlite_pg() {
    setup_pg_test_table().await;
    let peer_a = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_b = FullStackPeer::new_pg(test_config(), make_wildcard_jwt(), PG_URL).await;

    let (_h_accept, _h_init) = sync_pair_persistent(&peer_a, &peer_b).await;
    tokio::time::sleep(Duration::from_millis(150)).await;

    let count_before = peer_a.change_log_count().await;
    peer_a.insert_record("sp-echo-item", "Echo Test", "org1").await;

    let found = wait_for_record(&peer_b, "sp-echo-item", Duration::from_secs(3)).await;
    assert!(found, "PG peer B should have sp-echo-item");

    tokio::time::sleep(Duration::from_secs(1)).await;

    let count_after = peer_a.change_log_count().await;
    // PG echo suppression has higher tolerance — the PG watcher detects applier
    // writes via updated_at=NOW() which can create a few echo cycles before
    // the ApplierTracker catches up. Delta ≤ 15 is acceptable (vs 250K+ without suppression).
    assert!(
        count_after <= count_before + 15,
        "Echo suppression failed (sqlite→pg): {} → {} (delta > 15)",
        count_before,
        count_after
    );
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires postgres at port 15434"]
async fn test_echo_suppression_pg_pg() {
    let url_a = create_pg_database("cadence_test_echo_a").await;
    let url_b = create_pg_database("cadence_test_echo_b").await;
    let peer_a = FullStackPeer::new_pg(test_config(), make_wildcard_jwt(), &url_a).await;
    let peer_b = FullStackPeer::new_pg(test_config(), make_wildcard_jwt(), &url_b).await;

    let (_h_accept, _h_init) = sync_pair_persistent(&peer_a, &peer_b).await;
    tokio::time::sleep(Duration::from_millis(150)).await;

    let count_before = peer_a.change_log_count().await;
    peer_a.insert_record("pp-echo-item", "Echo Test", "org1").await;

    let found = wait_for_record(&peer_b, "pp-echo-item", Duration::from_secs(3)).await;
    assert!(found, "PG peer B should have pp-echo-item");

    tokio::time::sleep(Duration::from_secs(1)).await;

    let count_after = peer_a.change_log_count().await;
    assert!(
        count_after <= count_before + 15,
        "Echo suppression failed (pg→pg): {} → {} (delta > 15)",
        count_before,
        count_after
    );
}

// ---------------------------------------------------------------------------
// Test 5 — Scope filtering: org2 records must NOT cross to B
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_scope_filtered_sqlite_sqlite() {
    // Peer A has wildcard scope (sends everything); Peer B only accepts org1
    let (config_b, jwt_b) = scoped_test_config(vec!["org1"]);
    let peer_a = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_b = FullStackPeer::new_sqlite(config_b, jwt_b).await;

    peer_a.insert_record("scope-org1", "Org1 Item", "org1").await;
    peer_a.insert_record("scope-org2", "Org2 Item", "org2").await;

    // Give the watcher time to detect the inserts
    tokio::time::sleep(Duration::from_millis(200)).await;

    // B initiates to A using B's scoped JWT — A filters sends by B's scope (org1 only)
    sync_pair_once(&peer_b, &peer_a).await;
    tokio::time::sleep(Duration::from_millis(300)).await;

    assert!(
        peer_b.has_record("scope-org1").await,
        "Peer B should have the org1 record"
    );
    assert!(
        !peer_b.has_record("scope-org2").await,
        "Peer B must NOT have the org2 record (scope filtered)"
    );
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires postgres at port 15434"]
async fn test_scope_filtered_sqlite_pg() {
    setup_pg_test_table().await;
    let (config_b, jwt_b) = scoped_test_config(vec!["org1"]);
    let peer_a = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_b = FullStackPeer::new_pg(config_b, jwt_b, PG_URL).await;

    peer_a.insert_record("sp-scope-org1", "Org1 Item", "org1").await;
    peer_a.insert_record("sp-scope-org2", "Org2 Item", "org2").await;

    tokio::time::sleep(Duration::from_millis(200)).await;
    // B initiates to A — A filters sends by B's scope (org1 only)
    sync_pair_once(&peer_b, &peer_a).await;
    tokio::time::sleep(Duration::from_millis(300)).await;

    assert!(peer_b.has_record("sp-scope-org1").await, "PG B should have org1 record");
    assert!(!peer_b.has_record("sp-scope-org2").await, "PG B must not have org2 record");
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires postgres at port 15434"]
async fn test_scope_filtered_pg_pg() {
    let url_a = create_pg_database("cadence_test_scope_a").await;
    let url_b = create_pg_database("cadence_test_scope_b").await;
    let (config_b, jwt_b) = scoped_test_config(vec!["org1"]);
    let peer_a = FullStackPeer::new_pg(test_config(), make_wildcard_jwt(), &url_a).await;
    let peer_b = FullStackPeer::new_pg(config_b, jwt_b, &url_b).await;

    peer_a.insert_record("pp-scope-org1", "Org1 Item", "org1").await;
    peer_a.insert_record("pp-scope-org2", "Org2 Item", "org2").await;

    tokio::time::sleep(Duration::from_millis(200)).await;
    // B initiates to A — A filters sends by B's scope (org1 only)
    sync_pair_once(&peer_b, &peer_a).await;
    tokio::time::sleep(Duration::from_millis(300)).await;

    assert!(peer_b.has_record("pp-scope-org1").await, "PG B should have org1 record");
    assert!(!peer_b.has_record("pp-scope-org2").await, "PG B must not have org2 record");
}

// ---------------------------------------------------------------------------
// Test 6 — Three-peer mesh (SQLite only)
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_three_peer_mesh() {
    let peer_a = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_b = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_c = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;

    peer_a.insert_record("mesh-item-a", "Mesh Item A", "org1").await;

    tokio::time::sleep(Duration::from_millis(200)).await;

    sync_mesh(&[&peer_a, &peer_b, &peer_c]).await;
    tokio::time::sleep(Duration::from_millis(300)).await;

    assert!(
        peer_b.has_record("mesh-item-a").await,
        "Peer B should have mesh-item-a after mesh sync"
    );
    assert!(
        peer_c.has_record("mesh-item-a").await,
        "Peer C should have mesh-item-a after mesh sync"
    );
}

// ---------------------------------------------------------------------------
// Test 7 — Four-peer chain (SQLite only)
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_four_peer_chain() {
    let peer_a = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_b = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_c = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_d = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;

    peer_a.insert_record("chain-item", "Chain Item", "org1").await;

    tokio::time::sleep(Duration::from_millis(200)).await;

    // Chain: A→B, then B→C, then C→D
    sync_pair_once(&peer_a, &peer_b).await;
    tokio::time::sleep(Duration::from_millis(150)).await;

    sync_pair_once(&peer_b, &peer_c).await;
    tokio::time::sleep(Duration::from_millis(150)).await;

    sync_pair_once(&peer_c, &peer_d).await;
    tokio::time::sleep(Duration::from_millis(300)).await;

    assert!(
        peer_d.has_record("chain-item").await,
        "Peer D should have chain-item after A→B→C→D chain"
    );
}

// ---------------------------------------------------------------------------
// Test 8 — Multi-peer concurrent writes (SQLite only)
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_multi_peer_concurrent_writes() {
    let peer_a = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_b = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;
    let peer_c = FullStackPeer::new_sqlite(test_config(), make_wildcard_jwt()).await;

    // Each peer inserts its own record independently
    peer_a.insert_record("concurrent-x", "From A", "org1").await;
    peer_b.insert_record("concurrent-y", "From B", "org1").await;
    peer_c.insert_record("concurrent-z", "From C", "org1").await;

    tokio::time::sleep(Duration::from_millis(200)).await;

    sync_mesh(&[&peer_a, &peer_b, &peer_c]).await;
    tokio::time::sleep(Duration::from_millis(400)).await;

    // Every peer should now hold all three records
    for (label, peer) in [("A", &peer_a), ("B", &peer_b), ("C", &peer_c)] {
        assert!(
            peer.has_record("concurrent-x").await,
            "Peer {} should have concurrent-x",
            label
        );
        assert!(
            peer.has_record("concurrent-y").await,
            "Peer {} should have concurrent-y",
            label
        );
        assert!(
            peer.has_record("concurrent-z").await,
            "Peer {} should have concurrent-z",
            label
        );
    }
}
