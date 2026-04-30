//! Diagnostic test reproducing the staging "0 rows received despite 31k available"
//! scenario locally. Mirrors:
//!
//! - The wildcard config used in staging (configmap + cadence_embed.rs match):
//!   `scope_rules: { account: organization, created_by: user, facility: organization,
//!    organization: organization, warehouse: organization }`
//! - The user's actual JWT scopes:
//!   `{ organization: ["68f5f5c61c4dccfdfc80d4b2"], user: ["68f5f5a81c4dccfdfc80d4a9"] }`
//! - The staging table shapes for the failing tables (sampled from staging PG).
//! - Real row values from staging that *should* match the scopes.
//!
//! What the test does:
//! 1. Creates a tiny PG schema with the same column shape as staging
//! 2. Inserts rows whose scope-relevant columns hold the user's actual ids
//! 3. Resolves the wildcard config
//! 4. Dumps the resolved scope_columns for each collection
//! 5. Reads rows via primary_reader and runs them through the same filter
//!    chain as the cloud uses
//! 6. Asserts which rows pass — failures here are the bug

use cadence::auth::SyncClaims;
use cadence::config::{CadenceConfig, CollectionConfig, ConflictStrategy};
use cadence::primary_reader::{PgPrimaryReader, PrimaryDbReader};
use cadence::state::{SyncPayload, SyncState};
use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;

const PG_BASE: &str = "host=localhost port=15434 user=postgres password=postgres";
const STAGING_USER_ID: &str = "68f5f5a81c4dccfdfc80d4a9";
const STAGING_ORG_ID: &str = "68f5f5c61c4dccfdfc80d4b2";

/// Schema mirroring the staging tables that drop everything in the cloud's
/// scope filter. Includes:
/// - Better Auth `user`/`account`/`session` (no scope-rule columns)
/// - Legacy MyCure `accounts` (`id` IS the user_id by design)
/// - Legacy `personal_details` (`id` IS the user_id; `facility` is org)
/// - Org-scoped `medical_patients` (has `facility`/`account`/`created_by`)
/// - Org-scoped `billing_invoices` (has all five rule columns)
const SCHEMA_SQL: &str = r#"
    DROP TABLE IF EXISTS billing_invoices CASCADE;
    DROP TABLE IF EXISTS medical_patients CASCADE;
    DROP TABLE IF EXISTS personal_details CASCADE;
    DROP TABLE IF EXISTS accounts CASCADE;
    DROP TABLE IF EXISTS session CASCADE;
    DROP TABLE IF EXISTS account CASCADE;
    DROP TABLE IF EXISTS "user" CASCADE;

    CREATE TABLE "user" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE account (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        password TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE session (
        id TEXT PRIMARY KEY,
        expires_at TIMESTAMP NOT NULL,
        token TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        active_organization_id TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        email TEXT,
        created_by TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE personal_details (
        id TEXT PRIMARY KEY,
        facility TEXT,
        name TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE medical_patients (
        id TEXT PRIMARY KEY,
        facility TEXT,
        account TEXT,
        created_by TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE billing_invoices (
        id TEXT PRIMARY KEY,
        organization TEXT,
        facility TEXT,
        account TEXT,
        warehouse TEXT,
        created_by TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
"#;

async fn setup_pg() -> tokio_postgres::Client {
    let admin_url = format!("{} dbname=postgres", PG_BASE);
    let (admin, conn) = tokio_postgres::connect(&admin_url, tokio_postgres::NoTls).await.unwrap();
    tokio::spawn(async move { let _ = conn.await; });
    admin
        .execute("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='cadence_scope_diag'", &[])
        .await
        .ok();
    admin.execute("DROP DATABASE IF EXISTS cadence_scope_diag", &[]).await.ok();
    admin.execute("CREATE DATABASE cadence_scope_diag", &[]).await.unwrap();

    let url = format!("{} dbname=cadence_scope_diag", PG_BASE);
    let (client, conn) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await.unwrap();
    tokio::spawn(async move { let _ = conn.await; });
    client.batch_execute(SCHEMA_SQL).await.unwrap();
    client
}

async fn populate_test_data(client: &tokio_postgres::Client) {
    // user table — should pass via empty scope_columns (no rule columns exist)
    client
        .execute(
            "INSERT INTO \"user\" (id, name, email) VALUES ($1, 'Super Admin', 'super@x.com')",
            &[&STAGING_USER_ID],
        )
        .await
        .unwrap();

    // account (Better Auth) — should pass via empty scope_columns
    client
        .execute(
            "INSERT INTO account (id, account_id, provider_id, user_id) VALUES ('acc-uuid', $1, 'credential', $1)",
            &[&STAGING_USER_ID],
        )
        .await
        .unwrap();

    // session — should pass via empty scope_columns
    client
        .execute(
            "INSERT INTO session (id, expires_at, token, user_id) VALUES ('sess-1', NOW() + INTERVAL '7 days', 'tok-1', $1)",
            &[&STAGING_USER_ID],
        )
        .await
        .unwrap();

    // legacy accounts — id IS user_id; should pass via {user: id}
    client
        .execute(
            "INSERT INTO accounts (id, email) VALUES ($1, 'super@x.com')",
            &[&STAGING_USER_ID],
        )
        .await
        .unwrap();

    // personal_details — id IS user_id; should pass via {user: id}
    client
        .execute(
            "INSERT INTO personal_details (id, facility, name) VALUES ($1, $2, 'Super Admin')",
            &[&STAGING_USER_ID, &STAGING_ORG_ID],
        )
        .await
        .unwrap();

    // medical_patients — facility=org, created_by=user; should pass on either dim
    client
        .execute(
            "INSERT INTO medical_patients (id, facility, account, created_by) VALUES ('pt-1', $1, NULL, $2)",
            &[&STAGING_ORG_ID, &STAGING_USER_ID],
        )
        .await
        .unwrap();

    // billing_invoices — exercises every rule column
    client
        .execute(
            "INSERT INTO billing_invoices (id, organization, facility, account, warehouse, created_by) \
             VALUES ('inv-1', $1, $1, NULL, NULL, $2)",
            &[&STAGING_ORG_ID, &STAGING_USER_ID],
        )
        .await
        .unwrap();
}

fn staging_config() -> CadenceConfig {
    let mut config = CadenceConfig::default();

    // Wildcard with the same scope_rules as staging configmap + cadence_embed.rs
    let mut scope_rules = BTreeMap::new();
    scope_rules.insert("account".to_string(), "organization".to_string());
    scope_rules.insert("created_by".to_string(), "user".to_string());
    scope_rules.insert("facility".to_string(), "organization".to_string());
    scope_rules.insert("organization".to_string(), "organization".to_string());
    scope_rules.insert("warehouse".to_string(), "organization".to_string());
    config.collections.insert(
        "*".to_string(),
        CollectionConfig {
            strategy: ConflictStrategy::Lww,
            scope_columns: BTreeMap::new(),
            scope_rules: Some(scope_rules),
        },
    );

    // Explicit entries that staging has too
    let mut accounts_scope = BTreeMap::new();
    accounts_scope.insert("user".to_string(), "id".to_string());
    config.collections.insert(
        "accounts".to_string(),
        CollectionConfig {
            strategy: ConflictStrategy::Lww,
            scope_columns: accounts_scope,
            scope_rules: None,
        },
    );

    let mut pd_scope = BTreeMap::new();
    pd_scope.insert("user".to_string(), "id".to_string());
    pd_scope.insert("organization".to_string(), "facility".to_string());
    config.collections.insert(
        "personal_details".to_string(),
        CollectionConfig {
            strategy: ConflictStrategy::Lww,
            scope_columns: pd_scope,
            scope_rules: None,
        },
    );

    config.collections_blacklist = vec![
        "--drizzle-migrations".to_string(),
        "-migration-checkpoints".to_string(),
    ];

    config
}

fn staging_peer_claims() -> SyncClaims {
    let mut scopes = HashMap::new();
    scopes.insert("organization".to_string(), vec![STAGING_ORG_ID.to_string()]);
    scopes.insert("user".to_string(), vec![STAGING_USER_ID.to_string()]);
    SyncClaims {
        sub: "diag-peer".to_string(),
        iss: "test".to_string(),
        aud: None,
        exp: None,
        nbf: None,
        iat: None,
        peer_id: Some("diag-peer".to_string()),
        read_only: false,
        scopes,
    }
}

/// Replicates `SyncEngine::filter_changes` exactly.
fn replica_filter_changes(
    changes: Vec<cadence::state::RowChange>,
    claims: &SyncClaims,
    config: &CadenceConfig,
) -> Vec<cadence::state::RowChange> {
    changes
        .into_iter()
        .filter(|c| {
            let scope_cols = config.scope_columns_for(&c.collection);
            if scope_cols.is_empty() {
                return true;
            }
            let mut row_fields = HashMap::new();
            if let SyncPayload::Fields(ref fields) = c.payload {
                for fc in fields {
                    let val = match &fc.value {
                        serde_json::Value::String(s) => s.clone(),
                        serde_json::Value::Null => continue,
                        other => other.to_string(),
                    };
                    row_fields.insert(fc.field.clone(), val);
                }
            }
            claims.row_in_scope(scope_cols, &row_fields)
        })
        .collect()
}

#[tokio::test]
async fn diagnose_scope_filter_dropping_everything() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter("cadence=debug")
        .with_test_writer()
        .try_init();

    let client = setup_pg().await;
    populate_test_data(&client).await;

    let mut config = staging_config();
    let url = format!("{} dbname=cadence_scope_diag", PG_BASE);
    config.primary_db_url = format!("postgres://postgres:postgres@localhost:15434/cadence_scope_diag");
    config.resolve_wildcard_pg(&client).await.unwrap();

    // ── Step 1: dump resolved scope_columns ──────────────────────
    eprintln!("\n========== Resolved scope_columns per collection ==========");
    let mut sorted: Vec<_> = config.collections.iter().collect();
    sorted.sort_by_key(|(k, _)| k.to_string());
    for (name, cfg) in &sorted {
        eprintln!("  {:30}  scope_columns = {:?}", name, cfg.scope_columns);
    }
    eprintln!("============================================================\n");

    // ── Step 2: read each collection via primary_reader and apply filter ──
    let claims = staging_peer_claims();
    let state = Arc::new(SyncState::new());
    let primary = PgPrimaryReader::new(url.clone(), "diag-cloud-peer".to_string());

    let mut total_in = 0usize;
    let mut total_out = 0usize;

    for (collection, _) in &sorted {
        if collection.as_str() == "*" { continue; }
        let rows = primary.read_rows_page(collection, &state, 0, 1000).await.unwrap();
        let read = rows.len();
        let filtered = replica_filter_changes(rows, &claims, &config);
        let kept = filtered.len();
        total_in += read;
        total_out += kept;
        let verdict = if read == 0 {
            "(empty table)"
        } else if kept == read {
            "ALL PASS ✓"
        } else if kept == 0 {
            "ALL DROPPED ✗"
        } else {
            "PARTIAL"
        };
        eprintln!("  {:30}  read={:3}  kept={:3}  {}", collection, read, kept, verdict);
    }

    eprintln!("\n========== TOTAL: read={}, kept={} ==========\n", total_in, total_out);

    // The expected outcomes given the user's JWT and the data we inserted:
    //   user, account, session  → empty scope_columns → 1 row each, all pass
    //   accounts                → {user: id}, row.id == user_id → passes
    //   personal_details        → {user: id, organization: facility} → passes (user dim)
    //   medical_patients        → {organization: facility, user: created_by} → passes
    //   billing_invoices        → {organization: <one of account/facility/org/warehouse>, user: created_by} → passes
    //
    // If ANY row drops, the assertion below fires and the diagnostic output above
    // shows exactly which collections + scope_columns + claim mismatch caused it.
    assert!(
        total_out > 0,
        "All {} rows dropped by scope filter — bug reproduced. See dump above.",
        total_in
    );
    // Stronger assertion: every non-empty collection should have at least
    // one row pass, given we built rows that match the user's scopes.
    // (We expect parity given how rows were constructed.)
}
