/// Regression test: integer values 0 and 1 stored in the change log (e.g. via a
/// SQLite-originated catchup where booleans are stored as INTEGER) must not cause
/// UPSERT failures against PostgreSQL `boolean` columns.
///
/// Root cause: `json_value_to_pg_literal(Number(1))` previously emitted `1`, and
/// PostgreSQL rejects bare integer literals for boolean columns:
///   `db error: ERROR: column "is_active" is of type boolean but expression is of type integer`
/// The fix emits `true`/`false` for integer values 0 and 1, which PostgreSQL coerces
/// correctly for both boolean and integer column types.
use cadence::applier::tracker::ApplierTracker;
use cadence::state::{FieldChange, RowChange, SyncPayload};
use cadence::storage::{MetadataBackend, SqliteBackend};
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;

const PG_URL: &str = "host=localhost port=15434 user=postgres password=postgres dbname=cadence_test";

async fn connect_pg() -> (tokio_postgres::Client, tokio::task::JoinHandle<()>) {
    let (client, connection) = tokio_postgres::connect(PG_URL, tokio_postgres::NoTls)
        .await
        .expect("Failed to connect to test PostgreSQL");
    let handle = tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("PG connection error: {}", e);
        }
    });
    (client, handle)
}

fn make_field(field: &str, value: serde_json::Value) -> FieldChange {
    FieldChange { field: field.to_string(), value, lamport: 1, peer_id: "test".to_string() }
}

/// Verify the PG applier can UPSERT a row whose fields include integer values 0 and 1
/// into a table with `boolean` columns — the canonical bug scenario.
#[tokio::test]
async fn test_pg_applier_upsert_boolean_column_via_integer_value() {
    let (client, _handle) = connect_pg().await;

    // Create table with boolean columns (mirrors the `accounts` schema that triggered the bug)
    client.batch_execute(
        "DROP TABLE IF EXISTS test_bool_accounts;
         CREATE TABLE test_bool_accounts (
             id TEXT PRIMARY KEY,
             created_at TIMESTAMPTZ,
             updated_at TIMESTAMPTZ,
             email TEXT,
             is_active BOOLEAN,
             is_verified BOOLEAN,
             score INTEGER
         )"
    ).await.expect("Failed to create test_bool_accounts");

    let metadata: Arc<dyn MetadataBackend> = Arc::new(SqliteBackend::in_memory().unwrap());

    // Simulate the bug: boolean values arrive as Number(1)/Number(0) (from SQLite or
    // old-format Valkey entries where serde_json::from_str("1") = Number(1))
    let change = RowChange {
        collection: "test-bool-accounts".to_string(),
        document_id: "acct-001".to_string(),
        payload: SyncPayload::Fields(vec![
            make_field("email", json!("user@example.com")),
            make_field("is_active", json!(1)),      // Number(1) — was causing PG boolean error
            make_field("is_verified", json!(0)),    // Number(0) — same issue
            make_field("score", json!(42)),         // Normal integer, must remain 42
        ]),
        deleted: false,
        seq: 0,
    };
    metadata.append_change(&change).await.unwrap();

    let handle = cadence::applier::pg::start_pg_applier(
        metadata.clone(),
        PG_URL.to_string(),
        vec!["test-bool-accounts".to_string()],
        vec![],
        Duration::from_millis(50),
        ApplierTracker::new(),
        3, 100, 500, 5_000,
        "test-peer".to_string(),
    );

    // Give the applier a few poll cycles to apply the change
    tokio::time::sleep(Duration::from_millis(400)).await;
    handle.abort();

    // Verify the row was written without error
    let row = client.query_one(
        "SELECT email, is_active, is_verified, score FROM test_bool_accounts WHERE id = 'acct-001'",
        &[],
    ).await.expect("Row should exist — UPSERT should have succeeded with boolean fix");

    let email: String = row.get(0);
    let is_active: bool = row.get(1);
    let is_verified: bool = row.get(2);
    let score: i32 = row.get(3);

    assert_eq!(email, "user@example.com");
    assert!(is_active, "is_active = Number(1) should map to PG true");
    assert!(!is_verified, "is_verified = Number(0) should map to PG false");
    assert_eq!(score, 42, "integer score should remain unchanged");

    client.batch_execute("DROP TABLE IF EXISTS test_bool_accounts").await.ok();
}

/// Verify that a mix of JSON booleans and integer-encoded booleans both work correctly.
#[tokio::test]
async fn test_pg_applier_mixed_bool_representations() {
    let (client, _handle) = connect_pg().await;

    client.batch_execute(
        "DROP TABLE IF EXISTS test_mixed_bool;
         CREATE TABLE test_mixed_bool (
             id TEXT PRIMARY KEY,
             created_at TIMESTAMPTZ,
             updated_at TIMESTAMPTZ,
             flag_a BOOLEAN,
             flag_b BOOLEAN
         )"
    ).await.expect("Failed to create test_mixed_bool");

    let metadata: Arc<dyn MetadataBackend> = Arc::new(SqliteBackend::in_memory().unwrap());

    // Row 1: JSON booleans (the expected format from PG watcher)
    let change1 = RowChange {
        collection: "test-mixed-bool".to_string(),
        document_id: "row-1".to_string(),
        payload: SyncPayload::Fields(vec![
            make_field("flag_a", json!(true)),
            make_field("flag_b", json!(false)),
        ]),
        deleted: false,
        seq: 0,
    };
    // Row 2: integer-encoded booleans (from SQLite or old Valkey format)
    let change2 = RowChange {
        collection: "test-mixed-bool".to_string(),
        document_id: "row-2".to_string(),
        payload: SyncPayload::Fields(vec![
            make_field("flag_a", json!(1)),
            make_field("flag_b", json!(0)),
        ]),
        deleted: false,
        seq: 0,
    };
    metadata.append_change(&change1).await.unwrap();
    metadata.append_change(&change2).await.unwrap();

    let handle = cadence::applier::pg::start_pg_applier(
        metadata.clone(),
        PG_URL.to_string(),
        vec!["test-mixed-bool".to_string()],
        vec![],
        Duration::from_millis(50),
        ApplierTracker::new(),
        3, 100, 500, 5_000,
        "test-peer".to_string(),
    );

    tokio::time::sleep(Duration::from_millis(400)).await;
    handle.abort();

    let row1 = client.query_one(
        "SELECT flag_a, flag_b FROM test_mixed_bool WHERE id = 'row-1'",
        &[],
    ).await.expect("row-1 should exist");
    assert!(row1.get::<_, bool>(0), "flag_a should be true for row-1");
    assert!(!row1.get::<_, bool>(1), "flag_b should be false for row-1");

    let row2 = client.query_one(
        "SELECT flag_a, flag_b FROM test_mixed_bool WHERE id = 'row-2'",
        &[],
    ).await.expect("row-2 should exist (integer-encoded booleans)");
    assert!(row2.get::<_, bool>(0), "flag_a should be true for row-2 (from integer 1)");
    assert!(!row2.get::<_, bool>(1), "flag_b should be false for row-2 (from integer 0)");

    client.batch_execute("DROP TABLE IF EXISTS test_mixed_bool").await.ok();
}
