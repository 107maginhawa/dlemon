//! Iteration harness: run a fully-functional cadence peer locally, with the
//! same config + JWT as the embedded desktop peer, against staging cadence's
//! WebSocket endpoint. Lets us iterate on filter/scope/sync logic without
//! rebuilding the Tauri app each time.
//!
//! Prereqs (one-time setup):
//!   1. JWT extracted from the desktop's metadata DB:
//!      ```
//!      sqlite3 "$HOME/Library/Application Support/com.mycure.desktop/cadence_metadata.db" \
//!        "SELECT jwt FROM peer_tokens LIMIT 1;" > /tmp/staging-jwt.txt
//!      ```
//!   2. The desktop should NOT be running (or at least not connected) so
//!      this peer doesn't compete for the same JWT scope.
//!
//! Run:
//!   ```
//!   cargo test --features integration-tests --test e2e \
//!     staging_iterate -- --ignored --nocapture
//!   ```
//!
//! What it does:
//!   - Loads `services/hapihub/cadence.yml` (the canonical config shared
//!     between cloud and embedded).
//!   - Creates a fresh SQLite primary DB at /tmp/staging-iterate-primary.db
//!     (with all the staging tables) and a fresh metadata DB at
//!     /tmp/staging-iterate-meta.db. Idempotent: deletes them first.
//!   - Boots a SqliteWatcher + SqlitePrimaryReader + Applier against those.
//!   - Connects via WebSocket to staging cadence at
//!     wss://cadence.stg.localfirsthealth.com/sync.
//!   - Runs `initiate_sync_stream` with the JWT.
//!   - On exit, prints how many rows arrived in each table and any
//!     `Rejecting out-of-scope` warnings the receive filter emitted.
//!
//! To iterate on a specific behavior (e.g. scope rules), edit the source,
//! rerun. Cargo's incremental builds keep the loop ~10s.

use cadence::applier::tracker::ApplierTracker;
use cadence::auth::JwtValidator;
use cadence::config::CadenceConfig;
use cadence::peer_status::PeerTracker;
use cadence::primary_reader::{PrimaryDbReader, SqlitePrimaryReader};
use cadence::schema::SchemaFingerprint;
use cadence::state::{ChangeBroadcaster, SyncState};
use cadence::storage::{MetadataBackend, SqliteBackend};
use cadence::sync::SyncEngine;
use cadence::token::TokenStore;
use cadence::watcher::ChangeWatcher;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

const STAGING_WS_URL: &str = "wss://cadence.stg.localfirsthealth.com/sync";
const HAPIHUB_CADENCE_YML: &str =
    include_str!("../../../hapihub/cadence.yml");


fn primary_db_path() -> PathBuf {
    PathBuf::from("/tmp/staging-iterate-primary.db")
}

fn metadata_db_path() -> PathBuf {
    PathBuf::from("/tmp/staging-iterate-meta.db")
}

fn reset_test_dbs() {
    for p in [primary_db_path(), metadata_db_path()] {
        for ext in ["", "-shm", "-wal"] {
            let path = format!("{}{}", p.display(), ext);
            let _ = std::fs::remove_file(&path);
        }
    }
}

fn build_primary_db() -> Arc<std::sync::Mutex<rusqlite::Connection>> {
    let path = primary_db_path();
    let conn = rusqlite::Connection::open(&path).expect("open primary");
    // Use the desktop's full drizzle-generated schema as the source of truth.
    // The earlier approach layered a minimal hand-written schema *under* the
    // drizzle schema, but the hand-written CREATEs ran first and the
    // drizzle CREATE-IF-NOT-EXISTS calls then no-op'd, leaving the table
    // with the smaller hand-written column set (missing columns like
    // `apps` on legacy `accounts`). Result: applier UPSERT fails with
    // "no such column" for half the fields the cloud sends.
    //
    // To populate /tmp/mycure-schema.sql, run once:
    //   sqlite3 ~/Library/Application\ Support/com.mycure.desktop/mycure.db .schema > /tmp/mycure-schema.sql
    let full_schema = std::fs::read_to_string("/tmp/mycure-schema.sql").expect(
        "/tmp/mycure-schema.sql missing — dump the desktop schema:\n  \
         sqlite3 ~/Library/Application\\ Support/com.mycure.desktop/mycure.db .schema \
         > /tmp/mycure-schema.sql",
    );
    conn.execute_batch(&full_schema).expect("apply drizzle schema");
    eprintln!("✓ Loaded full mycure.db schema from /tmp/mycure-schema.sql");
    Arc::new(std::sync::Mutex::new(conn))
}

fn read_jwt() -> String {
    std::fs::read_to_string("/tmp/staging-jwt.txt")
        .expect("/tmp/staging-jwt.txt missing — extract JWT from desktop cadence_metadata.db first")
        .trim()
        .to_string()
}

#[tokio::test]
#[ignore]
async fn staging_iterate() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            "cadence::sync=debug,\
             cadence::applier=debug,\
             cadence::watcher=info,\
             cadence::storage=info,\
             cadence=info",
        )
        .with_test_writer()
        .try_init();

    reset_test_dbs();
    let primary_path = primary_db_path();
    let primary_conn = build_primary_db();

    // ── Config: parse the canonical cadence.yml ────────────────────
    let mut config = CadenceConfig::from_yaml_str(HAPIHUB_CADENCE_YML)
        .expect("parse cadence.yml");
    config.metadata_db_path = metadata_db_path().to_string_lossy().to_string();
    config.primary_db_url = format!("sqlite://{}", primary_path.display());
    config.api_server.enabled = false;
    config.p2p.enabled = false;
    // Cloud's Phase 1 build is currently synchronous and can take 30-40s
    // for staging's row volume (31k rows across 117 collections, with PG
    // connect-per-page). During that window, no frames hit the wire — if
    // the harness's liveness_timeout (default 30s) fires first, recv
    // returns Err and the session hangs in send's keepalive loop.
    // Bumping to 180s well above the observed Phase 1 latency. The
    // proper fix is streaming Phase 1 on the cloud side; this is the
    // workaround that makes the iteration loop usable.
    config.liveness_timeout_secs = 180;

    // Resolve wildcard against the SQLite primary (creates per-table
    // collection entries from the discovered schema).
    config.resolve_wildcard().await.expect("resolve wildcard");
    let collections: Vec<String> = config.collections.keys().cloned().collect();
    let scope_columns_by_collection = config.scope_columns_by_collection();

    eprintln!("\n========== Resolved collections (sample) ==========");
    let mut sorted: Vec<_> = config.collections.iter().collect();
    sorted.sort_by_key(|(k, _)| k.to_string());
    for (name, c) in sorted.iter().take(20) {
        eprintln!("  {:35}  scope_columns = {:?}", name, c.scope_columns);
    }
    eprintln!("  ... ({} total collections)\n", config.collections.len());

    // ── Storage + state ────────────────────────────────────────────
    let storage: Arc<dyn MetadataBackend> = Arc::new(
        SqliteBackend::open(&metadata_db_path()).expect("open metadata"),
    );
    let state = Arc::new(SyncState::new());
    let broadcaster = Arc::new(ChangeBroadcaster::new(256));
    let applier_tracker = ApplierTracker::new();

    let validator = Arc::new(JwtValidator::no_verify());
    let token_store = Arc::new(TokenStore::new(storage.clone(), validator.clone()));

    // Set the JWT so initiate_sync_stream can use it (via token_store path).
    let jwt = read_jwt();
    eprintln!("Loaded JWT (len={})", jwt.len());

    let primary_reader = Arc::new(SqlitePrimaryReader::new(
        primary_conn.clone(),
        format!("staging-iterate-{}", uuid::Uuid::new_v4()),
    )) as Arc<dyn PrimaryDbReader>;

    let peer_id = format!("staging-iterate-{}", uuid::Uuid::new_v4());

    let (engine, _peer_change_rx) = SyncEngine::new(
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

    // SQLite watcher (own connection)
    let _watcher_handle = {
        let watcher_storage = storage.clone();
        let watcher_state = state.clone();
        let watcher_tracker = applier_tracker.clone();
        let watcher_broadcaster = broadcaster.clone();
        let cols = collections.clone();
        let pid = peer_id.clone();
        let sc = scope_columns_by_collection.clone();
        let path = primary_path.clone();
        let conn = {
            let c = rusqlite::Connection::open(&path).unwrap();
            c.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")
                .unwrap();
            Arc::new(std::sync::Mutex::new(c))
        };
        let mut watcher =
            cadence::watcher::sqlite::SqliteWatcher::new(conn, cols, pid, watcher_state, sc);
        let poll_ms = 200u64;
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_millis(poll_ms)).await;
                if let Ok(output) = watcher.poll_changes().await {
                    if !output.changes.is_empty() {
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
                }
            }
        })
    };

    // Applier
    let _applier_handle = cadence::applier::sqlite::start_sqlite_applier(
        storage.clone(),
        primary_path.clone(),
        collections,
        Vec::new(),
        Duration::from_millis(200),
        applier_tracker,
        10,
        1000,
        60_000,
        5_000,
        "test-peer".to_string(),
    );

    // ── Connect and run ────────────────────────────────────────────
    let session_key = format!("out:{}", STAGING_WS_URL);
    let change_rx = broadcaster.subscribe();

    eprintln!("\n========== Connecting to {} ==========", STAGING_WS_URL);
    let started = std::time::Instant::now();
    let connect_result = tokio::time::timeout(
        Duration::from_secs(600),
        cadence::ws::connect_ws_peer(STAGING_WS_URL, &engine, &jwt, change_rx, &session_key),
    )
    .await;
    eprintln!("\nSession ended after {:?}", started.elapsed());

    match connect_result {
        Ok(Ok(())) => eprintln!("\n✓ Sync session ended cleanly"),
        Ok(Err(e)) => eprintln!("\n✗ Sync session error: {}", e),
        Err(_) => eprintln!("\n⏱ Sync session timed out after 180s (still alive — counting what arrived)"),
    }

    // Wait briefly for applier to flush.
    tokio::time::sleep(Duration::from_millis(500)).await;

    // ── Report ─────────────────────────────────────────────────────
    eprintln!("\n========== Local primary DB row counts ==========");
    let conn = primary_conn.lock().unwrap();
    for table in [
        "user",
        "account",
        "session",
        "accounts",
        "personal_details",
        "personal_details_history",
        "medical_patients",
        "organizations",
        "billing_invoices",
    ] {
        let cnt: i64 = conn
            .query_row(&format!("SELECT count(*) FROM \"{}\"", table), [], |r| {
                r.get(0)
            })
            .unwrap_or(-1);
        eprintln!("  {:30}  {}", table, cnt);
    }
    eprintln!("==================================================\n");

    let changelog_count: i64 = {
        let conn = rusqlite::Connection::open(metadata_db_path()).unwrap();
        conn.query_row("SELECT count(*) FROM changes", [], |r| r.get(0))
            .unwrap_or(-1)
    };
    eprintln!("Metadata changelog entries: {}", changelog_count);
}
