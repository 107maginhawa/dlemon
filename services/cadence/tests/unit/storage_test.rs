use cadence::state::{FieldChange, RowChange, SyncPayload};
use cadence::storage::{MetadataBackend, SqliteBackend};
use serde_json::json;
use tempfile::TempDir;

fn make_field_change(field: &str, value: serde_json::Value, lamport: u64) -> FieldChange {
    FieldChange {
        field: field.to_string(),
        value,
        lamport,
        peer_id: "test-peer".to_string(),
    }
}

fn make_row_change(collection: &str, doc_id: &str, fields: Vec<FieldChange>) -> RowChange {
    RowChange {
        collection: collection.to_string(),
        document_id: doc_id.to_string(),
        payload: SyncPayload::Fields(fields),
        deleted: false,
        seq: 0,
    }
}

#[tokio::test]
async fn test_change_log_append() {
    let storage = SqliteBackend::in_memory().unwrap();
    let change = make_row_change(
        "medical_patients",
        "patient-1",
        vec![make_field_change("name", json!("John"), 1)],
    );
    let seq = storage.append_change(&change).await.unwrap();
    assert!(seq > 0, "Seq should be auto-incremented");

    let change2 = make_row_change(
        "medical_patients",
        "patient-2",
        vec![make_field_change("name", json!("Jane"), 2)],
    );
    let seq2 = storage.append_change(&change2).await.unwrap();
    assert!(seq2 > seq, "Second seq should be greater");
}

#[tokio::test]
async fn test_change_log_query_since_seq() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Insert 10 changes
    for i in 1..=10 {
        let change = make_row_change(
            "medical_patients",
            &format!("patient-{}", i),
            vec![make_field_change("name", json!(format!("Patient {}", i)), i)],
        );
        storage.append_change(&change).await.unwrap();
    }

    // Query since seq 5
    let changes = storage.query_since(5).await.unwrap();
    assert_eq!(changes.len(), 5, "Should get 5 changes (seq 6-10)");
}

#[tokio::test]
async fn test_change_log_query_by_collection_doc() {
    let storage = SqliteBackend::in_memory().unwrap();

    storage
        .append_change(&make_row_change(
            "medical_patients",
            "doc-1",
            vec![make_field_change("name", json!("A"), 1)],
        ))
        .await
        .unwrap();
    storage
        .append_change(&make_row_change(
            "billing_invoices",
            "doc-2",
            vec![make_field_change("status", json!("draft"), 2)],
        ))
        .await
        .unwrap();
    storage
        .append_change(&make_row_change(
            "medical_patients",
            "doc-1",
            vec![make_field_change("tags", json!(["vip"]), 3)],
        ))
        .await
        .unwrap();

    let changes = storage
        .query_by_doc("medical_patients", "doc-1")
        .await
        .unwrap();
    assert_eq!(changes.len(), 1, "Should aggregate into 1 RowChange");
    if let SyncPayload::Fields(fields) = &changes[0].payload {
        assert_eq!(fields.len(), 2, "Should have 2 field changes (name + tags)");
    } else {
        panic!("Expected Fields payload");
    }
}

#[tokio::test]
async fn test_watermark_table_upsert() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Initial watermark should be 0
    assert_eq!(storage.get_watermark("peer-a").await.unwrap(), 0);

    // Set watermark
    storage.set_watermark("peer-a", 42).await.unwrap();
    assert_eq!(storage.get_watermark("peer-a").await.unwrap(), 42);

    // Update watermark
    storage.set_watermark("peer-a", 100).await.unwrap();
    assert_eq!(storage.get_watermark("peer-a").await.unwrap(), 100);
}

#[tokio::test]
async fn test_change_log_deleted_flag() {
    let storage = SqliteBackend::in_memory().unwrap();

    let change = RowChange {
        collection: "medical_patients".to_string(),
        document_id: "patient-deleted".to_string(),
        payload: SyncPayload::Fields(vec![make_field_change("name", json!("Gone"), 1)]),
        deleted: true,
        seq: 0,
    };
    storage.append_change(&change).await.unwrap();

    let changes = storage.query_since(0).await.unwrap();
    assert_eq!(changes.len(), 1);
    assert!(changes[0].deleted, "Deleted flag should round-trip");
}

#[tokio::test]
async fn test_compaction_keeps_latest() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Insert 5 updates to the same field
    for i in 1..=5 {
        let change = make_row_change(
            "medical_patients",
            "patient-1",
            vec![make_field_change("name", json!(format!("Name {}", i)), i)],
        );
        storage.append_change(&change).await.unwrap();
    }

    let before = storage.query_since(0).await.unwrap();
    assert_eq!(before.len(), 1); // Aggregated into 1 row

    let deleted = storage.compact().await.unwrap();
    assert_eq!(deleted, 4, "Should compact 4 old entries");

    let after = storage.query_since(0).await.unwrap();
    assert_eq!(after.len(), 1);
    if let SyncPayload::Fields(fields) = &after[0].payload {
        assert_eq!(fields.len(), 1);
        assert_eq!(fields[0].value, json!("Name 5"), "Should keep latest value");
    }
}

#[tokio::test]
async fn test_compaction_preserves_different_docs() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Insert changes for 3 different documents
    for i in 1..=3 {
        let change = make_row_change(
            "medical_patients",
            &format!("patient-{}", i),
            vec![make_field_change("name", json!(format!("Patient {}", i)), i as u64)],
        );
        storage.append_change(&change).await.unwrap();
    }

    let deleted = storage.compact().await.unwrap();
    assert_eq!(deleted, 0, "No duplicates to compact");

    let changes = storage.query_since(0).await.unwrap();
    assert_eq!(changes.len(), 3, "All 3 docs should be preserved");
}

#[test]
fn test_storage_schema_creation() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("new_metadata.db");
    assert!(!path.exists());

    let _storage = SqliteBackend::open(&path).unwrap();
    assert!(path.exists(), "Database file should be created");
}

#[tokio::test]
async fn test_storage_reopen_preserves_data() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("persistent.db");

    // Write data
    {
        let storage = SqliteBackend::open(&path).unwrap();
        storage
            .append_change(&make_row_change(
                "medical_patients",
                "patient-1",
                vec![make_field_change("name", json!("Persistent"), 1)],
            ))
            .await
            .unwrap();
        storage.set_watermark("peer-a", 99).await.unwrap();
    }

    // Reopen and verify
    {
        let storage = SqliteBackend::open(&path).unwrap();
        let changes = storage.query_since(0).await.unwrap();
        assert_eq!(changes.len(), 1);
        assert_eq!(storage.get_watermark("peer-a").await.unwrap(), 99);
    }
}

#[tokio::test]
async fn test_query_since_batched_limits_results() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Insert 20 changes (each with 1 field = 1 raw row)
    for i in 1..=20 {
        let change = make_row_change(
            "medical_patients",
            &format!("patient-{}", i),
            vec![make_field_change("name", json!(format!("Patient {}", i)), i)],
        );
        storage.append_change(&change).await.unwrap();
    }

    // Batch of 5 raw rows — should get at most 5 RowChanges and has_more=true
    let (changes, has_more) = storage.query_since_batched(0, 5).await.unwrap();
    assert!(changes.len() <= 5, "Should return at most 5 changes, got {}", changes.len());
    assert!(has_more, "Should indicate more data available");
}

#[tokio::test]
async fn test_query_since_batched_exhaustion() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Insert 3 changes
    for i in 1..=3 {
        let change = make_row_change(
            "medical_patients",
            &format!("patient-{}", i),
            vec![make_field_change("name", json!(format!("Patient {}", i)), i)],
        );
        storage.append_change(&change).await.unwrap();
    }

    // Batch of 100 — should get all 3 and has_more=false
    let (changes, has_more) = storage.query_since_batched(0, 100).await.unwrap();
    assert_eq!(changes.len(), 3);
    assert!(!has_more, "Should indicate no more data");
}

#[tokio::test]
async fn test_query_since_batched_cursor_pagination() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Insert 50 changes (1 field each = 1 raw row each)
    for i in 1..=50 {
        let change = make_row_change(
            "medical_patients",
            &format!("patient-{}", i),
            vec![make_field_change("name", json!(format!("Patient {}", i)), i)],
        );
        storage.append_change(&change).await.unwrap();
    }

    // Page through with batch size 10
    let mut cursor = 0u64;
    let mut all_doc_ids: Vec<String> = Vec::new();
    let mut pages = 0;

    loop {
        let (changes, has_more) = storage.query_since_batched(cursor, 10).await.unwrap();
        if changes.is_empty() { break; }

        for change in &changes {
            all_doc_ids.push(change.document_id.clone());
            cursor = std::cmp::max(cursor, change.seq);
        }
        pages += 1;

        if !has_more { break; }
    }

    assert_eq!(all_doc_ids.len(), 50, "Should retrieve all 50 documents across pages");
    assert!(pages >= 5, "Should take at least 5 pages with batch size 10");

    // Verify no duplicates
    let unique: std::collections::HashSet<&String> = all_doc_ids.iter().collect();
    assert_eq!(unique.len(), 50, "Should have no duplicate documents");
}
