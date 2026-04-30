use anyhow::Result;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::state::{RowChange, SyncPayload};

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

    /// Append a batch of row changes to the change log atomically. Returns
    /// the highest assigned sequence number across all writes (or 0 if
    /// `changes` is empty).
    ///
    /// Backends that support transactions (SQLite) MUST wrap the writes in
    /// one transaction so the per-call fsync cost is amortized. The default
    /// implementation falls back to N independent `append_change` calls —
    /// correct but slow under heavy receive traffic. Use
    /// `append_change` for a single-change call site; reach for the batch
    /// form when applying a whole `SyncData` frame.
    async fn append_changes_batch(&self, changes: &[RowChange]) -> Result<u64> {
        let mut max_seq = 0u64;
        for change in changes {
            let s = self.append_change(change).await?;
            max_seq = std::cmp::max(max_seq, s);
        }
        Ok(max_seq)
    }

    /// Query changes with seq > since_seq.
    /// **Warning**: loads all matching rows into memory. Prefer `query_since_batched`
    /// for production code paths where the result set may be large.
    async fn query_since(&self, since_seq: u64) -> Result<Vec<RowChange>>;

    /// Paginated query: returns changes with seq > `since_seq`, up to `limit`
    /// raw rows. Returns `(changes, has_more)` where `has_more` indicates
    /// additional rows exist beyond this batch. Callers should advance
    /// `since_seq` to the max seq of the returned batch and call again.
    ///
    /// Default implementation delegates to `query_since` (unbounded) for
    /// backward compatibility with custom backends.
    async fn query_since_batched(
        &self,
        since_seq: u64,
        _limit: usize,
    ) -> Result<(Vec<RowChange>, bool)> {
        let all = self.query_since(since_seq).await?;
        Ok((all, false))
    }

    /// Query changes for a specific collection and document.
    async fn query_by_doc(&self, collection: &str, doc_id: &str) -> Result<Vec<RowChange>>;

    /// Paginated query that returns ONLY tombstones (`deleted == true`)
    /// with `seq > since_seq`, up to `limit` rows. Returns
    /// `(tombstones, has_more)` where `has_more` indicates additional
    /// tombstones exist beyond this batch.
    ///
    /// Used by snapshot catch-up: when primary-reader has already
    /// streamed current row state, the change-log replay only needs
    /// tombstones (the one thing primary-reader's `SELECT *` cannot
    /// see). Without this, replay scans every entry just to filter
    /// non-tombstones in process — under heavy traffic that's the
    /// dominant Phase 1 latency cost (e.g. 100k+ activity-logs entries
    /// scanned to deliver zero rows).
    ///
    /// Default implementation delegates to `query_since_batched` and
    /// filters in-process. Backends with native filtering (SQLite via
    /// `WHERE deleted = 1`, Valkey via a separate tombstones-only
    /// zset) should override.
    async fn query_tombstones_since_batched(
        &self,
        since_seq: u64,
        limit: usize,
    ) -> Result<(Vec<RowChange>, bool)> {
        let (batch, has_more) = self.query_since_batched(since_seq, limit).await?;
        let tombstones: Vec<RowChange> = batch.into_iter().filter(|c| c.deleted).collect();
        Ok((tombstones, has_more))
    }

    /// For every (collection, doc_id) pair that has at least one entry in
    /// the change log, return the maximum lamport seen across all that
    /// doc's field changes.
    ///
    /// Used by primary-reader catch-up to attach a meaningful lamport to
    /// rows it emits — so receiving peers' LWW comparisons give correct
    /// answers (cloud's last-known-edit-time vs. peer's local edit time)
    /// instead of always-wins fresh lamports. Rows that don't appear in
    /// this map were silently absorbed by the watcher's baseline scan
    /// and the caller should fall back to lamport=1.
    ///
    /// Default implementation reuses `query_since(0)` and aggregates
    /// in-process. Backends with a native group-by (SQLite) override.
    async fn max_lamports_by_doc(
        &self,
    ) -> Result<std::collections::HashMap<(String, String), u64>> {
        let all = self.query_since(0).await?;
        let mut out: std::collections::HashMap<(String, String), u64> =
            std::collections::HashMap::new();
        for change in all {
            if let SyncPayload::Fields(fields) = &change.payload {
                let max = fields.iter().map(|f| f.lamport).max().unwrap_or(0);
                let key = (change.collection.clone(), change.document_id.clone());
                let entry = out.entry(key).or_insert(0);
                if max > *entry {
                    *entry = max;
                }
            }
        }
        Ok(out)
    }

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

    /// Delete a persisted peer token by key. Idempotent: succeeds when the key
    /// is absent.
    async fn delete_peer_token(&self, key: &str) -> Result<()>;

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
