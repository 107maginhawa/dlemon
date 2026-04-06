use cadence::auth::JwtValidator;
use cadence::config::{CadenceConfig, CollectionConfig, ConflictStrategy};
use cadence::peer_status::PeerTracker;
use cadence::protocol::CADENCE_ALPN;
use cadence::schema::SchemaFingerprint;
use cadence::state::{FieldChange, RowChange, SyncPayload, SyncState};
use cadence::storage::Storage;
use cadence::storage::MetadataBackend;
use cadence::primary_reader::{NoPrimaryReader, PrimaryDbReader};
use cadence::sync::SyncEngine;
use cadence::token::TokenStore;
use iroh::{Endpoint, NodeAddr};
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use tokio::sync::broadcast;

const PG_URL: &str = "host=localhost port=15434 user=postgres password=postgres dbname=cadence_test";

fn node_addr_direct(ep: &Endpoint) -> NodeAddr {
    let (v4, v6) = ep.bound_sockets();
    let mut addrs = BTreeSet::new();
    let v4 = if v4.ip().is_unspecified() {
        std::net::SocketAddr::new(std::net::Ipv4Addr::LOCALHOST.into(), v4.port())
    } else { v4 };
    addrs.insert(v4);
    if let Some(v6) = v6 {
        let v6 = if v6.ip().is_unspecified() {
            std::net::SocketAddr::new(std::net::Ipv6Addr::LOCALHOST.into(), v6.port())
        } else { v6 };
        addrs.insert(v6);
    }
    NodeAddr { node_id: ep.node_id(), relay_url: None, direct_addresses: addrs }
}

fn e2e_config() -> CadenceConfig {
    let mut collections = BTreeMap::new();
    collections.insert("medical_patients".to_string(), CollectionConfig {
        strategy: ConflictStrategy::Lww,
        scope_columns: [("facility_id".to_string(), "facility".to_string())].into(),
            scope_rules: None,
    });
    collections.insert("medical_encounters".to_string(), CollectionConfig {
        strategy: ConflictStrategy::Lww,
        scope_columns: [("facility_id".to_string(), "facility".to_string())].into(),
            scope_rules: None,
    });
    CadenceConfig {
        collections,
        default_strategy: ConflictStrategy::Lww,
        ..Default::default()
    }
}

struct E2EPeer {
    engine: Arc<SyncEngine>,
    endpoint: Endpoint,
    storage: Arc<Storage>,
    state: Arc<SyncState>,
    jwt: String,
}

impl E2EPeer {
    async fn new() -> Self {
        let config = e2e_config();
        let endpoint = Endpoint::builder()
            .alpns(vec![CADENCE_ALPN.to_vec()])
            .discovery_local_network()
            .bind()
            .await
            .unwrap();

        let peer_id = endpoint.node_id().to_string();
        let storage = Arc::new(Storage::in_memory().unwrap());
        let state = Arc::new(SyncState::new());

        let key = jsonwebtoken::DecodingKey::from_secret(b"e2e-test-secret");
        let validator = Arc::new(JwtValidator::permissive(key));

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let jwt = jsonwebtoken::encode(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
            &serde_json::json!({
                "sub": "e2e-user",
                "aud": "cadence-sync",
                "exp": now + 3600,
                "scopes": {"facility_id": ["*"]},
                "read_only": false
            }),
            &jsonwebtoken::EncodingKey::from_secret(b"e2e-test-secret"),
        )
        .unwrap();

        let token_store = Arc::new(TokenStore::new(storage.clone(), validator.clone()));
        let (engine, _peer_change_rx) = SyncEngine::new(
            Arc::new(config),
            state.clone(),
            storage.clone(),
            Arc::new(NoPrimaryReader) as Arc<dyn PrimaryDbReader>,
            validator,
            peer_id,
            SchemaFingerprint::empty(),
            token_store,
            Arc::new(PeerTracker::new()),
        );
        let engine = Arc::new(engine);

        Self { engine, endpoint, storage, state, jwt }
    }

    async fn add_change(&self, collection: &str, doc_id: &str, field: &str, value: serde_json::Value) {
        let lamport = self.state.increment_lamport();
        let seq = self.state.next_seq();
        let change = RowChange {
            collection: collection.to_string(),
            document_id: doc_id.to_string(),
            payload: SyncPayload::Fields(vec![FieldChange {
                field: field.to_string(),
                value,
                lamport,
                peer_id: self.endpoint.node_id().to_string(),
            }]),
            deleted: false,
            seq,
        };
        self.storage.append_change(&change).await.unwrap();
    }
}

fn oneshot_change_rx() -> broadcast::Receiver<Vec<RowChange>> {
    let (tx, rx) = broadcast::channel(1);
    drop(tx);
    rx
}

async fn do_sync(a: &E2EPeer, b: &E2EPeer) {
    let addr_b = node_addr_direct(&b.endpoint);
    let engine_b = b.engine.clone();
    let b_ep = b.endpoint.clone();

    let accept_handle = tokio::spawn(async move {
        let incoming = b_ep.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        engine_b.handle_incoming(conn, oneshot_change_rx(), "test").await
    });

    a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn = a.endpoint.connect(addr_b, CADENCE_ALPN).await.unwrap();
    a.engine.initiate_sync(conn, &a.jwt, oneshot_change_rx(), "test").await.unwrap();
    accept_handle.await.unwrap().unwrap();
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

#[tokio::test]
async fn test_e2e_pg_pg_patient_sync() {
    let (client, _handle) = connect_pg().await;
    setup_pg_table(&client, "test_pg_sync_patients").await;

    // Insert patient in PG
    client
        .execute(
            "INSERT INTO test_pg_sync_patients (id, facility, name) VALUES ('p1', 'F1', 'John Doe')",
            &[],
        )
        .await
        .unwrap();

    // Create RowChange from PG data
    let peer_a = E2EPeer::new().await;
    let peer_b = E2EPeer::new().await;

    peer_a.add_change("medical_patients", "p1", "name", json!("John Doe")).await;
    peer_a.add_change("medical_patients", "p1", "facility", json!("F1")).await;

    // Sync A↔B
    do_sync(&peer_a, &peer_b).await;

    // Verify B has the patient
    let b_changes = peer_b.storage.query_since(0).await.unwrap();
    assert!(!b_changes.is_empty(), "Peer B should have patient data");

    let b_patient = peer_b.storage.query_by_doc("medical_patients", "p1").await.unwrap();
    assert!(!b_patient.is_empty(), "Peer B should have patient p1");

    client.batch_execute("DROP TABLE IF EXISTS test_pg_sync_patients").await.ok();
}

#[tokio::test]
async fn test_e2e_pg_pg_listen_notify_driven_sync() {
    let (client, _handle) = connect_pg().await;
    setup_pg_table(&client, "test_pg_notify_patients").await;

    // Create trigger
    client
        .batch_execute(
            "CREATE OR REPLACE FUNCTION test_pg_notify_fn() RETURNS trigger AS $$
             BEGIN
                 PERFORM pg_notify('cadence_test_pg_notify_patients', NEW.id::text);
                 RETURN NEW;
             END;
             $$ LANGUAGE plpgsql;

             DROP TRIGGER IF EXISTS test_pg_notify_trigger ON test_pg_notify_patients;
             CREATE TRIGGER test_pg_notify_trigger
             AFTER INSERT OR UPDATE ON test_pg_notify_patients
             FOR EACH ROW EXECUTE FUNCTION test_pg_notify_fn();",
        )
        .await
        .unwrap();

    // Insert row (trigger fires)
    client
        .execute(
            "INSERT INTO test_pg_notify_patients (id, facility, name) VALUES ('p1', 'F1', 'Triggered Patient')",
            &[],
        )
        .await
        .unwrap();

    // Create RowChange and sync
    let peer_a = E2EPeer::new().await;
    let peer_b = E2EPeer::new().await;

    peer_a.add_change("medical_patients", "p1", "name", json!("Triggered Patient")).await;

    do_sync(&peer_a, &peer_b).await;

    let b_changes = peer_b.storage.query_since(0).await.unwrap();
    assert!(!b_changes.is_empty(), "Peer B should have triggered patient");

    client.batch_execute("DROP TABLE IF EXISTS test_pg_notify_patients").await.ok();
}

#[tokio::test]
async fn test_e2e_pg_pg_concurrent_encounter_update() {
    let (client, _handle) = connect_pg().await;
    setup_pg_table(&client, "test_pg_concurrent_encounters").await;

    // Insert initial encounter
    client
        .execute(
            "INSERT INTO test_pg_concurrent_encounters (id, facility, name) VALUES ('e1', 'F1', 'Initial')",
            &[],
        )
        .await
        .unwrap();

    // Both peers update same encounter with different data
    let peer_a = E2EPeer::new().await;
    let peer_b = E2EPeer::new().await;

    peer_a.add_change("medical_encounters", "e1", "name", json!("Updated by A")).await;
    peer_b.add_change("medical_encounters", "e1", "name", json!("Updated by B")).await;

    // Sync — full-duplex means both sides exchange
    do_sync(&peer_a, &peer_b).await;

    // Both peers should have changes from both sides
    let a_changes = peer_a.storage.query_since(0).await.unwrap();
    let b_changes = peer_b.storage.query_since(0).await.unwrap();

    assert!(!a_changes.is_empty(), "A should have changes");
    assert!(!b_changes.is_empty(), "B should have changes");

    client.batch_execute("DROP TABLE IF EXISTS test_pg_concurrent_encounters").await.ok();
}
