use cadence::merge::lww::{lww_merge_field, lww_merge_row};
use cadence::state::FieldChange;
use serde_json::json;

fn fc(field: &str, value: serde_json::Value, lamport: u64, peer_id: &str) -> FieldChange {
    FieldChange {
        field: field.to_string(),
        value,
        lamport,
        peer_id: peer_id.to_string(),
    }
}

#[test]
fn test_lww_remote_higher_lamport_wins() {
    let local = fc("name", json!("Local Name"), 5, "peer-a");
    let remote = fc("name", json!("Remote Name"), 10, "peer-b");
    let winner = lww_merge_field(&local, &remote);
    assert_eq!(winner.value, json!("Remote Name"));
    assert_eq!(winner.lamport, 10);
}

#[test]
fn test_lww_local_higher_lamport_wins() {
    let local = fc("status", json!("paid"), 10, "peer-a");
    let remote = fc("status", json!("draft"), 5, "peer-b");
    let winner = lww_merge_field(&local, &remote);
    assert_eq!(winner.value, json!("paid"));
    assert_eq!(winner.lamport, 10);
}

#[test]
fn test_lww_equal_lamport_higher_peer_id_wins() {
    let local = fc("name", json!("Local"), 10, "peer-a");
    let remote = fc("name", json!("Remote"), 10, "peer-b");
    let winner = lww_merge_field(&local, &remote);
    // peer-b > peer-a lexicographically, so remote wins
    assert_eq!(winner.value, json!("Remote"));
    assert_eq!(winner.peer_id, "peer-b");
}

#[test]
fn test_lww_equal_lamport_equal_peer_id() {
    let local = fc("name", json!("Value"), 10, "peer-a");
    let remote = fc("name", json!("Other"), 10, "peer-a");
    let winner = lww_merge_field(&local, &remote);
    // Same peer_id → local wins (>= means local)
    assert_eq!(winner.value, json!("Value"));
}

#[test]
fn test_lww_merge_multiple_fields() {
    let local_fields = vec![
        fc("type", json!("consultation"), 3, "peer-a"),
        fc("patient", json!("p1"), 3, "peer-a"),
        fc("draft", json!(false), 3, "peer-a"),
    ];

    let remote_fields = vec![
        fc("type", json!("follow-up"), 5, "peer-b"),  // remote wins (higher lamport)
        fc("patient", json!("p1"), 2, "peer-b"),       // local wins (higher lamport)
        fc("queueNumber", json!(42), 5, "peer-b"),     // new field from remote
    ];

    let merged = lww_merge_row(&local_fields, &remote_fields);
    assert_eq!(merged.len(), 4, "Should have 4 fields (3 existing + 1 new)");

    let by_field: std::collections::HashMap<&str, &FieldChange> =
        merged.iter().map(|fc| (fc.field.as_str(), fc)).collect();

    assert_eq!(by_field["type"].value, json!("follow-up")); // remote won
    assert_eq!(by_field["patient"].value, json!("p1")); // local won (lamport 3 > 2)
    assert_eq!(by_field["draft"].value, json!(false)); // only local
    assert_eq!(by_field["queueNumber"].value, json!(42)); // only remote
}

#[test]
fn test_lww_merge_json_object_field() {
    let local = fc(
        "totalDetails",
        json!({"subtotal": 1000, "tax": 120, "total": 1120}),
        5,
        "peer-a",
    );
    let remote = fc(
        "totalDetails",
        json!({"subtotal": 2000, "tax": 240, "total": 2240}),
        10,
        "peer-b",
    );
    let winner = lww_merge_field(&local, &remote);
    // JSON object replaced atomically
    assert_eq!(winner.value["total"], 2240);
}

#[test]
fn test_lww_merge_json_array_field() {
    let local = fc("doctors", json!(["doc-1"]), 5, "peer-a");
    let remote = fc("doctors", json!(["doc-1", "doc-2"]), 7, "peer-b");
    let winner = lww_merge_field(&local, &remote);
    assert_eq!(winner.value, json!(["doc-1", "doc-2"]));
}

#[test]
fn test_lww_merge_null_value() {
    let local = fc("name", json!("John"), 5, "peer-a");
    let remote = fc("name", json!(null), 10, "peer-b");
    let winner = lww_merge_field(&local, &remote);
    assert_eq!(winner.value, json!(null), "Null should be accepted");
}

#[test]
fn test_lww_merge_deleted_document() {
    // When a document is deleted, we set deleted=true on the RowChange.
    // Individual field values don't matter — the whole row is marked deleted.
    // Here we just test that the FieldChange with deleted-marker value works.
    let local = fc("name", json!("John"), 5, "peer-a");
    let remote = fc("name", json!(null), 10, "peer-b");
    let winner = lww_merge_field(&local, &remote);
    assert_eq!(winner.lamport, 10);
}

#[test]
fn test_lww_deterministic_across_peers() {
    // Same conflict resolved identically regardless of which peer runs the merge.
    let change_a = fc("name", json!("Alice"), 10, "peer-a");
    let change_b = fc("name", json!("Bob"), 10, "peer-b");

    // Peer A merges
    let winner_on_a = lww_merge_field(&change_a, &change_b);
    // Peer B merges (local/remote swapped)
    let winner_on_b = lww_merge_field(&change_b, &change_a);

    // Both peers should pick the same winner
    assert_eq!(winner_on_a.value, winner_on_b.value);
    assert_eq!(winner_on_a.peer_id, winner_on_b.peer_id);
}
