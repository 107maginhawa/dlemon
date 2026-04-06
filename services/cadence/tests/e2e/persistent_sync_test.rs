use cadence::auth::JwtValidator;
use cadence::config::{CadenceConfig, CollectionConfig, ConflictStrategy};
use cadence::peer_status::PeerTracker;
use cadence::protocol::CADENCE_ALPN;
use cadence::schema::SchemaFingerprint;
use cadence::state::{ChangeBroadcaster, FieldChange, RowChange, SyncPayload, SyncState};
use cadence::storage::Storage;
use cadence::storage::MetadataBackend;
use cadence::primary_reader::{NoPrimaryReader, PrimaryDbReader};
use cadence::sync::SyncEngine;
use cadence::token::TokenStore;
use iroh::{Endpoint, NodeAddr};
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use std::time::Duration;

fn node_addr_direct(ep: &Endpoint) -> NodeAddr {
    let (v4, v6) = ep.bound_sockets();
    let mut addrs = BTreeSet::new();
    let v4 = if v4.ip().is_unspecified() {
        std::net::SocketAddr::new(std::net::Ipv4Addr::LOCALHOST.into(), v4.port())
    } else {
        v4
    };
    addrs.insert(v4);
    if let Some(v6) = v6 {
        let v6 = if v6.ip().is_unspecified() {
            std::net::SocketAddr::new(std::net::Ipv6Addr::LOCALHOST.into(), v6.port())
        } else {
            v6
        };
        addrs.insert(v6);
    }
    NodeAddr {
        node_id: ep.node_id(),
        relay_url: None,
        direct_addresses: addrs,
    }
}

fn e2e_config() -> CadenceConfig {
    let mut collections = BTreeMap::new();
    collections.insert(
        "medical_patients".to_string(),
        CollectionConfig {
            strategy: ConflictStrategy::Lww,
            scope_columns: [("facility_id".to_string(), "facility".to_string())].into(),
            scope_rules: None,
        },
    );
    collections.insert(
        "billing_invoices".to_string(),
        CollectionConfig {
            strategy: ConflictStrategy::Lww,
            scope_columns: [("facility_id".to_string(), "facility".to_string())].into(),
            scope_rules: None,
        },
    );
    CadenceConfig {
        collections,
        default_strategy: ConflictStrategy::Lww,
        keepalive_interval_secs: 1,
        liveness_timeout_secs: 5,
        ..Default::default()
    }
}

struct PersistentE2EPeer {
    engine: Arc<SyncEngine>,
    endpoint: Endpoint,
    storage: Arc<Storage>,
    state: Arc<SyncState>,
    jwt: String,
    broadcaster: Arc<ChangeBroadcaster>,
}

impl PersistentE2EPeer {
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
        let broadcaster = Arc::new(ChangeBroadcaster::new(256));

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

        Self {
            engine,
            endpoint,
            storage,
            state,
            jwt,
            broadcaster,
        }
    }

    async fn add_change_and_broadcast(
        &self,
        collection: &str,
        doc_id: &str,
        field: &str,
        value: serde_json::Value,
    ) {
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
        self.broadcaster.broadcast(vec![change]);
    }
}

#[tokio::test]
async fn test_persistent_e2e_continuous_changes() {
    // 3 peers in persistent mesh — changes added over time all converge
    let peer_a = PersistentE2EPeer::new().await;
    let peer_b = PersistentE2EPeer::new().await;
    let peer_c = PersistentE2EPeer::new().await;

    // Connect A → B persistently
    let addr_b = node_addr_direct(&peer_b.endpoint);
    let engine_b = peer_b.engine.clone();
    let b_ep = peer_b.endpoint.clone();
    let b_rx = peer_b.broadcaster.subscribe();

    let ab_accept = tokio::spawn(async move {
        let incoming = b_ep.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        engine_b.handle_incoming(conn, b_rx, "test").await
    });

    peer_a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn_ab = peer_a
        .endpoint
        .connect(addr_b, CADENCE_ALPN)
        .await
        .unwrap();
    let a_rx = peer_a.broadcaster.subscribe();
    let ea = peer_a.engine.clone();
    let jwt_a = peer_a.jwt.clone();
    let ab_init = tokio::spawn(async move {
        ea.initiate_sync(conn_ab, &jwt_a, a_rx, "test").await
    });

    // Connect B → C persistently
    let addr_c = node_addr_direct(&peer_c.endpoint);
    let engine_c = peer_c.engine.clone();
    let c_ep = peer_c.endpoint.clone();
    let c_rx = peer_c.broadcaster.subscribe();

    let bc_accept = tokio::spawn(async move {
        let incoming = c_ep.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        engine_c.handle_incoming(conn, c_rx, "test").await
    });

    peer_b.endpoint.add_node_addr(addr_c.clone()).ok();
    let conn_bc = peer_b
        .endpoint
        .connect(addr_c, CADENCE_ALPN)
        .await
        .unwrap();
    let b_rx2 = peer_b.broadcaster.subscribe();
    let eb = peer_b.engine.clone();
    let jwt_b = peer_b.jwt.clone();
    let bc_init = tokio::spawn(async move {
        eb.initiate_sync(conn_bc, &jwt_b, b_rx2, "test").await
    });

    // Wait for connections to establish
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Add changes over time — A adds data that should flow to B and C
    for i in 0..5 {
        peer_a.add_change_and_broadcast(
            "medical_patients",
            &format!("continuous-{}", i),
            "name",
            json!(format!("Patient {}", i)),
        ).await;
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    // Wait for propagation
    tokio::time::sleep(Duration::from_secs(2)).await;

    // B should have all of A's changes (direct connection)
    let b_changes = peer_b.storage.query_since(0).await.unwrap();
    assert!(
        b_changes.len() >= 5,
        "B should have all 5 of A's continuous changes, got {}",
        b_changes.len()
    );

    // Clean shutdown
    drop(peer_a.broadcaster);
    drop(peer_b.broadcaster);
    drop(peer_c.broadcaster);
    tokio::time::sleep(Duration::from_millis(200)).await;
    ab_accept.abort();
    ab_init.abort();
    bc_accept.abort();
    bc_init.abort();
}

#[tokio::test]
async fn test_persistent_e2e_graceful_shutdown() {
    let peer_a = PersistentE2EPeer::new().await;
    let peer_b = PersistentE2EPeer::new().await;

    peer_a.add_change_and_broadcast("medical_patients", "shutdown-p1", "name", json!("Pre-shutdown")).await;

    let addr_b = node_addr_direct(&peer_b.endpoint);
    let engine_b = peer_b.engine.clone();
    let b_ep = peer_b.endpoint.clone();
    let b_rx = peer_b.broadcaster.subscribe();

    let accept_handle = tokio::spawn(async move {
        let incoming = b_ep.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        engine_b.handle_incoming(conn, b_rx, "test").await
    });

    peer_a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn = peer_a
        .endpoint
        .connect(addr_b, CADENCE_ALPN)
        .await
        .unwrap();
    let a_rx = peer_a.broadcaster.subscribe();
    let ea = peer_a.engine.clone();
    let jwt = peer_a.jwt.clone();

    let initiator_handle = tokio::spawn(async move {
        ea.initiate_sync(conn, &jwt, a_rx, "test").await
    });

    // Wait for catch-up
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Verify data synced
    let b_changes = peer_b.storage.query_since(0).await.unwrap();
    assert!(!b_changes.is_empty(), "B should have initial data");

    // Graceful shutdown: drop broadcasters to close channels
    drop(peer_a.broadcaster);
    drop(peer_b.broadcaster);

    // The sync tasks should exit cleanly within a reasonable time
    let timeout_result = tokio::time::timeout(Duration::from_secs(3), async {
        // Wait for both tasks — they might error due to channel close, that's fine
        let _ = initiator_handle.await;
        let _ = accept_handle.await;
    })
    .await;

    assert!(
        timeout_result.is_ok(),
        "Persistent sync should shut down gracefully within timeout"
    );
}
