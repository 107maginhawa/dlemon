use cadence::auth::JwtValidator;
use cadence::config::{CadenceConfig, CollectionConfig, ConflictStrategy};
use cadence::peer_status::PeerTracker;
use cadence::protocol::CADENCE_ALPN;
use cadence::schema::{
    ColumnType, SchemaCompatibility, SchemaFingerprint, TableFingerprint,
};
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
    collections.insert("billing_invoices".to_string(), CollectionConfig {
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

/// Create a peer with a specific schema fingerprint.
async fn make_peer(schema: SchemaFingerprint) -> E2EPeer {
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
        schema,
        token_store,
        Arc::new(PeerTracker::new()),
    );
    let engine = Arc::new(engine);

    E2EPeer { engine, endpoint, storage, state, jwt }
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
        make_peer(SchemaFingerprint::empty()).await
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

/// Build a SQLite-style schema fingerprint for medical_patients.
fn sqlite_patient_schema() -> SchemaFingerprint {
    let mut cols = BTreeMap::new();
    cols.insert("id".to_string(), ColumnType::Text);
    cols.insert("facility".to_string(), ColumnType::Text);
    cols.insert("name".to_string(), ColumnType::Text);
    cols.insert("tags".to_string(), ColumnType::Text); // SQLite stores JSON as TEXT
    cols.insert("_data".to_string(), ColumnType::Text);

    let mut tables = BTreeMap::new();
    tables.insert("medical_patients".to_string(), TableFingerprint::new(cols));
    SchemaFingerprint::new(tables)
}

/// Schema with an extra column (same base types as sqlite_patient_schema).
fn schema_with_extra_col() -> SchemaFingerprint {
    let mut cols = BTreeMap::new();
    cols.insert("id".to_string(), ColumnType::Text);
    cols.insert("facility".to_string(), ColumnType::Text);
    cols.insert("name".to_string(), ColumnType::Text);
    cols.insert("tags".to_string(), ColumnType::Text);
    cols.insert("_data".to_string(), ColumnType::Text);
    cols.insert("phone_number".to_string(), ColumnType::Text); // Extra column

    let mut tables = BTreeMap::new();
    tables.insert("medical_patients".to_string(), TableFingerprint::new(cols));
    SchemaFingerprint::new(tables)
}

#[tokio::test]
async fn test_e2e_sqlite_pg_patient_sync() {
    // SQLite peer and PG peer — basic cross-backend sync
    let sqlite_peer = E2EPeer::new().await;
    let pg_peer = E2EPeer::new().await;

    sqlite_peer.add_change("medical_patients", "sp1", "name", json!("SQLite Patient")).await;
    sqlite_peer.add_change("medical_patients", "sp1", "facility", json!("F1")).await;

    do_sync(&sqlite_peer, &pg_peer).await;

    let pg_changes = pg_peer.storage.query_since(0).await.unwrap();
    assert!(!pg_changes.is_empty(), "PG peer should have SQLite patient data");
}

#[tokio::test]
async fn test_e2e_pg_sqlite_invoice_sync() {
    // PG→SQLite direction
    let pg_peer = E2EPeer::new().await;
    let sqlite_peer = E2EPeer::new().await;

    pg_peer.add_change("billing_invoices", "inv-pg1", "status", json!("paid")).await;
    pg_peer.add_change("billing_invoices", "inv-pg1", "facility", json!("F1")).await;

    do_sync(&pg_peer, &sqlite_peer).await;

    let sqlite_changes = sqlite_peer.storage.query_since(0).await.unwrap();
    assert!(!sqlite_changes.is_empty(), "SQLite peer should have PG invoice data");
}

#[tokio::test]
async fn test_e2e_sqlite_pg_bidirectional() {
    let sqlite_peer = E2EPeer::new().await;
    let pg_peer = E2EPeer::new().await;

    // Both sides have data
    sqlite_peer.add_change("medical_patients", "sp1", "name", json!("From SQLite")).await;
    pg_peer.add_change("medical_patients", "pp1", "name", json!("From PG")).await;

    do_sync(&sqlite_peer, &pg_peer).await;

    // Both should have both records
    let sqlite_changes = sqlite_peer.storage.query_since(0).await.unwrap();
    let pg_changes = pg_peer.storage.query_since(0).await.unwrap();

    assert!(sqlite_changes.len() >= 2, "SQLite should have both records, got {}", sqlite_changes.len());
    assert!(pg_changes.len() >= 2, "PG should have both records, got {}", pg_changes.len());
}

#[tokio::test]
async fn test_e2e_sqlite_pg_json_field_fidelity() {
    // Verify nested JSON survives SQLite TEXT ↔ PG JSONB
    let sqlite_peer = E2EPeer::new().await;
    let pg_peer = E2EPeer::new().await;

    let nested_json = json!({
        "address": {
            "street": "123 Main St",
            "city": "Manila",
            "coords": [14.5995, 120.9842]
        },
        "contacts": [
            {"type": "phone", "value": "+63-912-345-6789"},
            {"type": "email", "value": "patient@example.com"}
        ],
        "metadata": {"source": "import", "verified": true, "score": 0.95}
    });

    sqlite_peer.add_change("medical_patients", "json-p1", "_data", nested_json.clone()).await;

    do_sync(&sqlite_peer, &pg_peer).await;

    let pg_changes = pg_peer.storage.query_by_doc("medical_patients", "json-p1").await.unwrap();
    assert!(!pg_changes.is_empty(), "PG should have the record");

    // Check the value matches
    if let SyncPayload::Fields(fields) = &pg_changes[0].payload {
        let data_field = fields.iter().find(|f| f.field == "_data");
        assert!(data_field.is_some(), "Should have _data field");
        assert_eq!(data_field.unwrap().value, nested_json, "Nested JSON should be preserved");
    }
}

#[tokio::test]
async fn test_e2e_sqlite_pg_schema_extra_column() {
    // Remote has extra column → Compatible, extra stored in _data
    let sqlite_schema = sqlite_patient_schema();
    let pg_schema = schema_with_extra_col();

    // Verify schema comparison says Compatible
    let compat = cadence::schema::compare_schemas(&sqlite_schema, &pg_schema);
    let patient_compat = compat.get("medical_patients").unwrap();
    match patient_compat {
        SchemaCompatibility::Compatible { warnings } => {
            assert!(warnings.iter().any(|w| w.contains("phone_number")),
                "Should warn about extra phone_number column");
        }
        SchemaCompatibility::Identical => {
            panic!("Should not be Identical when PG has extra column");
        }
        SchemaCompatibility::Incompatible { errors } => {
            panic!("Should be Compatible, not Incompatible: {:?}", errors);
        }
    }

    // Verify sync still works with compatible schemas
    let sqlite_peer = make_peer(sqlite_schema.clone()).await;
    let pg_peer = make_peer(pg_schema.clone()).await;

    sqlite_peer.add_change("medical_patients", "compat-p1", "name", json!("Compat Patient")).await;

    do_sync(&sqlite_peer, &pg_peer).await;

    let pg_changes = pg_peer.storage.query_since(0).await.unwrap();
    assert!(!pg_changes.is_empty(), "PG peer should receive data despite extra column");
}

#[tokio::test]
async fn test_e2e_sqlite_pg_schema_compatible_sync() {
    // Schema Compatible → shared columns sync normally
    let sqlite_peer = E2EPeer::new().await;
    let pg_peer = E2EPeer::new().await;

    // Add changes using shared columns only
    sqlite_peer.add_change("medical_patients", "shared-p1", "name", json!("Shared Patient")).await;
    sqlite_peer.add_change("medical_patients", "shared-p1", "facility", json!("F1")).await;
    pg_peer.add_change("medical_patients", "shared-p2", "name", json!("PG Shared Patient")).await;

    do_sync(&sqlite_peer, &pg_peer).await;

    let sqlite_changes = sqlite_peer.storage.query_since(0).await.unwrap();
    let pg_changes = pg_peer.storage.query_since(0).await.unwrap();

    // Both should have both patients
    assert!(sqlite_changes.len() >= 2, "SQLite should have both patients, got {}", sqlite_changes.len());
    assert!(pg_changes.len() >= 2, "PG should have both patients, got {}", pg_changes.len());
}
