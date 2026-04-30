use cadence::state::{FieldChange, RowChange, SyncPayload};
use cadence::storage::{MetadataBackend, SqliteBackend};
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use tempfile::TempDir;

fn make_field_change(field: &str, value: serde_json::Value, lamport: u64) -> FieldChange {
    FieldChange {
        field: field.to_string(),
        value,
        lamport,
        peer_id: "test-peer".to_string(),
    }
}

fn make_row_change(collection: &str, doc_id: &str, fields: Vec<FieldChange>, deleted: bool) -> RowChange {
    RowChange {
        collection: collection.to_string(),
        document_id: doc_id.to_string(),
        payload: SyncPayload::Fields(fields),
        deleted,
        seq: 0,
    }
}

/// Create a target SQLite DB with a test table for the applier to write into.
fn create_target_db(path: &std::path::Path) -> rusqlite::Connection {
    let conn = rusqlite::Connection::open(path).unwrap();
    conn.execute_batch("PRAGMA journal_mode=WAL;").unwrap();
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS medical_patients (
            id TEXT PRIMARY KEY,
            created_at TEXT,
            updated_at TEXT,
            name TEXT,
            age INTEGER,
            email TEXT,
            metadata TEXT
        );"
    ).unwrap();
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS billing_invoices (
            id TEXT PRIMARY KEY,
            created_at TEXT,
            updated_at TEXT,
            amount REAL,
            status TEXT
        );"
    ).unwrap();
    conn
}

// ── SQLite Applier Tests ────────────────────────────────────────

#[tokio::test]
async fn test_sqlite_applier_inserts_row() {
    let tmp = TempDir::new().unwrap();
    let target_db_path = tmp.path().join("hapihub.db");
    let target_conn = create_target_db(&target_db_path);

    // Seed metadata backend with a change
    let metadata: Arc<dyn MetadataBackend> = Arc::new(SqliteBackend::in_memory().unwrap());
    let change = make_row_change(
        "medical-patients",
        "patient-1",
        vec![
            make_field_change("name", json!("John Doe"), 1),
            make_field_change("age", json!(35), 1),
            make_field_change("email", json!("john@example.com"), 1),
        ],
        false,
    );
    metadata.append_change(&change).await.unwrap();

    // Start applier with fast poll
    let handle = cadence::applier::sqlite::start_sqlite_applier(
        metadata.clone(),
        target_db_path.clone(),
        vec!["medical-patients".to_string()],
        vec![],
        Duration::from_millis(50), cadence::applier::tracker::ApplierTracker::new(),
        10, 100, 1000, 5_000,
        "test-peer".to_string(),
    );

    // Wait for applier to process
    tokio::time::sleep(Duration::from_millis(200)).await;
    handle.abort();

    // Verify the row was inserted
    let row: (String, String, i64) = target_conn.query_row(
        "SELECT id, name, age FROM medical_patients WHERE id = 'patient-1'",
        [],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ).unwrap();

    assert_eq!(row.0, "patient-1");
    assert_eq!(row.1, "John Doe");
    assert_eq!(row.2, 35);
}

#[tokio::test]
async fn test_sqlite_applier_updates_existing_row() {
    let tmp = TempDir::new().unwrap();
    let target_db_path = tmp.path().join("hapihub.db");
    let target_conn = create_target_db(&target_db_path);

    let metadata: Arc<dyn MetadataBackend> = Arc::new(SqliteBackend::in_memory().unwrap());

    // Insert initial row
    let change1 = make_row_change(
        "medical-patients",
        "patient-1",
        vec![make_field_change("name", json!("John"), 1)],
        false,
    );
    metadata.append_change(&change1).await.unwrap();

    // Update the row
    let change2 = make_row_change(
        "medical-patients",
        "patient-1",
        vec![make_field_change("name", json!("John Updated"), 2)],
        false,
    );
    metadata.append_change(&change2).await.unwrap();

    let handle = cadence::applier::sqlite::start_sqlite_applier(
        metadata.clone(),
        target_db_path.clone(),
        vec!["medical-patients".to_string()],
        vec![],
        Duration::from_millis(50), cadence::applier::tracker::ApplierTracker::new(),
        10, 100, 1000, 5_000,
        "test-peer".to_string(),
    );

    tokio::time::sleep(Duration::from_millis(300)).await;
    handle.abort();

    // Should have the updated name
    let name: String = target_conn.query_row(
        "SELECT name FROM medical_patients WHERE id = 'patient-1'",
        [],
        |row| row.get(0),
    ).unwrap();
    assert_eq!(name, "John Updated");

    // Should only have one row (upsert, not duplicate insert)
    let count: i64 = target_conn.query_row(
        "SELECT COUNT(*) FROM medical_patients WHERE id = 'patient-1'",
        [],
        |row| row.get(0),
    ).unwrap();
    assert_eq!(count, 1);
}

#[tokio::test]
async fn test_sqlite_applier_deletes_row() {
    let tmp = TempDir::new().unwrap();
    let target_db_path = tmp.path().join("hapihub.db");
    let target_conn = create_target_db(&target_db_path);

    let metadata: Arc<dyn MetadataBackend> = Arc::new(SqliteBackend::in_memory().unwrap());

    // Insert a row first
    let change1 = make_row_change(
        "medical-patients",
        "patient-1",
        vec![make_field_change("name", json!("John"), 1)],
        false,
    );
    metadata.append_change(&change1).await.unwrap();

    // Now also append the delete change before starting the applier
    // so both are processed in the same or consecutive poll cycles
    let delete_change = RowChange {
        collection: "medical-patients".to_string(),
        document_id: "patient-1".to_string(),
        payload: SyncPayload::Fields(vec![]),
        deleted: true,
        seq: 0,
    };
    metadata.append_change(&delete_change).await.unwrap();

    let handle = cadence::applier::sqlite::start_sqlite_applier(
        metadata.clone(),
        target_db_path.clone(),
        vec!["medical-patients".to_string()],
        vec![],
        Duration::from_millis(50), cadence::applier::tracker::ApplierTracker::new(),
        10, 100, 1000, 5_000,
        "test-peer".to_string(),
    );

    // Give the applier enough time to process both changes
    tokio::time::sleep(Duration::from_millis(500)).await;
    handle.abort();

    // Drop the target_conn and reopen to avoid WAL read issues
    drop(target_conn);
    let target_conn = rusqlite::Connection::open(&target_db_path).unwrap();

    // After insert + delete, the row should not exist
    let count: i64 = target_conn.query_row(
        "SELECT COUNT(*) FROM medical_patients WHERE id = 'patient-1'",
        [],
        |row| row.get(0),
    ).unwrap();
    assert_eq!(count, 0, "Row should be deleted after applier processes insert + delete");
}

#[tokio::test]
async fn test_sqlite_applier_ignores_non_matching_collections() {
    let tmp = TempDir::new().unwrap();
    let target_db_path = tmp.path().join("hapihub.db");
    let target_conn = create_target_db(&target_db_path);

    let metadata: Arc<dyn MetadataBackend> = Arc::new(SqliteBackend::in_memory().unwrap());

    // Insert into a collection not in the applier's list
    let change = make_row_change(
        "unknown-collection",
        "doc-1",
        vec![make_field_change("name", json!("Test"), 1)],
        false,
    );
    metadata.append_change(&change).await.unwrap();

    // Insert into a tracked collection
    let change2 = make_row_change(
        "medical-patients",
        "patient-1",
        vec![make_field_change("name", json!("John"), 1)],
        false,
    );
    metadata.append_change(&change2).await.unwrap();

    let handle = cadence::applier::sqlite::start_sqlite_applier(
        metadata.clone(),
        target_db_path.clone(),
        vec!["medical-patients".to_string()],
        vec![],
        Duration::from_millis(50), cadence::applier::tracker::ApplierTracker::new(),
        10, 100, 1000, 5_000,
        "test-peer".to_string(),
    );

    tokio::time::sleep(Duration::from_millis(200)).await;
    handle.abort();

    // Only the tracked collection's data should be in the target DB
    let count: i64 = target_conn.query_row(
        "SELECT COUNT(*) FROM medical_patients",
        [],
        |row| row.get(0),
    ).unwrap();
    assert_eq!(count, 1);
}

#[tokio::test]
async fn test_sqlite_applier_maps_hyphens_to_underscores() {
    let tmp = TempDir::new().unwrap();
    let target_db_path = tmp.path().join("hapihub.db");
    let target_conn = create_target_db(&target_db_path);

    let metadata: Arc<dyn MetadataBackend> = Arc::new(SqliteBackend::in_memory().unwrap());

    // Collection name with hyphens should map to underscored table name
    let change = make_row_change(
        "billing-invoices",
        "inv-1",
        vec![
            make_field_change("amount", json!(99.99), 1),
            make_field_change("status", json!("pending"), 1),
        ],
        false,
    );
    metadata.append_change(&change).await.unwrap();

    let handle = cadence::applier::sqlite::start_sqlite_applier(
        metadata.clone(),
        target_db_path.clone(),
        vec!["billing-invoices".to_string()],
        vec![],
        Duration::from_millis(50), cadence::applier::tracker::ApplierTracker::new(),
        10, 100, 1000, 5_000,
        "test-peer".to_string(),
    );

    tokio::time::sleep(Duration::from_millis(200)).await;
    handle.abort();

    // Verify it was written to billing_invoices (underscored)
    let row: (String, f64, String) = target_conn.query_row(
        "SELECT id, amount, status FROM billing_invoices WHERE id = 'inv-1'",
        [],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ).unwrap();

    assert_eq!(row.0, "inv-1");
    assert!((row.1 - 99.99).abs() < 0.001);
    assert_eq!(row.2, "pending");
}

#[tokio::test]
async fn test_sqlite_applier_handles_json_objects() {
    let tmp = TempDir::new().unwrap();
    let target_db_path = tmp.path().join("hapihub.db");
    let target_conn = create_target_db(&target_db_path);

    let metadata: Arc<dyn MetadataBackend> = Arc::new(SqliteBackend::in_memory().unwrap());

    // Insert a row with a JSON object field
    let change = make_row_change(
        "medical-patients",
        "patient-1",
        vec![
            make_field_change("name", json!("John"), 1),
            make_field_change("metadata", json!({"allergies": ["peanuts"], "blood_type": "A+"}), 1),
        ],
        false,
    );
    metadata.append_change(&change).await.unwrap();

    let handle = cadence::applier::sqlite::start_sqlite_applier(
        metadata.clone(),
        target_db_path.clone(),
        vec!["medical-patients".to_string()],
        vec![],
        Duration::from_millis(50), cadence::applier::tracker::ApplierTracker::new(),
        10, 100, 1000, 5_000,
        "test-peer".to_string(),
    );

    tokio::time::sleep(Duration::from_millis(200)).await;
    handle.abort();

    // The JSON object should be stored as a string
    let metadata_val: String = target_conn.query_row(
        "SELECT metadata FROM medical_patients WHERE id = 'patient-1'",
        [],
        |row| row.get(0),
    ).unwrap();

    let parsed: serde_json::Value = serde_json::from_str(&metadata_val).unwrap();
    assert_eq!(parsed["blood_type"], "A+");
    assert_eq!(parsed["allergies"][0], "peanuts");
}

#[tokio::test]
async fn test_sqlite_applier_handles_null_values() {
    let tmp = TempDir::new().unwrap();
    let target_db_path = tmp.path().join("hapihub.db");
    let target_conn = create_target_db(&target_db_path);

    let metadata: Arc<dyn MetadataBackend> = Arc::new(SqliteBackend::in_memory().unwrap());

    let change = make_row_change(
        "medical-patients",
        "patient-1",
        vec![
            make_field_change("name", json!("John"), 1),
            make_field_change("email", json!(null), 1),
        ],
        false,
    );
    metadata.append_change(&change).await.unwrap();

    let handle = cadence::applier::sqlite::start_sqlite_applier(
        metadata.clone(),
        target_db_path.clone(),
        vec!["medical-patients".to_string()],
        vec![],
        Duration::from_millis(50), cadence::applier::tracker::ApplierTracker::new(),
        10, 100, 1000, 5_000,
        "test-peer".to_string(),
    );

    tokio::time::sleep(Duration::from_millis(200)).await;
    handle.abort();

    // email should be NULL
    let email: Option<String> = target_conn.query_row(
        "SELECT email FROM medical_patients WHERE id = 'patient-1'",
        [],
        |row| row.get(0),
    ).unwrap();
    assert!(email.is_none());
}

#[tokio::test]
async fn test_sqlite_applier_skips_reserved_fields() {
    let tmp = TempDir::new().unwrap();
    let target_db_path = tmp.path().join("hapihub.db");
    let target_conn = create_target_db(&target_db_path);

    let metadata: Arc<dyn MetadataBackend> = Arc::new(SqliteBackend::in_memory().unwrap());

    // id, created_at, updated_at, createdAt, updatedAt should be managed by the applier
    let change = make_row_change(
        "medical-patients",
        "patient-1",
        vec![
            make_field_change("id", json!("should-be-ignored"), 1),
            make_field_change("created_at", json!("should-be-ignored"), 1),
            make_field_change("updated_at", json!("should-be-ignored"), 1),
            make_field_change("createdAt", json!("should-be-ignored"), 1),
            make_field_change("updatedAt", json!("should-be-ignored"), 1),
            make_field_change("name", json!("John"), 1),
        ],
        false,
    );
    metadata.append_change(&change).await.unwrap();

    let handle = cadence::applier::sqlite::start_sqlite_applier(
        metadata.clone(),
        target_db_path.clone(),
        vec!["medical-patients".to_string()],
        vec![],
        Duration::from_millis(50), cadence::applier::tracker::ApplierTracker::new(),
        10, 100, 1000, 5_000,
        "test-peer".to_string(),
    );

    tokio::time::sleep(Duration::from_millis(200)).await;
    handle.abort();

    // id should be "patient-1" (from doc_id), not "should-be-ignored"
    let id: String = target_conn.query_row(
        "SELECT id FROM medical_patients WHERE id = 'patient-1'",
        [],
        |row| row.get(0),
    ).unwrap();
    assert_eq!(id, "patient-1");
}

#[tokio::test]
async fn test_sqlite_applier_handles_multiple_collections() {
    let tmp = TempDir::new().unwrap();
    let target_db_path = tmp.path().join("hapihub.db");
    let target_conn = create_target_db(&target_db_path);

    let metadata: Arc<dyn MetadataBackend> = Arc::new(SqliteBackend::in_memory().unwrap());

    let change1 = make_row_change(
        "medical-patients",
        "patient-1",
        vec![make_field_change("name", json!("John"), 1)],
        false,
    );
    metadata.append_change(&change1).await.unwrap();

    let change2 = make_row_change(
        "billing-invoices",
        "inv-1",
        vec![
            make_field_change("amount", json!(100.0), 1),
            make_field_change("status", json!("paid"), 1),
        ],
        false,
    );
    metadata.append_change(&change2).await.unwrap();

    let handle = cadence::applier::sqlite::start_sqlite_applier(
        metadata.clone(),
        target_db_path.clone(),
        vec!["medical-patients".to_string(), "billing-invoices".to_string()],
        vec![],
        Duration::from_millis(50), cadence::applier::tracker::ApplierTracker::new(),
        10, 100, 1000, 5_000,
        "test-peer".to_string(),
    );

    tokio::time::sleep(Duration::from_millis(200)).await;
    handle.abort();

    // Both tables should have data
    let patient_count: i64 = target_conn.query_row(
        "SELECT COUNT(*) FROM medical_patients",
        [],
        |row| row.get(0),
    ).unwrap();
    assert_eq!(patient_count, 1);

    let invoice_count: i64 = target_conn.query_row(
        "SELECT COUNT(*) FROM billing_invoices",
        [],
        |row| row.get(0),
    ).unwrap();
    assert_eq!(invoice_count, 1);
}

// ── PG Applier Module Compilation Test ──────────────────────────

// The PG applier is an extraction of existing code from main.rs.
// It requires a live PostgreSQL connection so we only verify it compiles
// and the public API is accessible.
#[test]
fn test_pg_applier_public_api_exists() {
    // Verify the function signature exists and is callable
    let _: fn(
        Arc<dyn MetadataBackend>,
        String,
        Vec<String>,
        Vec<String>,
        Duration, cadence::applier::tracker::ApplierTracker,
        u32, u64, u64, usize, String,
    ) -> tokio::task::JoinHandle<()> = cadence::applier::pg::start_pg_applier;
}

#[test]
fn test_sqlite_applier_public_api_exists() {
    let _: fn(
        Arc<dyn MetadataBackend>,
        std::path::PathBuf,
        Vec<String>,
        Vec<String>,
        Duration, cadence::applier::tracker::ApplierTracker,
        u32, u64, u64, usize, String,
    ) -> tokio::task::JoinHandle<()> = cadence::applier::sqlite::start_sqlite_applier;
}
