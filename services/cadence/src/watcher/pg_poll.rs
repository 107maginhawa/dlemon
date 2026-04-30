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
    /// Per-collection set of DB column names that must always be emitted (scope
    /// columns) so the receiving side can re-evaluate scope membership.
    /// Replaces the previously-flat global `HashSet`, which let one collection's
    /// scope rules pollute every other collection's watcher.
    scope_columns_by_collection: HashMap<String, HashSet<String>>,
    initial_scan_done: bool,
}

/// Default LRU capacity for the watcher cache (100,000 rows).
pub const DEFAULT_WATCHER_LRU_CAPACITY: usize = 100_000;

/// Number of rows to fetch per cursor batch during the baseline scan.
const BASELINE_CURSOR_BATCH_SIZE: usize = 1_000;

/// Deserialize a single `tokio_postgres::Row` into a `(doc_id, row_data, max_ts)`
/// tuple. Shared by both the baseline scan and incremental poll paths.
///
/// `ts_col` is the timestamp column name used for watermark tracking
/// (e.g. `"updatedAt"` or `"updated_at"`).
///
/// Returns `None` if the row has no `id` column (skipped).
fn deserialize_pg_row(
    row: &tokio_postgres::Row,
    ts_col: &str,
    current_max_ts: &str,
) -> Option<(String, HashMap<String, serde_json::Value>, String)> {
    let columns = row.columns();
    let mut row_data: HashMap<String, serde_json::Value> = HashMap::new();
    let mut doc_id = String::new();
    let mut max_updated = current_max_ts.to_string();

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
                if s.as_str() > max_updated.as_str() {
                    max_updated = s.clone();
                }
            }
        }

        row_data.insert(name, value);
    }

    if doc_id.is_empty() {
        return None;
    }

    Some((doc_id, row_data, max_updated))
}

/// Compute field hashes for a deserialized row, excluding timestamp columns.
fn compute_field_hashes(
    row_data: &HashMap<String, serde_json::Value>,
) -> HashMap<String, FieldHash> {
    let mut hashes = HashMap::new();
    for (col, val) in row_data {
        if !matches!(
            col.as_str(),
            "updatedAt" | "createdAt" | "updated_at" | "created_at"
        ) {
            hashes.insert(col.clone(), hash_json_value(val));
        }
    }
    hashes
}

/// Try to detect which timestamp column convention a table uses by running
/// a cheap probe query. Returns `"updatedAt"` (camelCase) or `"updated_at"`
/// (snake_case), or `Err` if neither works.
async fn detect_ts_column(
    client: &tokio_postgres::Client,
    table: &str,
) -> Result<&'static str> {
    // Try camelCase first. query() with LIMIT 0 is a no-op that only
    // validates the column exists. An UNDEFINED_COLUMN error means the
    // column doesn't exist and we should try snake_case.
    match client
        .query(&format!("SELECT \"updatedAt\" FROM {table} LIMIT 0"), &[])
        .await
    {
        Ok(_) => return Ok("updatedAt"),
        Err(e) => {
            let is_undefined = e
                .code()
                .map_or(false, |c| *c == tokio_postgres::error::SqlState::UNDEFINED_COLUMN);
            if !is_undefined {
                // Some other error (permissions, table doesn't exist, etc.)
                return Ok("updatedAt"); // optimistic fallback
            }
        }
    }

    match client
        .query(&format!("SELECT updated_at FROM {table} LIMIT 0"), &[])
        .await
    {
        Ok(_) => Ok("updated_at"),
        Err(e) => {
            let is_undefined = e
                .code()
                .map_or(false, |c| *c == tokio_postgres::error::SqlState::UNDEFINED_COLUMN);
            if !is_undefined {
                return Ok("updated_at"); // optimistic fallback
            }
            anyhow::bail!("table {table} has neither updatedAt nor updated_at column")
        }
    }
}

impl PgPollWatcher {
    pub fn new(
        conn_str: String,
        collections: Vec<String>,
        peer_id: String,
        sync_state: Arc<SyncState>,
        scope_columns_by_collection: HashMap<String, HashSet<String>>,
    ) -> Self {
        Self::with_capacity(
            conn_str,
            collections,
            peer_id,
            sync_state,
            scope_columns_by_collection,
            DEFAULT_WATCHER_LRU_CAPACITY,
        )
    }

    pub fn with_capacity(
        conn_str: String,
        collections: Vec<String>,
        peer_id: String,
        sync_state: Arc<SyncState>,
        scope_columns_by_collection: HashMap<String, HashSet<String>>,
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
            scope_columns_by_collection,
            initial_scan_done: false,
        }
    }

    /// Baseline scan for a single collection using a PostgreSQL cursor.
    ///
    /// Iterates all rows in batches of [`BASELINE_CURSOR_BATCH_SIZE`],
    /// populating the LRU hash cache and advancing the watermark without
    /// allocating any `RowChange`/`FieldChange` structs (the baseline is
    /// never persisted or broadcast — see `run_watcher_loop`).
    ///
    /// Returns the total number of rows scanned.
    async fn baseline_scan_collection(&mut self, collection: &str) -> Result<usize> {
        let (client, connection) =
            tokio_postgres::connect(&self.conn_str, tokio_postgres::NoTls)
                .await
                .context(format!(
                    "PgPollWatcher: baseline connect failed for {}",
                    collection
                ))?;

        tokio::spawn(async move {
            if let Err(e) = connection.await {
                tracing::error!("PgPollWatcher baseline connection error: {}", e);
            }
        });

        let table = collection.replace('-', "_");

        // Detect timestamp column convention for this table.
        let ts_col = match detect_ts_column(&client, &table).await {
            Ok(col) => col,
            Err(_) => {
                tracing::trace!(
                    "PgPollWatcher: baseline skipping {} (no timestamp column)",
                    collection
                );
                return Ok(0);
            }
        };

        let created_col = if ts_col == "updatedAt" {
            "createdAt"
        } else {
            "created_at"
        };

        // Use a cursor inside a transaction so we fetch rows in bounded
        // batches instead of loading the entire table into memory.
        client.execute("BEGIN", &[]).await?;
        client
            .execute(
                &format!(
                    "DECLARE baseline_cursor CURSOR FOR \
                     SELECT * FROM {table} \
                     ORDER BY COALESCE(\"{ts_col}\", \"{created_col}\") ASC"
                ),
                &[],
            )
            .await
            .context(format!(
                "PgPollWatcher: baseline DECLARE CURSOR failed for {}",
                collection
            ))?;

        let mut total_rows: usize = 0;
        let mut max_updated = self
            .watermarks
            .get(collection)
            .cloned()
            .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string());

        loop {
            let rows = client
                .query(
                    &format!("FETCH {} FROM baseline_cursor", BASELINE_CURSOR_BATCH_SIZE),
                    &[],
                )
                .await
                .context("PgPollWatcher: baseline FETCH failed")?;

            if rows.is_empty() {
                break;
            }

            let batch_len = rows.len();

            for row in &rows {
                let Some((doc_id, row_data, row_max_ts)) =
                    deserialize_pg_row(row, ts_col, &max_updated)
                else {
                    continue;
                };

                if row_max_ts > max_updated {
                    max_updated = row_max_ts;
                }

                let key = (collection.to_string(), doc_id);
                let hashes = compute_field_hashes(&row_data);
                self.last_known.put(key, hashes);
                // row_data is dropped here — only hashes survive in the LRU
            }

            total_rows += batch_len;

            if batch_len < BASELINE_CURSOR_BATCH_SIZE {
                break; // last batch
            }
        }

        client.execute("CLOSE baseline_cursor", &[]).await.ok();
        client.execute("COMMIT", &[]).await.ok();

        // Advance the watermark so incremental polls start from here.
        if max_updated != "1970-01-01T00:00:00Z" {
            self.watermarks
                .insert(collection.to_string(), max_updated);
        }

        Ok(total_rows)
    }

    /// Poll a single collection for incremental changes (rows updated since
    /// the last watermark). Used after the baseline scan is complete.
    async fn poll_collection(&mut self, collection: &str) -> Result<Vec<RowChange>> {
        // Per-collection scope columns: only the columns this specific
        // collection declares as scope columns are force-emitted. Empty when
        // absent. Bound here so we don't hold a borrow into `self` across the
        // mutable `self.last_known.put` calls below.
        let scope_columns = self
            .scope_columns_by_collection
            .get(collection)
            .cloned()
            .unwrap_or_default();
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
            let Some((doc_id, row_data, row_max_ts)) =
                deserialize_pg_row(row, ts_col, &max_updated)
            else {
                continue;
            };

            if row_max_ts > max_updated {
                max_updated = row_max_ts;
            }

            // Diff against last known state using hashes for memory efficiency.
            // Clone the LRU entry so we can release the immutable borrow before
            // calling `self.last_known.put(...)` below.
            let key = (collection.to_string(), doc_id.clone());
            let last_hashes: Option<HashMap<String, FieldHash>> =
                self.last_known.get(&key).cloned();

            let current_hashes = compute_field_hashes(&row_data);

            // Determine whether any NON-TIMESTAMP field actually changed versus
            // our last known hash set. A row is "new" iff `last_hashes` is None.
            // Rows that we've seen before and whose hashes match exactly must be
            // skipped entirely — otherwise the scope-column passthrough below
            // would emit the same row on every poll, advancing the local seq
            // counter forever and polluting the change log.
            let has_real_change = match &last_hashes {
                None => true, // first time seeing this row
                Some(prev) => {
                    // Changed if any current column's hash differs, or if a
                    // previously-seen column is no longer present.
                    current_hashes.iter().any(|(col, hash)| prev.get(col) != Some(hash))
                        || prev.keys().any(|k| !current_hashes.contains_key(k))
                }
            };

            // Always refresh the LRU so subsequent polls have the latest hash
            // snapshot, even when we skip emission.
            self.last_known.put(key.clone(), current_hashes);

            if !has_real_change {
                continue;
            }

            // Only allocate seq/lamport once we've decided to emit.
            let lamport = self.sync_state.increment_lamport();
            let seq = self.sync_state.next_seq();

            let field_changes: Vec<FieldChange> = row_data
                .iter()
                .filter_map(|(col, val)| {
                    // Skip timestamp columns
                    if matches!(col.as_str(), "updatedAt" | "createdAt" | "updated_at" | "created_at") {
                        return None;
                    }
                    // Include the field if: it's a scope column (downstream scope
                    // filter needs it), OR its hash differs from the last snapshot,
                    // OR this is the first time seeing the row.
                    let include = scope_columns.contains(col.as_str())
                        || match &last_hashes {
                            Some(prev) => {
                                let hash = hash_json_value(val);
                                prev.get(col) != Some(&hash)
                            }
                            None => true,
                        };
                    if !include {
                        return None;
                    }
                    Some(FieldChange {
                        field: col.clone(),
                        value: val.clone(),
                        lamport,
                        peer_id: self.peer_id.clone(),
                    })
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
            // On the first poll, run a cursor-based baseline scan that only
            // populates the LRU hash cache without allocating RowChange
            // structs. This avoids loading entire tables into memory —
            // critical for large DBs (e.g. 200K+ medical_records rows that
            // previously caused 20+ GB RSS).
            if !self.initial_scan_done {
                let mut total = 0usize;
                for collection in &collections {
                    match self.baseline_scan_collection(collection).await {
                        Ok(n) => {
                            if n > 0 {
                                tracing::info!(
                                    "PgPollWatcher: baseline scanned {} ({} rows)",
                                    collection,
                                    n
                                );
                            }
                            total += n;
                        }
                        Err(e) => {
                            tracing::warn!(
                                "PgPollWatcher: baseline scan failed for {}: {}",
                                collection,
                                e
                            );
                        }
                    }
                }
                self.initial_scan_done = true;
                // Intentionally DO NOT call `set_baseline_completion_seq` here.
                // The pg-poll watcher silently absorbs baseline rows into its
                // LRU cache without writing them to the change log — so the
                // change log can never serve as a complete source for a
                // reconnecting peer. Leaving `baseline_completion_seq` at its
                // default `u64::MAX` keeps `build_catchup_frames`'s
                // `since_seq < baseline_completion_seq` predicate always-true
                // for this watcher, forcing every catch-up call to run the
                // primary-reader pass. (The sqlite watcher *does* emit
                // baseline rows to the change log naturally — see its own
                // `set_baseline_completion_seq` call site for the asymmetric
                // behaviour.)
                tracing::info!(
                    "PgPollWatcher: baseline scan complete ({} rows across {} collections); change log does not contain baseline data → primary-reader will fire on every catch-up",
                    total,
                    collections.len(),
                );
                // Return empty changes — the baseline is never persisted or
                // broadcast (run_watcher_loop drops non-incremental output).
                return Ok(WatcherOutput {
                    changes: Vec::new(),
                    is_incremental: false,
                });
            }

            // Incremental poll — only fetches rows updated since the last
            // watermark. Result sets are small (typically 0-100 rows).
            let mut all_changes = Vec::new();
            for collection in &collections {
                match self.poll_collection(collection).await {
                    Ok(changes) => all_changes.extend(changes),
                    Err(e) => {
                        tracing::warn!("PgPollWatcher: failed to poll {}: {}", collection, e);
                    }
                }
            }
            Ok(WatcherOutput {
                changes: all_changes,
                is_incremental: true,
            })
        })
    }
}
