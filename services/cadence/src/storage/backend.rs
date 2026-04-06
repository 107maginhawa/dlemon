use anyhow::Result;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::state::RowChange;

/// TTL for stale catchup checkpoints (24 hours).
pub const CATCHUP_CHECKPOINT_TTL_SECS: i64 = 24 * 60 * 60;

/// Persistent local identity for this Cadence instance.
///
/// Stores the peer ID and optionally the Iroh secret key (for P2P mode).
/// This ensures the peer identity remains stable across restarts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalIdentity {
    /// The peer ID (UUID for WS-only mode, or Iroh node_id for P2P mode).
    pub peer_id: String,
    /// The Iroh secret key as a string (using SecretKey's Display format).
    /// None for WebSocket-only mode.
    pub iroh_secret_key: Option<String>,
    /// When this identity was first created (RFC 3339 timestamp).
    pub created_at: String,
}

/// Checkpoint state for resumable initial catchup.
#[derive(Debug, Clone)]
pub struct CatchupCheckpoint {
    /// Last successfully received sequence number.
    pub last_seq: u64,
    /// When the catchup started (RFC 3339 timestamp).
    pub started_at: String,
    /// Whether the catchup has completed.
    pub is_complete: bool,
}

impl CatchupCheckpoint {
    /// Check if this checkpoint is stale (older than TTL).
    pub fn is_stale(&self) -> bool {
        let started = DateTime::parse_from_rfc3339(&self.started_at).ok();
        match started {
            Some(ts) => {
                Utc::now().signed_duration_since(ts.with_timezone(&Utc)).num_seconds()
                    > CATCHUP_CHECKPOINT_TTL_SECS
            }
            None => false,
        }
    }
}

/// Async storage backend for Cadence metadata.
///
/// Covers change log, peer watermarks, peer tokens, and JWKS cache.
/// SQLite wraps sync calls in `spawn_blocking`; future Valkey backend is natively async.
#[async_trait]
pub trait MetadataBackend: Send + Sync + 'static {
    // ── Change log ──────────────────────────────────────────────

    /// Append a row change to the change log. Returns the assigned sequence number.
    async fn append_change(&self, change: &RowChange) -> Result<u64>;

    /// Query changes with seq > since_seq.
    async fn query_since(&self, since_seq: u64) -> Result<Vec<RowChange>>;

    /// Query changes for a specific collection and document.
    async fn query_by_doc(&self, collection: &str, doc_id: &str) -> Result<Vec<RowChange>>;

    /// Compact the change log: keep only the latest entry per (collection, doc_id, field).
    async fn compact(&self) -> Result<u64>;

    /// Get the maximum sequence number in the change log.
    async fn max_seq(&self) -> Result<u64>;

    // ── Peer watermarks ─────────────────────────────────────────

    /// Get the watermark for a peer.
    async fn get_watermark(&self, peer_id: &str) -> Result<u64>;

    /// Set (upsert) the watermark for a peer.
    async fn set_watermark(&self, peer_id: &str, seq: u64) -> Result<()>;

    // ── Peer tokens ─────────────────────────────────────────────

    /// Get a persisted peer token by key.
    async fn get_peer_token(&self, key: &str) -> Result<Option<String>>;

    /// Persist a peer token by key.
    async fn set_peer_token(&self, key: &str, jwt: &str) -> Result<()>;

    // ── Peers ──────────────────────────────────────────────────

    /// Get the persisted peers list.
    async fn get_peers(&self) -> Result<Vec<String>>;

    /// Persist the peers list.
    async fn set_peers(&self, peers: &[String]) -> Result<()>;

    // ── JWKS cache ──────────────────────────────────────────────

    /// Get cached JWKS keys JSON for a URL.
    async fn get_cached_jwks(&self, url: &str) -> Result<Option<String>>;

    /// Persist JWKS keys JSON for a URL.
    async fn set_cached_jwks(&self, url: &str, keys_json: &str) -> Result<()>;

    // ── Catchup checkpoints (for resumable initial sync) ───────

    /// Get the catchup checkpoint for a peer.
    /// Returns None if no checkpoint exists or if the checkpoint is stale.
    async fn get_catchup_checkpoint(&self, peer_id: &str) -> Result<Option<CatchupCheckpoint>>;

    /// Set/update the catchup checkpoint for a peer.
    async fn set_catchup_checkpoint(&self, peer_id: &str, checkpoint: &CatchupCheckpoint) -> Result<()>;

    /// Mark catchup as complete for a peer (clears checkpoint state).
    async fn complete_catchup(&self, peer_id: &str) -> Result<()>;

    /// Delete a catchup checkpoint for a peer.
    async fn delete_catchup_checkpoint(&self, peer_id: &str) -> Result<()>;

    // ── Peer address mapping (for checkpoint lookup before Hello) ──

    /// Get the peer ID associated with an address (learned from previous connections).
    async fn get_peer_id_by_address(&self, address: &str) -> Result<Option<String>>;

    /// Store the address → peer_id mapping for future connections.
    async fn set_peer_address_mapping(&self, address: &str, peer_id: &str) -> Result<()>;

    // ── Local identity (persistent peer ID across restarts) ─────────

    /// Get the persisted local identity for this instance.
    /// Returns None if no identity has been stored yet.
    async fn get_local_identity(&self) -> Result<Option<LocalIdentity>>;

    /// Store the local identity for this instance.
    async fn set_local_identity(&self, identity: &LocalIdentity) -> Result<()>;
}
