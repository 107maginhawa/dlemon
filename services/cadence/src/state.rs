use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::broadcast;

/// A single field-level change for LWW merge.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FieldChange {
    pub field: String,
    pub value: serde_json::Value,
    pub lamport: u64,
    pub peer_id: String,
}

/// Payload of a sync change — either field-level (LWW) or document-level (CRDT).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncPayload {
    /// Field-level changes for LWW collections.
    Fields(Vec<FieldChange>),
    /// Loro document bytes for CRDT collections.
    CrdtDoc(Vec<u8>),
}

/// A row-level change that gets synced between peers.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RowChange {
    pub collection: String,
    pub document_id: String,
    pub payload: SyncPayload,
    pub deleted: bool,
    pub seq: u64,
}

/// Per-peer sync state: Lamport clock, local sequence counter, and peer watermarks.
pub struct SyncState {
    /// This peer's Lamport clock (incremented on every local change + merge).
    lamport: AtomicU64,
    /// This peer's global sequence counter (incremented on every local change).
    local_seq: AtomicU64,
    /// Per remote peer: last sequence number we've synced up to.
    peer_watermarks: DashMap<String, u64>,
    /// Local seq value at the moment this peer's watcher finished its
    /// baseline scan (the first poll that absorbs pre-existing primary-DB
    /// rows into the watcher's LRU cache without writing them to the
    /// change log).
    ///
    /// Default `u64::MAX` means "baseline not yet known"; any peer
    /// `since_seq < u64::MAX` is treated as "below the threshold" and
    /// triggers a primary-reader catch-up. This is conservative on
    /// purpose — we'd rather over-snapshot than silently miss rows.
    ///
    /// `build_catchup_frames` reads this to decide whether the change
    /// log is sufficient for a reconnecting peer or whether
    /// primary-reader needs to fill in baseline-absorbed rows.
    baseline_completion_seq: AtomicU64,
}

impl SyncState {
    pub fn new() -> Self {
        Self {
            lamport: AtomicU64::new(0),
            local_seq: AtomicU64::new(0),
            peer_watermarks: DashMap::new(),
            baseline_completion_seq: AtomicU64::new(u64::MAX),
        }
    }

    /// Create with initial values (for recovery).
    pub fn with_values(lamport: u64, local_seq: u64) -> Self {
        Self {
            lamport: AtomicU64::new(lamport),
            local_seq: AtomicU64::new(local_seq),
            peer_watermarks: DashMap::new(),
            baseline_completion_seq: AtomicU64::new(u64::MAX),
        }
    }

    /// Increment and return the new Lamport clock value.
    pub fn increment_lamport(&self) -> u64 {
        self.lamport.fetch_add(1, Ordering::SeqCst) + 1
    }

    /// Get the current Lamport clock value.
    pub fn lamport(&self) -> u64 {
        self.lamport.load(Ordering::SeqCst)
    }

    /// Merge with a remote Lamport value: set local = max(local, remote) + 1.
    pub fn merge_lamport(&self, remote: u64) {
        loop {
            let current = self.lamport.load(Ordering::SeqCst);
            let new_val = std::cmp::max(current, remote) + 1;
            if self
                .lamport
                .compare_exchange(current, new_val, Ordering::SeqCst, Ordering::SeqCst)
                .is_ok()
            {
                break;
            }
        }
    }

    /// Increment and return the new local sequence number.
    pub fn next_seq(&self) -> u64 {
        self.local_seq.fetch_add(1, Ordering::SeqCst) + 1
    }

    /// Get the current local sequence number.
    pub fn local_seq(&self) -> u64 {
        self.local_seq.load(Ordering::SeqCst)
    }

    /// Get the watermark for a remote peer (0 if unknown).
    pub fn get_watermark(&self, peer_id: &str) -> u64 {
        self.peer_watermarks
            .get(peer_id)
            .map(|v| *v)
            .unwrap_or(0)
    }

    /// Set the watermark for a remote peer.
    pub fn set_watermark(&self, peer_id: &str, seq: u64) {
        self.peer_watermarks.insert(peer_id.to_string(), seq);
    }

    /// Get the local-seq value at which the watcher's baseline scan
    /// completed. `u64::MAX` if baseline has not yet completed (or no
    /// watcher has reported a baseline — e.g. a peer that doesn't run a
    /// primary-DB watcher).
    pub fn baseline_completion_seq(&self) -> u64 {
        self.baseline_completion_seq.load(Ordering::SeqCst)
    }

    /// Mark the baseline scan as complete at the given local seq value.
    /// Idempotent: subsequent calls only lower the value (the *first*
    /// baseline-completion is what matters for catch-up correctness; any
    /// later silent absorption shouldn't push the threshold up because
    /// reconnecting peers' since_seq could legitimately exceed it).
    pub fn set_baseline_completion_seq(&self, seq: u64) {
        // CAS down-only: keep the lowest non-MAX value seen so far.
        loop {
            let current = self.baseline_completion_seq.load(Ordering::SeqCst);
            if current != u64::MAX && seq >= current {
                return;
            }
            if self
                .baseline_completion_seq
                .compare_exchange(current, seq, Ordering::SeqCst, Ordering::SeqCst)
                .is_ok()
            {
                return;
            }
        }
    }
}

impl Default for SyncState {
    fn default() -> Self {
        Self::new()
    }
}

/// Broadcasts change notifications to all active persistent sync sessions.
///
/// Each persistent session calls `subscribe()` to get its own receiver.
/// When the watcher detects changes, it calls `broadcast()` to notify all sessions.
pub struct ChangeBroadcaster {
    sender: broadcast::Sender<Vec<RowChange>>,
}

impl ChangeBroadcaster {
    /// Create a new broadcaster with the given channel capacity.
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self { sender }
    }

    /// Subscribe to change notifications. Returns a new receiver.
    pub fn subscribe(&self) -> broadcast::Receiver<Vec<RowChange>> {
        self.sender.subscribe()
    }

    /// Broadcast changes to all active subscribers.
    /// Silently ignores the case where there are no receivers.
    pub fn broadcast(&self, changes: Vec<RowChange>) {
        let _ = self.sender.send(changes);
    }
}
