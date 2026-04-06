use cadence::auth::SyncClaims;
use cadence::state::{FieldChange, RowChange, SyncPayload};
use cadence::storage::Storage;
use cadence::storage::MetadataBackend;
use serde_json::json;
use std::collections::{BTreeMap, HashMap};

fn make_scoped_change(collection: &str, doc_id: &str, scope_field: &str, scope_val: &str, lamport: u64) -> RowChange {
    RowChange {
        collection: collection.to_string(),
        document_id: doc_id.to_string(),
        payload: SyncPayload::Fields(vec![
            FieldChange {
                field: scope_field.to_string(),
                value: json!(scope_val),
                lamport,
                peer_id: "test-peer".to_string(),
            },
            FieldChange {
                field: "name".to_string(),
                value: json!(format!("record-{}", doc_id)),
                lamport,
                peer_id: "test-peer".to_string(),
            },
        ]),
        deleted: false,
        seq: 0,
    }
}

fn claims_with_scopes(scopes: &[(&str, Vec<&str>)]) -> SyncClaims {
    let scopes_map: HashMap<String, Vec<String>> = scopes
        .iter()
        .map(|(k, v)| (k.to_string(), v.iter().map(|s| s.to_string()).collect()))
        .collect();

    SyncClaims {
        sub: "test".to_string(),
        iss: "cadence".to_string(),
        aud: None,
        exp: None,
        nbf: None,
        iat: None,
        peer_id: Some("test-peer".to_string()),
        read_only: false,
        scopes: scopes_map,
    }
}

fn scope_columns(entries: &[(&str, &str)]) -> BTreeMap<String, String> {
    entries
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect()
}

/// Helper to filter changes using scope logic (simulates SyncEngine::filter_changes).
fn filter_changes(
    changes: Vec<RowChange>,
    claims: &SyncClaims,
    scope_cols: &BTreeMap<String, String>,
) -> Vec<RowChange> {
    changes
        .into_iter()
        .filter(|c| {
            if scope_cols.is_empty() {
                return true;
            }
            let mut row_fields = HashMap::new();
            if let SyncPayload::Fields(ref fields) = c.payload {
                for fc in fields {
                    if let serde_json::Value::String(ref s) = fc.value {
                        row_fields.insert(fc.field.clone(), s.clone());
                    }
                }
            }
            claims.row_in_scope(scope_cols, &row_fields)
        })
        .collect()
}

#[tokio::test]
async fn test_scope_filters_by_dimension() {
    let storage = Storage::in_memory().unwrap();
    let sc = scope_columns(&[("workspace_id", "workspace_id")]);

    for (i, ws) in ["ws-1", "ws-2", "ws-3"].iter().enumerate() {
        let change = make_scoped_change("projects", &format!("p{}", i), "workspace_id", ws, (i + 1) as u64);
        storage.append_change(&change).await.unwrap();
    }

    let all_changes = storage.query_since(0).await.unwrap();
    assert_eq!(all_changes.len(), 3);

    let claims = claims_with_scopes(&[("workspace_id", vec!["ws-1", "ws-2"])]);
    let filtered = filter_changes(all_changes, &claims, &sc);
    assert_eq!(filtered.len(), 2, "Should only get ws-1 and ws-2, not ws-3");
}

#[tokio::test]
async fn test_scope_wildcard_gets_all() {
    let storage = Storage::in_memory().unwrap();
    let sc = scope_columns(&[("workspace_id", "workspace_id")]);

    for (i, ws) in ["ws-1", "ws-2", "ws-3"].iter().enumerate() {
        let change = make_scoped_change("projects", &format!("p{}", i), "workspace_id", ws, (i + 1) as u64);
        storage.append_change(&change).await.unwrap();
    }

    let all_changes = storage.query_since(0).await.unwrap();
    let claims = claims_with_scopes(&[("workspace_id", vec!["*"])]);
    let filtered = filter_changes(all_changes, &claims, &sc);
    assert_eq!(filtered.len(), 3, "Wildcard peer should get all rows");
}

#[test]
fn test_scope_multi_dimension_or_logic() {
    let sc = scope_columns(&[("org_id", "org_id"), ("user_id", "user_id")]);

    // Row has org_id=org-1, user_id=u-99
    let change = RowChange {
        collection: "settings".to_string(),
        document_id: "s1".to_string(),
        payload: SyncPayload::Fields(vec![
            FieldChange { field: "org_id".to_string(), value: json!("org-1"), lamport: 1, peer_id: "p".to_string() },
            FieldChange { field: "user_id".to_string(), value: json!("u-99"), lamport: 1, peer_id: "p".to_string() },
        ]),
        deleted: false,
        seq: 1,
    };

    // Claims: org_id=org-1, user_id=u-5
    let claims = claims_with_scopes(&[("org_id", vec!["org-1"]), ("user_id", vec!["u-5"])]);

    // OR logic: org_id matches → passes even though user_id doesn't
    let filtered = filter_changes(vec![change], &claims, &sc);
    assert_eq!(filtered.len(), 1);
}

#[test]
fn test_scope_missing_dimension_denied() {
    let sc = scope_columns(&[("workspace_id", "workspace_id")]);

    let change = make_scoped_change("projects", "p1", "workspace_id", "ws-1", 1);

    // Claims have org_id but not workspace_id
    let claims = claims_with_scopes(&[("org_id", vec!["org-1"])]);
    let filtered = filter_changes(vec![change], &claims, &sc);
    assert_eq!(filtered.len(), 0, "No workspace_id dimension → denied");
}

#[test]
fn test_scope_cross_isolation() {
    let sc = scope_columns(&[("workspace_id", "workspace_id")]);

    let change_a = make_scoped_change("projects", "p1", "workspace_id", "ws-a", 1);
    let change_b = make_scoped_change("projects", "p2", "workspace_id", "ws-b", 2);

    let claims_a = claims_with_scopes(&[("workspace_id", vec!["ws-a"])]);
    let claims_b = claims_with_scopes(&[("workspace_id", vec!["ws-b"])]);

    let filtered_a = filter_changes(vec![change_a.clone(), change_b.clone()], &claims_a, &sc);
    assert_eq!(filtered_a.len(), 1);
    assert_eq!(filtered_a[0].document_id, "p1");

    let filtered_b = filter_changes(vec![change_a, change_b], &claims_b, &sc);
    assert_eq!(filtered_b.len(), 1);
    assert_eq!(filtered_b[0].document_id, "p2");
}

#[test]
fn test_scope_intersection_between_peers() {
    let claims_a = claims_with_scopes(&[("workspace_id", vec!["ws-1", "ws-2"])]);
    let claims_b = claims_with_scopes(&[("workspace_id", vec!["ws-2", "ws-3"])]);

    let intersection = claims_a.scope_intersection(&claims_b);
    let ws_vals = intersection.get("workspace_id").unwrap();
    assert_eq!(ws_vals, &vec!["ws-2".to_string()]);
}

#[test]
fn test_scope_read_only_cannot_push() {
    let claims = SyncClaims {
        sub: "readonly".to_string(),
        iss: "".to_string(),
        aud: None, exp: None, nbf: None, iat: None,
        peer_id: None,
        read_only: true,
        scopes: [("workspace_id".to_string(), vec!["ws-1".to_string()])].into(),
    };

    assert!(!claims.can_write(), "Read-only peer cannot push");
    assert!(claims.has_scope_value("workspace_id", "ws-1"), "Can still read ws-1");
}

#[test]
fn test_scope_unscoped_collection_passes_all() {
    let sc = BTreeMap::new(); // No scope columns configured

    let change = make_scoped_change("organizations", "org1", "name", "My Org", 1);

    let claims = claims_with_scopes(&[("workspace_id", vec!["ws-1"])]);
    let filtered = filter_changes(vec![change], &claims, &sc);
    assert_eq!(filtered.len(), 1, "Unscoped collection should pass all rows");
}
