use cadence::state::SyncState;
use cadence::storage::MetadataBackend;
use cadence::watcher::sqlite::SqliteWatcher;
use cadence::watcher::ChangeWatcher;
use rusqlite::Connection;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

fn setup_sqlite_db() -> Arc<Mutex<Connection>> {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE patients (
            id TEXT PRIMARY KEY,
            name TEXT,
            updatedAt TEXT DEFAULT (datetime('now'))
        );",
    )
    .unwrap();
    Arc::new(Mutex::new(conn))
}

#[tokio::test]
async fn test_initial_scan_is_not_incremental() {
    let conn = setup_sqlite_db();

    // Pre-populate data before watcher starts
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO patients (id, name, updatedAt) VALUES ('p1', 'Alice', datetime('now', '+1 second'))",
            [],
        )
        .unwrap();
    }

    let state = Arc::new(SyncState::new());
    let mut watcher = SqliteWatcher::new(
        conn.clone(),
        vec!["patients".to_string()],
        "test-peer".to_string(),
        state,
        HashMap::new(),
    );

    // First poll picks up pre-existing data — should NOT be incremental
    let output = watcher.poll_changes().await.unwrap();
    assert_eq!(output.changes.len(), 1, "Should detect the pre-existing row");
    assert!(
        !output.is_incremental,
        "Initial scan should NOT be incremental — data already exists in primary DB"
    );
}

#[tokio::test]
async fn test_subsequent_changes_are_incremental() {
    let conn = setup_sqlite_db();

    // Pre-populate data before watcher starts
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO patients (id, name, updatedAt) VALUES ('p1', 'Alice', datetime('now', '+1 second'))",
            [],
        )
        .unwrap();
    }

    let state = Arc::new(SyncState::new());
    let mut watcher = SqliteWatcher::new(
        conn.clone(),
        vec!["patients".to_string()],
        "test-peer".to_string(),
        state,
        HashMap::new(),
    );

    // First poll: initial scan
    let output1 = watcher.poll_changes().await.unwrap();
    assert!(!output1.is_incremental);

    // Now insert new data
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO patients (id, name, updatedAt) VALUES ('p2', 'Bob', datetime('now', '+2 seconds'))",
            [],
        )
        .unwrap();
    }

    // Second poll: should be incremental
    let output2 = watcher.poll_changes().await.unwrap();
    assert_eq!(output2.changes.len(), 1, "Should detect the new insert");
    assert!(
        output2.is_incremental,
        "After initial scan, changes should be marked incremental"
    );
}

#[tokio::test]
async fn test_empty_initial_scan_does_not_set_incremental() {
    let conn = setup_sqlite_db();

    let state = Arc::new(SyncState::new());
    let mut watcher = SqliteWatcher::new(
        conn.clone(),
        vec!["patients".to_string()],
        "test-peer".to_string(),
        state,
        HashMap::new(),
    );

    // First poll with no data: empty, not incremental
    let output1 = watcher.poll_changes().await.unwrap();
    assert!(output1.changes.is_empty());
    assert!(
        !output1.is_incremental,
        "Empty initial poll should not be incremental"
    );

    // Second poll still no data: still not incremental (initial_scan_done only flips on non-empty)
    let output2 = watcher.poll_changes().await.unwrap();
    assert!(output2.changes.is_empty());
    assert!(
        !output2.is_incremental,
        "Still no data, should not be incremental yet"
    );

    // Now insert data — this becomes the initial scan
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO patients (id, name, updatedAt) VALUES ('p1', 'Alice', datetime('now', '+1 second'))",
            [],
        )
        .unwrap();
    }

    let output3 = watcher.poll_changes().await.unwrap();
    assert_eq!(output3.changes.len(), 1);
    assert!(
        !output3.is_incremental,
        "First non-empty poll is the initial scan, not incremental"
    );

    // Insert more data — now incremental
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO patients (id, name, updatedAt) VALUES ('p2', 'Bob', datetime('now', '+2 seconds'))",
            [],
        )
        .unwrap();
    }

    let output4 = watcher.poll_changes().await.unwrap();
    assert_eq!(output4.changes.len(), 1);
    assert!(
        output4.is_incremental,
        "After initial scan completes, subsequent polls are incremental"
    );
}

#[tokio::test]
async fn test_change_log_only_gets_incremental_changes() {
    // Simulates what main.rs does: only writes to change log when is_incremental is true
    let conn = setup_sqlite_db();
    let storage = cadence::storage::Storage::in_memory().unwrap();

    // Pre-populate primary DB
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO patients (id, name, updatedAt) VALUES ('p1', 'PreExisting', datetime('now', '+1 second'))",
            [],
        )
        .unwrap();
    }

    let state = Arc::new(SyncState::new());
    let mut watcher = SqliteWatcher::new(
        conn.clone(),
        vec!["patients".to_string()],
        "test-peer".to_string(),
        state,
        HashMap::new(),
    );

    // Initial scan — should NOT be written to change log
    let output1 = watcher.poll_changes().await.unwrap();
    assert!(!output1.is_incremental);
    // Simulate what main.rs does:
    if output1.is_incremental {
        for change in &output1.changes {
            storage.append_change(change).await.unwrap();
        }
    }

    // Change log should be empty — initial scan data is in primary DB
    let logged = storage.query_since(0).await.unwrap();
    assert!(
        logged.is_empty(),
        "Change log should be empty after initial scan"
    );

    // Now a new change comes in
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO patients (id, name, updatedAt) VALUES ('p2', 'NewPatient', datetime('now', '+2 seconds'))",
            [],
        )
        .unwrap();
    }

    let output2 = watcher.poll_changes().await.unwrap();
    assert!(output2.is_incremental);
    // This time, write to change log
    if output2.is_incremental {
        for change in &output2.changes {
            storage.append_change(change).await.unwrap();
        }
    }

    // Change log should have only the incremental change
    let logged = storage.query_since(0).await.unwrap();
    assert_eq!(
        logged.len(),
        1,
        "Change log should only contain the incremental change"
    );
    assert_eq!(logged[0].document_id, "p2");
}

/// Regression test: after initial sync, new records inserted with created_at
/// but NULL updated_at should still be detected. This matches hapihub's behavior
/// where API creates set created_at but not updated_at.
#[tokio::test]
async fn test_watcher_detects_new_records_with_null_updated_at() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE counters (
            id TEXT PRIMARY KEY,
            name TEXT,
            organization TEXT,
            created_at TEXT,
            updated_at TEXT
        );",
    )
    .unwrap();
    let conn = Arc::new(Mutex::new(conn));

    let state = Arc::new(SyncState::new());
    let mut watcher = SqliteWatcher::new(
        conn.clone(),
        vec!["counters".to_string()],
        "test-peer".to_string(),
        state,
        HashMap::new(),
    );

    // Insert an existing record with proper updated_at (simulates initial sync data)
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO counters (id, name, created_at, updated_at) VALUES ('existing', 'old', datetime('now'), datetime('now'))",
            [],
        )
        .unwrap();
    }

    // Initial scan — picks up existing record
    let output = watcher.poll_changes().await.unwrap();
    assert_eq!(output.changes.len(), 1);
    assert!(!output.is_incremental);

    // Now a NEW record is created via hapihub API — has created_at but NULL updated_at
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO counters (id, name, organization, created_at, updated_at) VALUES ('new-c1', 'sync-test', 'org1', datetime('now', '+1 second'), NULL)",
            [],
        )
        .unwrap();
    }

    // Verify the record exists with NULL updated_at
    {
        let c = conn.lock().unwrap();
        let count: i32 = c.query_row("SELECT count(*) FROM counters WHERE updated_at IS NULL", [], |r| r.get(0)).unwrap();
        println!("Records with NULL updated_at: {}", count);
        let total: i32 = c.query_row("SELECT count(*) FROM counters", [], |r| r.get(0)).unwrap();
        println!("Total records: {}", total);
    }

    // Watcher should detect the new record even though updated_at is NULL
    let output = watcher.poll_changes().await.unwrap();
    println!("Changes detected: {} (incremental: {})", output.changes.len(), output.is_incremental);
    for c in &output.changes {
        println!("  doc_id: {}", c.document_id);
    }
    assert_eq!(
        output.changes.len(),
        1,
        "Watcher should detect new records with NULL updated_at (via created_at fallback)"
    );
    assert_eq!(output.changes[0].document_id, "new-c1");
}

/// Regression test: SQLite COALESCE query correctly handles the case where
/// updated_at is NULL by falling through to created_at. This mimics the PG
/// watcher's COALESCE(updated_at, created_at) pattern.
#[tokio::test]
async fn test_sqlite_coalesce_detects_null_updated_at() {
    let conn = Connection::open_in_memory().unwrap();
    // Use snake_case columns to force the COALESCE path (not the camelCase SQLite quirk)
    conn.execute_batch(
        "CREATE TABLE items (
            id TEXT PRIMARY KEY,
            name TEXT,
            organization TEXT,
            created_at TEXT,
            updated_at TEXT
        );",
    )
    .unwrap();

    // Insert record with both timestamps (simulates applier-written data)
    conn.execute(
        "INSERT INTO items (id, name, created_at, updated_at) VALUES ('i1', 'existing', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        [],
    ).unwrap();

    // Insert record with NULL updated_at (simulates hapihub API create)
    conn.execute(
        "INSERT INTO items (id, name, organization, created_at, updated_at) VALUES ('i2', 'new-item', 'org1', '2026-06-01T00:00:00Z', NULL)",
        [],
    ).unwrap();

    // The COALESCE query should find both records when watermark is before both
    let rows: Vec<String> = conn.prepare(
        "SELECT id FROM items WHERE COALESCE(\"updated_at\", \"created_at\") > ?1 ORDER BY COALESCE(\"updated_at\", \"created_at\") ASC"
    ).unwrap()
        .query_map(rusqlite::params!["2000-01-01T00:00:00Z"], |row| row.get(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    assert_eq!(rows, vec!["i1", "i2"], "COALESCE should find both records");

    // With watermark after i1 but before i2, should only find i2
    let rows: Vec<String> = conn.prepare(
        "SELECT id FROM items WHERE COALESCE(\"updated_at\", \"created_at\") > ?1 ORDER BY COALESCE(\"updated_at\", \"created_at\") ASC"
    ).unwrap()
        .query_map(rusqlite::params!["2026-03-01T00:00:00Z"], |row| row.get(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    assert_eq!(rows, vec!["i2"], "COALESCE should find record with NULL updated_at via created_at");

    // Plain updated_at query MISSES the NULL record
    let rows: Vec<String> = conn.prepare(
        "SELECT id FROM items WHERE \"updated_at\" > ?1 ORDER BY \"updated_at\" ASC"
    ).unwrap()
        .query_map(rusqlite::params!["2026-03-01T00:00:00Z"], |row| row.get(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    assert!(rows.is_empty(), "Plain updated_at query should miss NULL updated_at record");
}

/// Verify the watcher integration with COALESCE detects new records with NULL updated_at.
/// Simulates the exact scenario from the E2E test: initial sync populates data,
/// then a new record is created with NULL updated_at via API.
#[tokio::test]
async fn test_watcher_integration_null_updated_at_after_initial_sync() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE counters (
            id TEXT PRIMARY KEY,
            name TEXT,
            organization TEXT,
            type TEXT,
            created_at TEXT,
            updated_at TEXT
        );",
    )
    .unwrap();
    let conn = Arc::new(Mutex::new(conn));

    let state = Arc::new(SyncState::new());
    let mut watcher = SqliteWatcher::new(
        conn.clone(),
        vec!["counters".to_string()],
        "test-peer".to_string(),
        state,
        HashMap::new(),
    );

    // Phase 1: Populate with synced data (applier sets both timestamps)
    {
        let c = conn.lock().unwrap();
        for i in 0..5 {
            c.execute(
                &format!(
                    "INSERT INTO counters (id, name, organization, type, created_at, updated_at) \
                     VALUES ('synced-{}', 'counter-{}', 'org1', 'test', '2026-03-23T00:00:0{}Z', '2026-03-23T00:00:0{}Z')",
                    i, i, i, i
                ),
                [],
            ).unwrap();
        }
    }

    // Initial scan
    let output = watcher.poll_changes().await.unwrap();
    assert_eq!(output.changes.len(), 5, "Initial scan should find 5 records");
    assert!(!output.is_incremental);

    // Phase 2: New record created via hapihub API (NULL updated_at)
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO counters (id, name, organization, type, created_at, updated_at) \
             VALUES ('api-created', 'sync-test', 'org1', 'sync-test', '2026-03-23T01:00:00Z', NULL)",
            [],
        ).unwrap();
    }

    // Watcher poll should detect the new record
    let output = watcher.poll_changes().await.unwrap();
    assert!(output.is_incremental, "Should be incremental after initial scan");
    assert_eq!(
        output.changes.len(), 1,
        "Should detect exactly 1 new record (the API-created one with NULL updated_at)"
    );
    assert_eq!(output.changes[0].document_id, "api-created");

    // Phase 3: Another new record with NULL updated_at
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO counters (id, name, organization, type, created_at, updated_at) \
             VALUES ('api-created-2', 'sync-test-2', 'org1', 'sync-test', '2026-03-23T02:00:00Z', NULL)",
            [],
        ).unwrap();
    }

    let output = watcher.poll_changes().await.unwrap();
    assert_eq!(output.changes.len(), 1, "Should detect the second API-created record");
    assert_eq!(output.changes[0].document_id, "api-created-2");
}

/// Records with both created_at and updated_at set should still be detected.
#[tokio::test]
async fn test_watcher_detects_records_with_both_timestamps() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE counters (
            id TEXT PRIMARY KEY,
            name TEXT,
            created_at TEXT,
            updated_at TEXT
        );",
    )
    .unwrap();
    let conn = Arc::new(Mutex::new(conn));

    let state = Arc::new(SyncState::new());
    let mut watcher = SqliteWatcher::new(
        conn.clone(),
        vec!["counters".to_string()],
        "test-peer".to_string(),
        state,
        HashMap::new(),
    );

    // Initial scan (empty)
    watcher.poll_changes().await.unwrap();

    // Insert with both timestamps
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO counters (id, name, created_at, updated_at) VALUES ('c1', 'test', datetime('now', '+1 second'), datetime('now', '+1 second'))",
            [],
        )
        .unwrap();
    }

    let output = watcher.poll_changes().await.unwrap();
    assert_eq!(output.changes.len(), 1);

    // Update only updated_at
    {
        let c = conn.lock().unwrap();
        c.execute(
            "UPDATE counters SET name = 'updated', updated_at = datetime('now', '+2 seconds') WHERE id = 'c1'",
            [],
        )
        .unwrap();
    }

    let output = watcher.poll_changes().await.unwrap();
    assert_eq!(output.changes.len(), 1, "Should detect the update via updated_at");
}
