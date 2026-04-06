use cadence::schema::*;
use std::collections::BTreeMap;

fn make_patient_columns() -> BTreeMap<String, ColumnType> {
    let mut cols = BTreeMap::new();
    cols.insert("id".to_string(), ColumnType::Text);
    cols.insert("facility".to_string(), ColumnType::Text);
    cols.insert("name".to_string(), ColumnType::Text);
    cols.insert("tags".to_string(), ColumnType::Json);
    cols.insert("_data".to_string(), ColumnType::Json);
    cols.insert("createdAt".to_string(), ColumnType::Timestamp);
    cols.insert("updatedAt".to_string(), ColumnType::Timestamp);
    cols
}

#[test]
fn test_schema_introspect_sqlite() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE medical_patients (
            id TEXT PRIMARY KEY,
            facility TEXT,
            name TEXT,
            tags JSON,
            _data JSON,
            createdAt TIMESTAMP,
            updatedAt TIMESTAMP
        )",
    )
    .unwrap();

    let fp = introspect_sqlite(&conn, "medical_patients").unwrap();
    assert_eq!(fp.columns.len(), 7);
    assert_eq!(fp.columns["id"], ColumnType::Text);
    assert_eq!(fp.columns["tags"], ColumnType::Json);
    assert_eq!(fp.columns["createdAt"], ColumnType::Timestamp);
}

#[test]
fn test_schema_introspect_postgres() {
    // This test requires a real PG connection — mark as integration test
    // Here we test the type mapping instead
    assert_eq!(ColumnType::from_pg_type("text"), ColumnType::Text);
    assert_eq!(
        ColumnType::from_pg_type("character varying"),
        ColumnType::Text
    );
    assert_eq!(ColumnType::from_pg_type("integer"), ColumnType::Integer);
    assert_eq!(ColumnType::from_pg_type("bigint"), ColumnType::Integer);
    assert_eq!(ColumnType::from_pg_type("jsonb"), ColumnType::Json);
    assert_eq!(ColumnType::from_pg_type("boolean"), ColumnType::Boolean);
    assert_eq!(
        ColumnType::from_pg_type("timestamp with time zone"),
        ColumnType::Timestamp
    );
    assert_eq!(
        ColumnType::from_pg_type("double precision"),
        ColumnType::Real
    );
}

#[test]
fn test_schema_fingerprint_deterministic() {
    let cols1 = make_patient_columns();
    let cols2 = make_patient_columns();

    let fp1 = TableFingerprint::new(cols1);
    let fp2 = TableFingerprint::new(cols2);

    assert_eq!(fp1.hash, fp2.hash, "Same schema should produce same hash");
}

#[test]
fn test_schema_compare_identical() {
    let cols = make_patient_columns();
    let fp = TableFingerprint::new(cols);

    let mut local_tables = BTreeMap::new();
    local_tables.insert("medical_patients".to_string(), fp.clone());

    let mut remote_tables = BTreeMap::new();
    remote_tables.insert("medical_patients".to_string(), fp);

    let local = SchemaFingerprint::new(local_tables);
    let remote = SchemaFingerprint::new(remote_tables);

    let result = compare_schemas(&local, &remote);
    assert_eq!(result.len(), 1);
    assert_eq!(
        result["medical_patients"],
        SchemaCompatibility::Identical
    );
}

#[test]
fn test_schema_compare_extra_column() {
    let local_cols = make_patient_columns();
    let mut remote_cols = make_patient_columns();
    remote_cols.insert("preferredLanguage".to_string(), ColumnType::Text);

    let mut local_tables = BTreeMap::new();
    local_tables.insert(
        "medical_patients".to_string(),
        TableFingerprint::new(local_cols),
    );

    let mut remote_tables = BTreeMap::new();
    remote_tables.insert(
        "medical_patients".to_string(),
        TableFingerprint::new(remote_cols),
    );

    let local = SchemaFingerprint::new(local_tables);
    let remote = SchemaFingerprint::new(remote_tables);

    let result = compare_schemas(&local, &remote);
    match &result["medical_patients"] {
        SchemaCompatibility::Compatible { warnings } => {
            assert!(!warnings.is_empty(), "Should have warnings about extra column");
        }
        other => panic!("Expected Compatible, got {:?}", other),
    }
}

#[test]
fn test_schema_compare_missing_table() {
    let cols = make_patient_columns();
    let mut local_tables = BTreeMap::new();
    local_tables.insert(
        "medical_patients".to_string(),
        TableFingerprint::new(cols),
    );

    let local = SchemaFingerprint::new(local_tables);
    let remote = SchemaFingerprint::new(BTreeMap::new());

    let result = compare_schemas(&local, &remote);
    match &result["medical_patients"] {
        SchemaCompatibility::Incompatible { errors } => {
            assert!(
                errors[0].contains("missing"),
                "Should mention missing table"
            );
        }
        other => panic!("Expected Incompatible, got {:?}", other),
    }
}

#[test]
fn test_schema_compare_type_mismatch() {
    let local_cols = make_patient_columns();

    let mut remote_cols = make_patient_columns();
    // Change 'tags' from Json to Text
    remote_cols.insert("tags".to_string(), ColumnType::Text);

    let mut local_tables = BTreeMap::new();
    local_tables.insert(
        "medical_patients".to_string(),
        TableFingerprint::new(local_cols),
    );

    let mut remote_tables = BTreeMap::new();
    remote_tables.insert(
        "medical_patients".to_string(),
        TableFingerprint::new(remote_cols),
    );

    let local = SchemaFingerprint::new(local_tables);
    let remote = SchemaFingerprint::new(remote_tables);

    let result = compare_schemas(&local, &remote);
    match &result["medical_patients"] {
        SchemaCompatibility::Incompatible { errors } => {
            assert!(
                errors.iter().any(|e| e.contains("tags")),
                "Should mention type mismatch on tags"
            );
        }
        other => panic!("Expected Incompatible, got {:?}", other),
    }
}

#[test]
fn test_list_all_tables_sqlite() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE medical_patients (id TEXT PRIMARY KEY, name TEXT);
         CREATE TABLE billing_invoices (id TEXT PRIMARY KEY, amount REAL);
         CREATE TABLE organizations (id TEXT PRIMARY KEY);",
    )
    .unwrap();

    let tables = list_all_tables_sqlite(&conn).unwrap();
    assert_eq!(tables.len(), 3);
    assert!(tables.contains(&"medical_patients".to_string()));
    assert!(tables.contains(&"billing_invoices".to_string()));
    assert!(tables.contains(&"organizations".to_string()));
}

#[test]
fn test_list_all_tables_sqlite_excludes_internal() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch("CREATE TABLE my_table (id TEXT PRIMARY KEY);").unwrap();

    let tables = list_all_tables_sqlite(&conn).unwrap();
    // Should not contain sqlite_* internal tables
    assert!(tables.iter().all(|t| !t.starts_with("sqlite_")));
    assert!(tables.contains(&"my_table".to_string()));
}

#[test]
fn test_table_has_column_sqlite() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE patients (id TEXT PRIMARY KEY, facility_id TEXT, name TEXT);",
    )
    .unwrap();

    assert!(table_has_column_sqlite(&conn, "patients", "facility_id").unwrap());
    assert!(table_has_column_sqlite(&conn, "patients", "name").unwrap());
    assert!(!table_has_column_sqlite(&conn, "patients", "nonexistent").unwrap());
}
