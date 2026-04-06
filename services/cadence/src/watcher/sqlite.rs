use anyhow::Result;
use lru::LruCache;
use rusqlite::Connection;
use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::num::NonZeroUsize;
use std::pin::Pin;
use std::sync::{Arc, Mutex};

use crate::state::{FieldChange, RowChange, SyncPayload, SyncState};
use crate::watcher::{hash_json_value, ChangeWatcher, FieldHash, WatcherOutput};

/// Default LRU capacity for the watcher cache (100,000 rows).
pub const DEFAULT_WATCHER_LRU_CAPACITY: usize = 100_000;

/// SQLite polling-based change watcher.
/// Detects changes via `SELECT * FROM {table} WHERE updatedAt > $last_poll`.
pub struct SqliteWatcher {
    conn: Arc<Mutex<Connection>>,
    collections: Vec<String>,
    /// Last known updatedAt per collection.
    watermarks: HashMap<String, String>,
    /// Peer ID for this node.
    peer_id: String,
    /// Shared sync state.
    sync_state: Arc<SyncState>,
    /// Last known row state for diffing, stored as field hashes for memory efficiency.
    /// Uses LRU eviction to bound memory usage.
    last_known: LruCache<(String, String), HashMap<String, FieldHash>>,
    /// Columns that must always be emitted (scope columns) so filter_changes can inspect them.
    scope_columns: HashSet<String>,
    initial_scan_done: bool,
}

impl SqliteWatcher {
    pub fn new(
        conn: Arc<Mutex<Connection>>,
        collections: Vec<String>,
        peer_id: String,
        sync_state: Arc<SyncState>,
        scope_columns: HashSet<String>,
    ) -> Self {
        Self::with_capacity(
            conn,
            collections,
            peer_id,
            sync_state,
            scope_columns,
            DEFAULT_WATCHER_LRU_CAPACITY,
        )
    }

    pub fn with_capacity(
        conn: Arc<Mutex<Connection>>,
        collections: Vec<String>,
        peer_id: String,
        sync_state: Arc<SyncState>,
        scope_columns: HashSet<String>,
        lru_capacity: usize,
    ) -> Self {
        Self {
            conn,
            collections,
            watermarks: HashMap::new(),
            peer_id,
            sync_state,
            last_known: LruCache::new(
                NonZeroUsize::new(lru_capacity).unwrap_or(NonZeroUsize::new(DEFAULT_WATCHER_LRU_CAPACITY).unwrap()),
            ),
            scope_columns,
            initial_scan_done: false,
        }
    }

    /// Poll a single collection for changes.
    fn poll_collection(&mut self, collection: &str) -> Result<Vec<RowChange>> {
        let conn = self.conn.lock().unwrap();
        let table = collection.replace('-', "_");

        let last_updated = self
            .watermarks
            .get(collection)
            .cloned()
            .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string());

        // Query for changed rows. Uses COALESCE(updated_at, created_at) to also catch
        // newly inserted rows where updated_at is NULL (hapihub doesn't always set it on create).
        // Try camelCase first (hapihub convention), fall back to snake_case (Drizzle convention).
        let (mut stmt, ts_col) = match conn.prepare(&format!(
            "SELECT * FROM \"{}\" WHERE COALESCE(\"updatedAt\", \"createdAt\") > ?1 ORDER BY COALESCE(\"updatedAt\", \"createdAt\") ASC",
            table
        )) {
            Ok(s) => (s, "updatedAt"),
            Err(_) => match conn.prepare(&format!(
                "SELECT * FROM \"{}\" WHERE COALESCE(\"updated_at\", \"created_at\") > ?1 ORDER BY COALESCE(\"updated_at\", \"created_at\") ASC",
                table
            )) {
                Ok(s) => (s, "updated_at"),
                Err(e) => {
                    tracing::trace!("SqliteWatcher: skipping {} (table {}): {}", collection, table, e);
                    return Ok(Vec::new());
                }
            },
        };

        let column_names: Vec<String> = stmt
            .column_names()
            .iter()
            .map(|s| s.to_string())
            .collect();

        let mut changes = Vec::new();
        let mut max_updated = last_updated.clone();

        let mut rows = stmt.query(rusqlite::params![last_updated])?;

        while let Some(row) = rows.next()? {
            let mut row_data: HashMap<String, serde_json::Value> = HashMap::new();
            let mut doc_id = String::new();

            for (i, col_name) in column_names.iter().enumerate() {
                let value: serde_json::Value =
                    match row.get_ref(i)? {
                        rusqlite::types::ValueRef::Null => serde_json::Value::Null,
                        rusqlite::types::ValueRef::Integer(v) => serde_json::Value::from(v),
                        rusqlite::types::ValueRef::Real(v) => {
                            serde_json::Value::from(v)
                        }
                        rusqlite::types::ValueRef::Text(v) => {
                            let s = std::str::from_utf8(v).unwrap_or("");
                            // Try to parse as JSON if it looks like JSON
                            if (s.starts_with('{') || s.starts_with('['))
                                && serde_json::from_str::<serde_json::Value>(s).is_ok()
                            {
                                serde_json::from_str(s).unwrap()
                            } else {
                                serde_json::Value::String(s.to_string())
                            }
                        }
                        rusqlite::types::ValueRef::Blob(v) => {
                            serde_json::Value::String(format!("<blob:{}>", v.len()))
                        }
                    };

                if col_name == "id" {
                    doc_id = match &value {
                        serde_json::Value::String(s) => s.clone(),
                        _ => value.to_string(),
                    };
                }

                // Track max timestamp for watermark (check both updated_at and created_at variants)
                if col_name == ts_col
                    || (ts_col == "updatedAt" && col_name == "createdAt")
                    || (ts_col == "updated_at" && col_name == "created_at")
                {
                    if let serde_json::Value::String(ref s) = value {
                        if s > &max_updated {
                            max_updated = s.clone();
                        }
                    }
                }

                row_data.insert(col_name.clone(), value);
            }

            // Diff against last known state using hashes for memory efficiency
            let key = (collection.to_string(), doc_id.clone());
            let last_hashes = self.last_known.get(&key);

            // Compute hashes for current row
            let mut current_hashes: HashMap<String, FieldHash> = HashMap::new();
            for (col, val) in &row_data {
                // Skip timestamp columns (both camelCase and snake_case conventions)
                if !matches!(col.as_str(), "updatedAt" | "createdAt" | "updated_at" | "created_at") {
                    current_hashes.insert(col.clone(), hash_json_value(val));
                }
            }

            let lamport = self.sync_state.increment_lamport();
            let seq = self.sync_state.next_seq();

            let field_changes: Vec<FieldChange> = row_data
                .iter()
                .filter(|(col, val)| {
                    // Skip timestamp columns from sync payload (both naming conventions)
                    if matches!(col.as_str(), "updatedAt" | "createdAt" | "updated_at" | "created_at") {
                        return false;
                    }
                    let hash = hash_json_value(val);
                    // Include if: scope column OR changed (hash differs or new row)
                    self.scope_columns.contains(*col)
                        || match last_hashes {
                            Some(prev) => prev.get(*col) != Some(&hash),
                            None => true, // New row — include all fields
                        }
                })
                .map(|(col, val)| FieldChange {
                    field: col.clone(),
                    value: val.clone(),
                    lamport,
                    peer_id: self.peer_id.clone(),
                })
                .collect();

            if !field_changes.is_empty() {
                changes.push(RowChange {
                    collection: collection.to_string(),
                    document_id: doc_id.clone(),
                    payload: SyncPayload::Fields(field_changes),
                    deleted: false,
                    seq,
                });
            }

            // Store hashes, not full row data (96% memory reduction)
            self.last_known.put(key, current_hashes);
        }

        if max_updated != last_updated {
            self.watermarks
                .insert(collection.to_string(), max_updated);
        }

        Ok(changes)
    }
}

impl ChangeWatcher for SqliteWatcher {
    fn poll_changes(
        &mut self,
    ) -> Pin<Box<dyn Future<Output = Result<WatcherOutput>> + Send + '_>> {
        // SQLite polling is synchronous, wrap in a future
        let collections: Vec<String> = self.collections.clone();
        Box::pin(async move {
            let mut all_changes = Vec::new();
            for collection in &collections {
                match self.poll_collection(collection) {
                    Ok(changes) => all_changes.extend(changes),
                    Err(e) => {
                        tracing::warn!("Failed to poll {}: {}", collection, e);
                    }
                }
            }
            let is_incremental = self.initial_scan_done;
            // Only mark initial scan as done when we have non-empty changes
            // (empty polls don't count as the initial scan)
            if !all_changes.is_empty() && !self.initial_scan_done {
                self.initial_scan_done = true;
            }
            Ok(WatcherOutput {
                changes: all_changes,
                is_incremental,
            })
        })
    }
}
