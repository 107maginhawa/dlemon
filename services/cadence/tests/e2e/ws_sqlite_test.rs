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
    #[allow(dead_code)]
    broadcaster: Arc<ChangeBroadcaster>,
    jwt: String,
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
        let (engine, _peer_change_rx) = SyncEngine::new(
            Arc::new(config),
            state.clone(),
            storage.clone(),
            Arc::new(NoPrimaryReader) as Arc<dyn PrimaryDbReader>,
            validator,
            peer_id.to_string(),
            SchemaFingerprint::empty(),
            token_store,
            Arc::new(PeerTracker::new()),
        );
        let engine = Arc::new(engine);

        Self {
            engine,
            storage,
            state,
            broadcaster,
            jwt,
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

#[tokio::test]
async fn test_ws_sqlite_to_sqlite_full_sync() {
    let server = TestSyncPeer::new(test_config(), "server");
    let client = TestSyncPeer::new(test_config(), "client");

    server.add_change("medical_patients", "p1", "name", json!("Alice Smith")).await;
    server.add_change("medical_patients", "p1", "dob", json!("1990-01-15")).await;
    client.add_change("medical_patients", "p2", "name", json!("Bob Jones")).await;

    let url = start_test_ws_server(&server).await;

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        ws::connect_ws_peer(&url, &client.engine, &client.jwt, oneshot_change_rx(), "test"),
    ).await;
    assert!(result.is_ok(), "Should complete within timeout");

    // Verify client received server's data
    let client_changes = client.storage.query_since(0).await.unwrap();
    let client_doc_ids: Vec<&str> = client_changes.iter().map(|c| c.document_id.as_str()).collect();
    assert!(client_doc_ids.contains(&"p1"), "Client should have server's patient p1");
    assert!(client_doc_ids.contains(&"p2"), "Client should still have its own patient p2");

    // Verify server received client's data
    let server_changes = server.storage.query_since(0).await.unwrap();
    let server_doc_ids: Vec<&str> = server_changes.iter().map(|c| c.document_id.as_str()).collect();
    assert!(server_doc_ids.contains(&"p1"), "Server should still have its own patient p1");
    assert!(server_doc_ids.contains(&"p2"), "Server should have client's patient p2");
}

#[tokio::test]
async fn test_ws_reconnect_after_disconnect() {
    let server = TestSyncPeer::new(test_config(), "server");
    let client = TestSyncPeer::new(test_config(), "client");

    // Phase 1: Initial sync
    server.add_change("medical_patients", "p1", "name", json!("Alice")).await;

    let url = start_test_ws_server(&server).await;

    let _ = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        ws::connect_ws_peer(&url, &client.engine, &client.jwt, oneshot_change_rx(), "test"),
    ).await;

    let changes_after_first = client.storage.query_since(0).await.unwrap();
    assert!(!changes_after_first.is_empty(), "Should have changes after first sync");

    // Phase 2: Server gets more data
    server.add_change("medical_patients", "p2", "name", json!("Bob")).await;

    // Phase 3: Reconnect
    let _ = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        ws::connect_ws_peer(&url, &client.engine, &client.jwt, oneshot_change_rx(), "test"),
    ).await;

    let changes_after_second = client.storage.query_since(0).await.unwrap();
    let doc_ids: Vec<&str> = changes_after_second.iter().map(|c| c.document_id.as_str()).collect();
    assert!(doc_ids.contains(&"p1"), "Should still have p1");
    assert!(doc_ids.contains(&"p2"), "Should have p2 after reconnect");
}

#[tokio::test]
async fn test_ws_concurrent_clients() {
    let server = TestSyncPeer::new(test_config(), "server");

    for i in 0..10 {
        server.add_change(
            "medical_patients",
            &format!("p-{}", i),
            "name",
            json!(format!("Patient {}", i)),
        ).await;
    }

    let url = start_test_ws_server(&server).await;

    let mut handles = Vec::new();
    for i in 0..3 {
        let url = url.clone();
        handles.push(tokio::spawn(async move {
            let client = TestSyncPeer::new(test_config(), &format!("client-{}", i));
            let _ = tokio::time::timeout(
                std::time::Duration::from_secs(10),
                ws::connect_ws_peer(&url, &client.engine, &client.jwt, oneshot_change_rx(), "test"),
            ).await;
            let changes = client.storage.query_since(0).await.unwrap();
            changes.len()
        }));
    }

    for handle in handles {
        let count = handle.await.unwrap();
        assert_eq!(count, 10, "Each client should receive all 10 changes");
    }
}
