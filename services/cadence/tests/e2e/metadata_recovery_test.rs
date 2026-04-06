use cadence::state::{FieldChange, RowChange, SyncPayload, SyncState};
use cadence::storage::Storage;
use cadence::storage::MetadataBackend;
use serde_json::json;
use tempfile::TempDir;

async fn populate_storage(storage: &Storage, n: usize) {
    for i in 0..n {
        let change = RowChange {
            collection: "medical_patients".to_string(),
            document_id: format!("patient-{}", i),
            payload: SyncPayload::Fields(vec![FieldChange {
                field: "name".to_string(),
                value: json!(format!("Patient {}", i)),
                lamport: (i + 1) as u64,
                peer_id: "peer-a".to_string(),
            }]),
            deleted: false,
            seq: (i + 1) as u64,
        };
        storage.append_change(&change).await.unwrap();
    }
}

#[tokio::test]
async fn test_metadata_loss_triggers_full_resync() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("metadata.db");

    // Create and populate metadata
    {
        let storage = Storage::open(&path).unwrap();
        populate_storage(&storage, 10).await;
        storage.set_watermark("peer-b", 10).await.unwrap();
        assert_eq!(storage.max_seq().await.unwrap(), 10);
    }

    // Delete the metadata file (simulating metadata loss)
    std::fs::remove_file(&path).unwrap();
    assert!(!path.exists());

    // Reopen — this creates a fresh database
    let storage = Storage::open(&path).unwrap();

    // Watermark should be 0 (unknown peer)
    assert_eq!(storage.get_watermark("peer-b").await.unwrap(), 0,
        "After metadata loss, watermark should reset to 0");

    // Change log should be empty
    let changes = storage.query_since(0).await.unwrap();
    assert!(changes.is_empty(), "After metadata loss, change log should be empty");

    // This means the next sync will be a full sync (since_seq = 0)
    // The peer will request all changes from its partner
}

#[tokio::test]
async fn test_metadata_loss_no_data_loss() {
    // Primary DB is never affected by metadata operations
    // Simulate: metadata is lost but primary DB still has all data

    let dir = TempDir::new().unwrap();
    let primary_path = dir.path().join("primary.db");
    let metadata_path = dir.path().join("metadata.db");

    // Create primary DB with data
    let primary = rusqlite::Connection::open(&primary_path).unwrap();
    primary
        .execute_batch(
            "CREATE TABLE medical_patients (
                id TEXT PRIMARY KEY,
                name TEXT,
                facility TEXT
            )",
        )
        .unwrap();

    for i in 0..5 {
        primary
            .execute(
                "INSERT INTO medical_patients (id, name, facility) VALUES (?1, ?2, ?3)",
                rusqlite::params![format!("p{}", i), format!("Patient {}", i), "F1"],
            )
            .unwrap();
    }

    // Create and populate metadata
    {
        let storage = Storage::open(&metadata_path).unwrap();
        populate_storage(&storage, 5).await;
    }

    // Delete metadata
    std::fs::remove_file(&metadata_path).unwrap();

    // Primary DB should still have all data
    let count: i64 = primary
        .query_row("SELECT COUNT(*) FROM medical_patients", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 5, "Primary DB should still have all 5 patients");

    // After metadata recovery, a full resync will re-discover all primary DB data
    // and exchange with peers — but the primary data was never at risk
}

#[tokio::test]
async fn test_metadata_loss_lww_handles_duplicates() {
    // After metadata loss and full resync, both peers will send all their data.
    // If both sides have the same data (same value, same or lower lamport),
    // LWW merge is a no-op.

    use cadence::merge::lww::lww_merge_field;

    // Same field, same value, same lamport, same peer
    let local = FieldChange {
        field: "name".to_string(),
        value: json!("John"),
        lamport: 5,
        peer_id: "peer-a".to_string(),
    };

    let remote = FieldChange {
        field: "name".to_string(),
        value: json!("John"),
        lamport: 5,
        peer_id: "peer-a".to_string(),
    };

    let winner = lww_merge_field(&local, &remote);
    assert_eq!(winner.value, json!("John"), "Duplicate merge should be a no-op");
    assert_eq!(winner.lamport, 5);
    assert_eq!(winner.peer_id, "peer-a");

    // Rebuilding state from scratch
    let state = SyncState::new();
    assert_eq!(state.lamport(), 0, "Fresh state starts at 0");
    assert_eq!(state.local_seq(), 0, "Fresh seq starts at 0");
    assert_eq!(state.get_watermark("any-peer"), 0, "Fresh watermarks are 0");
}
