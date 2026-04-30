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
    /// Per-collection set of DB column names that must always be emitted (scope
    /// columns) so the receiving side can re-evaluate scope membership.
    /// Collections not in the map have an empty scope-column set. This is the
    /// per-collection replacement for the previously-flat global `HashSet`,
    /// which let one collection's scope rules pollute every other collection's
    /// watcher and emit PK-only no-op changes that broke pg upserts.
    scope_columns_by_collection: HashMap<String, HashSet<String>>,
    initial_scan_done: bool,
}

impl SqliteWatcher {
    pub fn new(
        conn: Arc<Mutex<Connection>>,
        collections: Vec<String>,
        peer_id: String,
        sync_state: Arc<SyncState>,
        scope_columns_by_collection: HashMap<String, HashSet<String>>,
    ) -> Self {
        Self::with_capacity(
            conn,
            collections,
            peer_id,
            sync_state,
            scope_columns_by_collection,
            DEFAULT_WATCHER_LRU_CAPACITY,
        )
    }

    pub fn with_capacity(
        conn: Arc<Mutex<Connection>>,
        collections: Vec<String>,
        peer_id: String,
        sync_state: Arc<SyncState>,
        scope_columns_by_collection: HashMap<String, HashSet<String>>,
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
            scope_columns_by_collection,
            initial_scan_done: false,
        }
    }

    /// Poll a single collection for changes.
    fn poll_collection(&mut self, collection: &str) -> Result<Vec<RowChange>> {
        // Per-collection scope columns: only the columns this specific collection
        // declares as scope columns are force-emitted. Empty set when absent.
        let empty_scope: HashSet<String> = HashSet::new();
        let scope_columns = self
            .scope_columns_by_collection
            .get(collection)
            .unwrap_or(&empty_scope);
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

            // Diff against last known state using hashes for memory efficiency.
            // Clone the LRU entry so we can release the immutable borrow before
            // calling `self.last_known.put(...)` below — same pattern as
            // pg_poll.rs.
            let key = (collection.to_string(), doc_id.clone());
            let last_hashes: Option<HashMap<String, FieldHash>> =
                self.last_known.get(&key).cloned();

            // Compute hashes for current row
            let mut current_hashes: HashMap<String, FieldHash> = HashMap::new();
            for (col, val) in &row_data {
                // Skip timestamp columns (both camelCase and snake_case conventions)
                if !matches!(col.as_str(), "updatedAt" | "createdAt" | "updated_at" | "created_at") {
                    current_hashes.insert(col.clone(), hash_json_value(val));
                }
            }

            // Decide *first* whether anything real changed for this row.
            // Mirrors the gate already in pg_poll.rs: a row is "new" iff
            // `last_hashes` is None; otherwise it changed iff any current
            // column's hash differs from the previous snapshot, or a
            // previously-seen column is now missing.
            //
            // Without this guard the watcher emits a `RowChange` containing
            // only the unchanged scope columns whenever a poll re-surfaces a
            // row (e.g. via `updated_at` bumps from the applier itself). On
            // tables where a scope column is the PK and the receiving table
            // has NOT NULL columns that aren't part of the change, the upsert
            // fails and the change is retried forever, blocking the entire
            // sync stream.
            let has_real_change = match &last_hashes {
                None => true,
                Some(prev) => {
                    current_hashes.iter().any(|(col, hash)| prev.get(col) != Some(hash))
                        || prev.keys().any(|k| !current_hashes.contains_key(k))
                }
            };

            // Always refresh the LRU snapshot so subsequent polls compare
            // against the latest hashes — even when we skip emission.
            self.last_known.put(key.clone(), current_hashes);

            if !has_real_change {
                continue;
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
                    scope_columns.contains(*col)
                        || match &last_hashes {
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
            // (LRU snapshot already refreshed above, before the has_real_change
            // gate, so subsequent polls compare against the latest hashes even
            // when emission is skipped.)
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
                // SQLite watcher's first poll emits all existing rows to the
                // change log directly (last_known is empty → has_real_change
                // takes the None path → emits every column). So unlike
                // pg_poll's baseline, the change log is *complete* after this
                // poll for any peer whose since_seq is below the latest local
                // seq. Recording that ceiling lets `build_catchup_frames`
                // skip the primary-reader pass for reconnects above it.
                let baseline_seq = self.sync_state.local_seq();
                self.sync_state.set_baseline_completion_seq(baseline_seq);
            }
            Ok(WatcherOutput {
                changes: all_changes,
                is_incremental,
            })
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::SyncPayload;
    use rusqlite::params;

    /// Build a minimal `accounts` table mirroring the Better Auth schema that
    /// triggered the original bug: `id` is the PK, plus a couple of NOT NULL
    /// data columns that *would* fail an upsert if only `id` got emitted.
    fn make_test_db() -> Arc<Mutex<Connection>> {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE "accounts" (
                "id" TEXT PRIMARY KEY,
                "account_id" TEXT NOT NULL,
                "user_id" TEXT NOT NULL,
                "createdAt" TEXT,
                "updatedAt" TEXT
            );
            "#,
        )
        .unwrap();
        Arc::new(Mutex::new(conn))
    }

    fn insert_account(conn: &Arc<Mutex<Connection>>, id: &str, ts: &str) {
        let conn = conn.lock().unwrap();
        conn.execute(
            r#"INSERT INTO "accounts" ("id", "account_id", "user_id", "createdAt", "updatedAt")
               VALUES (?1, ?2, ?3, ?4, ?4)"#,
            params![id, format!("acct-{id}"), format!("user-{id}"), ts],
        )
        .unwrap();
    }

    fn touch_updated_at(conn: &Arc<Mutex<Connection>>, id: &str, ts: &str) {
        let conn = conn.lock().unwrap();
        conn.execute(
            r#"UPDATE "accounts" SET "updatedAt" = ?1 WHERE "id" = ?2"#,
            params![ts, id],
        )
        .unwrap();
    }

    /// Regression: when a row's `updatedAt` is bumped but no real column
    /// changed, the watcher must NOT emit a PK-only no-op `RowChange`. This is
    /// the bug that stalled staging cadence for 17 hours — the applier choked
    /// on `INSERT INTO accounts (id) ... ON CONFLICT DO UPDATE` because of
    /// NOT NULL constraints, and retried forever.
    #[test]
    fn no_op_updated_at_bump_emits_zero_changes() {
        let conn = make_test_db();
        insert_account(&conn, "abc", "2026-04-28T00:00:00Z");

        let mut scope_columns_by_collection: HashMap<String, HashSet<String>> = HashMap::new();
        let mut scope_set = HashSet::new();
        scope_set.insert("id".to_string()); // worst-case: id is a scope column
        scope_columns_by_collection.insert("accounts".to_string(), scope_set);

        let state = Arc::new(SyncState::new());
        let mut watcher = SqliteWatcher::new(
            conn.clone(),
            vec!["accounts".to_string()],
            "test-peer".to_string(),
            state,
            scope_columns_by_collection,
        );

        // First poll: row is new → emit full row.
        let first = watcher.poll_collection("accounts").unwrap();
        assert_eq!(first.len(), 1, "first poll should emit the new row");
        if let SyncPayload::Fields(fields) = &first[0].payload {
            // All non-timestamp columns must be present so the receiving
            // applier has a complete record (id, account_id, user_id).
            assert!(fields.iter().any(|f| f.field == "account_id"));
            assert!(fields.iter().any(|f| f.field == "user_id"));
        } else {
            panic!("expected SyncPayload::Fields");
        }

        // Bump updatedAt without changing any data column — this is exactly
        // the situation the cadence applier itself creates on every successful
        // upsert (it always writes `updated_at = now()`).
        touch_updated_at(&conn, "abc", "2026-04-28T01:00:00Z");

        let second = watcher.poll_collection("accounts").unwrap();
        assert!(
            second.is_empty(),
            "no-op updatedAt bump must NOT emit any changes — got {} change(s) with payload(s) {:?}",
            second.len(),
            second.iter().map(|c| &c.payload).collect::<Vec<_>>()
        );
    }

    /// Companion: a real data change still emits, and the emitted `RowChange`
    /// includes the changed column (plus any scope columns).
    #[test]
    fn real_change_emits_changed_column_and_scope_columns() {
        let conn = make_test_db();
        insert_account(&conn, "abc", "2026-04-28T00:00:00Z");

        let mut scope_columns_by_collection: HashMap<String, HashSet<String>> = HashMap::new();
        let mut scope_set = HashSet::new();
        scope_set.insert("user_id".to_string());
        scope_columns_by_collection.insert("accounts".to_string(), scope_set);

        let state = Arc::new(SyncState::new());
        let mut watcher = SqliteWatcher::new(
            conn.clone(),
            vec!["accounts".to_string()],
            "test-peer".to_string(),
            state,
            scope_columns_by_collection,
        );

        // Prime the cache with the initial state.
        let _ = watcher.poll_collection("accounts").unwrap();

        // Real data change: rewrite account_id, also bump updatedAt.
        {
            let conn = conn.lock().unwrap();
            conn.execute(
                r#"UPDATE "accounts"
                   SET "account_id" = 'NEW', "updatedAt" = '2026-04-28T02:00:00Z'
                   WHERE "id" = 'abc'"#,
                [],
            )
            .unwrap();
        }

        let changes = watcher.poll_collection("accounts").unwrap();
        assert_eq!(changes.len(), 1, "real change must emit exactly one RowChange");
        let SyncPayload::Fields(fields) = &changes[0].payload else {
            panic!("expected SyncPayload::Fields");
        };
        let names: HashSet<&str> = fields.iter().map(|f| f.field.as_str()).collect();
        assert!(names.contains("account_id"), "changed column must be in payload, got {:?}", names);
        assert!(names.contains("user_id"), "scope column must be force-included, got {:?}", names);
    }

    /// Per-collection scope columns must NOT bleed into other collections.
    /// This is the architectural bug that turned the embedded `accounts`
    /// (plural) registration into a watcher poison for the Better Auth
    /// `account` (singular) table.
    #[test]
    fn scope_columns_do_not_leak_across_collections() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE "foo" (
                "id" TEXT PRIMARY KEY,
                "data" TEXT,
                "updatedAt" TEXT
            );
            CREATE TABLE "bar" (
                "id" TEXT PRIMARY KEY,
                "data" TEXT,
                "updatedAt" TEXT
            );
            INSERT INTO "foo" VALUES ('1', 'foo-data', '2026-04-28T00:00:00Z');
            INSERT INTO "bar" VALUES ('1', 'bar-data', '2026-04-28T00:00:00Z');
            "#,
        )
        .unwrap();
        let conn = Arc::new(Mutex::new(conn));

        // `bar` declares `id` as a scope column; `foo` does not.
        let mut by_collection: HashMap<String, HashSet<String>> = HashMap::new();
        by_collection.insert("foo".to_string(), HashSet::new());
        let mut bar_scope = HashSet::new();
        bar_scope.insert("id".to_string());
        by_collection.insert("bar".to_string(), bar_scope);

        let state = Arc::new(SyncState::new());
        let mut watcher = SqliteWatcher::new(
            conn.clone(),
            vec!["foo".to_string(), "bar".to_string()],
            "test-peer".to_string(),
            state,
            by_collection,
        );

        // Prime cache for both rows.
        let _ = watcher.poll_collection("foo").unwrap();
        let _ = watcher.poll_collection("bar").unwrap();

        // Bump `updatedAt` on both rows — no data change.
        {
            let c = conn.lock().unwrap();
            c.execute(
                r#"UPDATE "foo" SET "updatedAt" = '2026-04-28T01:00:00Z' WHERE "id" = '1'"#,
                [],
            )
            .unwrap();
            c.execute(
                r#"UPDATE "bar" SET "updatedAt" = '2026-04-28T01:00:00Z' WHERE "id" = '1'"#,
                [],
            )
            .unwrap();
        }

        // Both should be skipped — no real change. The has_real_change gate
        // covers both, regardless of scope-column config.
        let foo_changes = watcher.poll_collection("foo").unwrap();
        let bar_changes = watcher.poll_collection("bar").unwrap();
        assert!(foo_changes.is_empty(), "foo: no-op bump must not emit");
        assert!(bar_changes.is_empty(), "bar: no-op bump must not emit");
    }
}
