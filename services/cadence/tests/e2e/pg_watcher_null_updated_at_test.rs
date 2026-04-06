/// Regression test: PG watcher must detect records with NULL updated_at.
///
/// When hapihub creates a record via API, it sets created_at but NOT updated_at.
/// The PG watcher must use COALESCE(updated_at, created_at) with a proper type
/// cast ($1::timestamptz) to find these records. Without the fix, PG rejects
/// `timestamp > text` comparison, and new records are never detected.

use cadence::state::SyncState;
use cadence::watcher::pg_poll::PgPollWatcher;
use cadence::watcher::ChangeWatcher;
use std::collections::HashSet;
use std::sync::Arc;

const PG_URL: &str = "host=localhost port=15434 user=postgres password=postgres dbname=cadence_test";

async fn connect_pg() -> (tokio_postgres::Client, tokio::task::JoinHandle<()>) {
    let (client, connection) = tokio_postgres::connect(PG_URL, tokio_postgres::NoTls)
        .await
        .expect("Failed to connect to test PostgreSQL — run: cd services/cadence && docker compose -f docker-compose.deps.yml up -d");
    let handle = tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("PG connection error: {}", e);
        }
    });
    (client, handle)
}

async fn setup_table(client: &tokio_postgres::Client, table: &str) {
    client.batch_execute(&format!(
        "DROP TABLE IF EXISTS {table};
         CREATE TABLE {table} (
             id TEXT PRIMARY KEY,
             name TEXT,
             organization TEXT,
             type TEXT,
             created_at TIMESTAMP DEFAULT NOW(),
             updated_at TIMESTAMP
         )"
    )).await.expect("Failed to create test table");
}

/// Core test: PG watcher detects new records with NULL updated_at after initial sync.
#[tokio::test]
async fn test_pg_watcher_detects_null_updated_at() {
    let table = "test_pw_null_detect";
    let collection = "test-pw-null-detect";
    let (client, _handle) = connect_pg().await;
    setup_table(&client, table).await;

    // Insert existing records with both timestamps (simulates applier-written data)
    client.execute(
        &format!("INSERT INTO {table} (id, name, created_at, updated_at) \
                  VALUES ('existing-1', 'old', NOW() - interval '1 hour', NOW() - interval '1 hour')"),
        &[],
    ).await.unwrap();

    let state = Arc::new(SyncState::new());
    let mut watcher = PgPollWatcher::new(
        PG_URL.to_string(),
        vec![collection.to_string()],
        "test-peer".to_string(),
        state,
        HashSet::new(),
    );

    // Initial scan
    let output = watcher.poll_changes().await.unwrap();
    assert_eq!(output.changes.len(), 1, "Initial scan should find 1 existing record");
    assert!(!output.is_incremental);

    // Insert NEW record with NULL updated_at (like hapihub API does)
    client.execute(
        &format!("INSERT INTO {table} (id, name, organization, type, created_at, updated_at) \
                  VALUES ('api-created', 'sync-test', 'org1', 'sync-test', NOW(), NULL)"),
        &[],
    ).await.unwrap();

    // Watcher should detect via OR (updated_at IS NULL AND created_at > watermark)
    let output = watcher.poll_changes().await.unwrap();
    assert!(output.is_incremental);
    assert_eq!(output.changes.len(), 1, "Should detect record with NULL updated_at");
    assert_eq!(output.changes[0].document_id, "api-created");

    client.batch_execute(&format!("DROP TABLE IF EXISTS {table}")).await.ok();
}

/// Verify records with BOTH timestamps are still detected after the COALESCE change.
#[tokio::test]
async fn test_pg_watcher_still_detects_updated_records() {
    let table = "test_pw_null_update";
    let collection = "test-pw-null-update";
    let (client, _handle) = connect_pg().await;
    setup_table(&client, table).await;

    client.execute(
        &format!("INSERT INTO {table} (id, name, created_at, updated_at) \
                  VALUES ('r1', 'original', NOW() - interval '1 hour', NOW() - interval '1 hour')"),
        &[],
    ).await.unwrap();

    let state = Arc::new(SyncState::new());
    let mut watcher = PgPollWatcher::new(
        PG_URL.to_string(),
        vec![collection.to_string()],
        "test-peer".to_string(),
        state,
        HashSet::new(),
    );

    // Initial scan
    watcher.poll_changes().await.unwrap();

    // Update the record
    client.execute(
        &format!("UPDATE {table} SET name = 'modified', updated_at = NOW() WHERE id = 'r1'"),
        &[],
    ).await.unwrap();

    let output = watcher.poll_changes().await.unwrap();
    assert_eq!(output.changes.len(), 1, "Should detect updated record");
    assert_eq!(output.changes[0].document_id, "r1");

    client.batch_execute(&format!("DROP TABLE IF EXISTS {table}")).await.ok();
}

/// Verify watermark advances correctly with COALESCE — no re-detection of old records.
#[tokio::test]
async fn test_pg_watcher_watermark_advances_with_coalesce() {
    let table = "test_pw_null_wmark";
    let collection = "test-pw-null-wmark";
    let (client, _handle) = connect_pg().await;
    setup_table(&client, table).await;

    let state = Arc::new(SyncState::new());
    let mut watcher = PgPollWatcher::new(
        PG_URL.to_string(),
        vec![collection.to_string()],
        "test-peer".to_string(),
        state,
        HashSet::new(),
    );

    // Insert first record with NULL updated_at
    client.execute(
        &format!("INSERT INTO {table} (id, name, created_at, updated_at) VALUES ('w1', 'first', NOW(), NULL)"),
        &[],
    ).await.unwrap();

    let output = watcher.poll_changes().await.unwrap();
    assert_eq!(output.changes.len(), 1);

    // Poll again — should be empty (watermark advanced past w1)
    let output = watcher.poll_changes().await.unwrap();
    assert_eq!(output.changes.len(), 0, "No new data, should be empty");

    // Insert second record with NULL updated_at
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    client.execute(
        &format!("INSERT INTO {table} (id, name, created_at, updated_at) VALUES ('w2', 'second', NOW(), NULL)"),
        &[],
    ).await.unwrap();

    let output = watcher.poll_changes().await.unwrap();
    assert_eq!(output.changes.len(), 1, "Should only detect the new record");
    assert_eq!(output.changes[0].document_id, "w2");

    client.batch_execute(&format!("DROP TABLE IF EXISTS {table}")).await.ok();
}
