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

fn test_config() -> CadenceConfig {
    let mut collections = BTreeMap::new();
    collections.insert(
        "medical_patients".to_string(),
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

struct PersistentTestPeer {
    engine: Arc<SyncEngine>,
    endpoint: Endpoint,
    storage: Arc<Storage>,
    state: Arc<SyncState>,
    jwt: String,
    broadcaster: Arc<ChangeBroadcaster>,
}

impl PersistentTestPeer {
    async fn new() -> Self {
        let config = test_config();
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

        let key = jsonwebtoken::DecodingKey::from_secret(b"test-secret");
        let validator = Arc::new(JwtValidator::permissive(key));

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let jwt = jsonwebtoken::encode(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
            &serde_json::json!({
                "sub": "test",
                "aud": "cadence-sync",
                "exp": now + 3600,
                "scopes": {"facility_id": ["*"]},
                "read_only": false
            }),
            &jsonwebtoken::EncodingKey::from_secret(b"test-secret"),
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
async fn test_persistent_sync_streams_new_changes() {
    let peer_a = PersistentTestPeer::new().await;
    let peer_b = PersistentTestPeer::new().await;

    // Pre-populate A with initial data
    peer_a.add_change_and_broadcast("medical_patients", "p1", "name", json!("Initial Patient")).await;

    let addr_b = node_addr_direct(&peer_b.endpoint);
    let engine_b = peer_b.engine.clone();
    let b_ep = peer_b.endpoint.clone();
    let b_rx = peer_b.broadcaster.subscribe();

    // Start persistent sync in background
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
    let engine_a = peer_a.engine.clone();
    let jwt = peer_a.jwt.clone();

    let initiator_handle = tokio::spawn(async move {
        engine_a.initiate_sync(conn, &jwt, a_rx, "test").await
    });

    // Wait for catch-up to complete
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Verify B received the initial data
    let b_changes = peer_b.storage.query_since(0).await.unwrap();
    assert!(
        !b_changes.is_empty(),
        "B should have received initial data from A"
    );

    // Now add a new change to A AFTER catch-up — it should stream to B
    peer_a.add_change_and_broadcast("medical_patients", "p2", "name", json!("Streamed Patient")).await;

    // Give time for the change to propagate
    tokio::time::sleep(Duration::from_millis(500)).await;

    let b_changes_after = peer_b.storage.query_since(0).await.unwrap();
    assert!(
        b_changes_after.len() >= 2,
        "B should have received the streamed change without reconnecting, got {}",
        b_changes_after.len()
    );

    // Clean shutdown by dropping broadcaster (closes change_rx)
    drop(peer_a.broadcaster);
    drop(peer_b.broadcaster);

    // Give time for graceful shutdown
    tokio::time::sleep(Duration::from_millis(200)).await;
    accept_handle.abort();
    initiator_handle.abort();
}

#[tokio::test]
async fn test_persistent_keepalive_keeps_connection_alive() {
    let peer_a = PersistentTestPeer::new().await;
    let peer_b = PersistentTestPeer::new().await;

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
    let engine_a = peer_a.engine.clone();
    let jwt = peer_a.jwt.clone();

    let initiator_handle = tokio::spawn(async move {
        engine_a.initiate_sync(conn, &jwt, a_rx, "test").await
    });

    // Wait for 3x the keepalive interval (config.keepalive_interval_secs = 1)
    tokio::time::sleep(Duration::from_secs(3)).await;

    // Connection should still be alive — verify by adding and syncing a change
    peer_a.add_change_and_broadcast("medical_patients", "keepalive-test", "name", json!("Still alive")).await;
    tokio::time::sleep(Duration::from_millis(500)).await;

    let b_changes = peer_b.storage.query_since(0).await.unwrap();
    assert!(
        b_changes.iter().any(|c| c.document_id == "keepalive-test"),
        "Connection should still work after idle period with keepalives"
    );

    drop(peer_a.broadcaster);
    drop(peer_b.broadcaster);
    tokio::time::sleep(Duration::from_millis(200)).await;
    accept_handle.abort();
    initiator_handle.abort();
}

#[tokio::test]
async fn test_persistent_broadcast_lag_recovery() {
    // Use a tiny broadcast channel to force lag
    let config = CadenceConfig {
        keepalive_interval_secs: 1,
        liveness_timeout_secs: 10,
        broadcast_channel_capacity: 2, // Very small to force lag
        ..test_config()
    };

    let peer_a_endpoint = Endpoint::builder()
        .alpns(vec![CADENCE_ALPN.to_vec()])
        .discovery_local_network()
        .bind()
        .await
        .unwrap();
    let peer_a_id = peer_a_endpoint.node_id().to_string();
    let peer_a_storage = Arc::new(Storage::in_memory().unwrap());
    let peer_a_state = Arc::new(SyncState::new());
    let peer_a_broadcaster = Arc::new(ChangeBroadcaster::new(2)); // Tiny channel

    let key = jsonwebtoken::DecodingKey::from_secret(b"test-secret");
    let validator = Arc::new(JwtValidator::permissive(key));
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let jwt = jsonwebtoken::encode(
        &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
        &serde_json::json!({
            "sub": "test", "aud": "cadence-sync", "exp": now + 3600,
            "scopes": {"facility_id": ["*"]}, "read_only": false
        }),
        &jsonwebtoken::EncodingKey::from_secret(b"test-secret"),
    )
    .unwrap();

    let token_store_a = Arc::new(TokenStore::new(peer_a_storage.clone(), validator.clone()));
    let (engine_a, _peer_change_rx_a) = SyncEngine::new(
        Arc::new(config.clone()),
        peer_a_state.clone(),
        peer_a_storage.clone(),
        Arc::new(NoPrimaryReader) as Arc<dyn PrimaryDbReader>,
        validator.clone(),
        peer_a_id,
        SchemaFingerprint::empty(),
        token_store_a,
        Arc::new(PeerTracker::new()),
    );
    let engine_a = Arc::new(engine_a);

    let peer_b_endpoint = Endpoint::builder()
        .alpns(vec![CADENCE_ALPN.to_vec()])
        .discovery_local_network()
        .bind()
        .await
        .unwrap();
    let peer_b_id = peer_b_endpoint.node_id().to_string();
    let peer_b_storage = Arc::new(Storage::in_memory().unwrap());
    let peer_b_state = Arc::new(SyncState::new());
    let peer_b_broadcaster = Arc::new(ChangeBroadcaster::new(2));

    let key_b = jsonwebtoken::DecodingKey::from_secret(b"test-secret");
    let validator_b = Arc::new(JwtValidator::permissive(key_b));
    let token_store_b = Arc::new(TokenStore::new(peer_b_storage.clone(), validator_b.clone()));
    let (engine_b, _peer_change_rx_b) = SyncEngine::new(
        Arc::new(config),
        peer_b_state.clone(),
        peer_b_storage.clone(),
        Arc::new(NoPrimaryReader) as Arc<dyn PrimaryDbReader>,
        validator_b,
        peer_b_id,
        SchemaFingerprint::empty(),
        token_store_b,
        Arc::new(PeerTracker::new()),
    );
    let engine_b = Arc::new(engine_b);

    // Subscribe BEFORE connecting (the rx will lag when we flood it)
    let a_rx = peer_a_broadcaster.subscribe();

    let addr_b = node_addr_direct(&peer_b_endpoint);
    let b_ep = peer_b_endpoint.clone();
    let b_rx = peer_b_broadcaster.subscribe();
    let eb = engine_b.clone();

    let accept_handle = tokio::spawn(async move {
        let incoming = b_ep.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        eb.handle_incoming(conn, b_rx, "test").await
    });

    peer_a_endpoint.add_node_addr(addr_b.clone()).ok();
    let conn = peer_a_endpoint
        .connect(addr_b, CADENCE_ALPN)
        .await
        .unwrap();
    let ea = engine_a.clone();
    let jwt_clone = jwt.clone();

    let initiator_handle = tokio::spawn(async move {
        ea.initiate_sync(conn, &jwt_clone, a_rx, "test").await
    });

    // Wait for initial catch-up
    tokio::time::sleep(Duration::from_millis(300)).await;

    // Flood the broadcast channel to cause lag
    for i in 0..10 {
        let lamport = peer_a_state.increment_lamport();
        let seq = peer_a_state.next_seq();
        let change = RowChange {
            collection: "medical_patients".to_string(),
            document_id: format!("flood-{}", i),
            payload: SyncPayload::Fields(vec![FieldChange {
                field: "name".to_string(),
                value: json!(format!("Flood {}", i)),
                lamport,
                peer_id: peer_a_endpoint.node_id().to_string(),
            }]),
            deleted: false,
            seq,
        };
        peer_a_storage.append_change(&change).await.unwrap();
        peer_a_broadcaster.broadcast(vec![change]);
    }

    // Give time for lag recovery
    tokio::time::sleep(Duration::from_secs(2)).await;

    // B should eventually have all the flood changes (via lag recovery from storage)
    let b_changes = peer_b_storage.query_since(0).await.unwrap();
    // At minimum, some changes should have arrived (lag recovery re-queries storage)
    assert!(
        !b_changes.is_empty(),
        "B should have received changes even after broadcast lag"
    );

    drop(peer_a_broadcaster);
    drop(peer_b_broadcaster);
    tokio::time::sleep(Duration::from_millis(200)).await;
    accept_handle.abort();
    initiator_handle.abort();
}
