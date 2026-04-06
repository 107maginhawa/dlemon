use cadence::storage::{CatchupCheckpoint, MetadataBackend, SqliteBackend};
use chrono::{Duration, Utc};

#[tokio::test]
async fn test_catchup_checkpoint_roundtrip() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Initially no checkpoint
    let cp = storage.get_catchup_checkpoint("peer-a").await.unwrap();
    assert!(cp.is_none(), "No checkpoint should exist initially");

    // Set checkpoint
    let checkpoint = CatchupCheckpoint {
        last_seq: 500,
        started_at: Utc::now().to_rfc3339(),
        is_complete: false,
    };
    storage.set_catchup_checkpoint("peer-a", &checkpoint).await.unwrap();

    // Read it back
    let cp = storage.get_catchup_checkpoint("peer-a").await.unwrap();
    assert!(cp.is_some(), "Checkpoint should exist");
    let cp = cp.unwrap();
    assert_eq!(cp.last_seq, 500);
    assert!(!cp.is_complete);
}

#[tokio::test]
async fn test_catchup_checkpoint_update() {
    let storage = SqliteBackend::in_memory().unwrap();
    let started_at = Utc::now().to_rfc3339();

    // Set initial checkpoint
    storage.set_catchup_checkpoint("peer-a", &CatchupCheckpoint {
        last_seq: 100,
        started_at: started_at.clone(),
        is_complete: false,
    }).await.unwrap();

    // Update checkpoint
    storage.set_catchup_checkpoint("peer-a", &CatchupCheckpoint {
        last_seq: 200,
        started_at: started_at.clone(),
        is_complete: false,
    }).await.unwrap();

    // Verify update
    let cp = storage.get_catchup_checkpoint("peer-a").await.unwrap().unwrap();
    assert_eq!(cp.last_seq, 200, "Checkpoint should be updated");
}

#[tokio::test]
async fn test_catchup_checkpoint_complete() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Set checkpoint
    storage.set_catchup_checkpoint("peer-a", &CatchupCheckpoint {
        last_seq: 1000,
        started_at: Utc::now().to_rfc3339(),
        is_complete: false,
    }).await.unwrap();

    // Complete catchup
    storage.complete_catchup("peer-a").await.unwrap();

    // Checkpoint should be gone
    let cp = storage.get_catchup_checkpoint("peer-a").await.unwrap();
    assert!(cp.is_none(), "Checkpoint should be deleted after completion");
}

#[tokio::test]
async fn test_catchup_checkpoint_delete() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Set checkpoint
    storage.set_catchup_checkpoint("peer-a", &CatchupCheckpoint {
        last_seq: 500,
        started_at: Utc::now().to_rfc3339(),
        is_complete: false,
    }).await.unwrap();

    // Delete checkpoint
    storage.delete_catchup_checkpoint("peer-a").await.unwrap();

    // Checkpoint should be gone
    let cp = storage.get_catchup_checkpoint("peer-a").await.unwrap();
    assert!(cp.is_none(), "Checkpoint should be deleted");
}

#[tokio::test]
async fn test_catchup_checkpoint_stale_cleanup() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Set a stale checkpoint (25 hours ago)
    let stale_time = Utc::now() - Duration::hours(25);
    storage.set_catchup_checkpoint("peer-a", &CatchupCheckpoint {
        last_seq: 500,
        started_at: stale_time.to_rfc3339(),
        is_complete: false,
    }).await.unwrap();

    // Read should return None and delete the stale checkpoint
    let cp = storage.get_catchup_checkpoint("peer-a").await.unwrap();
    assert!(cp.is_none(), "Stale checkpoint should be cleaned up on read");
}

#[tokio::test]
async fn test_catchup_checkpoint_fresh_not_stale() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Set a recent checkpoint
    storage.set_catchup_checkpoint("peer-a", &CatchupCheckpoint {
        last_seq: 500,
        started_at: Utc::now().to_rfc3339(),
        is_complete: false,
    }).await.unwrap();

    // Read should return the checkpoint
    let cp = storage.get_catchup_checkpoint("peer-a").await.unwrap();
    assert!(cp.is_some(), "Fresh checkpoint should not be cleaned up");
}

#[tokio::test]
async fn test_catchup_checkpoint_multiple_peers() {
    let storage = SqliteBackend::in_memory().unwrap();
    let now = Utc::now().to_rfc3339();

    // Set checkpoints for multiple peers
    storage.set_catchup_checkpoint("peer-a", &CatchupCheckpoint {
        last_seq: 100,
        started_at: now.clone(),
        is_complete: false,
    }).await.unwrap();

    storage.set_catchup_checkpoint("peer-b", &CatchupCheckpoint {
        last_seq: 200,
        started_at: now.clone(),
        is_complete: false,
    }).await.unwrap();

    // Verify each peer has its own checkpoint
    let cp_a = storage.get_catchup_checkpoint("peer-a").await.unwrap().unwrap();
    let cp_b = storage.get_catchup_checkpoint("peer-b").await.unwrap().unwrap();

    assert_eq!(cp_a.last_seq, 100);
    assert_eq!(cp_b.last_seq, 200);

    // Complete one peer, verify other is unaffected
    storage.complete_catchup("peer-a").await.unwrap();

    assert!(storage.get_catchup_checkpoint("peer-a").await.unwrap().is_none());
    assert!(storage.get_catchup_checkpoint("peer-b").await.unwrap().is_some());
}

#[tokio::test]
async fn test_peer_address_mapping_roundtrip() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Initially no mapping
    let peer_id = storage.get_peer_id_by_address("ws://example.com/sync").await.unwrap();
    assert!(peer_id.is_none(), "No mapping should exist initially");

    // Set mapping
    storage.set_peer_address_mapping("ws://example.com/sync", "peer-123").await.unwrap();

    // Read it back
    let peer_id = storage.get_peer_id_by_address("ws://example.com/sync").await.unwrap();
    assert_eq!(peer_id, Some("peer-123".to_string()));
}

#[tokio::test]
async fn test_peer_address_mapping_update() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Set initial mapping
    storage.set_peer_address_mapping("ws://example.com/sync", "peer-old").await.unwrap();

    // Update mapping (e.g., peer ID changed)
    storage.set_peer_address_mapping("ws://example.com/sync", "peer-new").await.unwrap();

    // Verify update
    let peer_id = storage.get_peer_id_by_address("ws://example.com/sync").await.unwrap();
    assert_eq!(peer_id, Some("peer-new".to_string()));
}

#[tokio::test]
async fn test_peer_address_mapping_multiple_addresses() {
    let storage = SqliteBackend::in_memory().unwrap();

    // Set mappings for different addresses
    storage.set_peer_address_mapping("ws://server1.com/sync", "peer-1").await.unwrap();
    storage.set_peer_address_mapping("ws://server2.com/sync", "peer-2").await.unwrap();
    storage.set_peer_address_mapping("abc123def456", "peer-3").await.unwrap(); // QUIC NodeId

    // Verify each mapping
    assert_eq!(
        storage.get_peer_id_by_address("ws://server1.com/sync").await.unwrap(),
        Some("peer-1".to_string())
    );
    assert_eq!(
        storage.get_peer_id_by_address("ws://server2.com/sync").await.unwrap(),
        Some("peer-2".to_string())
    );
    assert_eq!(
        storage.get_peer_id_by_address("abc123def456").await.unwrap(),
        Some("peer-3".to_string())
    );
}

#[tokio::test]
async fn test_checkpoint_is_stale_method() {
    // Test the is_stale method directly
    let fresh = CatchupCheckpoint {
        last_seq: 100,
        started_at: Utc::now().to_rfc3339(),
        is_complete: false,
    };
    assert!(!fresh.is_stale(), "Recent checkpoint should not be stale");

    let stale = CatchupCheckpoint {
        last_seq: 100,
        started_at: (Utc::now() - Duration::hours(25)).to_rfc3339(),
        is_complete: false,
    };
    assert!(stale.is_stale(), "25-hour old checkpoint should be stale");

    // Edge case: exactly at TTL boundary (23 hours - should not be stale)
    let edge = CatchupCheckpoint {
        last_seq: 100,
        started_at: (Utc::now() - Duration::hours(23)).to_rfc3339(),
        is_complete: false,
    };
    assert!(!edge.is_stale(), "23-hour old checkpoint should not be stale");
}
