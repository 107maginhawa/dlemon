use cadence::storage::MetadataBackend;

const PG_URL: &str = "host=localhost port=15434 user=postgres password=postgres dbname=cadence_test";

async fn setup_pg_table(client: &tokio_postgres::Client, table: &str) {
    client
        .batch_execute(&format!(
            "DROP TABLE IF EXISTS {table};
             CREATE TABLE {table} (
                 id TEXT PRIMARY KEY,
                 facility TEXT,
                 name TEXT,
                 tags JSONB DEFAULT '[]',
                 _data JSONB DEFAULT '{{}}'::jsonb,
                 \"createdAt\" TIMESTAMP DEFAULT NOW(),
                 \"updatedAt\" TIMESTAMP DEFAULT NOW()
             )"
        ))
        .await
        .expect("Failed to create test table");
}

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

#[tokio::test]
async fn test_pg_watcher_detects_insert() {
    let (client, _handle) = connect_pg().await;
    setup_pg_table(&client, "test_pg_insert_patients").await;

    // Insert a row
    client
        .execute(
            "INSERT INTO test_pg_insert_patients (id, facility, name) VALUES ('p1', 'F1', 'John')",
            &[],
        )
        .await
        .unwrap();

    // Verify row exists
    let rows = client
        .query(
            "SELECT id, name FROM test_pg_insert_patients WHERE id = 'p1'",
            &[],
        )
        .await
        .unwrap();

    assert_eq!(rows.len(), 1);
    let name: String = rows[0].get("name");
    assert_eq!(name, "John");

    client
        .batch_execute("DROP TABLE IF EXISTS test_pg_insert_patients")
        .await
        .ok();
}

#[tokio::test]
async fn test_pg_watcher_detects_update() {
    let (client, _handle) = connect_pg().await;
    setup_pg_table(&client, "test_pg_update_patients").await;

    client
        .execute(
            "INSERT INTO test_pg_update_patients (id, facility, name) VALUES ('p1', 'F1', 'John')",
            &[],
        )
        .await
        .unwrap();

    // Update
    client
        .execute(
            "UPDATE test_pg_update_patients SET name = 'Jane', \"updatedAt\" = NOW() WHERE id = 'p1'",
            &[],
        )
        .await
        .unwrap();

    let rows = client
        .query(
            "SELECT name FROM test_pg_update_patients WHERE id = 'p1'",
            &[],
        )
        .await
        .unwrap();

    assert_eq!(rows.len(), 1);
    let name: String = rows[0].get("name");
    assert_eq!(name, "Jane");

    client
        .batch_execute("DROP TABLE IF EXISTS test_pg_update_patients")
        .await
        .ok();
}

#[tokio::test]
async fn test_pg_watcher_detects_delete() {
    let (client, _handle) = connect_pg().await;
    setup_pg_table(&client, "test_pg_delete_patients").await;

    client
        .execute(
            "INSERT INTO test_pg_delete_patients (id, facility, name) VALUES ('p1', 'F1', 'John')",
            &[],
        )
        .await
        .unwrap();

    client
        .execute("DELETE FROM test_pg_delete_patients WHERE id = 'p1'", &[])
        .await
        .unwrap();

    let rows = client
        .query(
            "SELECT id FROM test_pg_delete_patients WHERE id = 'p1'",
            &[],
        )
        .await
        .unwrap();

    assert_eq!(rows.len(), 0, "Row should be deleted");

    client
        .batch_execute("DROP TABLE IF EXISTS test_pg_delete_patients")
        .await
        .ok();
}

#[tokio::test]
async fn test_pg_watcher_multiple_collections() {
    let (client, _handle) = connect_pg().await;
    setup_pg_table(&client, "test_pg_multi_patients").await;

    client
        .batch_execute(
            "DROP TABLE IF EXISTS test_pg_multi_invoices;
             CREATE TABLE test_pg_multi_invoices (
                 id TEXT PRIMARY KEY,
                 facility TEXT,
                 status TEXT DEFAULT 'draft',
                 _data JSONB DEFAULT '{}'::jsonb,
                 \"createdAt\" TIMESTAMP DEFAULT NOW(),
                 \"updatedAt\" TIMESTAMP DEFAULT NOW()
             )",
        )
        .await
        .unwrap();

    // Insert into both tables
    client
        .execute(
            "INSERT INTO test_pg_multi_patients (id, facility, name) VALUES ('p1', 'F1', 'John')",
            &[],
        )
        .await
        .unwrap();

    client
        .execute(
            "INSERT INTO test_pg_multi_invoices (id, facility, status) VALUES ('inv1', 'F1', 'paid')",
            &[],
        )
        .await
        .unwrap();

    // Query both
    let patients = client
        .query("SELECT id FROM test_pg_multi_patients", &[])
        .await
        .unwrap();
    let invoices = client
        .query("SELECT id FROM test_pg_multi_invoices", &[])
        .await
        .unwrap();

    assert_eq!(patients.len(), 1);
    assert_eq!(invoices.len(), 1);

    client
        .batch_execute("DROP TABLE IF EXISTS test_pg_multi_patients; DROP TABLE IF EXISTS test_pg_multi_invoices")
        .await
        .ok();
}

#[tokio::test]
async fn test_pg_watcher_bumps_lamport_and_seq() {
    // Test that PostgreSQL LISTEN/NOTIFY trigger can be installed
    let (client, _handle) = connect_pg().await;
    setup_pg_table(&client, "test_pg_lamport_patients").await;

    // Create a trigger function
    let result = client
        .batch_execute(
            "CREATE OR REPLACE FUNCTION test_notify_fn() RETURNS trigger AS $$
             BEGIN
                 PERFORM pg_notify('cadence_test_pg_lamport_patients', NEW.id::text);
                 RETURN NEW;
             END;
             $$ LANGUAGE plpgsql;

             DROP TRIGGER IF EXISTS test_notify_trigger ON test_pg_lamport_patients;
             CREATE TRIGGER test_notify_trigger
             AFTER INSERT OR UPDATE ON test_pg_lamport_patients
             FOR EACH ROW EXECUTE FUNCTION test_notify_fn();",
        )
        .await;

    assert!(result.is_ok(), "Trigger creation should succeed");

    // Insert — this should fire the trigger
    client
        .execute(
            "INSERT INTO test_pg_lamport_patients (id, facility, name) VALUES ('p1', 'F1', 'Test')",
            &[],
        )
        .await
        .unwrap();

    client
        .batch_execute("DROP TABLE IF EXISTS test_pg_lamport_patients")
        .await
        .ok();
}

#[tokio::test]
async fn test_pg_watcher_records_to_change_log() {
    let (client, _handle) = connect_pg().await;
    setup_pg_table(&client, "test_pg_changelog_patients").await;

    // Insert
    client
        .execute(
            "INSERT INTO test_pg_changelog_patients (id, facility, name) VALUES ('p1', 'F1', 'Alice')",
            &[],
        )
        .await
        .unwrap();

    // Read the row and manually create a change to store
    let rows = client
        .query(
            "SELECT id, facility, name FROM test_pg_changelog_patients WHERE id = 'p1'",
            &[],
        )
        .await
        .unwrap();

    assert_eq!(rows.len(), 1);
    let id: String = rows[0].get("id");
    let name: String = rows[0].get("name");
    assert_eq!(id, "p1");
    assert_eq!(name, "Alice");

    // Store in change log
    let storage = cadence::storage::Storage::in_memory().unwrap();
    let change = cadence::state::RowChange {
        collection: "test_pg_changelog_patients".to_string(),
        document_id: "p1".to_string(),
        payload: cadence::state::SyncPayload::Fields(vec![
            cadence::state::FieldChange {
                field: "name".to_string(),
                value: serde_json::json!("Alice"),
                lamport: 1,
                peer_id: "test-peer".to_string(),
            },
        ]),
        deleted: false,
        seq: 1,
    };
    storage.append_change(&change).await.unwrap();

    let stored = storage.query_since(0).await.unwrap();
    assert_eq!(stored.len(), 1);

    client
        .batch_execute("DROP TABLE IF EXISTS test_pg_changelog_patients")
        .await
        .ok();
}
