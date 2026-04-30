use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use crate::applier::tracker::ApplierTracker;
use crate::config::normalize_collection;
use crate::state::{FieldChange, SyncPayload};
use crate::storage::MetadataBackend;

/// Start a background task that polls the metadata backend for new changes
/// and applies them to a SQLite database (hapihub's shared DB).
/// Reconnects automatically on persistent errors; exits after max_reconnect_attempts.
pub fn start_sqlite_applier(
    storage: Arc<dyn MetadataBackend>,
    db_path: PathBuf,
    collections: Vec<String>,
    blacklisted_collections: Vec<String>,
    poll_interval: Duration,
    tracker: ApplierTracker,
    max_reconnect_attempts: u32,
    reconnect_base_delay_ms: u64,
    reconnect_max_delay_ms: u64,
    query_batch_size: usize,
) -> tokio::task::JoinHandle<()> {
    // Pre-normalize blacklist entries to kebab-case once at startup.
    let blacklisted_normalized: Vec<String> = blacklisted_collections
        .iter()
        .map(|e| normalize_collection(e))
        .collect();

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

            // Cache the primary-key column(s) per table for the lifetime of
            // this connection. PRAGMA table_info is a syscall to sqlite and
            // we'd otherwise pay it on every UPSERT. Cleared on reconnect.
            let mut pk_cache: std::collections::HashMap<String, Vec<String>> =
                std::collections::HashMap::new();

            // Apply loop — runs until persistent error
            loop {
                tokio::time::sleep(poll_interval).await;

                // Process changes in bounded batches to limit peak memory usage.
                let mut any_changes = false;
                let mut should_reconnect = false;
                loop {
                    let (changes, has_more) = match storage.query_since_batched(last_applied_seq, query_batch_size).await {
                        Ok(result) => result,
                        Err(e) => {
                            tracing::error!("SQLite applier: query_since_batched error: {}", e);
                            break;
                        }
                    };

                    if changes.is_empty() { break; }
                    any_changes = true;

                const BATCH_SIZE: usize = 100;

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
                        // Defensive blacklist check: treat blacklisted collections as
                        // a successful no-op so the seq advances without stalling.
                        let normalized = normalize_collection(&change.collection);
                        if blacklisted_normalized.contains(&normalized) {
                            tracing::debug!(
                                "SQLite applier: skipping blacklisted collection {}/{}",
                                change.collection,
                                change.document_id,
                            );
                            last_applied_seq = std::cmp::max(last_applied_seq, change.seq);
                            continue;
                        }

                        if !collections.contains(&change.collection) {
                            last_applied_seq = std::cmp::max(last_applied_seq, change.seq);
                            continue;
                        }

                        let table = change.collection.replace('-', "_");
                        let pk_cols = pk_columns_for(&conn, &table, &mut pk_cache);
                        let conflict_pk = &pk_cols[0];

                        if change.deleted {
                            if let Err(e) = conn.execute(
                                &format!("DELETE FROM \"{}\" WHERE \"{}\" = ?1", &table, conflict_pk),
                                rusqlite::params![change.document_id],
                            ) {
                                tracing::warn!("SQLite applier: DELETE failed for {}/{}: {}", change.collection, change.document_id, e);
                            }
                        } else if let SyncPayload::Fields(fields) = &change.payload {
                            if let Some(origin) = fields.first().map(|f| f.peer_id.as_str()) {
                                tracker.mark_written(&change.collection, &change.document_id, origin);
                            }
                            if let Err(e) = apply_fields_to_sqlite(&conn, &table, &change.document_id, fields, &pk_cols) {
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

                if should_reconnect { break; }
                    if !has_more { break; }
                } // end batch loop

                if should_reconnect {
                    tracing::warn!("SQLite applier: {} consecutive failures, reconnecting...", consecutive_failures);
                    break; // Break apply loop → outer loop reconnects
                }

                if any_changes {
                    consecutive_failures = 0;
                    tracing::debug!("SQLite applier: applied up to seq {}", last_applied_seq);
                }
            }
        }
    })
}

fn calculate_backoff(attempt: u32, base_delay_ms: u64, max_delay_ms: u64) -> u64 {
    let exp_delay = base_delay_ms.saturating_mul(1u64 << attempt.min(20));
    exp_delay.min(max_delay_ms)
}

/// Look up the primary-key column(s) for a SQLite table via `PRAGMA table_info`,
/// caching the result. Returns `["id"]` as a fallback if the PRAGMA fails or the
/// table has no declared PK — that matches the prior hardcoded assumption and
/// keeps unknown tables from silently corrupting their conflict target.
fn pk_columns_for(
    conn: &rusqlite::Connection,
    table: &str,
    cache: &mut std::collections::HashMap<String, Vec<String>>,
) -> Vec<String> {
    if let Some(pk) = cache.get(table) {
        return pk.clone();
    }
    let mut pk_rows: Vec<(i64, String)> = Vec::new();
    if let Ok(mut stmt) = conn.prepare(&format!(r#"PRAGMA table_info("{}")"#, table)) {
        if let Ok(iter) = stmt.query_map([], |row| {
            let name: String = row.get(1)?;
            let pk_idx: i64 = row.get(5)?;
            Ok((pk_idx, name))
        }) {
            for row in iter.flatten() {
                if row.0 > 0 {
                    pk_rows.push(row);
                }
            }
        }
    }
    pk_rows.sort_by_key(|(p, _)| *p);
    let names: Vec<String> = if pk_rows.is_empty() {
        vec!["id".to_string()]
    } else {
        pk_rows.into_iter().map(|(_, n)| n).collect()
    };
    cache.insert(table.to_string(), names.clone());
    names
}

fn apply_fields_to_sqlite(
    conn: &rusqlite::Connection,
    table: &str,
    doc_id: &str,
    fields: &[FieldChange],
    pk_cols: &[String],
) -> anyhow::Result<()> {
    // The wire protocol carries a single `document_id` per change, so we can
    // only set the first PK column from it. Composite-PK tables aren't fully
    // supported but at least we'll insert the first-PK part and rely on
    // payload fields for the rest.
    let conflict_pk = pk_cols
        .first()
        .map(String::as_str)
        .unwrap_or("id");

    let now = chrono::Utc::now().to_rfc3339();
    let mut field_map = std::collections::BTreeMap::new();
    for fc in fields {
        // Skip timestamps (we set those ourselves) and the PK column we'll
        // populate from doc_id below — including it twice produces a SQLite
        // "ambiguous column" error.
        if matches!(
            fc.field.as_str(),
            "created_at" | "updated_at" | "createdAt" | "updatedAt"
        ) || pk_cols.iter().any(|p| p == &fc.field)
        {
            continue;
        }
        field_map.insert(fc.field.clone(), &fc.value);
    }

    // Defensive skip mirroring `apply_fields_to_pg`: changes with only PK and
    // timestamp fields are no-ops and would either fail NOT NULL on a fresh
    // row or bump `updated_at` for free — re-arming the watcher and feeding
    // an empty-change loop. See the comment in `applier/pg.rs` for the full
    // reasoning.
    if field_map.is_empty() {
        tracing::debug!(
            collection = %table,
            doc_id = %doc_id,
            "Applier: skipping no-op upsert (change has only PK/timestamp fields)"
        );
        return Ok(());
    }

    let mut col_names = vec![
        format!("\"{}\"", conflict_pk),
        "\"created_at\"".to_string(),
        "\"updated_at\"".to_string(),
    ];
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

    let conflict_target = pk_cols
        .iter()
        .map(|c| format!("\"{}\"", c))
        .collect::<Vec<_>>()
        .join(", ");

    let sql = format!(
        "INSERT INTO \"{}\" ({}) VALUES ({}) ON CONFLICT({}) DO UPDATE SET {}",
        table,
        col_names.join(", "),
        placeholders.join(", "),
        conflict_target,
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
