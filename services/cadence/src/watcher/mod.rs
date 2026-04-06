pub mod pg_poll;
pub mod postgresql;
pub mod sqlite;

use crate::state::RowChange;
use sha2::{Digest, Sha256};
use std::future::Future;
use std::pin::Pin;

/// SHA256 hash of a JSON field value for memory-efficient diffing.
/// Stores 32 bytes instead of the full JSON value (typically 2-10 KB).
pub type FieldHash = [u8; 32];

/// Compute a SHA256 hash of a JSON value for change detection.
/// Uses compact JSON serialization for consistent hashing.
pub fn hash_json_value(value: &serde_json::Value) -> FieldHash {
    let mut hasher = Sha256::new();
    // Serialize to compact JSON for consistent hashing
    let _ = serde_json::to_writer(&mut hasher, value);
    hasher.finalize().into()
}

/// Output from a watcher poll cycle.
pub struct WatcherOutput {
    pub changes: Vec<RowChange>,
    /// If true, these are incremental changes that should be persisted to the change log.
    /// If false, this is the initial scan — changes exist in primary DB already.
    pub is_incremental: bool,
}

/// Trait for database change watchers.
pub trait ChangeWatcher: Send + Sync {
    /// Poll for changes since the last check.
    fn poll_changes(
        &mut self,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<WatcherOutput>> + Send + '_>>;
}
