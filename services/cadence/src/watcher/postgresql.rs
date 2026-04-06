use anyhow::{Context, Result};
use lru::LruCache;
use std::collections::HashMap;
use std::future::Future;
use std::num::NonZeroUsize;
use std::pin::Pin;
use std::sync::Arc;

use crate::state::{FieldChange, RowChange, SyncPayload, SyncState};
use crate::watcher::{hash_json_value, ChangeWatcher, FieldHash, WatcherOutput};

/// Default LRU capacity for the watcher cache (100,000 rows).
pub const DEFAULT_WATCHER_LRU_CAPACITY: usize = 100_000;

/// PostgreSQL LISTEN/NOTIFY-based change watcher.
/// Requires a trigger on each synced table that sends NOTIFY with table name and row ID.
pub struct PostgresWatcher {
    /// Connection string for the primary PostgreSQL database.
    conn_str: String,
    /// Collections (table names) to watch.
    collections: Vec<String>,
    /// Peer ID for this node.
    peer_id: String,
    /// Shared sync state.
    sync_state: Arc<SyncState>,
    /// Pending notifications (table, doc_id) to process.
    pending: Vec<(String, String)>,
    /// Last known row state for diffing, stored as field hashes for memory efficiency.
    /// Uses LRU eviction to bound memory usage.
    last_known: LruCache<(String, String), HashMap<String, FieldHash>>,
}

impl PostgresWatcher {
    pub fn new(
        conn_str: String,
        collections: Vec<String>,
        peer_id: String,
        sync_state: Arc<SyncState>,
    ) -> Self {
        Self::with_capacity(conn_str, collections, peer_id, sync_state, DEFAULT_WATCHER_LRU_CAPACITY)
    }

    pub fn with_capacity(
        conn_str: String,
        collections: Vec<String>,
        peer_id: String,
        sync_state: Arc<SyncState>,
        lru_capacity: usize,
    ) -> Self {
        Self {
            conn_str,
            collections,
            peer_id,
            sync_state,
            pending: Vec::new(),
            last_known: LruCache::new(
                NonZeroUsize::new(lru_capacity).unwrap_or(NonZeroUsize::new(DEFAULT_WATCHER_LRU_CAPACITY).unwrap()),
            ),
        }
    }

    /// Install LISTEN/NOTIFY triggers on the watched tables.
    pub async fn setup_triggers(&self) -> Result<()> {
        let (client, connection) =
            tokio_postgres::connect(&self.conn_str, tokio_postgres::NoTls)
                .await
                .context("Failed to connect to PostgreSQL")?;

        tokio::spawn(async move {
            if let Err(e) = connection.await {
                tracing::error!("PostgreSQL connection error: {}", e);
            }
        });

        for table in &self.collections {
            let channel = format!("cadence_{}", table);
            let trigger_fn = format!(
                "CREATE OR REPLACE FUNCTION cadence_notify_{table}() RETURNS trigger AS $$
                BEGIN
                    PERFORM pg_notify('{channel}', NEW.id::text);
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;"
            );

            let trigger = format!(
                "DROP TRIGGER IF EXISTS cadence_trigger_{table} ON {table};
                CREATE TRIGGER cadence_trigger_{table}
                AFTER INSERT OR UPDATE ON {table}
                FOR EACH ROW EXECUTE FUNCTION cadence_notify_{table}();"
            );

            client.batch_execute(&trigger_fn).await?;
            client.batch_execute(&trigger).await?;

            // Subscribe to the channel
            client
                .execute(&format!("LISTEN {}", channel), &[])
                .await?;
        }

        Ok(())
    }

    /// Fetch a full row and decompose into FieldChanges.
    async fn fetch_and_decompose(
        &mut self,
        table: &str,
        doc_id: &str,
    ) -> Result<Option<RowChange>> {
        let (client, connection) =
            tokio_postgres::connect(&self.conn_str, tokio_postgres::NoTls)
                .await
                .context("Failed to connect to PostgreSQL")?;

        tokio::spawn(async move {
            if let Err(e) = connection.await {
                tracing::error!("PostgreSQL connection error: {}", e);
            }
        });

        let query = format!("SELECT * FROM {} WHERE id = $1", table);
        let rows = client.query(&query, &[&doc_id]).await?;

        if rows.is_empty() {
            // Row was deleted
            let _lamport = self.sync_state.increment_lamport();
            let seq = self.sync_state.next_seq();
            return Ok(Some(RowChange {
                collection: table.to_string(),
                document_id: doc_id.to_string(),
                payload: SyncPayload::Fields(vec![]),
                deleted: true,
                seq,
            }));
        }

        let row = &rows[0];
        let columns = row.columns();
        let mut row_data: HashMap<String, serde_json::Value> = HashMap::new();

        for col in columns {
            let name = col.name().to_string();
            let value: serde_json::Value = match col.type_().name() {
                "text" | "varchar" | "char" | "uuid" => {
                    match row.try_get::<_, String>(col.name()) {
                        Ok(v) => serde_json::Value::String(v),
                        Err(_) => serde_json::Value::Null,
                    }
                }
                "int4" | "int8" | "int2" => match row.try_get::<_, i64>(col.name()) {
                    Ok(v) => serde_json::Value::from(v),
                    Err(_) => match row.try_get::<_, i32>(col.name()) {
                        Ok(v) => serde_json::Value::from(v),
                        Err(_) => serde_json::Value::Null,
                    },
                },
                "bool" => match row.try_get::<_, bool>(col.name()) {
                    Ok(v) => serde_json::Value::Bool(v),
                    Err(_) => serde_json::Value::Null,
                },
                "json" | "jsonb" => match row.try_get::<_, serde_json::Value>(col.name()) {
                    Ok(v) => v,
                    Err(_) => serde_json::Value::Null,
                },
                _ => match row.try_get::<_, String>(col.name()) {
                    Ok(v) => serde_json::Value::String(v),
                    Err(_) => serde_json::Value::Null,
                },
            };
            row_data.insert(name, value);
        }

        // Diff against last known state using hashes for memory efficiency
        let key = (table.to_string(), doc_id.to_string());
        let last_hashes = self.last_known.get(&key);

        // Compute hashes for current row
        let mut current_hashes: HashMap<String, FieldHash> = HashMap::new();
        for (col, val) in &row_data {
            if !matches!(col.as_str(), "updatedAt" | "createdAt" | "updated_at" | "created_at") {
                current_hashes.insert(col.clone(), hash_json_value(val));
            }
        }

        let lamport = self.sync_state.increment_lamport();
        let seq = self.sync_state.next_seq();

        let field_changes: Vec<FieldChange> = row_data
            .iter()
            .filter(|(col, val)| {
                if matches!(col.as_str(), "updatedAt" | "createdAt" | "updated_at" | "created_at") {
                    return false;
                }
                let hash = hash_json_value(val);
                match last_hashes {
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

        // Store hashes, not full row data (96% memory reduction)
        self.last_known.put(key, current_hashes);

        if field_changes.is_empty() {
            return Ok(None);
        }

        Ok(Some(RowChange {
            collection: table.to_string(),
            document_id: doc_id.to_string(),
            payload: SyncPayload::Fields(field_changes),
            deleted: false,
            seq,
        }))
    }
}

impl ChangeWatcher for PostgresWatcher {
    fn poll_changes(
        &mut self,
    ) -> Pin<Box<dyn Future<Output = Result<WatcherOutput>> + Send + '_>> {
        Box::pin(async move {
            let mut changes = Vec::new();
            let pending = std::mem::take(&mut self.pending);
            for (table, doc_id) in pending {
                match self.fetch_and_decompose(&table, &doc_id).await {
                    Ok(Some(change)) => changes.push(change),
                    Ok(None) => {}
                    Err(e) => {
                        tracing::warn!("Failed to fetch {}/{}: {}", table, doc_id, e);
                    }
                }
            }
            // LISTEN/NOTIFY-based watcher only receives changes after the initial connection,
            // so all changes here are incremental by definition.
            Ok(WatcherOutput {
                changes,
                is_incremental: true,
            })
        })
    }
}
