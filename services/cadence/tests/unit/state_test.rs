use cadence::state::{ChangeBroadcaster, FieldChange, RowChange, SyncPayload, SyncState};
use serde_json::json;

#[test]
fn test_lamport_clock_increment() {
    let state = SyncState::new();
    assert_eq!(state.lamport(), 0);
    let new_val = state.increment_lamport();
    assert_eq!(new_val, 1);
    assert_eq!(state.lamport(), 1);
    let new_val = state.increment_lamport();
    assert_eq!(new_val, 2);
}

#[test]
fn test_lamport_clock_merge_takes_max() {
    let state = SyncState::new();
    state.increment_lamport(); // local = 1
    state.merge_lamport(10); // merge with remote=10 → local = max(1, 10) + 1 = 11
    assert!(state.lamport() >= 11);
}

#[test]
fn test_local_seq_monotonic() {
    let state = SyncState::new();
    let mut prev = 0;
    for _ in 0..100 {
        let seq = state.next_seq();
        assert!(seq > prev, "Seq {} should be > {}", seq, prev);
        prev = seq;
    }
}

#[test]
fn test_peer_watermark_get_set() {
    let state = SyncState::new();
    state.set_watermark("peer-a", 42);
    assert_eq!(state.get_watermark("peer-a"), 42);
    state.set_watermark("peer-a", 100);
    assert_eq!(state.get_watermark("peer-a"), 100);
}

#[test]
fn test_peer_watermark_default_zero() {
    let state = SyncState::new();
    assert_eq!(state.get_watermark("nonexistent-peer"), 0);
}

#[test]
fn test_concurrent_lamport_increments() {
    use std::sync::Arc;
    use std::thread;

    let state = Arc::new(SyncState::new());
    let mut handles = Vec::new();

    for _ in 0..100 {
        let s = state.clone();
        handles.push(thread::spawn(move || s.increment_lamport()));
    }

    let mut values: Vec<u64> = handles.into_iter().map(|h| h.join().unwrap()).collect();
    values.sort();
    values.dedup();

    // All 100 increments should produce unique values
    assert_eq!(values.len(), 100, "All increments should produce unique values");
    assert_eq!(state.lamport(), 100);
}

fn make_test_change(doc_id: &str) -> RowChange {
    RowChange {
        collection: "test".to_string(),
        document_id: doc_id.to_string(),
        payload: SyncPayload::Fields(vec![FieldChange {
            field: "name".to_string(),
            value: json!("test"),
            lamport: 1,
            peer_id: "peer-a".to_string(),
        }]),
        deleted: false,
        seq: 1,
    }
}

#[test]
fn test_change_broadcaster_subscribe_receives() {
    let broadcaster = ChangeBroadcaster::new(16);
    let mut rx = broadcaster.subscribe();

    let changes = vec![make_test_change("p1")];
    broadcaster.broadcast(changes.clone());

    let received = rx.try_recv().unwrap();
    assert_eq!(received.len(), 1);
    assert_eq!(received[0].document_id, "p1");
}

#[test]
fn test_change_broadcaster_multiple_subscribers() {
    let broadcaster = ChangeBroadcaster::new(16);
    let mut rx1 = broadcaster.subscribe();
    let mut rx2 = broadcaster.subscribe();

    broadcaster.broadcast(vec![make_test_change("p1")]);

    let r1 = rx1.try_recv().unwrap();
    let r2 = rx2.try_recv().unwrap();
    assert_eq!(r1.len(), 1);
    assert_eq!(r2.len(), 1);
}

#[test]
fn test_change_broadcaster_no_receivers_ok() {
    let broadcaster = ChangeBroadcaster::new(16);
    // No subscribers — broadcast should not panic
    broadcaster.broadcast(vec![make_test_change("p1")]);
}

#[test]
fn test_change_broadcaster_dropped_sender_closes_rx() {
    let broadcaster = ChangeBroadcaster::new(16);
    let mut rx = broadcaster.subscribe();
    drop(broadcaster);

    let result = rx.try_recv();
    assert!(result.is_err(), "Receiver should error after sender is dropped");
}
