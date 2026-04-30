/// E2E test for the cloud↔on-prem catch-up scenario.
///
/// Topology mirrors production:
/// - **Cloud** peer: PostgreSQL primary, in-memory metadata storage (stand-in
///   for Valkey), pre-populated *before* cadence starts. Wildcard `*` config.
/// - **On-prem** peer: SQLite primary, in-memory metadata storage, schemas
///   pre-created but tables empty. Wildcard `*` config.
///
/// The on-prem peer connects to the cloud peer with `last_seen_seq=0`. The
/// catch-up path in `sync.rs::build_catchup_frames` should call
/// `PgPrimaryReader::read_rows_page` for each collection and stream all rows
/// to the on-prem peer — bypassing the change log entirely. The on-prem
/// applier writes those rows into its SQLite primary.
///
/// **What this test pins down:** every collection that exists on the cloud's
/// primary DB must arrive on the on-prem peer's primary DB after a single
/// catch-up handshake. Today (cadence main + the PK-only-loop fix) this
/// silently drops `user`, `session`, `personal_details`, etc. on the user's
/// running staging — the cause is some primary-reader read failure that the
/// new structured `tracing::warn!` (added alongside this test) will surface.
///
/// Why this test didn't exist before: every other e2e test populates the
/// primary DB *after* the watcher is running, so rows enter the change log
/// via incremental polls. The production scenario (cloud has data; new peer
/// connects with empty state) was untested.
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

const PG_URL_BASE: &str = "host=localhost port=15434 user=postgres password=postgres";
const E2E_SECRET: &[u8] = b"e2e-test-secret";
const WATCHER_POLL_MS: u64 = 50;
const APPLIER_POLL_MS: u64 = 50;

// ---------------------------------------------------------------------------
// Schema fixtures — mirrors the production tables that fail to sync today.
// ---------------------------------------------------------------------------

/// SQL to create the test schema on PostgreSQL. Reserved-word table name
/// (`"user"`) is intentional — that's the production shape from Better Auth.
const PG_SCHEMA: &str = r#"
    CREATE TABLE "user" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE account (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        password TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES "user"(id)
    );
    CREATE TABLE session (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE simple_thing (
        id TEXT PRIMARY KEY,
        label TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
"#;

/// Same schema for SQLite. NOT NULL is preserved where production has it, but
/// the FK is dropped (SQLite forgives, and the test doesn't depend on it).
const SQLITE_SCHEMA: &str = r#"
    PRAGMA journal_mode=WAL;
    CREATE TABLE "user" (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        email_verified INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
    );
    CREATE TABLE account (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        provider_id TEXT,
        user_id TEXT,
        password TEXT,
        created_at TEXT,
        updated_at TEXT
    );
    CREATE TABLE session (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        token TEXT,
        expires_at TEXT,
        created_at TEXT,
        updated_at TEXT
    );
    CREATE TABLE simple_thing (
        id TEXT PRIMARY KEY,
        label TEXT,
        created_at TEXT,
        updated_at TEXT
    );
"#;

#[derive(Clone, Debug)]
struct UserRow {
    id: &'static str,
    name: &'static str,
    email: &'static str,
}
const USER_ROWS: &[UserRow] = &[
    UserRow { id: "u-alice", name: "Alice", email: "alice@example.com" },
    UserRow { id: "u-bob",   name: "Bob",   email: "bob@example.com" },
    UserRow { id: "u-carol", name: "Carol", email: "carol@example.com" },
];

#[derive(Clone, Debug)]
struct AccountRow {
    id: &'static str,
    account_id: &'static str,
    user_id: &'static str,
}
const ACCOUNT_ROWS: &[AccountRow] = &[
    AccountRow { id: "a-alice", account_id: "alice@example.com", user_id: "u-alice" },
    AccountRow { id: "a-bob",   account_id: "bob@example.com",   user_id: "u-bob"   },
    AccountRow { id: "a-carol", account_id: "carol@example.com", user_id: "u-carol" },
];

const SIMPLE_ROWS: &[(&str, &str)] = &[("s-1", "one"), ("s-2", "two")];

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

/// Create a fresh PG database, drop+recreate it for isolation.
async fn create_pg_db(name: &str) -> String {
    let admin_url = format!("{} dbname=postgres", PG_URL_BASE);
    let (client, conn) = tokio_postgres::connect(&admin_url, tokio_postgres::NoTls)
        .await
        .expect("connect to postgres for DB creation");
    tokio::spawn(async move { let _ = conn.await; });

    // Force-disconnect existing connections so DROP succeeds.
    client
        .execute(
            &format!(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{}'",
                name
            ),
            &[],
        )
        .await
        .ok();
    client.execute(&format!("DROP DATABASE IF EXISTS {}", name), &[]).await.ok();
    client
        .execute(&format!("CREATE DATABASE {}", name), &[])
        .await
        .unwrap_or_else(|e| panic!("create DB {}: {}", name, e));

    format!("{} dbname={}", PG_URL_BASE, name)
}

/// Create the test schema on the given PG database and pre-populate every
/// table with rows. **Runs BEFORE the cadence watcher is started** — the
/// whole point of the test is exercising primary-reader catch-up for rows
/// that the watcher never observed via incremental polling.
async fn populate_pg(url: &str) {
    let (client, conn) = tokio_postgres::connect(url, tokio_postgres::NoTls)
        .await
        .expect("connect to test PG db");
    tokio::spawn(async move { let _ = conn.await; });

    client.batch_execute(PG_SCHEMA).await.expect("create PG schema");

    for u in USER_ROWS {
        client
            .execute(
                "INSERT INTO \"user\" (id, name, email, email_verified) VALUES ($1, $2, $3, true)",
                &[&u.id, &u.name, &u.email],
            )
            .await
            .expect("insert user row");
    }
    for a in ACCOUNT_ROWS {
        client
            .execute(
                "INSERT INTO account (id, account_id, provider_id, user_id, password) \
                 VALUES ($1, $2, 'credential', $3, 'bcrypted-secret')",
                &[&a.id, &a.account_id, &a.user_id],
            )
            .await
            .expect("insert account row");
    }
    // Sessions reference users by id with a real expires_at. expires_at is
    // *not* a wildcard scope-rule column, so it doesn't drive emission, but
    // it's NOT NULL on PG and that's part of the production shape that
    // currently breaks the applier on the *return* trip (separate bug).
    let now = chrono::Utc::now().naive_utc();
    let exp = now + chrono::Duration::hours(24);
    for u in USER_ROWS {
        client
            .execute(
                "INSERT INTO session (id, user_id, token, expires_at) \
                 VALUES ($1, $2, $3, $4)",
                &[
                    &format!("s-{}", u.id),
                    &u.id,
                    &format!("token-{}", u.id),
                    &exp,
                ],
            )
            .await
            .expect("insert session row");
    }
    for (id, label) in SIMPLE_ROWS {
        client
            .execute(
                "INSERT INTO simple_thing (id, label) VALUES ($1, $2)",
                &[id, label],
            )
            .await
            .expect("insert simple row");
    }
}

/// Create a fresh SQLite primary file with the test schema; tables exist but
/// are empty. Mirrors what hapihub-embedded does on the on-prem side.
fn create_sqlite_primary() -> (PathBuf, Arc<std::sync::Mutex<rusqlite::Connection>>) {
    let tmp = tempfile::Builder::new().suffix(".db").tempfile().expect("tempfile");
    let path = tmp.path().to_path_buf();
    std::mem::forget(tmp);
    {
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute_batch(SQLITE_SCHEMA).expect("create SQLite schema");
    }
    let conn = Arc::new(std::sync::Mutex::new(rusqlite::Connection::open(&path).unwrap()));
    (path, conn)
}

fn make_jwt() -> String {
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

/// Wildcard config that mirrors the staging cadence configmap. After
/// `resolve_wildcard_*`, `config.collections` will contain one entry per
/// table discovered on the primary DB.
fn wildcard_config() -> CadenceConfig {
    let mut scope_rules = BTreeMap::new();
    scope_rules.insert("facility".to_string(), "organization".to_string());
    scope_rules.insert("organization".to_string(), "organization".to_string());
    scope_rules.insert("warehouse".to_string(), "organization".to_string());
    scope_rules.insert("account".to_string(), "organization".to_string());
    scope_rules.insert("created_by".to_string(), "user".to_string());

    let mut collections = BTreeMap::new();
    collections.insert(
        "*".to_string(),
        CollectionConfig {
            strategy: ConflictStrategy::Lww,
            scope_columns: BTreeMap::new(),
            scope_rules: Some(scope_rules),
        },
    );
    CadenceConfig {
        collections,
        poll_interval_ms: WATCHER_POLL_MS,
        ..Default::default()
    }
}

// ---------------------------------------------------------------------------
// Iroh address helper (copied from full_stack_sync_test for symmetry)
// ---------------------------------------------------------------------------

fn node_addr_direct(ep: &Endpoint) -> NodeAddr {
    let (v4, v6) = ep.bound_sockets();
    let mut addrs = BTreeSet::new();
    let v4 = if v4.ip().is_unspecified() {
        std::net::SocketAddr::new(std::net::Ipv4Addr::LOCALHOST.into(), v4.port())
    } else { v4 };
    addrs.insert(v4);
    if let Some(v6) = v6 {
        let v6 = if v6.ip().is_unspecified() {
            std::net::SocketAddr::new(std::net::Ipv6Addr::LOCALHOST.into(), v6.port())
        } else { v6 };
        addrs.insert(v6);
    }
    NodeAddr {
        node_id: ep.node_id(),
        relay_url: None,
        direct_addresses: addrs,
    }
}

fn oneshot_change_rx() -> tokio::sync::broadcast::Receiver<Vec<RowChange>> {
    let (tx, rx) = tokio::sync::broadcast::channel(1);
    drop(tx);
    rx
}

// ---------------------------------------------------------------------------
// Peer assembly — keeps the test self-contained rather than coupling to
// the test_items-specific helpers in full_stack_sync_test.rs.
// ---------------------------------------------------------------------------

#[allow(dead_code)]
struct Peer {
    engine: Arc<SyncEngine>,
    endpoint: Endpoint,
    storage: Arc<Storage>,
    state: Arc<SyncState>,
    jwt: String,
    _watcher_handle: tokio::task::JoinHandle<()>,
    _applier_handle: tokio::task::JoinHandle<()>,
}

impl Drop for Peer {
    fn drop(&mut self) {
        self._watcher_handle.abort();
        self._applier_handle.abort();
    }
}

async fn build_pg_peer(db_url: String, mut config: CadenceConfig) -> Peer {
    config.primary_db_url = db_url.clone();
    config.resolve_wildcard().await.expect("resolve wildcard PG");
    let collections: Vec<String> = config.collections.keys().cloned().collect();
    let scope_columns_by_collection = config.scope_columns_by_collection();

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

    let primary_reader = Arc::new(PgPrimaryReader::new(db_url.clone(), peer_id.clone()))
        as Arc<dyn PrimaryDbReader>;

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

    let _watcher_handle = {
        let watcher_storage = storage.clone();
        let watcher_state = state.clone();
        let watcher_tracker = applier_tracker.clone();
        let watcher_broadcaster = broadcaster.clone();
        let cols = collections.clone();
        let pid = peer_id.clone();
        let sc = scope_columns_by_collection.clone();
        let watcher_db_url = db_url.clone();
        let mut watcher = cadence::watcher::pg_poll::PgPollWatcher::new(
            watcher_db_url, cols, pid, watcher_state, sc,
        );
        let poll_interval = Duration::from_millis(WATCHER_POLL_MS);
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(poll_interval).await;
                if let Ok(output) = watcher.poll_changes().await {
                    if !output.changes.is_empty() {
                        let mut changes = output.changes;
                        for change in &mut changes {
                            if let Some(origin) =
                                watcher_tracker.take_origin(&change.collection, &change.document_id)
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
                }
            }
        })
    };

    let _applier_handle = cadence::applier::pg::start_pg_applier(
        storage.clone(),
        db_url.clone(),
        collections,
        Vec::new(),
        Duration::from_millis(APPLIER_POLL_MS),
        applier_tracker,
        10, 1000, 60000, 5_000,
        "test-peer".to_string(),
    );

    Peer {
        engine,
        endpoint,
        storage,
        state,
        jwt: make_jwt(),
        _watcher_handle,
        _applier_handle,
    }
}

async fn build_sqlite_peer(
    db_path: PathBuf,
    db_conn: Arc<std::sync::Mutex<rusqlite::Connection>>,
    mut config: CadenceConfig,
) -> Peer {
    config.primary_db_url = format!("sqlite://{}", db_path.display());
    config.resolve_wildcard().await.expect("resolve wildcard SQLite");
    let collections: Vec<String> = config.collections.keys().cloned().collect();
    let scope_columns_by_collection = config.scope_columns_by_collection();

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

    let primary_reader = Arc::new(SqlitePrimaryReader::new(db_conn.clone(), peer_id.clone()))
        as Arc<dyn PrimaryDbReader>;

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

    // SQLite watcher (own connection so the applier doesn't fight for the lock)
    let _watcher_handle = {
        let watcher_storage = storage.clone();
        let watcher_state = state.clone();
        let watcher_tracker = applier_tracker.clone();
        let watcher_broadcaster = broadcaster.clone();
        let cols = collections.clone();
        let pid = peer_id.clone();
        let sc = scope_columns_by_collection.clone();
        let sqlite_conn = {
            let c = rusqlite::Connection::open(&db_path).unwrap();
            c.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;").unwrap();
            Arc::new(std::sync::Mutex::new(c))
        };
        let mut watcher = cadence::watcher::sqlite::SqliteWatcher::new(
            sqlite_conn, cols, pid, watcher_state, sc,
        );
        let poll_interval = Duration::from_millis(WATCHER_POLL_MS);
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(poll_interval).await;
                if let Ok(output) = watcher.poll_changes().await {
                    if !output.changes.is_empty() {
                        let mut changes = output.changes;
                        for change in &mut changes {
                            if let Some(origin) =
                                watcher_tracker.take_origin(&change.collection, &change.document_id)
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
                }
            }
        })
    };

    let _applier_handle = cadence::applier::sqlite::start_sqlite_applier(
        storage.clone(),
        db_path.clone(),
        collections,
        Vec::new(),
        Duration::from_millis(APPLIER_POLL_MS),
        applier_tracker,
        10, 1000, 60000, 5_000,
        "test-peer".to_string(),
    );

    Peer {
        engine,
        endpoint,
        storage,
        state,
        jwt: make_jwt(),
        _watcher_handle,
        _applier_handle,
    }
}

/// Single QUIC sync handshake from `from` (initiator) to `to` (acceptor).
/// `session_key` controls which `peer_id_hint` lookup branch the initiator
/// takes — see `sync.rs::initiate_sync_stream:307-341`. Pass an `"out:<addr>"`
/// session_key to allow `since_seq > 0` reuse from prior watermarks.
async fn sync_once_with_session(from: &Peer, to: &Peer, session_key: &str) {
    let to_addr = node_addr_direct(&to.endpoint);
    let to_engine = to.engine.clone();
    let to_ep = to.endpoint.clone();
    let session_key_to = session_key.to_string();

    let accept = tokio::spawn(async move {
        let incoming = to_ep.accept().await.expect("accept incoming");
        let conn = incoming.await.expect("await incoming conn");
        to_engine
            .handle_incoming(conn, oneshot_change_rx(), &session_key_to)
            .await
    });

    from.endpoint.add_node_addr(to_addr.clone()).ok();
    let conn = from
        .endpoint
        .connect(to_addr, CADENCE_ALPN)
        .await
        .expect("from connect");
    from.engine
        .initiate_sync(conn, &from.jwt, oneshot_change_rx(), session_key)
        .await
        .expect("initiate_sync");

    accept.await.expect("accept join").expect("accept ok");
}

async fn sync_once(from: &Peer, to: &Peer) {
    sync_once_with_session(from, to, "catchup-test").await;
}

/// Poll the on-prem SQLite primary for the row count of `table`. Used after
/// a sync to give the applier a moment to drain its pending changes.
fn count_sqlite(conn: &Arc<std::sync::Mutex<rusqlite::Connection>>, table: &str) -> i64 {
    let conn = conn.lock().unwrap();
    let sql = format!("SELECT count(*) FROM \"{}\"", table);
    conn.query_row(&sql, [], |row| row.get::<_, i64>(0)).unwrap_or(0)
}

async fn wait_for_count(
    conn: &Arc<std::sync::Mutex<rusqlite::Connection>>,
    table: &str,
    expected: i64,
    timeout: Duration,
) -> i64 {
    let deadline = std::time::Instant::now() + timeout;
    loop {
        let n = count_sqlite(conn, table);
        if n >= expected || std::time::Instant::now() >= deadline {
            return n;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

// ---------------------------------------------------------------------------
// The test
// ---------------------------------------------------------------------------

/// Cloud peer has PG primary pre-populated with `user`/`account`/`session`/
/// `simple_thing` rows; on-prem peer connects with `last_seen_seq=0` (fresh
/// metadata). After one catch-up handshake, every collection's rows must
/// appear on on-prem's SQLite primary.
///
/// This is the scenario `sync.rs::build_catchup_frames` lines 737-792 was
/// designed for: `effective_since_seq == 0 && config.catchup_from_primary_db`
/// triggers per-collection `primary_reader.read_rows_page` calls that bypass
/// the change log entirely. If any read fails, the new structured WARN log
/// (`PrimaryReader (PG): dropping collection — SELECT failed`) makes it
/// obvious in test output.
#[tokio::test]
async fn cloud_to_onprem_catchup_fresh_peer() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter("cadence::primary_reader=warn,cadence::sync=info")
        .with_test_writer()
        .try_init();

    // 1. Fresh PG database, schema, populate.
    let db_url = create_pg_db("cadence_test_cloud_to_onprem_fresh").await;
    populate_pg(&db_url).await;

    // 2. Cloud peer (PG primary with data already there).
    let cloud = build_pg_peer(db_url.clone(), wildcard_config()).await;

    // 3. On-prem peer (empty SQLite primary with matching schema, fresh
    //    in-memory metadata storage so `last_seen_seq == 0`).
    let (sqlite_path, sqlite_conn) = create_sqlite_primary();
    let onprem = build_sqlite_peer(sqlite_path.clone(), sqlite_conn.clone(), wildcard_config()).await;

    for table in ["user", "account", "session", "simple_thing"] {
        assert_eq!(count_sqlite(&sqlite_conn, table), 0, "on-prem {} should start empty", table);
    }

    // 4. One catch-up handshake.
    sync_once(&onprem, &cloud).await;

    // 5. Drain.
    let deadline = Duration::from_secs(5);
    wait_for_count(&sqlite_conn, "user", USER_ROWS.len() as i64, deadline).await;

    // 6. Every pre-populated table arrives.
    assert_eq!(count_sqlite(&sqlite_conn, "user"), USER_ROWS.len() as i64,
        "fresh peer should receive all `user` rows via primary-reader catch-up");
    assert_eq!(count_sqlite(&sqlite_conn, "account"), ACCOUNT_ROWS.len() as i64);
    assert_eq!(count_sqlite(&sqlite_conn, "session"), USER_ROWS.len() as i64);
    assert_eq!(count_sqlite(&sqlite_conn, "simple_thing"), SIMPLE_ROWS.len() as i64);

    let alice_email: String = sqlite_conn
        .lock()
        .unwrap()
        .query_row(
            "SELECT email FROM \"user\" WHERE id = 'u-alice'",
            [], |row| row.get(0),
        )
        .unwrap_or_default();
    assert_eq!(alice_email, "alice@example.com");

    drop(onprem);
    drop(cloud);
}

/// **Regression lock for the user-reported reconnect bug.**
///
/// Pre-fix scenario this test reproduced:
/// 1. Cloud's PG primary has rows inserted *before* the cadence pod started.
/// 2. Cadence boots; pg_poll watcher's baseline scan silently absorbs all
///    existing rows into its LRU cache without writing to the change log.
/// 3. A new row gets inserted somewhere — bumping cloud's `our_max_seq`.
/// 4. On-prem peer reconnects with a watermark *between* 0 and the cloud's
///    current max — NOT a stale epoch (`since_seq > our_max_seq` doesn't
///    fire). Cadence took the change-log replay branch and returned 0
///    rows for collections silently absorbed at baseline.
///
/// The fix: `build_catchup_frames` and `send_catchup_batch` now condition
/// the primary-reader pass on `since_seq < baseline_completion_seq`
/// (instead of `since_seq == 0`), and pg_poll deliberately leaves
/// `baseline_completion_seq = u64::MAX` because its baseline is silent.
/// Result: every catch-up against a pg_poll-watcher cloud runs
/// primary-reader. Lamports for primary-reader rows are rewritten from a
/// per-doc `max_lamports_by_doc` map (fallback `lamport=1`) so future
/// LWW enforcement at apply time will correctly preserve peer-local
/// edits.
#[tokio::test]
async fn cloud_to_onprem_catchup_reconnect_with_silent_baseline() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter("cadence::primary_reader=warn,cadence::sync=info,cadence::watcher=debug")
        .with_test_writer()
        .try_init();

    let db_url = create_pg_db("cadence_test_cloud_to_onprem_silent_baseline").await;
    populate_pg(&db_url).await;

    let cloud = build_pg_peer(db_url.clone(), wildcard_config()).await;

    // Wait long enough for the cloud's pg_poll watcher to *finish* its
    // baseline scan. Each collection's baseline takes ~100ms (cursor
    // batches against PG); with 4 collections that's ~400ms minimum. We
    // need this to complete before inserting the post-baseline row, or
    // the baseline will absorb that row too and the test setup invariant
    // won't hold.
    tokio::time::sleep(Duration::from_millis(2000)).await;

    // Now insert a *new* row into a control table on the cloud's PG so the
    // watcher's NEXT poll emits something to the change log. This bumps
    // `cloud.state.local_seq` above 0 — without it, the on-prem peer's
    // `since_seq=1` would trigger the stale-epoch branch and silently
    // dodge the bug.
    {
        let (client, conn) = tokio_postgres::connect(&db_url, tokio_postgres::NoTls)
            .await
            .expect("connect to PG");
        tokio::spawn(async move { let _ = conn.await; });
        client
            .execute(
                "INSERT INTO simple_thing (id, label) VALUES ('s-post-baseline', 'inserted-after-cadence-started')",
                &[],
            )
            .await
            .expect("post-baseline insert");
    }
    // Wait for the watcher to detect the post-baseline insert via an
    // incremental poll and append it to the change log.
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Sanity: cloud's change log now has at least 1 entry (so our_max_seq > 0).
    let cloud_log_count = cloud.storage.query_since(0).await.expect("query_since").len();
    assert!(
        cloud_log_count >= 1,
        "test setup: cloud should have at least 1 change-log entry from the \
         post-baseline insert; got {}. Without this, the on-prem peer's \
         since_seq>0 would trigger the stale-epoch fallback and the \
         reconnect bug would be hidden.",
        cloud_log_count
    );

    let (sqlite_path, sqlite_conn) = create_sqlite_primary();
    let onprem = build_sqlite_peer(sqlite_path.clone(), sqlite_conn.clone(), wildcard_config()).await;

    // Set the on-prem's watermark for cloud to a value > 0 but ≤ cloud's
    // current local_seq. This matches production: the on-prem peer's
    // cadence_metadata.db survived a primary-DB wipe and remembers its
    // last-seen seq for the cloud peer.
    let cloud_peer_id = cloud.endpoint.node_id().to_string();
    let cloud_addr = "stub-cloud-addr";
    onprem
        .storage
        .set_peer_address_mapping(cloud_addr, &cloud_peer_id)
        .await
        .expect("seed peer address mapping");
    // Mark on-prem as already-having-seen the post-baseline insert. With
    // this watermark the on-prem will request changes since seq=1 and
    // cloud will replay from change-log seq>1 (returning ~nothing useful
    // until the bug is fixed).
    onprem.state.set_watermark(&cloud_peer_id, 1);

    sync_once_with_session(&onprem, &cloud, &format!("out:{}", cloud_addr)).await;

    let deadline = Duration::from_secs(5);
    wait_for_count(&sqlite_conn, "user", USER_ROWS.len() as i64, deadline).await;

    let user_count = count_sqlite(&sqlite_conn, "user");
    let account_count = count_sqlite(&sqlite_conn, "account");
    let session_count = count_sqlite(&sqlite_conn, "session");
    let simple_count = count_sqlite(&sqlite_conn, "simple_thing");

    // These assertions encode the user's expectation: cloud should still
    // serve *current state from PG primary* for tables that the watcher
    // silently absorbed, even when the peer reconnects with `since_seq > 0`.
    // Today the code does not — these assertions fail, and the failure
    // *is* the bug the user reported on the running staging client.
    assert_eq!(
        user_count, USER_ROWS.len() as i64,
        "reconnecting peer with silent-baseline cloud: on-prem received {} \
         `user` rows, expected {}. The PG primary has the rows; the cloud \
         watcher absorbed them at baseline and never wrote them to the \
         change log; cadence took the change-log replay branch (since_seq=1, \
         not a stale epoch because cloud's our_max_seq>0) and that branch \
         returned 0 user rows. Fix: build_catchup_frames must consult \
         primary_reader for collections with no matching change-log entries \
         even when since_seq > 0.",
        user_count, USER_ROWS.len()
    );
    assert_eq!(
        account_count, ACCOUNT_ROWS.len() as i64,
        "reconnecting peer received {} `account` rows, expected {} (same root cause)",
        account_count, ACCOUNT_ROWS.len()
    );
    assert_eq!(
        session_count, USER_ROWS.len() as i64,
        "reconnecting peer received {} `session` rows, expected {} (same root cause)",
        session_count, USER_ROWS.len()
    );
    // simple_thing has the post-baseline insert (in change log) plus the
    // 2 baseline rows. The 2 baseline rows are the ones the bug drops.
    assert_eq!(
        simple_count, SIMPLE_ROWS.len() as i64 + 1,
        "reconnecting peer received {} `simple_thing` rows, expected {} \
         (the 2 baseline-absorbed rows + the 1 post-baseline insert that \
         IS in the change log)",
        simple_count, SIMPLE_ROWS.len() + 1
    );

    drop(onprem);
    drop(cloud);
}

/// LWW regression: a peer with a local-edit-with-high-lamport must NOT have
/// that edit clobbered by a reconnect catch-up sourced from cloud's primary
/// DB.
///
/// **What this pins down:** the apply-time LWW filter in
/// `sync.rs::merge_single_change`. Without that filter, every incoming
/// change is appended to the change log unconditionally and applied —
/// silently overwriting offline edits when a peer reconnects and cloud
/// streams baseline-absorbed rows back at it with `lamport=1` (the
/// fallback for rows the cloud's pg_poll watcher silently absorbed).
///
/// Setup mirrors the production failure shape:
/// - Cloud PG has `u-alice` with `name="Alice"` (baseline-absorbed → no
///   change-log entry on cloud → primary-reader emits with lamport=1).
/// - On-prem SQLite has `u-alice` with `name="ALICE-LOCAL-EDIT"`. The
///   on-prem change log carries a high-lamport entry for that field,
///   simulating the local edit's effect on the on-prem clock.
/// - On-prem reconnects with a non-zero watermark.
/// - The local edit must survive: SQLite still says "ALICE-LOCAL-EDIT"
///   after sync.
#[tokio::test]
async fn reconnect_does_not_overwrite_local_edits() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter("cadence::sync=info")
        .with_test_writer()
        .try_init();

    let db_url = create_pg_db("cadence_test_reconnect_no_clobber").await;
    populate_pg(&db_url).await;

    let cloud = build_pg_peer(db_url.clone(), wildcard_config()).await;

    // Wait for cloud's pg_poll baseline scan to finish absorbing alice silently.
    tokio::time::sleep(Duration::from_millis(2000)).await;

    // Insert a control row post-baseline so cloud's our_max_seq > 0 (avoids
    // the stale-epoch fallback path for the on-prem reconnect).
    {
        let (client, conn) = tokio_postgres::connect(&db_url, tokio_postgres::NoTls)
            .await
            .expect("connect to PG");
        tokio::spawn(async move { let _ = conn.await; });
        client
            .execute(
                "INSERT INTO simple_thing (id, label) VALUES ('s-bump', 'post-baseline-bump')",
                &[],
            )
            .await
            .expect("post-baseline insert");
    }
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Pre-populate the on-prem SQLite primary with the local-edit version of
    // alice BEFORE building the peer — the watcher's initial scan absorbs
    // this into the on-prem change log.
    let (sqlite_path, sqlite_conn) = create_sqlite_primary();
    {
        let c = sqlite_conn.lock().unwrap();
        c.execute(
            "INSERT INTO \"user\" (id, name, email, email_verified) VALUES (?1, ?2, ?3, 1)",
            rusqlite::params!["u-alice", "ALICE-LOCAL-EDIT", "alice@example.com"],
        )
        .expect("seed local-edit alice");
    }

    let onprem = build_sqlite_peer(sqlite_path.clone(), sqlite_conn.clone(), wildcard_config()).await;

    // Wait for on-prem watcher to absorb the local row into its change log.
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Stamp a high-lamport "local edit" entry into the on-prem change log
    // for u-alice/name. This simulates the peer having performed a local
    // write whose Lamport clock advanced well beyond anything the cloud
    // could plausibly assign for a primary-reader emit.
    let high_lamport: u64 = 1_000_000;
    onprem.state.merge_lamport(high_lamport);
    let local_edit = RowChange {
        collection: "user".to_string(),
        document_id: "u-alice".to_string(),
        payload: cadence::state::SyncPayload::Fields(vec![cadence::state::FieldChange {
            field: "name".to_string(),
            value: serde_json::Value::String("ALICE-LOCAL-EDIT".to_string()),
            lamport: high_lamport,
            peer_id: onprem.endpoint.node_id().to_string(),
        }]),
        deleted: false,
        seq: 0, // ignored — append_change assigns its own
    };
    onprem
        .storage
        .append_change(&local_edit)
        .await
        .expect("seed high-lamport local-edit");

    // Wire up reconnect path: stamp a non-zero watermark for the cloud peer.
    let cloud_peer_id = cloud.endpoint.node_id().to_string();
    let cloud_addr = "stub-cloud-addr-reconnect";
    onprem
        .storage
        .set_peer_address_mapping(cloud_addr, &cloud_peer_id)
        .await
        .expect("seed peer address mapping");
    onprem.state.set_watermark(&cloud_peer_id, 1);

    sync_once_with_session(&onprem, &cloud, &format!("out:{}", cloud_addr)).await;

    // Allow the applier a moment to act on anything that might have made it
    // through the LWW filter. (Nothing should have, but if the filter is
    // broken this lets the bug fully manifest.)
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Read back alice's name from the on-prem SQLite primary.
    let alice_name: String = {
        let c = sqlite_conn.lock().unwrap();
        c.query_row(
            "SELECT name FROM \"user\" WHERE id = ?1",
            rusqlite::params!["u-alice"],
            |row| row.get::<_, String>(0),
        )
        .expect("alice should still exist")
    };

    assert_eq!(
        alice_name, "ALICE-LOCAL-EDIT",
        "Local edit was clobbered by reconnect catch-up. The cloud streamed \
         alice/name=\"Alice\" with fallback lamport=1 via primary-reader; the \
         on-prem peer's apply-time LWW filter should have dropped it because \
         the local-edit lamport ({}) is higher. Got name={:?}.",
        high_lamport, alice_name,
    );

    drop(onprem);
    drop(cloud);
}
