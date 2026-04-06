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

fn chaos_config() -> CadenceConfig {
    let mut collections = BTreeMap::new();
    collections.insert("medical_patients".to_string(), CollectionConfig {
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

fn oneshot_change_rx() -> broadcast::Receiver<Vec<RowChange>> {
    let (tx, rx) = broadcast::channel(1);
    drop(tx);
    rx
}

struct ChaosPeer {
    engine: Arc<SyncEngine>,
    endpoint: Endpoint,
    storage: Arc<Storage>,
    state: Arc<SyncState>,
    jwt: String,
}

impl ChaosPeer {
    async fn new() -> Self {
        let config = chaos_config();
        let endpoint = Endpoint::builder()
            .alpns(vec![CADENCE_ALPN.to_vec()])
            .discovery_local_network()
            .bind()
            .await
            .unwrap();

        let peer_id = endpoint.node_id().to_string();
        let storage = Arc::new(Storage::in_memory().unwrap());
        let state = Arc::new(SyncState::new());

        let key = jsonwebtoken::DecodingKey::from_secret(b"chaos-test-secret");
        let validator = Arc::new(JwtValidator::permissive(key));

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let jwt = jsonwebtoken::encode(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
            &serde_json::json!({
                "sub": "chaos-user",
                "aud": "cadence-sync",
                "exp": now + 3600,
                "scopes": {"facility_id": ["*"]},
                "read_only": false
            }),
            &jsonwebtoken::EncodingKey::from_secret(b"chaos-test-secret"),
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

async fn do_sync(a: &ChaosPeer, b: &ChaosPeer) {
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

#[tokio::test]
async fn test_partition_then_recovery() {
    let peer_a = ChaosPeer::new().await;
    let peer_b = ChaosPeer::new().await;

    // Initial sync with some data
    peer_a.add_change("medical_patients", "p1", "name", json!("Initial Patient")).await;
    do_sync(&peer_a, &peer_b).await;

    // Simulate partition: both sides add data without syncing
    peer_a.add_change("medical_patients", "p2", "name", json!("A-only Patient")).await;
    peer_b.add_change("medical_patients", "p3", "name", json!("B-only Patient")).await;

    // Recovery: sync again
    do_sync(&peer_a, &peer_b).await;

    // Both should have all 3 patients
    let a_changes = peer_a.storage.query_since(0).await.unwrap();
    let b_changes = peer_b.storage.query_since(0).await.unwrap();

    assert!(a_changes.len() >= 3, "A should have all 3 patients after recovery, got {}", a_changes.len());
    assert!(b_changes.len() >= 3, "B should have all 3 patients after recovery, got {}", b_changes.len());
}

#[tokio::test]
async fn test_three_peer_split_brain() {
    let peer_a = ChaosPeer::new().await;
    let peer_b = ChaosPeer::new().await;
    let peer_c = ChaosPeer::new().await;

    // Initial full mesh sync with shared data
    peer_a.add_change("medical_patients", "shared-1", "name", json!("Shared Patient")).await;
    do_sync(&peer_a, &peer_b).await;
    do_sync(&peer_b, &peer_c).await;

    // Partition: {A} vs {B, C}
    peer_a.add_change("medical_patients", "a-split-1", "name", json!("A Split Patient")).await;
    peer_a.add_change("medical_patients", "a-split-2", "name", json!("A Split Patient 2")).await;

    peer_b.add_change("medical_patients", "bc-split-1", "name", json!("BC Split Patient")).await;
    peer_c.add_change("medical_patients", "bc-split-2", "name", json!("BC Split Patient 2")).await;
    do_sync(&peer_b, &peer_c).await;

    // Reunite: A↔B sync
    do_sync(&peer_a, &peer_b).await;

    let a_changes = peer_a.storage.query_since(0).await.unwrap();
    assert!(
        a_changes.len() >= 5,
        "A should have all 5 patients after reunion, got {}",
        a_changes.len()
    );

    let b_changes = peer_b.storage.query_since(0).await.unwrap();
    assert!(
        b_changes.len() >= 5,
        "B should have all 5 patients after reunion, got {}",
        b_changes.len()
    );
}

#[tokio::test]
async fn test_partition_no_data_loss() {
    let peer_a = ChaosPeer::new().await;
    let peer_b = ChaosPeer::new().await;

    // A has 50 records
    for i in 0..50 {
        peer_a.add_change(
            "medical_patients",
            &format!("patient-{}", i),
            "name",
            json!(format!("Patient {}", i)),
        ).await;
    }

    // First sync
    do_sync(&peer_a, &peer_b).await;

    let b_count_1 = peer_b.storage.query_since(0).await.unwrap().len();
    assert!(b_count_1 >= 50, "B should have 50 after first sync, got {}", b_count_1);

    // Partition: A adds 50 more
    for i in 50..100 {
        peer_a.add_change(
            "medical_patients",
            &format!("patient-{}", i),
            "name",
            json!(format!("Patient {}", i)),
        ).await;
    }

    // Recovery sync
    do_sync(&peer_a, &peer_b).await;

    // Both should have 100
    let a_count = peer_a.storage.query_since(0).await.unwrap().len();
    let b_count = peer_b.storage.query_since(0).await.unwrap().len();

    assert!(a_count >= 100, "A should have 100 records, got {}", a_count);
    assert!(b_count >= 100, "B should have 100 records, got {}", b_count);
}
