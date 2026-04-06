use cadence::auth::JwtValidator;
use cadence::config::{CadenceConfig, CollectionConfig, ConflictStrategy};
use cadence::peer_status::{PeerTracker, PeerTransport};
use cadence::schema::SchemaFingerprint;
use cadence::state::{ChangeBroadcaster, FieldChange, RowChange, SyncPayload, SyncState};
use cadence::storage::Storage;
use cadence::storage::MetadataBackend;
use cadence::stream::{WsSyncRead, WsSyncWrite};
use cadence::primary_reader::{NoPrimaryReader, PrimaryDbReader};
use cadence::sync::SyncEngine;
use cadence::token::TokenStore;
use cadence::ws;
use serde_json::json;
use std::collections::BTreeMap;
use std::sync::Arc;
use tokio::sync::broadcast;

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
        liveness_timeout_secs: 2,
        keepalive_interval_secs: 1,
        ..Default::default()
    }
}

struct TestSyncPeer {
    engine: Arc<SyncEngine>,
    storage: Arc<Storage>,
    state: Arc<SyncState>,
    broadcaster: Arc<ChangeBroadcaster>,
    jwt: String,
    peer_tracker: Arc<PeerTracker>,
}

impl TestSyncPeer {
    fn new(config: CadenceConfig, peer_id: &str) -> Self {
        let storage = Arc::new(Storage::in_memory().unwrap());
        let state = Arc::new(SyncState::new());

        let key = jsonwebtoken::DecodingKey::from_secret(b"test-secret");
        let validator = Arc::new(JwtValidator::permissive(key));

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let claims = serde_json::json!({
            "sub": "test",
            "aud": "cadence-sync",
            "exp": now + 3600,
            "scopes": {"facility_id": ["*"]},
            "read_only": false
        });

        let jwt = jsonwebtoken::encode(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(b"test-secret"),
        )
        .unwrap();

        let broadcaster = Arc::new(ChangeBroadcaster::new(256));
        let token_store = Arc::new(TokenStore::new(storage.clone(), validator.clone()));
        let peer_tracker = Arc::new(PeerTracker::new());
        let (engine, _peer_change_rx) = SyncEngine::new(
            Arc::new(config),
            state.clone(),
            storage.clone(),
            Arc::new(NoPrimaryReader) as Arc<dyn PrimaryDbReader>,
            validator,
            peer_id.to_string(),
            SchemaFingerprint::empty(),
            token_store,
            peer_tracker.clone(),
        );
        let engine = Arc::new(engine);

        Self {
            engine,
            storage,
            state,
            broadcaster,
            jwt,
            peer_tracker,
        }
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
                peer_id: "test-peer".to_string(),
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

/// Start an Axum test server. Uses oneshot broadcast so server send loop
/// exits after catch-up phase (allows sync to complete via liveness timeout).
async fn start_test_ws_server(peer: &TestSyncPeer) -> String {
    let engine = peer.engine.clone();

    let app = axum::Router::new().route(
        "/sync",
        axum::routing::get(move |ws: axum::extract::ws::WebSocketUpgrade| {
            let engine = engine.clone();
            async move {
                ws.on_upgrade(move |socket| async move {
                    let (ws_send, ws_recv) = futures_util::StreamExt::split(socket);
                    let mut send = WsSyncWrite::new(ws_send);
                    let mut recv = WsSyncRead::new(ws_recv);
                    let change_rx = oneshot_change_rx();
                    let _ = engine
                        .handle_incoming_stream(&mut send, &mut recv, change_rx, "test", PeerTransport::WebSocket)
                        .await;
                })
            }
        }),
    );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    format!("ws://127.0.0.1:{}/sync", addr.port())
}

/// Start a WS server with the peer's live broadcaster (for streaming tests).
async fn start_test_ws_server_live(peer: &TestSyncPeer) -> String {
    let engine = peer.engine.clone();
    let broadcaster = peer.broadcaster.clone();

    let app = axum::Router::new().route(
        "/sync",
        axum::routing::get(move |ws: axum::extract::ws::WebSocketUpgrade| {
            let engine = engine.clone();
            let broadcaster = broadcaster.clone();
            async move {
                ws.on_upgrade(move |socket| async move {
                    let (ws_send, ws_recv) = futures_util::StreamExt::split(socket);
                    let mut send = WsSyncWrite::new(ws_send);
                    let mut recv = WsSyncRead::new(ws_recv);
                    let change_rx = broadcaster.subscribe();
                    let _ = engine
                        .handle_incoming_stream(&mut send, &mut recv, change_rx, "test", PeerTransport::WebSocket)
                        .await;
                })
            }
        }),
    );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    format!("ws://127.0.0.1:{}/sync", addr.port())
}

#[tokio::test]
async fn test_ws_raw_transport_timeout() {
    use cadence::transport;

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    let app = axum::Router::new().route(
        "/test",
        axum::routing::get(|ws: axum::extract::ws::WebSocketUpgrade| async move {
            ws.on_upgrade(|socket| async move {
                let (_send, _recv) = futures_util::StreamExt::split(socket);
                tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            })
        }),
    );
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    let url = format!("ws://127.0.0.1:{}/test", addr.port());
    let (ws_stream, _) = tokio_tungstenite::connect_async(&url).await.unwrap();
    let (_ws_send, ws_recv) = futures_util::StreamExt::split(ws_stream);
    let mut recv = cadence::stream::TungsteniteWsSyncRead::new(ws_recv);

    let result = transport::read_message_timeout(
        &mut recv,
        std::time::Duration::from_millis(500),
    )
    .await;

    assert!(result.is_err(), "Should have timed out");
}

#[tokio::test]
async fn test_ws_hello_handshake() {
    use cadence::stream::{TungsteniteWsSyncRead, TungsteniteWsSyncWrite};
    use cadence::transport;
    use cadence::protocol::{self, SyncMessage};

    let server_peer = TestSyncPeer::new(test_config(), "server-peer");
    server_peer.add_change("medical_patients", "p1", "name", json!("Alice")).await;

    let url = start_test_ws_server(&server_peer).await;

    let (ws_stream, _) = tokio_tungstenite::connect_async(&url).await.unwrap();
    let (ws_send, ws_recv) = futures_util::StreamExt::split(ws_stream);
    let mut send = TungsteniteWsSyncWrite::new(ws_send);
    let mut recv = TungsteniteWsSyncRead::new(ws_recv);

    let client_peer = TestSyncPeer::new(test_config(), "client-peer");

    // Send Hello
    let hello = SyncMessage::Hello {
        jwt: client_peer.jwt.clone(),
        peer_id: "client-peer".to_string(),
        schema_fingerprint: cadence::schema::SchemaFingerprint::empty(),
        since_seq: 0,
        resume_after_seq: None,
    };
    let hello_bytes = protocol::encode_message_raw(&hello).unwrap();
    transport::write_message(&mut send, &hello_bytes).await.unwrap();

    // Read HelloAck
    let ack_bytes = transport::read_message_timeout(
        &mut recv,
        std::time::Duration::from_secs(5),
    ).await.unwrap();
    let ack_msg = protocol::decode_message_raw(&ack_bytes).unwrap();

    match ack_msg {
        SyncMessage::HelloAck { peer_id, ok, .. } => {
            assert!(ok, "Server should accept connection");
            assert_eq!(peer_id, "server-peer");
        }
        _ => panic!("Expected HelloAck"),
    }

    // Read catch-up data
    let data_bytes = transport::read_message_timeout(
        &mut recv,
        std::time::Duration::from_secs(5),
    ).await.unwrap();
    let data_msg = protocol::decode_message_raw(&data_bytes).unwrap();

    match data_msg {
        SyncMessage::SyncData { changes, .. } => {
            assert!(!changes.is_empty(), "Should receive server's changes");
        }
        _ => panic!("Expected SyncData"),
    }
}

#[tokio::test]
async fn test_ws_catch_up_batch() {
    let server_peer = TestSyncPeer::new(test_config(), "server-peer");

    for i in 0..50 {
        server_peer.add_change(
            "medical_patients",
            &format!("patient-{}", i),
            "name",
            json!(format!("Patient {}", i)),
        ).await;
    }

    let client_peer = TestSyncPeer::new(test_config(), "client-peer");
    let url = start_test_ws_server(&server_peer).await;

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        ws::connect_ws_peer(&url, &client_peer.engine, &client_peer.jwt, oneshot_change_rx(), "test"),
    ).await;
    assert!(result.is_ok(), "Should complete within timeout");

    let changes = client_peer.storage.query_since(0).await.unwrap();
    assert_eq!(changes.len(), 50, "Client should have received 50 changes via WS");

    // Verify peer status tracking on the client
    let snap = client_peer.peer_tracker.snapshot();
    assert_eq!(snap.len(), 1, "Client should track 1 peer");
    assert_eq!(snap[0].state, cadence::peer_status::PeerState::Disconnected);
    assert_eq!(snap[0].changes_received, 50, "Client tracker should show 50 received");
    assert_eq!(snap[0].recv_progress.received, 50);
    // Server told client how many changes to expect
    assert_eq!(snap[0].recv_progress.total, Some(50));
    assert!((snap[0].recv_progress.percent.unwrap() - 100.0).abs() < 0.01);
}

#[tokio::test]
async fn test_ws_two_peer_sync() {
    let server_peer = TestSyncPeer::new(test_config(), "server-peer");
    let client_peer = TestSyncPeer::new(test_config(), "client-peer");

    server_peer.add_change("medical_patients", "p1", "name", json!("Alice")).await;
    server_peer.add_change("medical_patients", "p2", "name", json!("Bob")).await;
    client_peer.add_change("medical_patients", "p3", "name", json!("Charlie")).await;

    let url = start_test_ws_server(&server_peer).await;

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        ws::connect_ws_peer(&url, &client_peer.engine, &client_peer.jwt, oneshot_change_rx(), "test"),
    ).await;
    assert!(result.is_ok(), "Should complete within timeout");

    // Client should have server's 2 changes + its own 1
    let client_changes = client_peer.storage.query_since(0).await.unwrap();
    assert!(
        client_changes.len() >= 3,
        "Client should have at least 3 changes, got {}",
        client_changes.len()
    );

    // Server should have client's 1 change + its own 2
    let server_changes = server_peer.storage.query_since(0).await.unwrap();
    assert!(
        server_changes.len() >= 3,
        "Server should have at least 3 changes, got {}",
        server_changes.len()
    );

    // Verify bidirectional tracking on client side
    let client_snap = client_peer.peer_tracker.snapshot();
    assert_eq!(client_snap.len(), 1, "Client should track 1 peer");
    assert_eq!(client_snap[0].state, cadence::peer_status::PeerState::Disconnected);
    assert!(client_snap[0].changes_sent >= 1, "Client should have sent at least 1 change");
    assert!(client_snap[0].changes_received >= 2, "Client should have received at least 2 changes");
    assert_eq!(client_snap[0].transport, cadence::peer_status::PeerTransport::WebSocket);
}

#[tokio::test]
async fn test_ws_streaming_changes() {
    // Test real-time streaming: after catch-up, new changes flow via broadcaster
    let server_peer = TestSyncPeer::new(test_config(), "server-peer");
    server_peer.add_change("medical_patients", "p1", "name", json!("Alice")).await;

    let url = start_test_ws_server_live(&server_peer).await;
    let client_peer = TestSyncPeer::new(test_config(), "client-peer");

    let client_engine = client_peer.engine.clone();
    let client_jwt = client_peer.jwt.clone();
    let client_storage = client_peer.storage.clone();
    let client_broadcaster = client_peer.broadcaster.clone();

    // Start sync in background with live broadcaster
    let sync_handle = tokio::spawn(async move {
        let change_rx = client_broadcaster.subscribe();
        ws::connect_ws_peer(&url, &client_engine, &client_jwt, change_rx, "test").await
    });

    // Wait a moment for catch-up to complete
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    // Verify catch-up worked
    let changes = client_storage.query_since(0).await.unwrap();
    assert!(!changes.is_empty(), "Should have catch-up data");

    // Now add a new change on the server and broadcast it
    server_peer.add_change("medical_patients", "p2", "name", json!("Bob")).await;
    let new_changes = server_peer.storage.query_since(0).await.unwrap();
    server_peer.broadcaster.broadcast(new_changes);

    // Wait for the streaming change to arrive
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    let all_changes = client_storage.query_since(0).await.unwrap();
    let doc_ids: Vec<&str> = all_changes.iter().map(|c| c.document_id.as_str()).collect();
    assert!(doc_ids.contains(&"p2"), "Client should have streaming change p2");

    // Cleanup: abort the sync
    sync_handle.abort();
}

#[tokio::test]
async fn test_ws_keepalive() {
    let server_peer = TestSyncPeer::new(test_config(), "server-peer");
    let url = start_test_ws_server_live(&server_peer).await;

    let client_peer = TestSyncPeer::new(test_config(), "client-peer");
    let client_broadcaster = client_peer.broadcaster.clone();
    let change_rx = client_broadcaster.subscribe();

    let engine = client_peer.engine.clone();
    let jwt = client_peer.jwt.clone();
    let sync_handle = tokio::spawn(async move {
        ws::connect_ws_peer(&url, &engine, &jwt, change_rx, "test").await
    });

    // Let keepalives flow for 3 seconds (keepalive_interval=1s, liveness_timeout=2s)
    tokio::time::sleep(std::time::Duration::from_secs(3)).await;

    // Connection should still be alive (keepalives prevent liveness timeout)
    assert!(!sync_handle.is_finished(), "Sync should still be running with keepalives");

    // Cleanup
    sync_handle.abort();
}

#[tokio::test]
async fn test_ws_auth_rejection() {
    let server_peer = TestSyncPeer::new(test_config(), "server-peer");
    let url = start_test_ws_server(&server_peer).await;

    // Create client with a validator that checks signatures with a different key
    let storage = Arc::new(Storage::in_memory().unwrap());
    let state = Arc::new(SyncState::new());
    let validator = Arc::new(JwtValidator::with_static_key(
        jsonwebtoken::DecodingKey::from_secret(b"different-secret"),
    ));
    let token_store = Arc::new(TokenStore::new(storage.clone(), validator.clone()));
    let (engine, _peer_change_rx) = SyncEngine::new(
        Arc::new(test_config()),
        state,
        storage,
        Arc::new(NoPrimaryReader) as Arc<dyn PrimaryDbReader>,
        validator,
        "bad-peer".to_string(),
        SchemaFingerprint::empty(),
        token_store,
        Arc::new(PeerTracker::new()),
    );
    let engine = Arc::new(engine);

    // JWT signed with wrong key
    let bad_jwt = jsonwebtoken::encode(
        &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
        &serde_json::json!({
            "sub": "test",
            "aud": "cadence-sync",
            "exp": 9999999999u64,
            "scopes": {},
            "read_only": false
        }),
        &jsonwebtoken::EncodingKey::from_secret(b"wrong-key"),
    )
    .unwrap();

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        ws::connect_ws_peer(&url, &engine, &bad_jwt, oneshot_change_rx(), "test"),
    ).await;

    assert!(result.is_ok(), "Should complete within timeout");
    assert!(result.unwrap().is_err(), "Connection with invalid JWT should fail");
}

#[tokio::test]
async fn test_ws_scope_filtering() {
    let config = test_config();
    let server_peer = TestSyncPeer::new(config.clone(), "server-peer");

    // Add changes with different facilities
    let lamport = server_peer.state.increment_lamport();
    let seq = server_peer.state.next_seq();
    server_peer.storage.append_change(&RowChange {
        collection: "medical_patients".to_string(),
        document_id: "p-facility-a".to_string(),
        payload: SyncPayload::Fields(vec![
            FieldChange {
                field: "name".to_string(),
                value: json!("Patient A"),
                lamport,
                peer_id: "server-peer".to_string(),
            },
            FieldChange {
                field: "facility".to_string(),
                value: json!("facility-a"),
                lamport,
                peer_id: "server-peer".to_string(),
            },
        ]),
        deleted: false,
        seq,
    }).await.unwrap();

    let lamport = server_peer.state.increment_lamport();
    let seq = server_peer.state.next_seq();
    server_peer.storage.append_change(&RowChange {
        collection: "medical_patients".to_string(),
        document_id: "p-facility-b".to_string(),
        payload: SyncPayload::Fields(vec![
            FieldChange {
                field: "name".to_string(),
                value: json!("Patient B"),
                lamport,
                peer_id: "server-peer".to_string(),
            },
            FieldChange {
                field: "facility".to_string(),
                value: json!("facility-b"),
                lamport,
                peer_id: "server-peer".to_string(),
            },
        ]),
        deleted: false,
        seq,
    }).await.unwrap();

    let url = start_test_ws_server(&server_peer).await;

    // Client with scope limited to facility-a
    let storage = Arc::new(Storage::in_memory().unwrap());
    let state = Arc::new(SyncState::new());
    let key = jsonwebtoken::DecodingKey::from_secret(b"test-secret");
    let validator = Arc::new(JwtValidator::permissive(key));

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let scoped_jwt = jsonwebtoken::encode(
        &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
        &serde_json::json!({
            "sub": "test",
            "aud": "cadence-sync",
            "exp": now + 3600,
            "scopes": {"facility_id": ["facility-a"]},
            "read_only": false
        }),
        &jsonwebtoken::EncodingKey::from_secret(b"test-secret"),
    )
    .unwrap();

    let token_store = Arc::new(TokenStore::new(storage.clone(), validator.clone()));
    let (engine, _peer_change_rx) = SyncEngine::new(
        Arc::new(config),
        state,
        storage.clone(),
        Arc::new(NoPrimaryReader) as Arc<dyn PrimaryDbReader>,
        validator,
        "scoped-client".to_string(),
        SchemaFingerprint::empty(),
        token_store,
        Arc::new(PeerTracker::new()),
    );
    let engine = Arc::new(engine);

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        ws::connect_ws_peer(&url, &engine, &scoped_jwt, oneshot_change_rx(), "test"),
    ).await;
    assert!(result.is_ok(), "Should complete within timeout");

    let changes = storage.query_since(0).await.unwrap();
    assert_eq!(changes.len(), 1, "Scoped client should only receive facility-a changes, got {}", changes.len());
}
