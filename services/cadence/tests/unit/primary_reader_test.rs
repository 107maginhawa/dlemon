use cadence::primary_reader::{NoPrimaryReader, PrimaryDbReader, SqlitePrimaryReader};
use cadence::state::{SyncPayload, SyncState};
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

fn setup_sqlite_primary() -> Arc<Mutex<Connection>> {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE medical_patients (
            id TEXT PRIMARY KEY,
            facility TEXT,
            name TEXT,
            age INTEGER,
            active INTEGER DEFAULT 1,
            tags TEXT DEFAULT '[]',
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now'))
        );",
    )
    .unwrap();
    Arc::new(Mutex::new(conn))
}

#[tokio::test]
async fn test_no_primary_reader_returns_empty() {
    let reader = NoPrimaryReader;
    let state = SyncState::new();
    let rows = reader.read_all_rows("anything", &state).await.unwrap();
    assert!(rows.is_empty());
}

#[tokio::test]
async fn test_sqlite_primary_reader_reads_all_rows() {
    let conn = setup_sqlite_primary();

    // Insert test data
    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO medical_patients (id, facility, name, age) VALUES ('p1', 'F1', 'Alice', 30)",
            [],
        )
        .unwrap();
        c.execute(
            "INSERT INTO medical_patients (id, facility, name, age) VALUES ('p2', 'F1', 'Bob', 25)",
            [],
        )
        .unwrap();
        c.execute(
            "INSERT INTO medical_patients (id, facility, name, age) VALUES ('p3', 'F2', 'Charlie', 40)",
            [],
        )
        .unwrap();
    }

    let reader = SqlitePrimaryReader::new(conn, "test-peer".to_string());
    let state = SyncState::new();

    // Use kebab-case collection name (converted to snake_case for table name internally)
    let rows = reader
        .read_all_rows("medical_patients", &state)
        .await
        .unwrap();

    assert_eq!(rows.len(), 3, "Should read all 3 rows");

    // Verify row structure
    for row in &rows {
        assert_eq!(row.collection, "medical_patients");
        assert!(!row.deleted);
        assert!(!row.document_id.is_empty());

        match &row.payload {
            SyncPayload::Fields(fields) => {
                // Should NOT contain updatedAt or createdAt
                let field_names: Vec<&str> = fields.iter().map(|f| f.field.as_str()).collect();
                assert!(
                    !field_names.contains(&"updatedAt"),
                    "Should exclude updatedAt"
                );
                assert!(
                    !field_names.contains(&"createdAt"),
                    "Should exclude createdAt"
                );
                // Should contain the data fields
                assert!(field_names.contains(&"id"), "Should include id");
                assert!(field_names.contains(&"name"), "Should include name");
                assert!(field_names.contains(&"facility"), "Should include facility");
            }
            _ => panic!("Expected Fields payload"),
        }
    }

    // Verify doc IDs
    let mut doc_ids: Vec<String> = rows.iter().map(|r| r.document_id.clone()).collect();
    doc_ids.sort();
    assert_eq!(doc_ids, vec!["p1", "p2", "p3"]);
}

#[tokio::test]
async fn test_sqlite_primary_reader_empty_table() {
    let conn = setup_sqlite_primary();
    let reader = SqlitePrimaryReader::new(conn, "test-peer".to_string());
    let state = SyncState::new();

    let rows = reader
        .read_all_rows("medical_patients", &state)
        .await
        .unwrap();
    assert!(rows.is_empty(), "Empty table should return no rows");
}

#[tokio::test]
async fn test_sqlite_primary_reader_nonexistent_table() {
    let conn = setup_sqlite_primary();
    let reader = SqlitePrimaryReader::new(conn, "test-peer".to_string());
    let state = SyncState::new();

    let rows = reader
        .read_all_rows("nonexistent-table", &state)
        .await
        .unwrap();
    assert!(
        rows.is_empty(),
        "Nonexistent table should return empty, not error"
    );
}

#[tokio::test]
async fn test_sqlite_primary_reader_increments_lamport_and_seq() {
    let conn = setup_sqlite_primary();

    {
        let c = conn.lock().unwrap();
        c.execute(
            "INSERT INTO medical_patients (id, facility, name, age) VALUES ('p1', 'F1', 'Alice', 30)",
            [],
        )
        .unwrap();
        c.execute(
            "INSERT INTO medical_patients (id, facility, name, age) VALUES ('p2', 'F1', 'Bob', 25)",
            [],
        )
        .unwrap();
    }

    let reader = SqlitePrimaryReader::new(conn, "test-peer".to_string());
    let state = SyncState::new();
    assert_eq!(state.lamport(), 0);
    assert_eq!(state.local_seq(), 0);

    let rows = reader
        .read_all_rows("medical_patients", &state)
        .await
        .unwrap();
    assert_eq!(rows.len(), 2);

    // Each row should have incremented lamport and seq
    assert!(state.lamport() >= 2, "Lamport should be incremented for each row");
    assert!(state.local_seq() >= 2, "Seq should be incremented for each row");

    // Each row should have a unique seq
    let seqs: Vec<u64> = rows.iter().map(|r| r.seq).collect();
    assert_ne!(seqs[0], seqs[1], "Each row should have a unique seq");
}

#[tokio::test]
async fn test_sqlite_primary_reader_handles_json_columns() {
    let conn = setup_sqlite_primary();

    {
        let c = conn.lock().unwrap();
        c.execute(
            r#"INSERT INTO medical_patients (id, facility, name, age, tags) VALUES ('p1', 'F1', 'Alice', 30, '["tag1","tag2"]')"#,
            [],
        )
        .unwrap();
    }

    let reader = SqlitePrimaryReader::new(conn, "test-peer".to_string());
    let state = SyncState::new();

    let rows = reader
        .read_all_rows("medical_patients", &state)
        .await
        .unwrap();
    assert_eq!(rows.len(), 1);

    match &rows[0].payload {
        SyncPayload::Fields(fields) => {
            let tags_field = fields.iter().find(|f| f.field == "tags").unwrap();
            // JSON text should be parsed as a JSON array
            assert!(tags_field.value.is_array(), "Tags should be parsed as JSON array");
            assert_eq!(tags_field.value.as_array().unwrap().len(), 2);
        }
        _ => panic!("Expected Fields payload"),
    }
}

#[tokio::test]
async fn test_sqlite_primary_reader_skips_rows_without_id() {
    let conn = Arc::new(Mutex::new(Connection::open_in_memory().unwrap()));

    {
        let c = conn.lock().unwrap();
        c.execute_batch(
            "CREATE TABLE no_id_table (
                name TEXT,
                value TEXT,
                updatedAt TEXT DEFAULT (datetime('now'))
            );
            INSERT INTO no_id_table (name, value) VALUES ('test', 'data');",
        )
        .unwrap();
    }

    let reader = SqlitePrimaryReader::new(conn, "test-peer".to_string());
    let state = SyncState::new();

    let rows = reader
        .read_all_rows("no_id_table", &state)
        .await
        .unwrap();
    assert!(rows.is_empty(), "Rows without an 'id' column should be skipped");
}

#[tokio::test]
async fn test_sqlite_primary_reader_kebab_to_snake_case() {
    let conn = Arc::new(Mutex::new(Connection::open_in_memory().unwrap()));

    {
        let c = conn.lock().unwrap();
        c.execute_batch(
            "CREATE TABLE medical_patients (
                id TEXT PRIMARY KEY,
                name TEXT,
                updatedAt TEXT DEFAULT (datetime('now'))
            );
            INSERT INTO medical_patients (id, name) VALUES ('p1', 'Test');",
        )
        .unwrap();
    }

    let reader = SqlitePrimaryReader::new(conn, "test-peer".to_string());
    let state = SyncState::new();

    // Query with kebab-case (how collections are named)
    let rows = reader
        .read_all_rows("medical-patients", &state)
        .await
        .unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].collection, "medical-patients", "Collection name should remain kebab-case");
}
