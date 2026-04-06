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

fn oneshot_change_rx() -> broadcast::Receiver<Vec<RowChange>> {
    let (tx, rx) = broadcast::channel(1);
    drop(tx);
    rx
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

#[tokio::test]
async fn test_three_peer_full_mesh_convergence() {
    let peer_a = E2EPeer::new().await;
    let peer_b = E2EPeer::new().await;
    let peer_c = E2EPeer::new().await;

    // Each peer has unique data
    peer_a.add_change("medical_patients", "pa1", "name", json!("Alice")).await;
    peer_a.add_change("medical_patients", "pa2", "name", json!("Bob")).await;

    peer_b.add_change("billing_invoices", "inv1", "status", json!("paid")).await;
    peer_b.add_change("billing_invoices", "inv2", "status", json!("draft")).await;

    peer_c.add_change("medical_patients", "pc1", "name", json!("Charlie")).await;
    peer_c.add_change("billing_invoices", "inv3", "status", json!("void")).await;

    // Full mesh sync: A↔B, B↔C, A↔C
    do_sync(&peer_a, &peer_b).await;
    do_sync(&peer_b, &peer_c).await;
    do_sync(&peer_a, &peer_c).await;

    // All peers should converge to the same data
    let a_changes = peer_a.storage.query_since(0).await.unwrap();
    let b_changes = peer_b.storage.query_since(0).await.unwrap();
    let c_changes = peer_c.storage.query_since(0).await.unwrap();

    // Each peer should have all 6 unique documents
    assert!(a_changes.len() >= 6, "A should have >= 6 changes, got {}", a_changes.len());
    assert!(b_changes.len() >= 6, "B should have >= 6 changes, got {}", b_changes.len());
    assert!(c_changes.len() >= 6, "C should have >= 6 changes, got {}", c_changes.len());
}

#[tokio::test]
async fn test_star_topology_via_central() {
    let central = E2EPeer::new().await;
    let edge1 = E2EPeer::new().await;
    let edge2 = E2EPeer::new().await;
    let edge3 = E2EPeer::new().await;

    // Each edge has unique data
    edge1.add_change("medical_patients", "e1-p1", "name", json!("Edge1-Patient")).await;
    edge2.add_change("medical_patients", "e2-p1", "name", json!("Edge2-Patient")).await;
    edge3.add_change("medical_patients", "e3-p1", "name", json!("Edge3-Patient")).await;

    // Round 1: each edge syncs with central
    do_sync(&edge1, &central).await;
    do_sync(&edge2, &central).await;
    do_sync(&edge3, &central).await;

    // Round 2: each edge syncs with central again to get others' data
    do_sync(&edge1, &central).await;
    do_sync(&edge2, &central).await;
    do_sync(&edge3, &central).await;

    // All edges should have all 3 patients
    let e1_changes = edge1.storage.query_since(0).await.unwrap();
    let e2_changes = edge2.storage.query_since(0).await.unwrap();
    let e3_changes = edge3.storage.query_since(0).await.unwrap();

    assert!(e1_changes.len() >= 3, "Edge1 should have >= 3 changes, got {}", e1_changes.len());
    assert!(e2_changes.len() >= 3, "Edge2 should have >= 3 changes, got {}", e2_changes.len());
    assert!(e3_changes.len() >= 3, "Edge3 should have >= 3 changes, got {}", e3_changes.len());
}

#[tokio::test]
async fn test_chain_propagation() {
    let peer_a = E2EPeer::new().await;
    let peer_b = E2EPeer::new().await;
    let peer_c = E2EPeer::new().await;

    // A has data
    peer_a.add_change("medical_patients", "chain-p1", "name", json!("Chain Patient")).await;
    peer_a.add_change("medical_patients", "chain-p2", "name", json!("Chain Patient 2")).await;

    // Chain: A→B, then B→C
    do_sync(&peer_a, &peer_b).await;
    do_sync(&peer_b, &peer_c).await;

    // C should have A's data (propagated through B)
    let c_changes = peer_c.storage.query_since(0).await.unwrap();
    assert!(
        c_changes.len() >= 2,
        "Peer C should have A's data via chain propagation, got {}",
        c_changes.len()
    );
}
