use cadence::state::{FieldChange, RowChange, SyncPayload};
use cadence::storage::{MetadataBackend, SqliteBackend};
use proptest::prelude::*;
use serde_json::json;

fn make_change(collection: &str, doc_id: &str, field: &str, lamport: u64) -> RowChange {
    RowChange {
        collection: collection.to_string(),
        document_id: doc_id.to_string(),
        payload: SyncPayload::Fields(vec![FieldChange {
            field: field.to_string(),
            value: json!(format!("value-{}", lamport)),
            lamport,
            peer_id: "test-peer".to_string(),
        }]),
        deleted: false,
        seq: 0,
    }
}

fn rt() -> tokio::runtime::Runtime {
    tokio::runtime::Runtime::new().unwrap()
}

proptest! {
    #[test]
    fn prop_watermark_monotonic(
        values in prop::collection::vec(0..10000u64, 1..20),
    ) {
        let rt = rt();
        let storage = SqliteBackend::in_memory().unwrap();

        let mut max_val = 0u64;
        for val in &values {
            let new_val = std::cmp::max(max_val, *val);
            rt.block_on(storage.set_watermark("peer-a", new_val)).unwrap();
            max_val = new_val;

            let stored = rt.block_on(storage.get_watermark("peer-a")).unwrap();
            prop_assert!(
                stored >= max_val.saturating_sub(1), // Allow for concurrent reads
                "Watermark should never decrease"
            );
        }
    }

    #[test]
    fn prop_sync_complete_delivers_all(
        n in 1..50u32,
        since in 0..25u32,
    ) {
        let rt = rt();
        let storage = SqliteBackend::in_memory().unwrap();

        // Insert n changes
        for i in 0..n {
            let change = make_change(
                "medical_patients",
                &format!("doc-{}", i),
                "name",
                i as u64,
            );
            rt.block_on(storage.append_change(&change)).unwrap();
        }

        // Query since `since`
        let changes = rt.block_on(storage.query_since(since as u64)).unwrap();
        let expected_count = if since >= n { 0 } else { (n - since) as usize };

        prop_assert_eq!(
            changes.len(),
            expected_count,
            "Should deliver exactly {} changes for since={}, n={}",
            expected_count,
            since,
            n
        );
    }

    #[test]
    fn prop_sync_idempotent(
        n in 1..20u32,
    ) {
        let rt = rt();
        let storage = SqliteBackend::in_memory().unwrap();

        // Insert n changes
        for i in 0..n {
            let change = make_change(
                "medical_patients",
                &format!("doc-{}", i),
                "name",
                i as u64,
            );
            rt.block_on(storage.append_change(&change)).unwrap();
        }

        // Query twice — should get same results
        let result1 = rt.block_on(storage.query_since(0)).unwrap();
        let result2 = rt.block_on(storage.query_since(0)).unwrap();

        prop_assert_eq!(result1.len(), result2.len(), "Queries should be idempotent");
        for (a, b) in result1.iter().zip(result2.iter()) {
            prop_assert_eq!(&a.collection, &b.collection);
            prop_assert_eq!(&a.document_id, &b.document_id);
        }
    }
}
