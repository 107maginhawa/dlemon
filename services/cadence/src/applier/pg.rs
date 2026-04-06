use anyhow::Result;
use std::sync::Arc;
use std::time::Duration;

use crate::applier::tracker::ApplierTracker;
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
    poll_interval: Duration,
    tracker: ApplierTracker,
    max_reconnect_attempts: u32,
    reconnect_base_delay_ms: u64,
    reconnect_max_delay_ms: u64,
) -> tokio::task::JoinHandle<()> {
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
                &client, &storage, &collections, poll_interval, &tracker, &mut last_applied_seq,
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
    poll_interval: Duration,
    tracker: &ApplierTracker,
    last_applied_seq: &mut u64,
) -> Result<()> {
    let mut _consecutive_failures = 0u32;

    loop {
        tokio::time::sleep(poll_interval).await;

        let changes = match storage.query_since(*last_applied_seq).await {
            Ok(c) => c,
            Err(e) => {
                tracing::error!("Applier: query_since error: {}", e);
                continue;
            }
        };

        if changes.is_empty() {
            _consecutive_failures = 0; // Idle = healthy
            continue;
        }

        for change in &changes {
            if !collections.contains(&change.collection) {
                *last_applied_seq = std::cmp::max(*last_applied_seq, change.seq);
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

            match result {
                Ok(()) => { _consecutive_failures = 0; }
                Err(e) => {
                    tracing::warn!("Applier: upsert failed for {}/{}: {:?}", change.collection, change.document_id, e);
                    _consecutive_failures += 1;
                }
            }

            *last_applied_seq = std::cmp::max(*last_applied_seq, change.seq);
        }

        tracing::debug!("Applier: applied up to seq {}", last_applied_seq);
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
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => escape_pg_literal(s),
        other => format!("'{}'::jsonb", other.to_string().replace('\'', "''")),
    }
}
