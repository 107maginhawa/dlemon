use anyhow::Result;
use std::sync::Arc;
use std::time::Duration;

use crate::applier::tracker::ApplierTracker;
use crate::config::normalize_collection;
use crate::state::{FieldChange, SyncPayload};
use crate::storage::MetadataBackend;
use crate::utils::reconnect::retry_with_backoff;

/// Timeout for individual PG queries. Prevents hanging on dead connections.
const PG_QUERY_TIMEOUT: Duration = Duration::from_secs(30);

/// Start a background task that polls the metadata backend for new changes
/// and applies them to a PostgreSQL database.
/// Reconnects automatically on connection loss; exits after max_reconnect_attempts.
pub fn start_pg_applier(
    storage: Arc<dyn MetadataBackend>,
    db_url: String,
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

        loop {
            // Connect with retry + backoff
            let client = match connect_pg(
                &db_url, max_reconnect_attempts, reconnect_base_delay_ms, reconnect_max_delay_ms,
            ).await {
                Some(c) => c,
                None => {
                    tracing::error!(
                        "Applier: exhausted {} reconnect attempts to primary DB, exiting process",
                        max_reconnect_attempts
                    );
                    std::process::exit(1);
                }
            };

            tracing::info!("Applier: connected to primary database, applying changes...");

            // Apply loop — runs until connection error
            match run_apply_loop(
                &client, &storage, &collections, &blacklisted_normalized, poll_interval, &tracker, &mut last_applied_seq, query_batch_size,
            ).await {
                Ok(()) => {
                    // Clean exit (shouldn't happen in practice)
                    tracing::info!("Applier: apply loop exited cleanly");
                    return;
                }
                Err(e) => {
                    tracing::warn!("Applier: connection lost: {}, reconnecting...", e);
                    // Continue to outer loop → reconnect
                }
            }
        }
    })
}

/// Connect to PostgreSQL, retrying with exponential backoff.
async fn connect_pg(
    db_url: &str,
    max_attempts: u32,
    base_delay_ms: u64,
    max_delay_ms: u64,
) -> Option<tokio_postgres::Client> {
    retry_with_backoff(max_attempts, base_delay_ms, max_delay_ms, "PG Applier connect", || {
        let url = db_url.to_string();
        async move {
            let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
            tokio::spawn(async move {
                if let Err(e) = connection.await {
                    tracing::error!("Applier: PostgreSQL connection error: {}", e);
                }
            });
            Ok(client)
        }
    }).await
}

/// Inner apply loop. Returns Err on connection failure to trigger reconnect.
async fn run_apply_loop(
    client: &tokio_postgres::Client,
    storage: &Arc<dyn MetadataBackend>,
    collections: &[String],
    blacklisted_collections: &[String],
    poll_interval: Duration,
    tracker: &ApplierTracker,
    last_applied_seq: &mut u64,
    query_batch_size: usize,
) -> Result<()> {
    let mut _consecutive_failures = 0u32;

    loop {
        tokio::time::sleep(poll_interval).await;

        // Process changes in bounded batches to limit peak memory usage.
        loop {
            let (changes, has_more) = match storage.query_since_batched(*last_applied_seq, query_batch_size).await {
                Ok(result) => result,
                Err(e) => {
                    tracing::error!("Applier: query_since_batched error: {}", e);
                    break;
                }
            };

            if changes.is_empty() {
                _consecutive_failures = 0; // Idle = healthy
                break;
            }

        let mut max_seq = *last_applied_seq;

        for change in &changes {
            // Defensive blacklist check: treat blacklisted collections as a
            // successful no-op so the seq advances and we don't stall.
            // Normalizes to kebab-case before comparing.
            let normalized = normalize_collection(&change.collection);
            if blacklisted_collections.contains(&normalized) {
                tracing::debug!(
                    "Applier: skipping blacklisted collection {}/{}",
                    change.collection,
                    change.document_id,
                );
                max_seq = std::cmp::max(max_seq, change.seq);
                continue;
            }

            if !collections.contains(&change.collection) {
                max_seq = std::cmp::max(max_seq, change.seq);
                continue;
            }

            let pg_table = change.collection.replace('-', "_");

            let result: Result<(), anyhow::Error> = if change.deleted {
                let sql = format!("DELETE FROM \"{}\" WHERE \"id\" = $1", &pg_table);
                match tokio::time::timeout(PG_QUERY_TIMEOUT, client.execute(&sql, &[&change.document_id])).await {
                    Ok(Ok(_)) => Ok(()),
                    Ok(Err(e)) => Err(anyhow::anyhow!("DELETE failed: {}", e)),
                    Err(_) => return Err(anyhow::anyhow!("PG query timed out after {:?}", PG_QUERY_TIMEOUT)),
                }
            } else if let SyncPayload::Fields(fields) = &change.payload {
                if let Some(origin) = fields.first().map(|f| f.peer_id.as_str()) {
                    tracker.mark_written(&change.collection, &change.document_id, origin);
                }
                match tokio::time::timeout(PG_QUERY_TIMEOUT, apply_fields_to_pg(client, &pg_table, &change.document_id, fields)).await {
                    Ok(Ok(())) => Ok(()),
                    Ok(Err(e)) => Err(e),
                    Err(_) => return Err(anyhow::anyhow!("PG query timed out after {:?}", PG_QUERY_TIMEOUT)),
                }
            } else {
                Ok(())
            };

            // Always advance past this change's seq, even on failure.
            // Rewinding on failure caused an infinite retry loop: the
            // applier would re-load the same batch every 500ms, each
            // cycle allocating fresh RowChange structs that fragmented
            // the heap into unreclaimable RSS (~8 MB/sec growth).
            // Failed upserts are logged above; the data isn't lost — it
            // remains in the metadata change log for manual inspection.
            max_seq = std::cmp::max(max_seq, change.seq);

            match result {
                Ok(()) => {
                    _consecutive_failures = 0;
                }
                Err(e) => {
                    tracing::warn!("Applier: upsert failed for {}/{}: {:?}", change.collection, change.document_id, e);
                    _consecutive_failures += 1;
                }
            }
        }

        *last_applied_seq = max_seq;

        tracing::debug!("Applier: applied up to seq {}", last_applied_seq);

            if !has_more { break; }
        } // end batch loop
    }
}

/// Apply field-level LWW changes to a PostgreSQL row via UPSERT.
async fn apply_fields_to_pg(
    client: &tokio_postgres::Client,
    collection: &str,
    doc_id: &str,
    fields: &[FieldChange],
) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    let escaped_id = escape_pg_literal(doc_id);
    let mut field_map = std::collections::BTreeMap::new();
    for fc in fields {
        if fc.field == "id" || fc.field == "created_at" || fc.field == "updated_at"
            || fc.field == "createdAt" || fc.field == "updatedAt"
        {
            continue;
        }
        field_map.insert(fc.field.clone(), json_value_to_pg_literal(&fc.value));
    }

    // Defensive skip: if the change carries no real data fields (only PK and/or
    // timestamps), there is nothing useful to upsert. Attempting it would
    // either fail NOT NULL on a fresh row (because we'd insert with NULL
    // everywhere except `id`/`created_at`/`updated_at`) or, on a known row,
    // bump `updated_at` for free — re-arming any peer's watcher on the same
    // row and producing a feedback amplifier of empty changes. Dropping the
    // upsert here breaks the loop without losing data: the change is
    // ack'd via the caller's `max_seq` advance and the actual data fields
    // arrive in subsequent changes (or never, if the source was buggy).
    if field_map.is_empty() {
        tracing::debug!(
            collection = %collection,
            doc_id = %doc_id,
            "Applier: skipping no-op upsert (change has only PK/timestamp fields)"
        );
        return Ok(());
    }

    let mut col_names = vec!["\"id\"".to_string(), "\"created_at\"".to_string(), "\"updated_at\"".to_string()];
    let mut value_literals = vec![escaped_id.clone(), format!("'{}'", now), format!("'{}'", now)];
    let mut update_clauses = vec![format!("\"updated_at\" = '{}'", now)];

    for (col, literal) in &field_map {
        col_names.push(format!("\"{}\"", col));
        update_clauses.push(format!("\"{}\" = {}", col, literal));
        value_literals.push(literal.clone());
    }

    let sql = format!(
        "INSERT INTO \"{}\" ({}) VALUES ({}) ON CONFLICT (\"id\") DO UPDATE SET {}",
        collection,
        col_names.join(", "),
        value_literals.join(", "),
        update_clauses.join(", ")
    );

    if let Err(e) = client.execute(&sql, &[]).await {
        // Surface the underlying Postgres error (SQLSTATE, constraint name,
        // message) at WARN so future regressions diagnose themselves without
        // requiring a manual reproduction. The full SQL stays at DEBUG to
        // avoid leaking row data into normal logs.
        let pg_err = e.as_db_error();
        tracing::warn!(
            collection = %collection,
            doc_id = %doc_id,
            sqlstate = ?pg_err.map(|d| d.code().code()),
            constraint = ?pg_err.and_then(|d| d.constraint()),
            column = ?pg_err.and_then(|d| d.column()),
            table = ?pg_err.and_then(|d| d.table()),
            message = ?pg_err.map(|d| d.message()),
            field_count = field_map.len(),
            "UPSERT failed"
        );
        tracing::debug!("UPSERT SQL: {}", sql);
        return Err(anyhow::anyhow!("UPSERT failed: {}", e));
    }
    Ok(())
}

fn escape_pg_literal(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

fn json_value_to_pg_literal(val: &serde_json::Value) -> String {
    match val {
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::Bool(b) => if *b { "true".to_string() } else { "false".to_string() },
        serde_json::Value::Number(n) => {
            // SQLite has no boolean type; booleans arrive as integer 0/1 when the source
            // is a SQLite-backed primary reader (local cadence). PostgreSQL rejects bare
            // integer literals for `boolean` columns. Emitting `true`/`false` for 0/1
            // is safe: PostgreSQL coerces `true`→1 and `false`→0 for integer columns,
            // so the round-trip is correct for both boolean and integer column types.
            if let Some(i) = n.as_i64() {
                if i == 0 {
                    return "false".to_string();
                } else if i == 1 {
                    return "true".to_string();
                }
            }
            n.to_string()
        }
        serde_json::Value::String(s) => escape_pg_literal(s),
        other => format!("'{}'::jsonb", other.to_string().replace('\'', "''")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_json_value_to_pg_literal_null() {
        assert_eq!(json_value_to_pg_literal(&json!(null)), "NULL");
    }

    #[test]
    fn test_json_value_to_pg_literal_bool() {
        assert_eq!(json_value_to_pg_literal(&json!(true)), "true");
        assert_eq!(json_value_to_pg_literal(&json!(false)), "false");
    }

    /// Regression test: integer 1 and 0 stored in Valkey from SQLite-originated changes
    /// (where booleans are stored as INTEGER 0/1) must produce boolean PG literals, not
    /// bare integer literals. PostgreSQL rejects `"is_first_login" = 1` for boolean columns.
    #[test]
    fn test_json_value_to_pg_literal_integer_0_1_as_boolean() {
        // Number(1) → "true" (safe for both boolean and int columns via PG implicit cast)
        assert_eq!(json_value_to_pg_literal(&json!(1)), "true");
        // Number(0) → "false"
        assert_eq!(json_value_to_pg_literal(&json!(0)), "false");
    }

    #[test]
    fn test_json_value_to_pg_literal_other_integers_unchanged() {
        assert_eq!(json_value_to_pg_literal(&json!(2)), "2");
        assert_eq!(json_value_to_pg_literal(&json!(-1)), "-1");
        assert_eq!(json_value_to_pg_literal(&json!(42)), "42");
        assert_eq!(json_value_to_pg_literal(&json!(100)), "100");
    }

    #[test]
    fn test_json_value_to_pg_literal_string() {
        assert_eq!(json_value_to_pg_literal(&json!("hello")), "'hello'");
        // Single quotes must be escaped
        assert_eq!(json_value_to_pg_literal(&json!("it's")), "'it''s'");
    }

    #[test]
    fn test_json_value_to_pg_literal_float() {
        let lit = json_value_to_pg_literal(&json!(3.14));
        assert_eq!(lit, "3.14");
    }

    #[test]
    fn test_json_value_to_pg_literal_object_as_jsonb() {
        let lit = json_value_to_pg_literal(&json!({"key": "value"}));
        assert!(lit.ends_with("::jsonb"), "objects should be cast as jsonb: {}", lit);
    }

    #[test]
    fn test_escape_pg_literal_single_quotes() {
        assert_eq!(escape_pg_literal("O'Brien"), "'O''Brien'");
        assert_eq!(escape_pg_literal("normal"), "'normal'");
        assert_eq!(escape_pg_literal(""), "''");
    }
}
