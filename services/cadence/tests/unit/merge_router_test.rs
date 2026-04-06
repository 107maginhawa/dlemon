use cadence::config::{CadenceConfig, CollectionConfig, ConflictStrategy};
use cadence::merge::{MergeResult, MergeRouter};
use cadence::state::{FieldChange, RowChange, SyncPayload};
use serde_json::json;
use std::collections::BTreeMap;

fn test_config() -> CadenceConfig {
    let mut collections = BTreeMap::new();
    collections.insert(
        "medical_patients".to_string(),
        CollectionConfig {
            strategy: ConflictStrategy::Lww,
            scope_columns: [("facility_id".to_string(), "facility".to_string())].into(),
            scope_rules: None,
        },
    );
    collections.insert(
        "clinical_notes".to_string(),
        CollectionConfig {
            strategy: ConflictStrategy::Crdt,
            scope_columns: [("facility_id".to_string(), "facility".to_string())].into(),
            scope_rules: None,
        },
    );

    CadenceConfig {
        collections,
        default_strategy: ConflictStrategy::Lww,
        ..Default::default()
    }
}

#[test]
fn test_router_lww_collection() {
    let config = test_config();
    let router = MergeRouter::new(&config);

    let change = RowChange {
        collection: "medical_patients".to_string(),
        document_id: "p1".to_string(),
        payload: SyncPayload::Fields(vec![FieldChange {
            field: "name".to_string(),
            value: json!("John"),
            lamport: 5,
            peer_id: "peer-b".to_string(),
        }]),
        deleted: false,
        seq: 1,
    };

    let result = router.merge(&change, &[]);
    match result {
        MergeResult::Lww(fields) => {
            assert_eq!(fields.len(), 1);
            assert_eq!(fields[0].value, json!("John"));
        }
        other => panic!("Expected Lww, got {:?}", other),
    }
}

#[test]
fn test_router_crdt_collection() {
    let config = test_config();
    let router = MergeRouter::new(&config);

    let crdt_bytes = vec![1, 2, 3, 4];
    let change = RowChange {
        collection: "clinical_notes".to_string(),
        document_id: "note-1".to_string(),
        payload: SyncPayload::CrdtDoc(crdt_bytes.clone()),
        deleted: false,
        seq: 1,
    };

    let result = router.merge(&change, &[]);
    match result {
        MergeResult::Crdt(bytes) => {
            assert_eq!(bytes, crdt_bytes);
        }
        other => panic!("Expected Crdt, got {:?}", other),
    }
}

#[test]
fn test_router_unconfigured_uses_default() {
    let config = test_config();
    let router = MergeRouter::new(&config);

    assert_eq!(
        router.strategy_for("unknown_table"),
        ConflictStrategy::Lww
    );

    let change = RowChange {
        collection: "unknown_table".to_string(),
        document_id: "doc-1".to_string(),
        payload: SyncPayload::Fields(vec![FieldChange {
            field: "value".to_string(),
            value: json!(42),
            lamport: 1,
            peer_id: "peer-a".to_string(),
        }]),
        deleted: false,
        seq: 1,
    };

    let result = router.merge(&change, &[]);
    assert!(matches!(result, MergeResult::Lww(_)));
}

#[test]
fn test_router_mixed_batch() {
    let config = test_config();
    let router = MergeRouter::new(&config);

    // LWW change
    let lww_change = RowChange {
        collection: "medical_patients".to_string(),
        document_id: "p1".to_string(),
        payload: SyncPayload::Fields(vec![FieldChange {
            field: "name".to_string(),
            value: json!("Alice"),
            lamport: 1,
            peer_id: "peer-a".to_string(),
        }]),
        deleted: false,
        seq: 1,
    };

    // CRDT change
    let crdt_change = RowChange {
        collection: "clinical_notes".to_string(),
        document_id: "note-1".to_string(),
        payload: SyncPayload::CrdtDoc(vec![5, 6, 7]),
        deleted: false,
        seq: 2,
    };

    let lww_result = router.merge(&lww_change, &[]);
    let crdt_result = router.merge(&crdt_change, &[]);

    assert!(matches!(lww_result, MergeResult::Lww(_)));
    assert!(matches!(crdt_result, MergeResult::Crdt(_)));
}
