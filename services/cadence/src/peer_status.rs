use dashmap::DashMap;
use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

/// Connection state of a peer.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PeerState {
    Connecting,
    Syncing,
    Live,
    Disconnected,
}

/// Transport type used for a peer connection.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PeerTransport {
    Quic,
    #[serde(rename = "websocket")]
    WebSocket,
}

/// Live per-peer status with atomic counters for lock-free updates.
pub struct PeerStatus {
    pub peer_id: String,
    pub address: String,
    pub transport: PeerTransport,
    pub state: RwLock<PeerState>,
    pub changes_sent: AtomicU64,
    pub changes_received: AtomicU64,
    pub send_total: AtomicU64,
    pub send_progress: AtomicU64,
    pub recv_total: AtomicU64,
    pub recv_progress: AtomicU64,
    pub last_activity_ms: AtomicU64,
    pub connected_at_ms: AtomicU64,
    pub their_watermark: AtomicU64,
    pub our_watermark: AtomicU64,
    pub last_error: RwLock<Option<String>>,
}

/// Serializable snapshot of a peer's status.
#[derive(Debug, Clone, Serialize)]
pub struct PeerStatusSnapshot {
    pub peer_id: String,
    pub address: String,
    pub transport: PeerTransport,
    pub state: PeerState,
    pub changes_sent: u64,
    pub changes_received: u64,
    pub send_progress: SendProgress,
    pub recv_progress: RecvProgress,
    pub last_activity_ms: u64,
    pub connected_at_ms: u64,
    pub their_watermark: u64,
    pub our_watermark: u64,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SendProgress {
    pub sent: u64,
    pub total: u64,
    pub percent: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RecvProgress {
    pub received: u64,
    pub total: Option<u64>,
    pub percent: Option<f64>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

impl PeerStatus {
    fn new(peer_id: String, address: String, transport: PeerTransport) -> Self {
        let now = now_ms();
        Self {
            peer_id,
            address,
            transport,
            state: RwLock::new(PeerState::Connecting),
            changes_sent: AtomicU64::new(0),
            changes_received: AtomicU64::new(0),
            send_total: AtomicU64::new(0),
            send_progress: AtomicU64::new(0),
            recv_total: AtomicU64::new(0),
            recv_progress: AtomicU64::new(0),
            last_activity_ms: AtomicU64::new(now),
            connected_at_ms: AtomicU64::new(now),
            their_watermark: AtomicU64::new(0),
            our_watermark: AtomicU64::new(0),
            last_error: RwLock::new(None),
        }
    }

    fn snapshot(&self) -> PeerStatusSnapshot {
        let send_total = self.send_total.load(Ordering::Relaxed);
        let send_progress = self.send_progress.load(Ordering::Relaxed);
        let recv_total = self.recv_total.load(Ordering::Relaxed);
        let recv_progress = self.recv_progress.load(Ordering::Relaxed);

        let send_percent = if send_total > 0 {
            Some((send_progress as f64 / send_total as f64 * 100.0).min(100.0))
        } else {
            None
        };

        let (recv_total_opt, recv_percent) = if recv_total > 0 {
            let pct = (recv_progress as f64 / recv_total as f64 * 100.0).min(100.0);
            (Some(recv_total), Some(pct))
        } else {
            (None, None)
        };

        PeerStatusSnapshot {
            peer_id: self.peer_id.clone(),
            address: self.address.clone(),
            transport: self.transport,
            state: *self.state.read().unwrap_or_else(|e| e.into_inner()),
            changes_sent: self.changes_sent.load(Ordering::Relaxed),
            changes_received: self.changes_received.load(Ordering::Relaxed),
            send_progress: SendProgress {
                sent: send_progress,
                total: send_total,
                percent: send_percent,
            },
            recv_progress: RecvProgress {
                received: recv_progress,
                total: recv_total_opt,
                percent: recv_percent,
            },
            last_activity_ms: self.last_activity_ms.load(Ordering::Relaxed),
            connected_at_ms: self.connected_at_ms.load(Ordering::Relaxed),
            their_watermark: self.their_watermark.load(Ordering::Relaxed),
            our_watermark: self.our_watermark.load(Ordering::Relaxed),
            last_error: self.last_error.read().unwrap_or_else(|e| e.into_inner()).clone(),
        }
    }
}

/// Thread-safe tracker for all peer connections.
pub struct PeerTracker {
    peers: DashMap<String, PeerStatus>,
}

impl PeerTracker {
    pub fn new() -> Self {
        Self {
            peers: DashMap::new(),
        }
    }

    /// Remove a peer from the tracker.
    pub fn remove(&self, key: &str) {
        self.peers.remove(key);
    }

    /// Register a peer (overwrites existing entry for reconnects).
    pub fn register(&self, key: &str, peer_id: &str, address: &str, transport: PeerTransport) {
        self.peers.insert(
            key.to_string(),
            PeerStatus::new(peer_id.to_string(), address.to_string(), transport),
        );
    }

    pub fn set_syncing(&self, key: &str) {
        if let Some(entry) = self.peers.get(key) {
            *entry.state.write().unwrap_or_else(|e| e.into_inner()) = PeerState::Syncing;
            entry.last_activity_ms.store(now_ms(), Ordering::Relaxed);
        }
    }

    pub fn set_live(&self, key: &str) {
        if let Some(entry) = self.peers.get(key) {
            *entry.state.write().unwrap_or_else(|e| e.into_inner()) = PeerState::Live;
            entry.last_activity_ms.store(now_ms(), Ordering::Relaxed);
        }
    }

    pub fn set_disconnected(&self, key: &str, error: Option<String>) {
        if let Some(entry) = self.peers.get(key) {
            *entry.state.write().unwrap_or_else(|e| e.into_inner()) = PeerState::Disconnected;
            *entry.last_error.write().unwrap_or_else(|e| e.into_inner()) = error;
            entry.last_activity_ms.store(now_ms(), Ordering::Relaxed);
        }
    }

    pub fn set_send_total(&self, key: &str, n: u64) {
        if let Some(entry) = self.peers.get(key) {
            entry.send_total.store(n, Ordering::Relaxed);
        }
    }

    pub fn inc_send_progress(&self, key: &str, n: u64) {
        if let Some(entry) = self.peers.get(key) {
            entry.send_progress.fetch_add(n, Ordering::Relaxed);
        }
    }

    pub fn set_recv_total(&self, key: &str, n: u64) {
        if let Some(entry) = self.peers.get(key) {
            entry.recv_total.store(n, Ordering::Relaxed);
        }
    }

    /// Set recv_total to the actual received count (corrects the estimate after catch-up).
    pub fn finalize_recv_total(&self, key: &str) {
        if let Some(entry) = self.peers.get(key) {
            let received = entry.recv_progress.load(Ordering::Relaxed);
            entry.recv_total.store(received, Ordering::Relaxed);
        }
    }

    pub fn inc_recv_progress(&self, key: &str, n: u64) {
        if let Some(entry) = self.peers.get(key) {
            entry.recv_progress.fetch_add(n, Ordering::Relaxed);
        }
    }

    pub fn inc_sent(&self, key: &str, n: u64) {
        if let Some(entry) = self.peers.get(key) {
            entry.changes_sent.fetch_add(n, Ordering::Relaxed);
        }
    }

    pub fn inc_received(&self, key: &str, n: u64) {
        if let Some(entry) = self.peers.get(key) {
            entry.changes_received.fetch_add(n, Ordering::Relaxed);
        }
    }

    pub fn touch(&self, key: &str) {
        if let Some(entry) = self.peers.get(key) {
            entry.last_activity_ms.store(now_ms(), Ordering::Relaxed);
        }
    }

    pub fn set_watermarks(&self, key: &str, theirs: u64, ours: u64) {
        if let Some(entry) = self.peers.get(key) {
            entry.their_watermark.store(theirs, Ordering::Relaxed);
            entry.our_watermark.store(ours, Ordering::Relaxed);
        }
    }

    pub fn update_our_watermark(&self, key: &str, ours: u64) {
        if let Some(entry) = self.peers.get(key) {
            entry.our_watermark.store(ours, Ordering::Relaxed);
        }
    }

    /// Check if both send and receive catch-up are complete.
    pub fn is_catchup_complete(&self, key: &str) -> bool {
        if let Some(entry) = self.peers.get(key) {
            let send_total = entry.send_total.load(Ordering::Relaxed);
            let send_progress = entry.send_progress.load(Ordering::Relaxed);
            let send_done = send_total == 0 || send_progress >= send_total;

            let recv_total = entry.recv_total.load(Ordering::Relaxed);
            let recv_progress = entry.recv_progress.load(Ordering::Relaxed);
            let recv_done = recv_total == 0 || recv_progress >= recv_total;

            send_done && recv_done
        } else {
            false
        }
    }

    /// Get all tracker keys.
    pub fn keys(&self) -> Vec<String> {
        self.peers.iter().map(|entry| entry.key().clone()).collect()
    }

    /// Remove disconnected peers that never made progress and have been idle
    /// for longer than `max_idle_ms`. Peers that sent or received any data are kept.
    /// Returns the number of reaped entries.
    pub fn reap_stale(&self, max_idle_ms: u64) -> usize {
        let now = now_ms();
        let stale_keys: Vec<String> = self
            .peers
            .iter()
            .filter(|entry| {
                let state = *entry.state.read().unwrap_or_else(|e| e.into_inner());
                let idle = now.saturating_sub(entry.last_activity_ms.load(Ordering::Relaxed));
                let sent = entry.changes_sent.load(Ordering::Relaxed);
                let received = entry.changes_received.load(Ordering::Relaxed);
                state == PeerState::Disconnected && idle > max_idle_ms && sent == 0 && received == 0
            })
            .map(|entry| entry.key().clone())
            .collect();
        let count = stale_keys.len();
        for key in stale_keys {
            self.peers.remove(&key);
        }
        count
    }

    /// Spawn a background task that periodically reaps stale disconnected peers.
    pub fn start_reaper(self: &Arc<Self>, max_idle_ms: u64, interval_ms: u64) -> tokio::task::AbortHandle {
        let tracker = Arc::clone(self);
        let handle = tokio::spawn(async move {
            let interval = std::time::Duration::from_millis(interval_ms);
            loop {
                tokio::time::sleep(interval).await;
                let reaped = tracker.reap_stale(max_idle_ms);
                if reaped > 0 {
                    tracing::debug!("Reaped {} stale peer entries", reaped);
                }
            }
        });
        handle.abort_handle()
    }

    /// Get a serializable snapshot of all peers.
    pub fn snapshot(&self) -> Vec<PeerStatusSnapshot> {
        self.peers
            .iter()
            .map(|entry| entry.value().snapshot())
            .collect()
    }
}

/// Full sync status combining tracker state with dynamically configured peers.
#[derive(Debug, Clone, Serialize)]
pub struct SyncStatus {
    pub lamport: u64,
    pub local_seq: u64,
    pub connected_peers: usize,
    pub total_peers: usize,
    pub peers: Vec<PeerStatusSnapshot>,
}

/// Build a placeholder `PeerStatusSnapshot` for a configured peer address that
/// has no entry in the tracker (i.e., not yet connected or never registered).
pub fn placeholder_peer_snapshot(address: &str) -> PeerStatusSnapshot {
    PeerStatusSnapshot {
        peer_id: address.to_string(),
        address: address.to_string(),
        transport: PeerTransport::WebSocket,
        state: PeerState::Disconnected,
        changes_sent: 0,
        changes_received: 0,
        send_progress: SendProgress { sent: 0, total: 0, percent: None },
        recv_progress: RecvProgress { received: 0, total: None, percent: None },
        last_activity_ms: 0,
        connected_at_ms: 0,
        their_watermark: 0,
        our_watermark: 0,
        last_error: Some("Not connected".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── placeholder_peer_snapshot tests ────────────────────────

    #[test]
    fn test_placeholder_peer_snapshot_fields() {
        let snap = placeholder_peer_snapshot("ws://example.com/sync");
        assert_eq!(snap.peer_id, "ws://example.com/sync");
        assert_eq!(snap.address, "ws://example.com/sync");
        assert_eq!(snap.transport, PeerTransport::WebSocket);
        assert_eq!(snap.state, PeerState::Disconnected);
        assert_eq!(snap.changes_sent, 0);
        assert_eq!(snap.changes_received, 0);
        assert_eq!(snap.send_progress.sent, 0);
        assert_eq!(snap.send_progress.total, 0);
        assert!(snap.send_progress.percent.is_none());
        assert_eq!(snap.recv_progress.received, 0);
        assert!(snap.recv_progress.total.is_none());
        assert!(snap.recv_progress.percent.is_none());
        assert_eq!(snap.last_activity_ms, 0);
        assert_eq!(snap.connected_at_ms, 0);
        assert_eq!(snap.their_watermark, 0);
        assert_eq!(snap.our_watermark, 0);
        assert_eq!(snap.last_error.as_deref(), Some("Not connected"));
    }

    #[test]
    fn test_placeholder_serializes_to_snake_case() {
        let snap = placeholder_peer_snapshot("ws://peer.example.com/sync");
        let val = serde_json::to_value(&snap).unwrap();
        // Verify key field names use snake_case as expected by the frontend.
        assert!(val.get("peer_id").is_some());
        assert!(val.get("last_activity_ms").is_some());
        assert!(val.get("connected_at_ms").is_some());
        assert!(val.get("their_watermark").is_some());
        assert!(val.get("our_watermark").is_some());
        assert!(val.get("changes_sent").is_some());
        assert!(val.get("changes_received").is_some());
        assert!(val.get("send_progress").is_some());
        assert!(val.get("recv_progress").is_some());
        assert!(val.get("last_error").is_some());
        assert_eq!(val["state"], "disconnected");
        assert_eq!(val["transport"], "websocket");
    }

    #[test]
    fn test_register_and_snapshot() {
        let tracker = PeerTracker::new();
        tracker.register("ws://peer1", "peer1", "ws://peer1", PeerTransport::WebSocket);

        let snap = tracker.snapshot();
        assert_eq!(snap.len(), 1);
        assert_eq!(snap[0].peer_id, "peer1");
        assert_eq!(snap[0].address, "ws://peer1");
        assert_eq!(snap[0].transport, PeerTransport::WebSocket);
        assert_eq!(snap[0].state, PeerState::Connecting);
    }

    #[test]
    fn test_state_transitions() {
        let tracker = PeerTracker::new();
        tracker.register("k", "p1", "addr", PeerTransport::Quic);

        tracker.set_syncing("k");
        assert_eq!(tracker.snapshot()[0].state, PeerState::Syncing);

        tracker.set_live("k");
        assert_eq!(tracker.snapshot()[0].state, PeerState::Live);

        tracker.set_disconnected("k", Some("timeout".into()));
        let snap = tracker.snapshot();
        assert_eq!(snap[0].state, PeerState::Disconnected);
        assert_eq!(snap[0].last_error.as_deref(), Some("timeout"));
    }

    #[test]
    fn test_counters() {
        let tracker = PeerTracker::new();
        tracker.register("k", "p1", "addr", PeerTransport::Quic);

        tracker.inc_sent("k", 5);
        tracker.inc_sent("k", 3);
        tracker.inc_received("k", 10);

        let snap = tracker.snapshot();
        assert_eq!(snap[0].changes_sent, 8);
        assert_eq!(snap[0].changes_received, 10);
    }

    #[test]
    fn test_send_progress_percent() {
        let tracker = PeerTracker::new();
        tracker.register("k", "p1", "addr", PeerTransport::Quic);

        tracker.set_send_total("k", 200);
        tracker.inc_send_progress("k", 100);

        let snap = tracker.snapshot();
        assert_eq!(snap[0].send_progress.sent, 100);
        assert_eq!(snap[0].send_progress.total, 200);
        assert!((snap[0].send_progress.percent.unwrap() - 50.0).abs() < 0.01);
    }

    #[test]
    fn test_recv_progress_unknown_total() {
        let tracker = PeerTracker::new();
        tracker.register("k", "p1", "addr", PeerTransport::Quic);

        // recv_total stays 0 (unknown)
        tracker.inc_recv_progress("k", 50);

        let snap = tracker.snapshot();
        assert_eq!(snap[0].recv_progress.received, 50);
        assert!(snap[0].recv_progress.total.is_none());
        assert!(snap[0].recv_progress.percent.is_none());
    }

    #[test]
    fn test_catchup_complete() {
        let tracker = PeerTracker::new();
        tracker.register("k", "p1", "addr", PeerTransport::Quic);

        // Both zero totals → complete
        assert!(tracker.is_catchup_complete("k"));

        tracker.set_send_total("k", 10);
        assert!(!tracker.is_catchup_complete("k"));

        tracker.inc_send_progress("k", 10);
        assert!(tracker.is_catchup_complete("k"));

        tracker.set_recv_total("k", 5);
        assert!(!tracker.is_catchup_complete("k"));

        tracker.inc_recv_progress("k", 5);
        assert!(tracker.is_catchup_complete("k"));
    }

    #[test]
    fn test_reconnect_overwrites() {
        let tracker = PeerTracker::new();
        tracker.register("k", "p1", "addr", PeerTransport::Quic);
        tracker.inc_sent("k", 100);
        tracker.set_disconnected("k", Some("err".into()));

        // Reconnect overwrites
        tracker.register("k", "p1", "addr", PeerTransport::Quic);
        let snap = tracker.snapshot();
        assert_eq!(snap[0].state, PeerState::Connecting);
        assert_eq!(snap[0].changes_sent, 0);
        assert!(snap[0].last_error.is_none());
    }

    #[test]
    fn test_noop_on_missing_key() {
        let tracker = PeerTracker::new();
        // These should not panic
        tracker.set_syncing("missing");
        tracker.set_live("missing");
        tracker.set_disconnected("missing", None);
        tracker.inc_sent("missing", 1);
        tracker.touch("missing");
        assert!(tracker.snapshot().is_empty());
    }
}
