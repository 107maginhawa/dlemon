use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use crate::applier::tracker::ApplierTracker;
use crate::state::{FieldChange, SyncPayload};
use crate::storage::MetadataBackend;

/// Start a background task that polls the metadata backend for new changes
/// and applies them to a SQLite database (hapihub's shared DB).
/// Reconnects automatically on persistent errors; exits after max_reconnect_attempts.
pub fn start_sqlite_applier(
    storage: Arc<dyn MetadataBackend>,
    db_path: PathBuf,
    collections: Vec<String>,
    poll_interval: Duration,
    tracker: ApplierTracker,
    max_reconnect_attempts: u32,
    reconnect_base_delay_ms: u64,
    reconnect_max_delay_ms: u64,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut last_applied_seq = 0u64;
        let mut connect_attempts = 0u32;

        loop {
            // Open SQLite connection
            let conn = match rusqlite::Connection::open(&db_path) {
                Ok(c) => {
                    if let Err(e) = c.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=30000; PRAGMA foreign_keys=OFF;") {
                        tracing::error!("SQLite applier: PRAGMA failed: {}", e);
                        connect_attempts += 1;
                        if max_reconnect_attempts > 0 && connect_attempts >= max_reconnect_attempts {
                            tracing::error!("SQLite applier: exhausted {} reconnect attempts, exiting", max_reconnect_attempts);
                            std::process::exit(1);
                        }
                        let delay = calculate_backoff(connect_attempts, reconnect_base_delay_ms, reconnect_max_delay_ms);
                        tokio::time::sleep(Duration::from_millis(delay)).await;
                        continue;
                    }
                    connect_attempts = 0;
                    c
                }
                Err(e) => {
                    connect_attempts += 1;
                    tracing::warn!("SQLite applier: open failed ({}x): {}", connect_attempts, e);
                    if max_reconnect_attempts > 0 && connect_attempts >= max_reconnect_attempts {
                        tracing::error!("SQLite applier: exhausted {} reconnect attempts, exiting", max_reconnect_attempts);
                        std::process::exit(1);
                    }
                    let delay = calculate_backoff(connect_attempts, reconnect_base_delay_ms, reconnect_max_delay_ms);
                    tokio::time::sleep(Duration::from_millis(delay)).await;
                    continue;
                }
            };

            tracing::info!("SQLite applier: connected to {:?}, applying changes...", db_path);
            let mut consecutive_failures = 0u32;

            // Apply loop — runs until persistent error
            loop {
                tokio::time::sleep(poll_interval).await;

                let changes = match storage.query_since(last_applied_seq).await {
                    Ok(c) => c,
                    Err(e) => {
                        tracing::error!("SQLite applier: query_since error: {}", e);
                        continue;
                    }
                };

                if changes.is_empty() {
                    consecutive_failures = 0;
                    continue;
                }

                const BATCH_SIZE: usize = 100;
                let mut should_reconnect = false;

                for chunk in changes.chunks(BATCH_SIZE) {
                    tokio::task::yield_now().await;
                    if let Err(e) = conn.execute_batch("BEGIN") {
                        consecutive_failures += 1;
                        tracing::error!("SQLite applier: BEGIN failed ({}x): {}", consecutive_failures, e);
                        if max_reconnect_attempts > 0 && consecutive_failures >= max_reconnect_attempts {
                            should_reconnect = true;
                            break;
                        }
                        continue;
                    }

                    for change in chunk {
                        if !collections.contains(&change.collection) {
                            last_applied_seq = std::cmp::max(last_applied_seq, change.seq);
                            continue;
                        }

                        let table = change.collection.replace('-', "_");

                        if change.deleted {
                            if let Err(e) = conn.execute(
                                &format!("DELETE FROM \"{}\" WHERE \"id\" = ?1", &table),
                                rusqlite::params![change.document_id],
                            ) {
                                tracing::warn!("SQLite applier: DELETE failed for {}/{}: {}", change.collection, change.document_id, e);
                            }
                        } else if let SyncPayload::Fields(fields) = &change.payload {
                            if let Some(origin) = fields.first().map(|f| f.peer_id.as_str()) {
                                tracker.mark_written(&change.collection, &change.document_id, origin);
                            }
                            if let Err(e) = apply_fields_to_sqlite(&conn, &table, &change.document_id, fields) {
                                tracing::warn!("SQLite applier: upsert failed for {}/{}: {:?}", change.collection, change.document_id, e);
                            }
                        }

                        last_applied_seq = std::cmp::max(last_applied_seq, change.seq);
                    }

                    if let Err(e) = conn.execute_batch("COMMIT") {
                        tracing::error!("SQLite applier: COMMIT failed: {}", e);
                        let _ = conn.execute_batch("ROLLBACK");
                        consecutive_failures += 1;
                        if max_reconnect_attempts > 0 && consecutive_failures >= max_reconnect_attempts {
                            should_reconnect = true;
                            break;
                        }
                    } else {
                        consecutive_failures = 0;
                    }
                }

                if should_reconnect {
                    tracing::warn!("SQLite applier: {} consecutive failures, reconnecting...", consecutive_failures);
                    break; // Break inner loop → outer loop reconnects
                }

                tracing::debug!("SQLite applier: applied up to seq {}", last_applied_seq);
            }
        }
    })
}

fn calculate_backoff(attempt: u32, base_delay_ms: u64, max_delay_ms: u64) -> u64 {
    let exp_delay = base_delay_ms.saturating_mul(1u64 << attempt.min(20));
    exp_delay.min(max_delay_ms)
}

fn apply_fields_to_sqlite(
    conn: &rusqlite::Connection,
    table: &str,
    doc_id: &str,
    fields: &[FieldChange],
) -> anyhow::Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    let mut field_map = std::collections::BTreeMap::new();
    for fc in fields {
        if fc.field == "id" || fc.field == "created_at" || fc.field == "updated_at"
            || fc.field == "createdAt" || fc.field == "updatedAt"
        {
            continue;
        }
        field_map.insert(fc.field.clone(), &fc.value);
    }

    let mut col_names = vec!["\"id\"".to_string(), "\"created_at\"".to_string(), "\"updated_at\"".to_string()];
    let mut placeholders = vec!["?1".to_string(), "?2".to_string(), "?3".to_string()];
    let mut update_clauses = vec!["\"updated_at\" = ?3".to_string()];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(doc_id.to_string()),
        Box::new(now.clone()),
        Box::new(now),
    ];

    let mut param_idx = 4u32;
    for (col, value) in &field_map {
        col_names.push(format!("\"{}\"", col));
        let placeholder = format!("?{}", param_idx);
        update_clauses.push(format!("\"{}\" = {}", col, placeholder));
        placeholders.push(placeholder);
        params.push(json_value_to_sqlite_param(value));
        param_idx += 1;
    }

    let sql = format!(
        "INSERT INTO \"{}\" ({}) VALUES ({}) ON CONFLICT(\"id\") DO UPDATE SET {}",
        table,
        col_names.join(", "),
        placeholders.join(", "),
        update_clauses.join(", ")
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    if let Err(e) = conn.execute(&sql, param_refs.as_slice()) {
        tracing::debug!("SQLite UPSERT SQL: {}", sql);
        return Err(anyhow::anyhow!("SQLite UPSERT failed: {}", e));
    }
    Ok(())
}

fn json_value_to_sqlite_param(val: &serde_json::Value) -> Box<dyn rusqlite::types::ToSql> {
    match val {
        serde_json::Value::Null => Box::new(rusqlite::types::Null),
        serde_json::Value::Bool(b) => Box::new(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() { Box::new(i) }
            else if let Some(f) = n.as_f64() { Box::new(f) }
            else { Box::new(n.to_string()) }
        }
        serde_json::Value::String(s) => Box::new(s.clone()),
        other => Box::new(other.to_string()),
    }
}
