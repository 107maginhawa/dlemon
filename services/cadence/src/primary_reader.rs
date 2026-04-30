use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;

use crate::state::{FieldChange, RowChange, SyncPayload, SyncState};

/// Reads rows directly from the primary database for initial catch-up.
/// Used when a new peer connects (since_seq == 0) to serve a full snapshot
/// without requiring the change log to contain all data.
#[async_trait]
pub trait PrimaryDbReader: Send + Sync + 'static {
    /// Read all rows from a collection, converting each to a RowChange.
    async fn read_all_rows(
        &self,
        collection: &str,
        state: &SyncState,
    ) -> Result<Vec<RowChange>>;

    /// Read a page of rows from a collection using LIMIT/OFFSET pagination.
    /// Returns an empty Vec when there are no more rows.
    async fn read_rows_page(
        &self,
        collection: &str,
        state: &SyncState,
        offset: u64,
        limit: u64,
    ) -> Result<Vec<RowChange>>;

    /// Fast row count across all collections for progress estimation.
    async fn count_all_rows(&self, config: &crate::config::CadenceConfig) -> Result<u64>;
}

/// PostgreSQL implementation of PrimaryDbReader.
pub struct PgPrimaryReader {
    conn_str: String,
    peer_id: String,
}

impl PgPrimaryReader {
    pub fn new(conn_str: String, peer_id: String) -> Self {
        Self { conn_str, peer_id }
    }
}

#[async_trait]
impl PrimaryDbReader for PgPrimaryReader {
    async fn count_all_rows(&self, config: &crate::config::CadenceConfig) -> Result<u64> {
        let (client, connection) =
            tokio_postgres::connect(&self.conn_str, tokio_postgres::NoTls).await?;
        tokio::spawn(async move {
            if let Err(e) = connection.await {
                tracing::error!("PgPrimaryReader count connection error: {}", e);
            }
        });
        // Use pg_class reltuples for fast row count estimates (no table scan).
        // Updated by ANALYZE / autovacuum, accurate enough for progress tracking.
        let mut total = 0u64;
        let tables: Vec<String> = config.collections.keys()
            .map(|c| c.replace('-', "_"))
            .collect();
        for table in &tables {
            match client.query_one(
                "SELECT COALESCE(reltuples, 0)::bigint FROM pg_class WHERE relname = $1",
                &[table],
            ).await {
                Ok(row) => {
                    let count: i64 = row.get(0);
                    if count > 0 {
                        total += count as u64;
                    }
                }
                Err(_) => {}
            }
        }
        Ok(total)
    }

    async fn read_all_rows(
        &self,
        collection: &str,
        state: &SyncState,
    ) -> Result<Vec<RowChange>> {
        // Paginate internally to avoid loading the entire table into a
        // single Vec<Row> from tokio_postgres (which is the main memory hog).
        let mut all_changes = Vec::new();
        let mut offset = 0u64;
        let page_size = 1000u64;
        loop {
            let page = self.read_rows_page(collection, state, offset, page_size).await?;
            let n = page.len();
            all_changes.extend(page);
            if (n as u64) < page_size {
                break;
            }
            offset += page_size;
        }
        Ok(all_changes)
    }

    async fn read_rows_page(
        &self,
        collection: &str,
        state: &SyncState,
        offset: u64,
        limit: u64,
    ) -> Result<Vec<RowChange>> {
        let (client, connection) =
            tokio_postgres::connect(&self.conn_str, tokio_postgres::NoTls).await?;
        tokio::spawn(async move {
            if let Err(e) = connection.await {
                tracing::error!("PgPrimaryReader connection error: {}", e);
            }
        });

        let table = collection.replace('-', "_");
        let query = format!(
            "SELECT * FROM \"{}\" ORDER BY id LIMIT {} OFFSET {}",
            table, limit, offset
        );
        let rows = match client.query(&query, &[]).await {
            Ok(r) => r,
            Err(e) => {
                // Silently dropping a whole collection from initial catch-up
                // (because `SELECT *` failed on a single problematic column,
                // or because the table is missing an `id` column, or because
                // tokio_postgres can't deserialize a column type we don't
                // explicitly handle in `pg_column_to_json`) used to be
                // invisible at TRACE level. New peers would simply never
                // receive that collection's data and would have no way to know
                // why. WARN with structured fields makes this self-diagnose.
                let pg_err = e.as_db_error();
                tracing::warn!(
                    collection = %collection,
                    table = %table,
                    offset,
                    sqlstate = ?pg_err.map(|d| d.code().code()),
                    column = ?pg_err.and_then(|d| d.column()),
                    pg_table = ?pg_err.and_then(|d| d.table()),
                    message = ?pg_err.map(|d| d.message()),
                    error = %e,
                    "PrimaryReader (PG): dropping collection — SELECT failed"
                );
                return Ok(Vec::new());
            }
        };

        let mut changes = Vec::new();

        for row in &rows {
            let columns = row.columns();
            let mut doc_id = String::new();
            let mut field_changes = Vec::new();
            let lamport = state.increment_lamport();
            let seq = state.next_seq();

            for col in columns {
                let name = col.name().to_string();
                let value = pg_column_to_json(row, &name, col.type_().name());

                if name == "id" {
                    doc_id = match &value {
                        serde_json::Value::String(s) => s.clone(),
                        _ => value.to_string(),
                    };
                }

                if matches!(name.as_str(), "updatedAt" | "createdAt" | "updated_at" | "created_at") {
                    continue;
                }

                field_changes.push(FieldChange {
                    field: name,
                    value,
                    lamport,
                    peer_id: self.peer_id.clone(),
                });
            }

            if doc_id.is_empty() {
                continue;
            }

            changes.push(RowChange {
                collection: collection.to_string(),
                document_id: doc_id,
                payload: SyncPayload::Fields(field_changes),
                deleted: false,
                seq,
            });
        }

        Ok(changes)
    }
}

/// SQLite implementation of PrimaryDbReader.
pub struct SqlitePrimaryReader {
    conn: Arc<std::sync::Mutex<rusqlite::Connection>>,
    peer_id: String,
}

impl SqlitePrimaryReader {
    pub fn new(conn: Arc<std::sync::Mutex<rusqlite::Connection>>, peer_id: String) -> Self {
        Self { conn, peer_id }
    }
}

#[async_trait]
impl PrimaryDbReader for SqlitePrimaryReader {
    async fn count_all_rows(&self, config: &crate::config::CadenceConfig) -> Result<u64> {
        // SQLite doesn't have a stats table like pg_class, but count(*) is fast
        // when tables have a rowid (default). Uses a UNION ALL to batch into one query.
        let conn = self.conn.lock().unwrap();
        let parts: Vec<String> = config.collections.keys()
            .map(|c| {
                let table = c.replace('-', "_");
                format!("SELECT count(*) AS n FROM \"{}\"", table)
            })
            .collect();
        if parts.is_empty() {
            return Ok(0);
        }
        let sql = format!("SELECT SUM(n) FROM ({})", parts.join(" UNION ALL "));
        match conn.query_row(&sql, [], |row| row.get::<_, i64>(0)) {
            Ok(total) => Ok(total as u64),
            Err(_) => Ok(0),
        }
    }

    async fn read_rows_page(
        &self,
        collection: &str,
        state: &SyncState,
        offset: u64,
        limit: u64,
    ) -> Result<Vec<RowChange>> {
        let conn = self.conn.lock().unwrap();
        let table = collection.replace('-', "_");
        let query = format!(
            "SELECT * FROM \"{}\" ORDER BY id LIMIT {} OFFSET {}",
            table, limit, offset
        );

        let mut stmt = match conn.prepare(&query) {
            Ok(s) => s,
            Err(e) => {
                // See PgPrimaryReader::read_rows_page for the rationale —
                // dropping a whole collection silently is exactly the class of
                // failure that should never sit at TRACE.
                tracing::warn!(
                    collection = %collection,
                    table = %table,
                    offset,
                    error = %e,
                    "PrimaryReader (SQLite): dropping collection — prepare failed (page)"
                );
                return Ok(Vec::new());
            }
        };

        let column_names: Vec<String> = stmt
            .column_names()
            .iter()
            .map(|s| s.to_string())
            .collect();

        let mut changes = Vec::new();
        let mut rows = stmt.query(rusqlite::params![])?;

        while let Some(row) = rows.next()? {
            let mut doc_id = String::new();
            let mut field_changes = Vec::new();
            let lamport = state.increment_lamport();
            let seq = state.next_seq();

            for (i, col_name) in column_names.iter().enumerate() {
                let value = sqlite_column_to_json(row, i);

                if col_name == "id" {
                    doc_id = match &value {
                        serde_json::Value::String(s) => s.clone(),
                        _ => value.to_string(),
                    };
                }

                if col_name == "updatedAt" || col_name == "createdAt" {
                    continue;
                }

                field_changes.push(FieldChange {
                    field: col_name.clone(),
                    value,
                    lamport,
                    peer_id: self.peer_id.clone(),
                });
            }

            if doc_id.is_empty() {
                continue;
            }

            changes.push(RowChange {
                collection: collection.to_string(),
                document_id: doc_id,
                payload: SyncPayload::Fields(field_changes),
                deleted: false,
                seq,
            });
        }

        Ok(changes)
    }

    async fn read_all_rows(
        &self,
        collection: &str,
        state: &SyncState,
    ) -> Result<Vec<RowChange>> {
        let conn = self.conn.lock().unwrap();
        let table = collection.replace('-', "_");
        let query = format!("SELECT * FROM \"{}\"", table);

        let mut stmt = match conn.prepare(&query) {
            Ok(s) => s,
            Err(e) => {
                tracing::warn!(
                    collection = %collection,
                    table = %table,
                    error = %e,
                    "PrimaryReader (SQLite): dropping collection — prepare failed (full scan)"
                );
                return Ok(Vec::new());
            }
        };

        let column_names: Vec<String> = stmt
            .column_names()
            .iter()
            .map(|s| s.to_string())
            .collect();

        let mut changes = Vec::new();
        let mut rows = stmt.query(rusqlite::params![])?;

        while let Some(row) = rows.next()? {
            let mut doc_id = String::new();
            let mut field_changes = Vec::new();
            let lamport = state.increment_lamport();
            let seq = state.next_seq();

            for (i, col_name) in column_names.iter().enumerate() {
                let value = sqlite_column_to_json(row, i);

                if col_name == "id" {
                    doc_id = match &value {
                        serde_json::Value::String(s) => s.clone(),
                        _ => value.to_string(),
                    };
                }

                if col_name == "updatedAt" || col_name == "createdAt" {
                    continue;
                }

                field_changes.push(FieldChange {
                    field: col_name.clone(),
                    value,
                    lamport,
                    peer_id: self.peer_id.clone(),
                });
            }

            if doc_id.is_empty() {
                continue;
            }

            changes.push(RowChange {
                collection: collection.to_string(),
                document_id: doc_id,
                payload: SyncPayload::Fields(field_changes),
                deleted: false,
                seq,
            });
        }

        Ok(changes)
    }
}

/// Convert a PostgreSQL column value to a serde_json::Value.
fn pg_column_to_json(row: &tokio_postgres::Row, name: &str, type_name: &str) -> serde_json::Value {
    match type_name {
        "text" | "varchar" | "char" | "name" => match row.try_get::<_, String>(name) {
            Ok(v) => serde_json::Value::String(v),
            Err(_) => serde_json::Value::Null,
        },
        "uuid" => match row.try_get::<_, String>(name) {
            Ok(v) => serde_json::Value::String(v),
            Err(_) => serde_json::Value::Null,
        },
        "int4" => match row.try_get::<_, i32>(name) {
            Ok(v) => serde_json::Value::from(v),
            Err(_) => serde_json::Value::Null,
        },
        "int8" => match row.try_get::<_, i64>(name) {
            Ok(v) => serde_json::Value::from(v),
            Err(_) => serde_json::Value::Null,
        },
        "int2" => match row.try_get::<_, i16>(name) {
            Ok(v) => serde_json::Value::from(v as i32),
            Err(_) => serde_json::Value::Null,
        },
        "float4" | "float8" | "numeric" => match row.try_get::<_, f64>(name) {
            Ok(v) => serde_json::Value::from(v),
            Err(_) => serde_json::Value::Null,
        },
        "bool" => match row.try_get::<_, bool>(name) {
            Ok(v) => serde_json::Value::Bool(v),
            Err(_) => serde_json::Value::Null,
        },
        "json" | "jsonb" => match row.try_get::<_, serde_json::Value>(name) {
            Ok(v) => v,
            Err(_) => serde_json::Value::Null,
        },
        "timestamp" => match row.try_get::<_, chrono::NaiveDateTime>(name) {
            Ok(v) => serde_json::Value::String(v.format("%Y-%m-%d %H:%M:%S%.f").to_string()),
            Err(_) => serde_json::Value::Null,
        },
        "timestamptz" => match row.try_get::<_, chrono::DateTime<chrono::Utc>>(name) {
            Ok(v) => serde_json::Value::String(v.to_rfc3339()),
            Err(_) => serde_json::Value::Null,
        },
        _ => match row.try_get::<_, String>(name) {
            Ok(v) => serde_json::Value::String(v),
            Err(_) => serde_json::Value::Null,
        },
    }
}

/// Convert a SQLite column value to a serde_json::Value.
fn sqlite_column_to_json(row: &rusqlite::Row, index: usize) -> serde_json::Value {
    match row.get_ref(index) {
        Ok(rusqlite::types::ValueRef::Null) => serde_json::Value::Null,
        Ok(rusqlite::types::ValueRef::Integer(v)) => serde_json::Value::from(v),
        Ok(rusqlite::types::ValueRef::Real(v)) => serde_json::Value::from(v),
        Ok(rusqlite::types::ValueRef::Text(v)) => {
            let s = std::str::from_utf8(v).unwrap_or("");
            if (s.starts_with('{') || s.starts_with('['))
                && serde_json::from_str::<serde_json::Value>(s).is_ok()
            {
                serde_json::from_str(s).unwrap()
            } else {
                serde_json::Value::String(s.to_string())
            }
        }
        Ok(rusqlite::types::ValueRef::Blob(v)) => {
            serde_json::Value::String(format!("<blob:{}>", v.len()))
        }
        Err(_) => serde_json::Value::Null,
    }
}

/// A no-op PrimaryDbReader for tests where no primary DB is available.
pub struct NoPrimaryReader;

#[async_trait]
impl PrimaryDbReader for NoPrimaryReader {
    async fn count_all_rows(&self, _config: &crate::config::CadenceConfig) -> Result<u64> {
        Ok(0)
    }

    async fn read_all_rows(
        &self,
        _collection: &str,
        _state: &SyncState,
    ) -> Result<Vec<RowChange>> {
        Ok(Vec::new())
    }

    async fn read_rows_page(
        &self,
        _collection: &str,
        _state: &SyncState,
        _offset: u64,
        _limit: u64,
    ) -> Result<Vec<RowChange>> {
        Ok(Vec::new())
    }
}
