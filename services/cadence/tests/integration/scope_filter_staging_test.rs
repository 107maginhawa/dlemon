//! Diagnostic test that runs filter_changes against ACTUAL staging data
//! via a port-forward. Ignored by default; run explicitly with:
//!
//!   cargo test --features integration-tests --test integration \
//!     scope_filter_staging::staging_filter_diag -- --ignored --nocapture
//!
//! Requires:
//!   kubectl ... port-forward postgresql-0 15435:5432
//!   /tmp/staging-pg-pass file containing the postgres password

use cadence::auth::SyncClaims;
use cadence::config::{CadenceConfig, CollectionConfig, ConflictStrategy};
use cadence::primary_reader::{PgPrimaryReader, PrimaryDbReader};
use cadence::state::{SyncPayload, SyncState};
use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;

const STAGING_USER_ID: &str = "68f5f5a81c4dccfdfc80d4a9";
const STAGING_ORG_ID: &str = "68f5f5c61c4dccfdfc80d4b2";

fn staging_config() -> CadenceConfig {
    let mut config = CadenceConfig::default();

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
            scope_columns: pd_scope.clone(),
            scope_rules: None,
        },
    );
    config.collections.insert(
        "personal_details_history".to_string(),
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
#[ignore]
async fn staging_filter_diag() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter("cadence=debug")
        .with_test_writer()
        .try_init();

    let pg_pass = std::fs::read_to_string("/tmp/staging-pg-pass")
        .expect("/tmp/staging-pg-pass missing")
        .trim()
        .to_string();
    let conn_str = format!(
        "host=localhost port=15435 user=postgres password={} dbname=hapihub",
        pg_pass
    );
    let url = format!("postgres://postgres:{}@localhost:15435/hapihub", pg_pass);

    let (client, conn) = tokio_postgres::connect(&conn_str, tokio_postgres::NoTls).await.unwrap();
    tokio::spawn(async move { let _ = conn.await; });

    let mut config = staging_config();
    config.primary_db_url = url.clone();
    config.resolve_wildcard_pg(&client).await.unwrap();

    eprintln!("\n========== Resolved scope_columns (against STAGING schema) ==========");
    let mut sorted: Vec<_> = config.collections.iter().collect();
    sorted.sort_by_key(|(k, _)| k.to_string());
    for (name, cfg) in &sorted {
        eprintln!("  {:35}  scope_columns = {:?}", name, cfg.scope_columns);
    }
    eprintln!("=====================================================================\n");

    let claims = staging_peer_claims();
    let state = Arc::new(SyncState::new());
    let primary = PgPrimaryReader::new(url, "diag-cloud-peer".to_string());

    // Focus on the failing tables — limit page to 50 to keep test fast
    let interesting = [
        "user", "account", "session",       // BetterAuth — should pass via empty scope_cols
        "accounts",                          // legacy — should pass user dim if user has a row
        "personal_details", "personal-details", "personal_details_history",
        "medical_patients", "medical-patients",
        "billing_invoices", "billing-invoices",
    ];

    let mut total_in = 0usize;
    let mut total_out = 0usize;

    for collection in &interesting {
        // Only iterate collections actually in the resolved config
        if !config.collections.contains_key(*collection) { continue; }
        let rows = primary.read_rows_page(collection, &state, 0, 50).await.unwrap();
        let read = rows.len();
        let filtered = replica_filter_changes(rows.clone(), &claims, &config);
        let kept = filtered.len();
        total_in += read;
        total_out += kept;

        let scope_cols = config.scope_columns_for(collection);

        let verdict = if read == 0 {
            "(empty page)"
        } else if kept == read {
            "ALL PASS ✓"
        } else if kept == 0 {
            "ALL DROPPED ✗"
        } else {
            "PARTIAL"
        };
        eprintln!(
            "  {:35}  read={:3}  kept={:3}  scope_cols={:?}  {}",
            collection, read, kept, scope_cols, verdict
        );

        // For dropped collections, dump first row's relevant fields
        if read > 0 && kept == 0 {
            if let Some(first) = rows.first() {
                let mut row_fields_dump: Vec<(String, String)> = Vec::new();
                if let SyncPayload::Fields(ref fields) = first.payload {
                    for fc in fields {
                        if matches!(&fc.value, serde_json::Value::String(_) | serde_json::Value::Null) {
                            // Show key columns: id + scope-rule columns
                            if scope_cols.values().any(|c| c == &fc.field)
                                || fc.field == "id"
                                || ["facility","organization","account","warehouse","created_by"].contains(&fc.field.as_str())
                            {
                                let v = match &fc.value {
                                    serde_json::Value::String(s) => s.clone(),
                                    _ => "<null>".to_string(),
                                };
                                row_fields_dump.push((fc.field.clone(), v));
                            }
                        }
                    }
                }
                eprintln!("    first row fields: {:?}", row_fields_dump);
            }
        }
    }

    eprintln!("\n========== TOTAL: read={}, kept={} ==========\n", total_in, total_out);
}
