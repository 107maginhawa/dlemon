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

/// Sync peer A (initiator) with peer B (acceptor).
async fn do_sync(a: &E2EPeer, b: &E2EPeer) {
    let addr_b = node_addr_direct(&b.endpoint);
    let engine_b = b.engine.clone();

    // We need to clone the endpoint for the acceptor spawn
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
async fn test_new_peer_gets_full_history() {
    let peer_a = E2EPeer::new().await;
    let peer_b = E2EPeer::new().await;

    // Peer A has 20 changes
    for i in 0..20 {
        peer_a.add_change(
            "medical_patients",
            &format!("patient-{}", i),
            "name",
            json!(format!("Patient {}", i)),
        ).await;
    }

    // Empty peer B syncs with A
    do_sync(&peer_a, &peer_b).await;

    // B should have all 20 changes
    let b_changes = peer_b.storage.query_since(0).await.unwrap();
    assert!(
        b_changes.len() >= 20,
        "Peer B should have all 20 changes, got {}",
        b_changes.len()
    );
}

#[tokio::test]
async fn test_new_peer_then_incremental() {
    let peer_a = E2EPeer::new().await;
    let peer_b = E2EPeer::new().await;

    // Add 10 changes to A
    for i in 0..10 {
        peer_a.add_change(
            "medical_patients",
            &format!("patient-{}", i),
            "name",
            json!(format!("Patient {}", i)),
        ).await;
    }

    // First sync: B gets 10
    do_sync(&peer_a, &peer_b).await;
    let b_changes_1 = peer_b.storage.query_since(0).await.unwrap();
    assert!(b_changes_1.len() >= 10, "B should have 10 after first sync, got {}", b_changes_1.len());

    // Add 5 more to A
    for i in 10..15 {
        peer_a.add_change(
            "medical_patients",
            &format!("patient-{}", i),
            "name",
            json!(format!("Patient {}", i)),
        ).await;
    }

    // Second sync: B should now have 15
    do_sync(&peer_a, &peer_b).await;
    let b_changes_2 = peer_b.storage.query_since(0).await.unwrap();
    assert!(
        b_changes_2.len() >= 15,
        "B should have 15 after second sync, got {}",
        b_changes_2.len()
    );
}

#[tokio::test]
async fn test_new_peer_joins_three_peer_mesh() {
    let peer_a = E2EPeer::new().await;
    let peer_b = E2EPeer::new().await;
    let peer_c = E2EPeer::new().await;
    let peer_d = E2EPeer::new().await;

    // A has data
    for i in 0..5 {
        peer_a.add_change("medical_patients", &format!("a-patient-{}", i), "name", json!(format!("A-{}", i))).await;
    }
    // B has data
    for i in 0..3 {
        peer_b.add_change("medical_patients", &format!("b-patient-{}", i), "name", json!(format!("B-{}", i))).await;
    }
    // C has data
    for i in 0..4 {
        peer_c.add_change("medical_patients", &format!("c-patient-{}", i), "name", json!(format!("C-{}", i))).await;
    }

    // Sync A↔B
    do_sync(&peer_a, &peer_b).await;
    // Sync B↔C (B now has A's data too)
    do_sync(&peer_b, &peer_c).await;

    // New peer D syncs with A → should get A+B's data (A got B's data in first sync)
    do_sync(&peer_d, &peer_a).await;

    let d_changes = peer_d.storage.query_since(0).await.unwrap();
    // D should have at least A's 5 + B's 3 = 8 changes (got through A)
    assert!(
        d_changes.len() >= 8,
        "Peer D should have A+B data (>= 8 changes), got {}",
        d_changes.len()
    );
}
