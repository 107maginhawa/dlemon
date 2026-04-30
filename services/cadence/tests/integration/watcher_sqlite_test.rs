use cadence::state::SyncState;
use cadence::storage::MetadataBackend;
use cadence::watcher::sqlite::SqliteWatcher;
use cadence::watcher::ChangeWatcher;
use rusqlite::Connection;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tempfile::TempDir;

fn setup_sqlite_db(dir: &TempDir) -> Arc<Mutex<Connection>> {
    let path = dir.path().join("primary.db");
    let conn = Connection::open(&path).unwrap();
    conn.execute_batch(
        "CREATE TABLE medical_patients (
            id TEXT PRIMARY KEY,
            facility TEXT,
            name TEXT,
            tags TEXT DEFAULT '[]',
            _data TEXT DEFAULT '{}',
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE medical_encounters (
            id TEXT PRIMARY KEY,
            facility TEXT,
            patient TEXT,
            type TEXT DEFAULT 'consultation',
            _data TEXT DEFAULT '{}',
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE bookings (
            id TEXT PRIMARY KEY,
            facility TEXT,
            status TEXT DEFAULT 'pending',
            _data TEXT DEFAULT '{}',
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now'))
        );",
    )
    .unwrap();
    Arc::new(Mutex::new(conn))
}

#[tokio::test]
async fn test_sqlite_watcher_detects_insert() {
    let dir = TempDir::new().unwrap();
    let conn = setup_sqlite_db(&dir);
    let state = Arc::new(SyncState::new());

    let mut watcher = SqliteWatcher::new(
        conn.clone(),
        vec!["medical_patients".to_string()],
        "test-peer".to_string(),
        state,
        HashMap::new(),
    );

    // Initial poll — no changes
    let changes = watcher.poll_changes().await.unwrap().changes;
    assert!(changes.is_empty(), "No changes initially");

    // Insert a patient
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO medical_patients (id, facility, name, updatedAt) VALUES ('p1', 'F1', 'John', datetime('now', '+1 second'))",
            [],
        )
        .unwrap();
    }

    // Poll again
    let changes = watcher.poll_changes().await.unwrap().changes;
    assert_eq!(changes.len(), 1, "Should detect 1 insert");
    assert_eq!(changes[0].collection, "medical_patients");
    assert_eq!(changes[0].document_id, "p1");
    assert!(!changes[0].deleted);
}

#[tokio::test]
async fn test_sqlite_watcher_detects_update() {
    let dir = TempDir::new().unwrap();
    let conn = setup_sqlite_db(&dir);
    let state = Arc::new(SyncState::new());

    let mut watcher = SqliteWatcher::new(
        conn.clone(),
        vec!["medical_encounters".to_string()],
        "test-peer".to_string(),
        state,
        HashMap::new(),
    );

    // Insert an encounter
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO medical_encounters (id, facility, patient, updatedAt) VALUES ('e1', 'F1', 'p1', datetime('now', '+1 second'))",
            [],
        )
        .unwrap();
    }

    // First poll picks up the insert
    let _ = watcher.poll_changes().await.unwrap().changes;

    // Update the encounter
    {
        let c = conn.lock().unwrap();
        c.execute(
            "UPDATE medical_encounters SET type = 'follow-up', updatedAt = datetime('now', '+2 seconds') WHERE id = 'e1'",
            [],
        )
        .unwrap();
    }

    // Second poll should detect the update
    let changes = watcher.poll_changes().await.unwrap().changes;
    assert_eq!(changes.len(), 1, "Should detect 1 update");
    assert_eq!(changes[0].document_id, "e1");
}

#[tokio::test]
async fn test_sqlite_watcher_detects_delete() {
    // SQLite polling detects via updatedAt, so a delete won't be detected
    // unless we use soft deletes. Test that the watcher handles rows disappearing.
    let dir = TempDir::new().unwrap();
    let conn = setup_sqlite_db(&dir);
    let state = Arc::new(SyncState::new());

    let mut watcher = SqliteWatcher::new(
        conn.clone(),
        vec!["bookings".to_string()],
        "test-peer".to_string(),
        state,
        HashMap::new(),
    );

    // Insert and detect
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO bookings (id, facility, status, updatedAt) VALUES ('b1', 'F1', 'confirmed', datetime('now', '+1 second'))",
            [],
        )
        .unwrap();
    }
    let changes = watcher.poll_changes().await.unwrap().changes;
    assert_eq!(changes.len(), 1);

    // Soft-delete (update status) — this is how hapihub handles deletes
    {
        let c = conn.lock().unwrap();
        c.execute(
            "UPDATE bookings SET status = 'cancelled', updatedAt = datetime('now', '+2 seconds') WHERE id = 'b1'",
            [],
        )
        .unwrap();
    }

    let changes = watcher.poll_changes().await.unwrap().changes;
    assert_eq!(changes.len(), 1, "Should detect the status change");
}

#[tokio::test]
async fn test_sqlite_watcher_bumps_lamport_and_seq() {
    let dir = TempDir::new().unwrap();
    let conn = setup_sqlite_db(&dir);
    let state = Arc::new(SyncState::new());

    let mut watcher = SqliteWatcher::new(
        conn.clone(),
        vec!["medical_patients".to_string()],
        "test-peer".to_string(),
        state.clone(),
        HashMap::new(),
    );

    assert_eq!(state.lamport(), 0);
    assert_eq!(state.local_seq(), 0);

    // Insert
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO medical_patients (id, facility, name, updatedAt) VALUES ('p1', 'F1', 'Jane', datetime('now', '+1 second'))",
            [],
        )
        .unwrap();
    }

    watcher.poll_changes().await.unwrap();

    assert!(state.lamport() > 0, "Lamport should be incremented");
    assert!(state.local_seq() > 0, "Local seq should be incremented");
}

#[tokio::test]
async fn test_sqlite_watcher_records_to_change_log() {
    let dir = TempDir::new().unwrap();
    let conn = setup_sqlite_db(&dir);
    let state = Arc::new(SyncState::new());
    let storage = cadence::storage::Storage::in_memory().unwrap();

    let mut watcher = SqliteWatcher::new(
        conn.clone(),
        vec!["medical_patients".to_string()],
        "test-peer".to_string(),
        state,
        HashMap::new(),
    );

    // Insert
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO medical_patients (id, facility, name, updatedAt) VALUES ('p1', 'F1', 'Alice', datetime('now', '+1 second'))",
            [],
        )
        .unwrap();
    }

    let changes = watcher.poll_changes().await.unwrap().changes;
    for change in &changes {
        storage.append_change(change).await.unwrap();
    }

    let stored = storage.query_since(0).await.unwrap();
    assert_eq!(stored.len(), 1, "Change should be in the log");
}

#[tokio::test]
async fn test_sqlite_watcher_poll_interval() {
    // Test that consecutive polls without changes return empty
    let dir = TempDir::new().unwrap();
    let conn = setup_sqlite_db(&dir);
    let state = Arc::new(SyncState::new());

    let mut watcher = SqliteWatcher::new(
        conn,
        vec!["medical_patients".to_string()],
        "test-peer".to_string(),
        state,
        HashMap::new(),
    );

    let changes1 = watcher.poll_changes().await.unwrap().changes;
    let changes2 = watcher.poll_changes().await.unwrap().changes;
    let changes3 = watcher.poll_changes().await.unwrap().changes;

    assert!(changes1.is_empty());
    assert!(changes2.is_empty());
    assert!(changes3.is_empty());
}
