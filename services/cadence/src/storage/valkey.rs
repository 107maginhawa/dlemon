use anyhow::{Context, Result};
use async_trait::async_trait;
use fred::prelude::*;
use fred::types::scripts::Script;
use std::collections::HashMap;
use std::time::Duration;

use crate::state::{RowChange, SyncPayload};

use super::backend::{CatchupCheckpoint, LocalIdentity, MetadataBackend, CATCHUP_CHECKPOINT_TTL_SECS};
use super::common::{aggregate_raw_rows, base64_encode, RawChangeRow};

/// Timeout for individual Valkey operations. If Valkey is unreachable,
/// operations fail fast instead of hanging the sync session forever.
const VALKEY_OP_TIMEOUT: Duration = Duration::from_secs(10);

/// Lua script for atomic append_change.
/// For each field-change: INCR seq counter, HSET the change hash, ZADD to the
/// relevant sorted sets. Tombstones (deleted='1') are also ZADDed to
/// `tombstones:by_seq` so snapshot catch-up can iterate just those without
/// scanning the full change log.
/// KEYS[1] = seq counter key, KEYS[2] = by_seq sorted set key,
/// KEYS[3] = tombstones:by_seq sorted set key
/// ARGV layout: [n_fields, then per field: collection, doc_id, field, value, lamport, peer_id, deleted, by_doc_key]
const APPEND_SCRIPT: &str = r#"
local seq_key = KEYS[1]
local by_seq_key = KEYS[2]
local tombstones_key = KEYS[3]
local prefix = ARGV[1]
local n = tonumber(ARGV[2])
local last_seq = 0
local idx = 3
for i = 1, n do
    local collection = ARGV[idx]
    local doc_id = ARGV[idx+1]
    local field = ARGV[idx+2]
    local value = ARGV[idx+3]
    local lamport = ARGV[idx+4]
    local peer_id = ARGV[idx+5]
    local deleted = ARGV[idx+6]
    local by_doc_key = ARGV[idx+7]
    idx = idx + 8

    local seq = redis.call('INCR', seq_key)
    local hash_key = prefix .. 'change:' .. seq

    redis.call('HSET', hash_key,
        'collection', collection,
        'doc_id', doc_id,
        'field', field,
        'value', value,
        'lamport', lamport,
        'peer_id', peer_id,
        'deleted', deleted)

    redis.call('ZADD', by_seq_key, seq, tostring(seq))
    redis.call('ZADD', by_doc_key, seq, tostring(seq))
    if deleted == '1' then
        redis.call('ZADD', tombstones_key, seq, tostring(seq))
    end

    last_seq = seq
end
return last_seq
"#;

/// Valkey/Redis-based metadata storage backend.
pub struct ValkeyBackend {
    client: Client,
    key_prefix: String,
    append_script: Script,
}

impl ValkeyBackend {
    /// Connect to Valkey and derive key prefix from primary_db_url hash.
    pub async fn connect(url: &str, primary_db_url: &str) -> Result<Self> {
        let hash = super::path::db_url_hash(primary_db_url);
        let prefix = format!("cadence:{}:", hash);
        Self::connect_with_prefix(url, &prefix).await
    }

    /// Connect to Valkey with an explicit key prefix (for testing).
    pub async fn connect_with_prefix(url: &str, prefix: &str) -> Result<Self> {
        let config = Config::from_url(url).context("Invalid Valkey URL")?;

        // Auto-reconnect with exponential backoff on connection drops
        let policy = ReconnectPolicy::new_exponential(0, 500, 30_000, 2);

        let client = Builder::from_config(config)
            .set_policy(policy)
            .build()
            .context("Failed to build Valkey client")?;
        client.init().await.context("Failed to connect to Valkey")?;

        let append_script = Script::from_lua(APPEND_SCRIPT);
        append_script.load(&client).await.context("Failed to load Lua append script")?;

        Ok(Self {
            client,
            key_prefix: prefix.to_string(),
            append_script,
        })
    }

    fn key(&self, suffix: &str) -> String {
        format!("{}{}", self.key_prefix, suffix)
    }

    fn by_doc_key(&self, collection: &str, doc_id: &str) -> String {
        self.key(&format!("changes:by_doc:{}:{}", collection, doc_id))
    }

    /// Run a Valkey operation with a timeout.
    async fn timed<T>(&self, op: impl std::future::Future<Output = Result<T>>) -> Result<T> {
        tokio::time::timeout(VALKEY_OP_TIMEOUT, op)
            .await
            .map_err(|_| anyhow::anyhow!("Valkey operation timed out after {:?}", VALKEY_OP_TIMEOUT))?
    }

    /// Fetch change hashes by their seq numbers and convert to RawChangeRows.
    async fn fetch_changes_by_seqs(&self, seqs: Vec<u64>) -> Result<Vec<RawChangeRow>> {
        if seqs.is_empty() {
            return Ok(vec![]);
        }

        let mut rows = Vec::with_capacity(seqs.len());
        for seq in seqs {
            let hash_key = self.key(&format!("change:{}", seq));
            let map: HashMap<String, String> = self.timed(async {
                Ok(self.client.hgetall(&hash_key).await?)
            }).await?;
            if map.is_empty() {
                continue;
            }
            rows.push(RawChangeRow {
                seq,
                collection: map.get("collection").cloned().unwrap_or_default(),
                doc_id: map.get("doc_id").cloned().unwrap_or_default(),
                field: map.get("field").cloned().unwrap_or_default(),
                value: map.get("value").cloned(),
                lamport: map.get("lamport").and_then(|v| v.parse().ok()).unwrap_or(0),
                peer_id: map.get("peer_id").cloned().unwrap_or_default(),
                deleted: map.get("deleted").map(|v| v == "1" || v == "true").unwrap_or(false),
            });
        }
        Ok(rows)
    }
}

#[async_trait]
impl MetadataBackend for ValkeyBackend {
    async fn append_change(&self, change: &RowChange) -> Result<u64> {
        let seq_key = self.key("seq");
        let by_seq_key = self.key("changes:by_seq");

        match &change.payload {
            SyncPayload::Fields(fields) => {
                let items: Vec<_> = if fields.is_empty() && change.deleted {
                    vec![(&change.collection, &change.document_id, "__deleted__".to_string(),
                          "null".to_string(), 0u64, String::new(), true)]
                } else {
                    fields.iter().map(|fc| {
                        let value_str = serde_json::to_string(&fc.value).unwrap_or_default();
                        (&change.collection, &change.document_id, fc.field.clone(),
                         value_str, fc.lamport, fc.peer_id.clone(), change.deleted)
                    }).collect()
                };

                let n = items.len();
                let mut args: Vec<String> = Vec::with_capacity(2 + n * 8);
                args.push(self.key_prefix.clone());
                args.push(n.to_string());

                for (collection, doc_id, field, value, lamport, peer_id, deleted) in &items {
                    let by_doc_key = self.by_doc_key(collection, doc_id);
                    args.push(collection.to_string());
                    args.push(doc_id.to_string());
                    args.push(field.clone());
                    args.push(value.clone());
                    args.push(lamport.to_string());
                    args.push(peer_id.clone());
                    args.push(if *deleted { "1".to_string() } else { "0".to_string() });
                    args.push(by_doc_key);
                }

                let tombstones_key = self.key("changes:tombstones:by_seq");
                self.timed(async {
                    let last_seq: u64 = self.append_script
                        .evalsha(&self.client, vec![seq_key.clone(), by_seq_key.clone(), tombstones_key.clone()], args)
                        .await
                        .context("Valkey append_change script failed")?;
                    Ok(last_seq)
                }).await
            }
            SyncPayload::CrdtDoc(bytes) => {
                let encoded = base64_encode(bytes);
                let by_doc_key = self.by_doc_key(&change.collection, &change.document_id);

                let args = vec![
                    self.key_prefix.clone(),
                    "1".to_string(),
                    change.collection.clone(),
                    change.document_id.clone(),
                    "__crdt__".to_string(),
                    encoded,
                    "0".to_string(),
                    "crdt".to_string(),
                    if change.deleted { "1".to_string() } else { "0".to_string() },
                    by_doc_key,
                ];

                let tombstones_key = self.key("changes:tombstones:by_seq");
                self.timed(async {
                    let last_seq: u64 = self.append_script
                        .evalsha(&self.client, vec![seq_key, by_seq_key, tombstones_key], args)
                        .await
                        .context("Valkey append_change CRDT script failed")?;
                    Ok(last_seq)
                }).await
            }
        }
    }

    async fn query_since(&self, since_seq: u64) -> Result<Vec<RowChange>> {
        let by_seq_key = self.key("changes:by_seq");
        let min = (since_seq + 1) as f64;

        let seq_strings: Vec<String> = self.timed(async {
            Ok(self.client
                .zrangebyscore(&by_seq_key, min, f64::INFINITY, false, Some((0, 10000)))
                .await
                .context("Valkey zrangebyscore failed")?)
        }).await?;

        let seqs: Vec<u64> = seq_strings.iter().filter_map(|s| s.parse().ok()).collect();
        let rows = self.fetch_changes_by_seqs(seqs).await?;
        Ok(aggregate_raw_rows(rows))
    }

    async fn query_since_batched(
        &self,
        since_seq: u64,
        limit: usize,
    ) -> Result<(Vec<RowChange>, bool)> {
        let by_seq_key = self.key("changes:by_seq");
        let min = (since_seq + 1) as f64;
        let fetch_count = limit.saturating_add(1);

        let seq_strings: Vec<String> = self.timed(async {
            Ok(self.client
                .zrangebyscore(
                    &by_seq_key,
                    min,
                    f64::INFINITY,
                    false,
                    Some((0i64, fetch_count as i64)),
                )
                .await
                .context("Valkey zrangebyscore batched failed")?)
        }).await?;

        let has_more = seq_strings.len() > limit;
        let seqs: Vec<u64> = seq_strings.iter()
            .take(limit)
            .filter_map(|s| s.parse().ok())
            .collect();
        let rows = self.fetch_changes_by_seqs(seqs).await?;
        Ok((aggregate_raw_rows(rows), has_more))
    }

    async fn query_tombstones_since_batched(
        &self,
        since_seq: u64,
        limit: usize,
    ) -> Result<(Vec<RowChange>, bool)> {
        let tombstones_key = self.key("changes:tombstones:by_seq");
        let min = (since_seq + 1) as f64;
        let fetch_count = limit.saturating_add(1);

        let seq_strings: Vec<String> = self.timed(async {
            Ok(self.client
                .zrangebyscore(
                    &tombstones_key,
                    min,
                    f64::INFINITY,
                    false,
                    Some((0i64, fetch_count as i64)),
                )
                .await
                .context("Valkey zrangebyscore tombstones failed")?)
        }).await?;

        let has_more = seq_strings.len() > limit;
        let seqs: Vec<u64> = seq_strings.iter()
            .take(limit)
            .filter_map(|s| s.parse().ok())
            .collect();
        let rows = self.fetch_changes_by_seqs(seqs).await?;
        Ok((aggregate_raw_rows(rows), has_more))
    }

    async fn query_by_doc(&self, collection: &str, doc_id: &str) -> Result<Vec<RowChange>> {
        let by_doc_key = self.by_doc_key(collection, doc_id);

        let seq_strings: Vec<String> = self.timed(async {
            Ok(self.client
                .zrangebyscore(&by_doc_key, f64::NEG_INFINITY, f64::INFINITY, false, None)
                .await
                .context("Valkey zrangebyscore by_doc failed")?)
        }).await?;

        let seqs: Vec<u64> = seq_strings.iter().filter_map(|s| s.parse().ok()).collect();
        let rows = self.fetch_changes_by_seqs(seqs).await?;
        Ok(aggregate_raw_rows(rows))
    }

    async fn compact(&self) -> Result<u64> {
        let by_seq_key = self.key("changes:by_seq");

        let seq_strings: Vec<String> = self.timed(async {
            Ok(self.client
                .zrangebyscore(&by_seq_key, f64::NEG_INFINITY, f64::INFINITY, false, None)
                .await?)
        }).await?;

        let seqs: Vec<u64> = seq_strings.iter().filter_map(|s| s.parse().ok()).collect();
        if seqs.is_empty() {
            return Ok(0);
        }

        let rows = self.fetch_changes_by_seqs(seqs).await?;

        let mut max_per_key: HashMap<(String, String, String), u64> = HashMap::new();
        for row in &rows {
            let key = (row.collection.clone(), row.doc_id.clone(), row.field.clone());
            let entry = max_per_key.entry(key).or_insert(0);
            if row.seq > *entry {
                *entry = row.seq;
            }
        }

        let max_seqs: std::collections::HashSet<u64> = max_per_key.values().copied().collect();

        let to_delete: Vec<_> = rows.iter()
            .filter(|r| !max_seqs.contains(&r.seq))
            .collect();

        if to_delete.is_empty() {
            return Ok(0);
        }

        let deleted_count = to_delete.len() as u64;

        for row in &to_delete {
            let hash_key = self.key(&format!("change:{}", row.seq));
            let by_doc_key = self.by_doc_key(&row.collection, &row.doc_id);
            let seq_str = row.seq.to_string();
            self.timed(async {
                self.client.del::<(), _>(&hash_key).await?;
                self.client.zrem::<(), _, _>(&by_seq_key, &seq_str).await?;
                self.client.zrem::<(), _, _>(&by_doc_key, &seq_str).await?;
                Ok(())
            }).await?;
        }

        Ok(deleted_count)
    }

    async fn max_seq(&self) -> Result<u64> {
        let seq_key = self.key("seq");
        self.timed(async {
            let result: Option<u64> = self.client.get(&seq_key).await?;
            Ok(result.unwrap_or(0))
        }).await
    }

    async fn get_watermark(&self, peer_id: &str) -> Result<u64> {
        let key = self.key(&format!("watermark:{}", peer_id));
        self.timed(async {
            let result: Option<u64> = self.client.get(&key).await?;
            Ok(result.unwrap_or(0))
        }).await
    }

    async fn set_watermark(&self, peer_id: &str, seq: u64) -> Result<()> {
        let key = self.key(&format!("watermark:{}", peer_id));
        self.timed(async {
            self.client.set::<(), _, _>(&key, seq.to_string(), None, None, false).await?;
            Ok(())
        }).await
    }

    async fn get_peer_token(&self, key: &str) -> Result<Option<String>> {
        let k = self.key(&format!("token:{}", key));
        self.timed(async {
            let result: Option<String> = self.client.get(&k).await?;
            Ok(result)
        }).await
    }

    async fn set_peer_token(&self, key: &str, jwt: &str) -> Result<()> {
        let k = self.key(&format!("token:{}", key));
        self.timed(async {
            self.client.set::<(), _, _>(&k, jwt, None, None, false).await?;
            Ok(())
        }).await
    }

    async fn delete_peer_token(&self, key: &str) -> Result<()> {
        let k = self.key(&format!("token:{}", key));
        self.timed(async {
            self.client.del::<(), _>(&k).await?;
            Ok(())
        }).await
    }

    async fn get_peers(&self) -> Result<Vec<String>> {
        let key = self.key("peers");
        self.timed(async {
            let result: Option<String> = self.client.get(&key).await?;
            match result {
                Some(json_str) => {
                    let peers: Vec<String> = serde_json::from_str(&json_str).unwrap_or_default();
                    Ok(peers)
                }
                None => Ok(vec![]),
            }
        }).await
    }

    async fn set_peers(&self, peers: &[String]) -> Result<()> {
        let key = self.key("peers");
        let json_str = serde_json::to_string(peers)?;
        self.timed(async {
            self.client.set::<(), _, _>(&key, &json_str, None, None, false).await?;
            Ok(())
        }).await
    }

    async fn get_cached_jwks(&self, url: &str) -> Result<Option<String>> {
        let key = self.key(&format!("jwks:{}", url));
        self.timed(async {
            let result: Option<String> = self.client.get(&key).await?;
            Ok(result)
        }).await
    }

    async fn set_cached_jwks(&self, url: &str, keys_json: &str) -> Result<()> {
        let key = self.key(&format!("jwks:{}", url));
        self.timed(async {
            self.client.set::<(), _, _>(&key, keys_json, None, None, false).await?;
            Ok(())
        }).await
    }

    async fn get_catchup_checkpoint(&self, peer_id: &str) -> Result<Option<CatchupCheckpoint>> {
        let key = self.key(&format!("catchup:{}", peer_id));
        let checkpoint = self.timed(async {
            let map: HashMap<String, String> = self.client.hgetall(&key).await?;
            if map.is_empty() {
                return Ok(None);
            }
            let last_seq = map.get("last_seq")
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);
            let started_at = map.get("started_at")
                .cloned()
                .unwrap_or_default();
            let is_complete = map.get("is_complete")
                .map(|v| v == "1" || v == "true")
                .unwrap_or(false);
            Ok(Some(CatchupCheckpoint { last_seq, started_at, is_complete }))
        }).await?;

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
        let key = self.key(&format!("catchup:{}", peer_id));
        let ttl_secs = CATCHUP_CHECKPOINT_TTL_SECS as u64;
        self.timed(async {
            self.client.hset::<(), _, _>(&key, vec![
                ("last_seq", checkpoint.last_seq.to_string()),
                ("started_at", checkpoint.started_at.clone()),
                ("is_complete", if checkpoint.is_complete { "1".to_string() } else { "0".to_string() }),
            ]).await?;
            // Set TTL for automatic cleanup
            self.client.expire::<(), _>(&key, ttl_secs as i64, None).await?;
            Ok(())
        }).await
    }

    async fn complete_catchup(&self, peer_id: &str) -> Result<()> {
        // Simply delete the checkpoint when catchup is complete
        self.delete_catchup_checkpoint(peer_id).await
    }

    async fn delete_catchup_checkpoint(&self, peer_id: &str) -> Result<()> {
        let key = self.key(&format!("catchup:{}", peer_id));
        self.timed(async {
            self.client.del::<(), _>(&key).await?;
            Ok(())
        }).await
    }

    async fn get_peer_id_by_address(&self, address: &str) -> Result<Option<String>> {
        let key = self.key(&format!("peer_addr:{}", address));
        self.timed(async {
            let result: Option<String> = self.client.get(&key).await?;
            Ok(result)
        }).await
    }

    async fn set_peer_address_mapping(&self, address: &str, peer_id: &str) -> Result<()> {
        let key = self.key(&format!("peer_addr:{}", address));
        self.timed(async {
            self.client.set::<(), _, _>(&key, peer_id, None, None, false).await?;
            Ok(())
        }).await
    }

    async fn get_local_identity(&self) -> Result<Option<LocalIdentity>> {
        let key = self.key("local_identity");
        self.timed(async {
            let result: Option<String> = self.client.get(&key).await?;
            match result {
                Some(json_str) => {
                    let identity: LocalIdentity = serde_json::from_str(&json_str)
                        .context("Failed to parse local identity JSON")?;
                    Ok(Some(identity))
                }
                None => Ok(None),
            }
        }).await
    }

    async fn set_local_identity(&self, identity: &LocalIdentity) -> Result<()> {
        let key = self.key("local_identity");
        let json_str = serde_json::to_string(identity)?;
        self.timed(async {
            self.client.set::<(), _, _>(&key, &json_str, None, None, false).await?;
            Ok(())
        }).await
    }
}
