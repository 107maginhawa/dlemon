use cadence::schema::*;
use std::collections::BTreeMap;

const PG_URL: &str = "host=localhost port=15434 user=postgres password=postgres dbname=cadence_test";

#[tokio::test]
async fn test_schema_introspect_real_postgres() {
    let (client, connection) = tokio_postgres::connect(PG_URL, tokio_postgres::NoTls)
        .await
        .expect("Failed to connect to test PostgreSQL");

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("PG connection error: {}", e);
        }
    });

    // Create a test table
    client
        .batch_execute(
            "DROP TABLE IF EXISTS test_patients;
             CREATE TABLE test_patients (
                 id TEXT PRIMARY KEY,
                 facility TEXT,
                 name TEXT,
                 age INTEGER,
                 active BOOLEAN,
                 tags JSONB,
                 _data JSONB DEFAULT '{}',
                 \"createdAt\" TIMESTAMP DEFAULT NOW(),
                 \"updatedAt\" TIMESTAMP DEFAULT NOW()
             )",
        )
        .await
        .expect("Failed to create test table");

    let fp = introspect_postgres(&client, "test_patients")
        .await
        .expect("Failed to introspect");

    assert!(fp.columns.len() >= 9, "Should have at least 9 columns");
    assert_eq!(fp.columns["id"], ColumnType::Text);
    assert_eq!(fp.columns["age"], ColumnType::Integer);
    assert_eq!(fp.columns["active"], ColumnType::Boolean);
    assert_eq!(fp.columns["tags"], ColumnType::Json);

    // Cleanup
    client
        .batch_execute("DROP TABLE IF EXISTS test_patients")
        .await
        .ok();
}

#[tokio::test]
async fn test_unknown_field_stored_in_data() {
    // Simulate: Peer A has a column "preferredLanguage" that Peer B doesn't have.
    // When B receives a FieldChange for "preferredLanguage", it should be storable in _data.
    // This tests the concept — the actual UPSERT with _data fallback is in the sync engine.

    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE medical_patients (
            id TEXT PRIMARY KEY,
            facility TEXT,
            name TEXT,
            _data TEXT DEFAULT '{}'
        )",
    )
    .unwrap();

    // Insert a patient
    conn.execute(
        "INSERT INTO medical_patients (id, facility, name) VALUES ('p1', 'F1', 'John')",
        [],
    )
    .unwrap();

    // Simulate receiving an unknown field — store in _data
    conn.execute(
        "UPDATE medical_patients SET _data = json_set(COALESCE(_data, '{}'), '$.preferredLanguage', 'en') WHERE id = 'p1'",
        [],
    )
    .unwrap();

    // Verify it was stored
    let data: String = conn
        .query_row(
            "SELECT _data FROM medical_patients WHERE id = 'p1'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    let parsed: serde_json::Value = serde_json::from_str(&data).unwrap();
    assert_eq!(parsed["preferredLanguage"], "en");
}

#[tokio::test]
async fn test_unknown_field_roundtrip_via_data() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE medical_patients (
            id TEXT PRIMARY KEY,
            name TEXT,
            _data TEXT DEFAULT '{}'
        )",
    )
    .unwrap();

    // Store unknown field in _data
    conn.execute(
        "INSERT INTO medical_patients (id, name, _data) VALUES ('p1', 'John', '{\"preferredLanguage\": \"en\", \"customField\": 42}')",
        [],
    )
    .unwrap();

    // Read back
    let data: String = conn
        .query_row("SELECT _data FROM medical_patients WHERE id = 'p1'", [], |row| row.get(0))
        .unwrap();

    let parsed: serde_json::Value = serde_json::from_str(&data).unwrap();
    assert_eq!(parsed["preferredLanguage"], "en");
    assert_eq!(parsed["customField"], 42);
}

#[tokio::test]
async fn test_schema_mismatch_skips_incompatible_table() {
    // Local has medical_patients with tags as Json
    // Remote has medical_patients with tags as Text (incompatible)
    let mut local_cols = BTreeMap::new();
    local_cols.insert("id".to_string(), ColumnType::Text);
    local_cols.insert("tags".to_string(), ColumnType::Json);

    let mut remote_cols = BTreeMap::new();
    remote_cols.insert("id".to_string(), ColumnType::Text);
    remote_cols.insert("tags".to_string(), ColumnType::Text); // mismatch!

    let mut local_tables = BTreeMap::new();
    local_tables.insert("medical_patients".to_string(), TableFingerprint::new(local_cols));
    let mut remote_tables = BTreeMap::new();
    remote_tables.insert("medical_patients".to_string(), TableFingerprint::new(remote_cols));

    // Also add a compatible table
    let mut shared_cols = BTreeMap::new();
    shared_cols.insert("id".to_string(), ColumnType::Text);
    shared_cols.insert("name".to_string(), ColumnType::Text);
    local_tables.insert("billing_invoices".to_string(), TableFingerprint::new(shared_cols.clone()));
    remote_tables.insert("billing_invoices".to_string(), TableFingerprint::new(shared_cols));

    let local = SchemaFingerprint::new(local_tables);
    let remote = SchemaFingerprint::new(remote_tables);

    let result = compare_schemas(&local, &remote);

    // medical_patients should be incompatible
    assert!(matches!(result["medical_patients"], SchemaCompatibility::Incompatible { .. }));
    // billing_invoices should be identical
    assert_eq!(result["billing_invoices"], SchemaCompatibility::Identical);
}

#[tokio::test]
async fn test_schema_fingerprint_exchanged_in_hello() {
    use cadence::protocol::{encode_message, decode_message, SyncMessage};

    let mut tables = BTreeMap::new();
    let mut cols = BTreeMap::new();
    cols.insert("id".to_string(), ColumnType::Text);
    cols.insert("name".to_string(), ColumnType::Text);
    tables.insert("medical_patients".to_string(), TableFingerprint::new(cols));

    let fp = SchemaFingerprint::new(tables);

    let hello = SyncMessage::Hello {
        jwt: "test-token".to_string(),
        peer_id: "peer-1".to_string(),
        schema_fingerprint: fp.clone(),
        since_seq: 0,
        resume_after_seq: None,
    };

    let encoded = encode_message(&hello).unwrap();
    let decoded = decode_message(&encoded).unwrap();

    match decoded {
        SyncMessage::Hello { schema_fingerprint, .. } => {
            assert_eq!(schema_fingerprint, fp);
        }
        _ => panic!("Expected Hello"),
    }
}

#[tokio::test]
async fn test_schema_compatible_peers_sync_shared_columns() {
    // Peer A has columns: id, name, tags
    // Peer B has columns: id, name, tags, extraField
    // Result: Compatible — shared columns sync, extraField stored in _data on A

    let mut a_cols = BTreeMap::new();
    a_cols.insert("id".to_string(), ColumnType::Text);
    a_cols.insert("name".to_string(), ColumnType::Text);
    a_cols.insert("tags".to_string(), ColumnType::Json);

    let mut b_cols = BTreeMap::new();
    b_cols.insert("id".to_string(), ColumnType::Text);
    b_cols.insert("name".to_string(), ColumnType::Text);
    b_cols.insert("tags".to_string(), ColumnType::Json);
    b_cols.insert("extraField".to_string(), ColumnType::Text);

    let mut a_tables = BTreeMap::new();
    a_tables.insert("patients".to_string(), TableFingerprint::new(a_cols));
    let mut b_tables = BTreeMap::new();
    b_tables.insert("patients".to_string(), TableFingerprint::new(b_cols));

    let a_fp = SchemaFingerprint::new(a_tables);
    let b_fp = SchemaFingerprint::new(b_tables);

    let result = compare_schemas(&a_fp, &b_fp);
    match &result["patients"] {
        SchemaCompatibility::Compatible { warnings } => {
            assert!(warnings.iter().any(|w| w.contains("extraField")));
        }
        other => panic!("Expected Compatible, got {:?}", other),
    }
}
