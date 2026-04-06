use anyhow::{Context, Result};
use lru::LruCache;
use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::num::NonZeroUsize;
use std::pin::Pin;
use std::sync::Arc;

use crate::state::{FieldChange, RowChange, SyncPayload, SyncState};
use crate::watcher::{hash_json_value, ChangeWatcher, FieldHash, WatcherOutput};

/// PostgreSQL polling-based change watcher.
/// Detects changes via `SELECT * FROM {table} WHERE "updatedAt" > $last_poll`.
pub struct PgPollWatcher {
    conn_str: String,
    collections: Vec<String>,
    /// Last known updatedAt per collection.
    watermarks: HashMap<String, String>,
    peer_id: String,
    sync_state: Arc<SyncState>,
    /// Last known row state for diffing, stored as field hashes for memory efficiency.
    /// Uses LRU eviction to bound memory usage.
    last_known: LruCache<(String, String), HashMap<String, FieldHash>>,
    /// Scope columns to always include in change payloads.
    scope_columns: HashSet<String>,
    initial_scan_done: bool,
}

/// Default LRU capacity for the watcher cache (100,000 rows).
pub const DEFAULT_WATCHER_LRU_CAPACITY: usize = 100_000;

impl PgPollWatcher {
    pub fn new(
        conn_str: String,
        collections: Vec<String>,
        peer_id: String,
        sync_state: Arc<SyncState>,
        scope_columns: HashSet<String>,
    ) -> Self {
        Self::with_capacity(
            conn_str,
            collections,
            peer_id,
            sync_state,
            scope_columns,
            DEFAULT_WATCHER_LRU_CAPACITY,
        )
    }

    pub fn with_capacity(
        conn_str: String,
        collections: Vec<String>,
        peer_id: String,
        sync_state: Arc<SyncState>,
        scope_columns: HashSet<String>,
        lru_capacity: usize,
    ) -> Self {
        Self {
            conn_str,
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
    async fn poll_collection(&mut self, collection: &str) -> Result<Vec<RowChange>> {
        let (client, connection) =
            tokio_postgres::connect(&self.conn_str, tokio_postgres::NoTls)
                .await
                .context(format!("PgPollWatcher: failed to connect for {}", collection))?;

        tokio::spawn(async move {
            if let Err(e) = connection.await {
                tracing::error!("PgPollWatcher connection error: {}", e);
            }
        });

        let last_updated = self
            .watermarks
            .get(collection)
            .cloned()
            .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string());

        // Collection names are kebab-case, table names are snake_case
        let table = collection.replace('-', "_");

        // Query for changed rows. Uses OR to check both updated_at and created_at,
        // catching newly inserted rows where updated_at is NULL.
        // Try camelCase first (hapihub convention), fall back to snake_case (Drizzle convention).
        // Inline the watermark as a literal instead of using $1 parameter — avoids
        // tokio_postgres text→timestamp serialization issues with prepared statements.
        let escaped_ts = last_updated.replace('\'', "''");
        let (rows, ts_col) = match client
            .query(
                &format!(
                    "SELECT * FROM {table} WHERE \"updatedAt\" > '{escaped_ts}'::timestamp \
                     OR (\"updatedAt\" IS NULL AND \"createdAt\" > '{escaped_ts}'::timestamp) \
                     ORDER BY COALESCE(\"updatedAt\", \"createdAt\") ASC"
                ),
                &[],
            )
            .await
        {
            Ok(r) => (r, "updatedAt"),
            Err(_) => match client
                .query(
                    &format!(
                        "SELECT * FROM {table} WHERE updated_at > '{escaped_ts}'::timestamp \
                         OR (updated_at IS NULL AND created_at > '{escaped_ts}'::timestamp) \
                         ORDER BY COALESCE(updated_at, created_at) ASC"
                    ),
                    &[],
                )
                .await
            {
                Ok(r) => (r, "updated_at"),
                Err(e) => {
                    tracing::trace!("PgPollWatcher: skipping {}: {}", collection, e);
                    return Ok(Vec::new());
                }
            },
        };

        let mut changes = Vec::new();
        let mut max_updated = last_updated.clone();

        for row in &rows {
            let columns = row.columns();
            let mut row_data: HashMap<String, serde_json::Value> = HashMap::new();
            let mut doc_id = String::new();

            for col in columns {
                let name = col.name().to_string();
                let value: serde_json::Value = match col.type_().name() {
                    "text" | "varchar" | "char" | "name" => {
                        match row.try_get::<_, String>(&*name) {
                            Ok(v) => serde_json::Value::String(v),
                            Err(_) => serde_json::Value::Null,
                        }
                    }
                    "uuid" => match row.try_get::<_, String>(&*name) {
                        Ok(v) => serde_json::Value::String(v),
                        Err(_) => serde_json::Value::Null,
                    },
                    "int4" => match row.try_get::<_, i32>(&*name) {
                        Ok(v) => serde_json::Value::from(v),
                        Err(_) => serde_json::Value::Null,
                    },
                    "int8" => match row.try_get::<_, i64>(&*name) {
                        Ok(v) => serde_json::Value::from(v),
                        Err(_) => serde_json::Value::Null,
                    },
                    "int2" => match row.try_get::<_, i16>(&*name) {
                        Ok(v) => serde_json::Value::from(v as i32),
                        Err(_) => serde_json::Value::Null,
                    },
                    "float4" | "float8" | "numeric" => match row.try_get::<_, f64>(&*name) {
                        Ok(v) => serde_json::Value::from(v),
                        Err(_) => serde_json::Value::Null,
                    },
                    "bool" => match row.try_get::<_, bool>(&*name) {
                        Ok(v) => serde_json::Value::Bool(v),
                        Err(_) => serde_json::Value::Null,
                    },
                    "json" | "jsonb" => match row.try_get::<_, serde_json::Value>(&*name) {
                        Ok(v) => v,
                        Err(_) => serde_json::Value::Null,
                    },
                    "timestamp" => match row.try_get::<_, chrono::NaiveDateTime>(&*name) {
                        Ok(v) => serde_json::Value::String(v.format("%Y-%m-%d %H:%M:%S%.f").to_string()),
                        Err(_) => serde_json::Value::Null,
                    },
                    "timestamptz" => match row.try_get::<_, chrono::DateTime<chrono::Utc>>(&*name) {
                        Ok(v) => serde_json::Value::String(v.to_rfc3339()),
                        Err(_) => serde_json::Value::Null,
                    },
                    _ => match row.try_get::<_, String>(&*name) {
                        Ok(v) => serde_json::Value::String(v),
                        Err(_) => serde_json::Value::Null,
                    },
                };

                if name == "id" {
                    doc_id = match &value {
                        serde_json::Value::String(s) => s.clone(),
                        _ => value.to_string(),
                    };
                }

                // Track max timestamp for watermark (check both updated_at and created_at variants)
                if name == ts_col
                    || (ts_col == "updatedAt" && name == "createdAt")
                    || (ts_col == "updated_at" && name == "created_at")
                {
                    if let serde_json::Value::String(ref s) = value {
                        if s > &max_updated {
                            max_updated = s.clone();
                        }
                    }
                }

                row_data.insert(name, value);
            }

            if doc_id.is_empty() {
                continue;
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
                    // Skip timestamp columns
                    if matches!(col.as_str(), "updatedAt" | "createdAt" | "updated_at" | "created_at") {
                        return false;
                    }
                    let hash = hash_json_value(val);
                    // Include if: scope column OR changed (hash differs or new row)
                    self.scope_columns.contains(*col)
                        || match last_hashes {
                            Some(prev) => prev.get(*col) != Some(&hash),
                            None => true,
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

impl ChangeWatcher for PgPollWatcher {
    fn poll_changes(
        &mut self,
    ) -> Pin<Box<dyn Future<Output = Result<WatcherOutput>> + Send + '_>> {
        let collections: Vec<String> = self.collections.clone();
        Box::pin(async move {
            let mut all_changes = Vec::new();
            for collection in &collections {
                match self.poll_collection(collection).await {
                    Ok(changes) => all_changes.extend(changes),
                    Err(e) => {
                        tracing::warn!("PgPollWatcher: failed to poll {}: {}", collection, e);
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
