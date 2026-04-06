use anyhow::{Context, Result};
use async_trait::async_trait;
use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::state::{RowChange, SyncPayload};

use super::backend::{CatchupCheckpoint, LocalIdentity, MetadataBackend};
use super::common::{aggregate_raw_rows, base64_encode, RawChangeRow};

/// SQLite-based metadata storage for change log, peer watermarks, tokens, and JWKS cache.
pub struct SqliteBackend {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteBackend {
    /// Open or create a metadata database at the given path.
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path).context("Failed to open metadata database")?;
        Self::create_schema_inner(&conn)?;
        let storage = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        Ok(storage)
    }

    /// Create an in-memory metadata database (for testing).
    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory().context("Failed to open in-memory database")?;
        Self::create_schema_inner(&conn)?;
        let storage = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        Ok(storage)
    }

    fn create_schema_inner(conn: &Connection) -> Result<()> {
        // Enable WAL mode for concurrent read/write access
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS changes (
                seq       INTEGER PRIMARY KEY AUTOINCREMENT,
                collection TEXT NOT NULL,
                doc_id    TEXT NOT NULL,
                field     TEXT NOT NULL,
                value     TEXT,
                lamport   INTEGER NOT NULL,
                peer_id   TEXT NOT NULL,
                deleted   BOOLEAN DEFAULT FALSE
            );
            CREATE INDEX IF NOT EXISTS idx_changes_seq ON changes (seq);
            CREATE INDEX IF NOT EXISTS idx_changes_doc ON changes (collection, doc_id);

            CREATE TABLE IF NOT EXISTS peer_watermarks (
                peer_id       TEXT PRIMARY KEY,
                last_synced_seq INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS peer_tokens (
                key         TEXT PRIMARY KEY,
                jwt         TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS jwks_cache (
                url         TEXT PRIMARY KEY,
                keys_json   TEXT NOT NULL,
                fetched_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS catchup_state (
                peer_id             TEXT PRIMARY KEY,
                last_checkpoint_seq INTEGER NOT NULL DEFAULT 0,
                started_at          TEXT NOT NULL,
                is_complete         INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS peer_address_map (
                address     TEXT PRIMARY KEY,
                peer_id     TEXT NOT NULL,
                last_seen   TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS local_identity (
                id              INTEGER PRIMARY KEY CHECK (id = 1),
                peer_id         TEXT NOT NULL,
                iroh_secret_key TEXT,
                created_at      TEXT NOT NULL
            );
            ",
        )
        .context("Failed to create metadata schema")?;
        Ok(())
    }
}

#[async_trait]
impl MetadataBackend for SqliteBackend {
    async fn append_change(&self, change: &RowChange) -> Result<u64> {
        let conn = self.conn.clone();
        let change = change.clone();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            match &change.payload {
                SyncPayload::Fields(fields) => {
                    let mut last_seq = 0u64;
                    if fields.is_empty() && change.deleted {
                        // Tombstone: record a delete marker even with no fields
                        conn.execute(
                            "INSERT INTO changes (collection, doc_id, field, value, lamport, peer_id, deleted)
                             VALUES (?1, ?2, '__deleted__', 'null', 0, '', ?3)",
                            params![
                                change.collection,
                                change.document_id,
                                true,
                            ],
                        )?;
                        last_seq = conn.last_insert_rowid() as u64;
                    } else {
                        for fc in fields {
                            let value_str = serde_json::to_string(&fc.value)?;
                            conn.execute(
                                "INSERT INTO changes (collection, doc_id, field, value, lamport, peer_id, deleted)
                                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                                params![
                                    change.collection,
                                    change.document_id,
                                    fc.field,
                                    value_str,
                                    fc.lamport as i64,
                                    fc.peer_id,
                                    change.deleted,
                                ],
                            )?;
                            last_seq = conn.last_insert_rowid() as u64;
                        }
                    }
                    Ok(last_seq)
                }
                SyncPayload::CrdtDoc(bytes) => {
                    let encoded = base64_encode(bytes);
                    conn.execute(
                        "INSERT INTO changes (collection, doc_id, field, value, lamport, peer_id, deleted)
                         VALUES (?1, ?2, '__crdt__', ?3, 0, ?4, ?5)",
                        params![
                            change.collection,
                            change.document_id,
                            encoded,
                            "crdt",
                            change.deleted,
                        ],
                    )?;
                    Ok(conn.last_insert_rowid() as u64)
                }
            }
        })
        .await?
    }

    async fn query_since(&self, since_seq: u64) -> Result<Vec<RowChange>> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let mut stmt = conn.prepare(
                "SELECT seq, collection, doc_id, field, value, lamport, peer_id, deleted
                 FROM changes WHERE seq > ?1 ORDER BY seq ASC",
            )?;

            let rows = stmt.query_map(params![since_seq as i64], |row| {
                Ok(RawChangeRow {
                    seq: row.get::<_, i64>(0)? as u64,
                    collection: row.get(1)?,
                    doc_id: row.get(2)?,
                    field: row.get(3)?,
                    value: row.get(4)?,
                    lamport: row.get::<_, i64>(5)? as u64,
                    peer_id: row.get(6)?,
                    deleted: row.get(7)?,
                })
            })?;

            let raw_rows: Vec<RawChangeRow> = rows.collect::<std::result::Result<_, _>>()?;
            Ok(aggregate_raw_rows(raw_rows))
        })
        .await?
    }

    async fn query_by_doc(&self, collection: &str, doc_id: &str) -> Result<Vec<RowChange>> {
        let conn = self.conn.clone();
        let collection = collection.to_string();
        let doc_id = doc_id.to_string();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let mut stmt = conn.prepare(
                "SELECT seq, collection, doc_id, field, value, lamport, peer_id, deleted
                 FROM changes WHERE collection = ?1 AND doc_id = ?2 ORDER BY seq ASC",
            )?;

            let rows = stmt.query_map(params![collection, doc_id], |row| {
                Ok(RawChangeRow {
                    seq: row.get::<_, i64>(0)? as u64,
                    collection: row.get(1)?,
                    doc_id: row.get(2)?,
                    field: row.get(3)?,
                    value: row.get(4)?,
                    lamport: row.get::<_, i64>(5)? as u64,
                    peer_id: row.get(6)?,
                    deleted: row.get(7)?,
                })
            })?;

            let raw_rows: Vec<RawChangeRow> = rows.collect::<std::result::Result<_, _>>()?;
            Ok(aggregate_raw_rows(raw_rows))
        })
        .await?
    }

    async fn compact(&self) -> Result<u64> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let deleted = conn.execute(
                "DELETE FROM changes WHERE seq NOT IN (
                    SELECT MAX(seq) FROM changes GROUP BY collection, doc_id, field
                )",
                [],
            )?;
            Ok(deleted as u64)
        })
        .await?
    }

    async fn max_seq(&self) -> Result<u64> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let result = conn.query_row("SELECT COALESCE(MAX(seq), 0) FROM changes", [], |row| {
                row.get::<_, i64>(0)
            })?;
            Ok(result as u64)
        })
        .await?
    }

    async fn get_watermark(&self, peer_id: &str) -> Result<u64> {
        let conn = self.conn.clone();
        let peer_id = peer_id.to_string();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let result = conn.query_row(
                "SELECT last_synced_seq FROM peer_watermarks WHERE peer_id = ?1",
                params![peer_id],
                |row| row.get::<_, i64>(0),
            );

            match result {
                Ok(seq) => Ok(seq as u64),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(0),
                Err(e) => Err(e.into()),
            }
        })
        .await?
    }

    async fn set_watermark(&self, peer_id: &str, seq: u64) -> Result<()> {
        let conn = self.conn.clone();
        let peer_id = peer_id.to_string();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            conn.execute(
                "INSERT INTO peer_watermarks (peer_id, last_synced_seq)
                 VALUES (?1, ?2)
                 ON CONFLICT(peer_id) DO UPDATE SET last_synced_seq = ?2",
                params![peer_id, seq as i64],
            )?;
            Ok(())
        })
        .await?
    }

    async fn get_peer_token(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.clone();
        let key = key.to_string();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let result = conn.query_row(
                "SELECT jwt FROM peer_tokens WHERE key = ?1",
                params![key],
                |row| row.get::<_, String>(0),
            );

            match result {
                Ok(jwt) => Ok(Some(jwt)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.into()),
            }
        })
        .await?
    }

    async fn set_peer_token(&self, key: &str, jwt: &str) -> Result<()> {
        let conn = self.conn.clone();
        let key = key.to_string();
        let jwt = jwt.to_string();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT INTO peer_tokens (key, jwt, updated_at)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET jwt = ?2, updated_at = ?3",
                params![key, jwt, now],
            )?;
            Ok(())
        })
        .await?
    }

    async fn get_peers(&self) -> Result<Vec<String>> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let result = conn.query_row(
                "SELECT jwt FROM peer_tokens WHERE key = 'peers'",
                [],
                |row| row.get::<_, String>(0),
            );

            match result {
                Ok(json_str) => {
                    let peers: Vec<String> = serde_json::from_str(&json_str)
                        .unwrap_or_default();
                    Ok(peers)
                }
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(vec![]),
                Err(e) => Err(e.into()),
            }
        })
        .await?
    }

    async fn set_peers(&self, peers: &[String]) -> Result<()> {
        let conn = self.conn.clone();
        let json_str = serde_json::to_string(peers)?;
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT INTO peer_tokens (key, jwt, updated_at)
                 VALUES ('peers', ?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET jwt = ?1, updated_at = ?2",
                params![json_str, now],
            )?;
            Ok(())
        })
        .await?
    }

    async fn get_cached_jwks(&self, url: &str) -> Result<Option<String>> {
        let conn = self.conn.clone();
        let url = url.to_string();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let result = conn.query_row(
                "SELECT keys_json FROM jwks_cache WHERE url = ?1",
                params![url],
                |row| row.get::<_, String>(0),
            );

            match result {
                Ok(json) => Ok(Some(json)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.into()),
            }
        })
        .await?
    }

    async fn set_cached_jwks(&self, url: &str, keys_json: &str) -> Result<()> {
        let conn = self.conn.clone();
        let url = url.to_string();
        let keys_json = keys_json.to_string();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT INTO jwks_cache (url, keys_json, fetched_at)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(url) DO UPDATE SET keys_json = ?2, fetched_at = ?3",
                params![url, keys_json, now],
            )?;
            Ok(())
        })
        .await?
    }

    async fn get_catchup_checkpoint(&self, peer_id: &str) -> Result<Option<CatchupCheckpoint>> {
        let conn = self.conn.clone();
        let peer_id_owned = peer_id.to_string();
        let checkpoint: Option<CatchupCheckpoint> = tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let result = conn.query_row(
                "SELECT last_checkpoint_seq, started_at, is_complete FROM catchup_state WHERE peer_id = ?1",
                params![peer_id_owned],
                |row| {
                    Ok(CatchupCheckpoint {
                        last_seq: row.get::<_, i64>(0)? as u64,
                        started_at: row.get(1)?,
                        is_complete: row.get::<_, i64>(2)? != 0,
                    })
                },
            );

            match result {
                Ok(cp) => Ok::<_, anyhow::Error>(Some(cp)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.into()),
            }
        })
        .await??;

        // Check for stale checkpoint and delete if necessary
        if let Some(ref cp) = checkpoint {
            if cp.is_stale() {
                self.delete_catchup_checkpoint(peer_id).await?;
                return Ok(None);
            }
        }

        Ok(checkpoint)
    }

    async fn set_catchup_checkpoint(&self, peer_id: &str, checkpoint: &CatchupCheckpoint) -> Result<()> {
        let conn = self.conn.clone();
        let peer_id = peer_id.to_string();
        let last_seq = checkpoint.last_seq;
        let started_at = checkpoint.started_at.clone();
        let is_complete = checkpoint.is_complete;
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            conn.execute(
                "INSERT INTO catchup_state (peer_id, last_checkpoint_seq, started_at, is_complete)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(peer_id) DO UPDATE SET last_checkpoint_seq = ?2, started_at = ?3, is_complete = ?4",
                params![peer_id, last_seq as i64, started_at, is_complete as i64],
            )?;
            Ok(())
        })
        .await?
    }

    async fn complete_catchup(&self, peer_id: &str) -> Result<()> {
        // Simply delete the checkpoint when catchup is complete
        self.delete_catchup_checkpoint(peer_id).await
    }

    async fn delete_catchup_checkpoint(&self, peer_id: &str) -> Result<()> {
        let conn = self.conn.clone();
        let peer_id = peer_id.to_string();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            conn.execute(
                "DELETE FROM catchup_state WHERE peer_id = ?1",
                params![peer_id],
            )?;
            Ok(())
        })
        .await?
    }

    async fn get_peer_id_by_address(&self, address: &str) -> Result<Option<String>> {
        let conn = self.conn.clone();
        let address = address.to_string();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let result = conn.query_row(
                "SELECT peer_id FROM peer_address_map WHERE address = ?1",
                params![address],
                |row| row.get::<_, String>(0),
            );

            match result {
                Ok(peer_id) => Ok(Some(peer_id)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.into()),
            }
        })
        .await?
    }

    async fn set_peer_address_mapping(&self, address: &str, peer_id: &str) -> Result<()> {
        let conn = self.conn.clone();
        let address = address.to_string();
        let peer_id = peer_id.to_string();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT INTO peer_address_map (address, peer_id, last_seen)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(address) DO UPDATE SET peer_id = ?2, last_seen = ?3",
                params![address, peer_id, now],
            )?;
            Ok(())
        })
        .await?
    }

    async fn get_local_identity(&self) -> Result<Option<LocalIdentity>> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            let result = conn.query_row(
                "SELECT peer_id, iroh_secret_key, created_at FROM local_identity WHERE id = 1",
                [],
                |row| {
                    Ok(LocalIdentity {
                        peer_id: row.get(0)?,
                        iroh_secret_key: row.get(1)?,
                        created_at: row.get(2)?,
                    })
                },
            );

            match result {
                Ok(identity) => Ok(Some(identity)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.into()),
            }
        })
        .await?
    }

    async fn set_local_identity(&self, identity: &LocalIdentity) -> Result<()> {
        let conn = self.conn.clone();
        let peer_id = identity.peer_id.clone();
        let iroh_secret_key = identity.iroh_secret_key.clone();
        let created_at = identity.created_at.clone();
        tokio::task::spawn_blocking(move || {
            let conn = conn.blocking_lock();
            conn.execute(
                "INSERT INTO local_identity (id, peer_id, iroh_secret_key, created_at)
                 VALUES (1, ?1, ?2, ?3)
                 ON CONFLICT(id) DO UPDATE SET peer_id = ?1, iroh_secret_key = ?2",
                params![peer_id, iroh_secret_key, created_at],
            )?;
            Ok(())
        })
        .await?
    }
}
