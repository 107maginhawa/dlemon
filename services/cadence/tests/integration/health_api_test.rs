use cadence::auth::JwtValidator;
use cadence::config::CadenceConfig;
use cadence::peer_status::PeerTracker;
use cadence::schema::SchemaFingerprint;
use cadence::state::{ChangeBroadcaster, SyncState};
use cadence::storage::Storage;
use cadence::primary_reader::{NoPrimaryReader, PrimaryDbReader};
use cadence::sync::SyncEngine;
use cadence::token::TokenStore;
use serde_json::Value;
use std::sync::Arc;

/// Create a test JWT using HS256 with test-secret.
fn test_jwt() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let claims = serde_json::json!({
        "sub": "test-subject",
        "aud": "cadence-sync",
        "exp": now + 3600,
        "peer_id": "test-peer-123",
        "scopes": {"facility_id": ["*"]},
        "read_only": false
    });

    jsonwebtoken::encode(
        &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret(b"test-secret"),
    )
    .unwrap()
}

/// Spin up a health server on a random port, returning the base URL, engine, and peer tracker.
async fn start_test_server() -> (String, Arc<SyncEngine>, Arc<PeerTracker>) {
    let storage = Arc::new(Storage::in_memory().unwrap());
    let state = Arc::new(SyncState::new());
    let key = jsonwebtoken::DecodingKey::from_secret(b"test-secret");
    let validator = Arc::new(JwtValidator::permissive(key));
    let token_store = Arc::new(TokenStore::new(storage.clone(), validator.clone()));
    let peer_tracker = Arc::new(PeerTracker::new());

    let config = Arc::new(CadenceConfig {
        api_server: cadence::config::ApiServerConfig {
            enabled: true,
            port: 0, // not used with custom listener
            ..Default::default()
        },
        ..Default::default()
    });

    let (engine, _peer_change_rx) = SyncEngine::new(
        config.clone(),
        state.clone(),
        storage,
        Arc::new(NoPrimaryReader) as Arc<dyn PrimaryDbReader>,
        validator,
        "test-peer".to_string(),
        SchemaFingerprint::empty(),
        token_store,
        peer_tracker.clone(),
    );
    let engine = Arc::new(engine);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let base_url = format!("http://127.0.0.1:{}", addr.port());

    let srv_engine = engine.clone();
    let srv_config = config.clone();
    let srv_state = state.clone();
    let srv_tracker = peer_tracker.clone();
    let srv_broadcaster = Arc::new(ChangeBroadcaster::new(256));
    tokio::spawn(async move {
        cadence::api::start_api_server_on_listener(srv_config, srv_state, srv_engine, srv_tracker, srv_broadcaster, listener)
            .await
            .unwrap();
    });

    // Give the server a moment to bind
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;

    (base_url, engine, peer_tracker)
}

#[tokio::test]
async fn test_get_peer_token_empty() {
    let (base_url, _engine, _tracker) = start_test_server().await;
    let client = reqwest::Client::new();

    let resp = client.get(format!("{}/peer-token", base_url)).send().await.unwrap();
    assert_eq!(resp.status(), 200);

    let body: Value = resp.json().await.unwrap();
    assert_eq!(body["has_token"], false);
    assert!(body.get("peer_id").is_none());
}

#[tokio::test]
async fn test_post_peer_token_valid() {
    let (base_url, _engine, _tracker) = start_test_server().await;
    let client = reqwest::Client::new();
    let jwt = test_jwt();

    let resp = client
        .post(format!("{}/peer-token", base_url))
        .json(&serde_json::json!({ "token": jwt }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let body: Value = resp.json().await.unwrap();
    assert_eq!(body["subject"], "test-subject");
    assert_eq!(body["read_only"], false);
}

#[tokio::test]
async fn test_post_peer_token_invalid() {
    let (base_url, _engine, _tracker) = start_test_server().await;
    let client = reqwest::Client::new();

    let resp = client
        .post(format!("{}/peer-token", base_url))
        .json(&serde_json::json!({ "token": "not-a-jwt" }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 400);
    let body: Value = resp.json().await.unwrap();
    assert!(body["error"].as_str().unwrap().len() > 0);
}

#[tokio::test]
async fn test_get_peer_token_after_set() {
    let (base_url, _engine, _tracker) = start_test_server().await;
    let client = reqwest::Client::new();
    let jwt = test_jwt();

    // Set token
    client
        .post(format!("{}/peer-token", base_url))
        .json(&serde_json::json!({ "token": jwt }))
        .send()
        .await
        .unwrap();

    // Get token
    let resp = client.get(format!("{}/peer-token", base_url)).send().await.unwrap();
    let body: Value = resp.json().await.unwrap();
    assert_eq!(body["has_token"], true);
    assert_eq!(body["subject"], "test-subject");
}

#[tokio::test]
async fn test_delete_peer_token() {
    let (base_url, _engine, _tracker) = start_test_server().await;
    let client = reqwest::Client::new();
    let jwt = test_jwt();

    // Set then delete
    client
        .post(format!("{}/peer-token", base_url))
        .json(&serde_json::json!({ "token": jwt }))
        .send()
        .await
        .unwrap();

    let resp = client.delete(format!("{}/peer-token", base_url)).send().await.unwrap();
    assert_eq!(resp.status(), 204);

    // Verify cleared
    let resp = client.get(format!("{}/peer-token", base_url)).send().await.unwrap();
    let body: Value = resp.json().await.unwrap();
    assert_eq!(body["has_token"], false);
}

#[tokio::test]
async fn test_health_has_token_field() {
    let (base_url, _engine, _tracker) = start_test_server().await;
    let client = reqwest::Client::new();

    // Before setting token
    let resp = client.get(format!("{}/health", base_url)).send().await.unwrap();
    let body: Value = resp.json().await.unwrap();
    assert_eq!(body["has_token"], false);
    assert_eq!(body["status"], "pass");

    // Set token
    let jwt = test_jwt();
    client
        .post(format!("{}/peer-token", base_url))
        .json(&serde_json::json!({ "token": jwt }))
        .send()
        .await
        .unwrap();

    // After setting token
    let resp = client.get(format!("{}/health", base_url)).send().await.unwrap();
    let body: Value = resp.json().await.unwrap();
    assert_eq!(body["has_token"], true);
}

#[tokio::test]
async fn test_get_peers_empty() {
    let (base_url, _engine, _tracker) = start_test_server().await;
    let client = reqwest::Client::new();

    let resp = client.get(format!("{}/peers", base_url)).send().await.unwrap();
    assert_eq!(resp.status(), 200);
    let body: Value = resp.json().await.unwrap();
    assert_eq!(body["data"], serde_json::json!([]));
    assert_eq!(body["total"], 0);
}

#[tokio::test]
async fn test_post_peers() {
    let (base_url, _engine, _tracker) = start_test_server().await;
    let client = reqwest::Client::new();

    let resp = client
        .post(format!("{}/peers", base_url))
        .json(&serde_json::json!({ "peers": ["ws://localhost:9091/sync"] }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let body: Value = resp.json().await.unwrap();
    assert_eq!(body["data"], serde_json::json!(["ws://localhost:9091/sync"]));
    assert_eq!(body["total"], 1);
}

#[tokio::test]
async fn test_delete_peers() {
    let (base_url, _engine, _tracker) = start_test_server().await;
    let client = reqwest::Client::new();

    // Set then delete
    client
        .post(format!("{}/peers", base_url))
        .json(&serde_json::json!({ "peers": ["ws://localhost:9091/sync"] }))
        .send()
        .await
        .unwrap();

    let resp = client.delete(format!("{}/peers", base_url)).send().await.unwrap();
    assert_eq!(resp.status(), 204);

    // Verify cleared
    let resp = client.get(format!("{}/peers", base_url)).send().await.unwrap();
    let body: Value = resp.json().await.unwrap();
    assert_eq!(body["data"], serde_json::json!([]));
    assert_eq!(body["total"], 0);
}

#[tokio::test]
async fn test_cors_preflight() {
    let (base_url, _engine, _tracker) = start_test_server().await;
    let client = reqwest::Client::new();

    let resp = client
        .request(reqwest::Method::OPTIONS, format!("{}/peer-token", base_url))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let headers = resp.headers();
    assert_eq!(headers.get("access-control-allow-origin").unwrap(), "*");
    assert!(headers
        .get("access-control-allow-methods")
        .unwrap()
        .to_str()
        .unwrap()
        .contains("POST"));
    assert!(headers
        .get("access-control-allow-methods")
        .unwrap()
        .to_str()
        .unwrap()
        .contains("DELETE"));
}

#[tokio::test]
async fn test_status_empty() {
    let (base_url, _engine, _tracker) = start_test_server().await;
    let client = reqwest::Client::new();

    let resp = client.get(format!("{}/status", base_url)).send().await.unwrap();
    assert_eq!(resp.status(), 200);

    let body: Value = resp.json().await.unwrap();
    assert_eq!(body["connected_peers"], 0);
    assert_eq!(body["total_peers"], 0);
    assert_eq!(body["peers"], serde_json::json!([]));
    assert!(body["lamport"].is_number());
    assert!(body["local_seq"].is_number());
}

#[tokio::test]
async fn test_status_with_registered_peers() {
    use cadence::peer_status::PeerTransport;

    let (base_url, _engine, tracker) = start_test_server().await;
    let client = reqwest::Client::new();

    // Register a syncing peer
    tracker.register("ws://peer1", "peer-abc", "ws://peer1:9091/sync", PeerTransport::WebSocket);
    tracker.set_syncing("ws://peer1");
    tracker.set_send_total("ws://peer1", 100);
    tracker.inc_send_progress("ws://peer1", 50);
    tracker.inc_sent("ws://peer1", 50);
    tracker.set_recv_total("ws://peer1", 200);
    tracker.inc_recv_progress("ws://peer1", 80);
    tracker.inc_received("ws://peer1", 80);
    tracker.set_watermarks("ws://peer1", 42, 15);

    // Register a disconnected peer
    tracker.register("in:quic:1", "peer-def", "inbound", PeerTransport::Quic);
    tracker.set_disconnected("in:quic:1", Some("connection reset".to_string()));

    let resp = client.get(format!("{}/status", base_url)).send().await.unwrap();
    assert_eq!(resp.status(), 200);

    let body: Value = resp.json().await.unwrap();
    assert_eq!(body["connected_peers"], 1); // only the syncing peer
    assert_eq!(body["total_peers"], 2);

    let peers = body["peers"].as_array().unwrap();
    assert_eq!(peers.len(), 2);

    // Find each peer (order not guaranteed)
    let syncing_peer = peers.iter().find(|p| p["peer_id"] == "peer-abc").unwrap();
    assert_eq!(syncing_peer["state"], "syncing");
    assert_eq!(syncing_peer["transport"], "websocket");
    assert_eq!(syncing_peer["address"], "ws://peer1:9091/sync");
    assert_eq!(syncing_peer["changes_sent"], 50);
    assert_eq!(syncing_peer["changes_received"], 80);
    assert_eq!(syncing_peer["send_progress"]["sent"], 50);
    assert_eq!(syncing_peer["send_progress"]["total"], 100);
    assert!((syncing_peer["send_progress"]["percent"].as_f64().unwrap() - 50.0).abs() < 0.01);
    assert_eq!(syncing_peer["recv_progress"]["received"], 80);
    assert_eq!(syncing_peer["recv_progress"]["total"], 200);
    assert!((syncing_peer["recv_progress"]["percent"].as_f64().unwrap() - 40.0).abs() < 0.01);
    assert_eq!(syncing_peer["their_watermark"], 42);
    assert_eq!(syncing_peer["our_watermark"], 15);
    assert!(syncing_peer["last_error"].is_null());

    let disconnected_peer = peers.iter().find(|p| p["peer_id"] == "peer-def").unwrap();
    assert_eq!(disconnected_peer["state"], "disconnected");
    assert_eq!(disconnected_peer["transport"], "quic");
    assert_eq!(disconnected_peer["last_error"], "connection reset");
}

#[tokio::test]
async fn test_status_cors() {
    let (base_url, _engine, _tracker) = start_test_server().await;
    let client = reqwest::Client::new();

    let resp = client.get(format!("{}/status", base_url)).send().await.unwrap();
    assert_eq!(resp.headers().get("access-control-allow-origin").unwrap(), "*");

    // Preflight
    let resp = client
        .request(reqwest::Method::OPTIONS, format!("{}/status", base_url))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
}

// ── status_snapshot() / configured-peer merge tests ────────────────────────

/// A configured peer that has never connected should appear as disconnected
/// with `last_error = "Not connected"` in the /status response.
#[tokio::test]
async fn test_status_shows_configured_peers_not_in_tracker() {
    let (base_url, engine, _tracker) = start_test_server().await;
    let client = reqwest::Client::new();

    // Add a configured peer (not yet registered in the tracker).
    engine.set_peers(vec!["ws://unconnected.example.com/sync".to_string()]).await.unwrap();

    let resp = client.get(format!("{}/status", base_url)).send().await.unwrap();
    assert_eq!(resp.status(), 200);

    let body: Value = resp.json().await.unwrap();
    assert_eq!(body["total_peers"], 1);
    assert_eq!(body["connected_peers"], 0);

    let peers = body["peers"].as_array().unwrap();
    assert_eq!(peers.len(), 1);
    let peer = &peers[0];
    assert_eq!(peer["address"], "ws://unconnected.example.com/sync");
    assert_eq!(peer["state"], "disconnected");
    assert_eq!(peer["last_error"], "Not connected");
    assert_eq!(peer["changes_sent"], 0);
    assert_eq!(peer["changes_received"], 0);
}

/// A configured peer whose address matches a tracked entry should not be
/// duplicated — the tracker entry takes precedence.
#[tokio::test]
async fn test_status_no_duplicate_when_configured_peer_is_tracked() {
    use cadence::peer_status::PeerTransport;

    let (base_url, engine, tracker) = start_test_server().await;
    let client = reqwest::Client::new();

    let addr = "ws://peer.example.com/sync";

    // Both configure the peer address and register it in the tracker.
    engine.set_peers(vec![addr.to_string()]).await.unwrap();
    tracker.register(addr, "peer-xyz", addr, PeerTransport::WebSocket);
    tracker.set_live(addr);

    let resp = client.get(format!("{}/status", base_url)).send().await.unwrap();
    assert_eq!(resp.status(), 200);

    let body: Value = resp.json().await.unwrap();
    // Should appear exactly once, sourced from the tracker (Live state).
    assert_eq!(body["total_peers"], 1);
    assert_eq!(body["connected_peers"], 1);

    let peers = body["peers"].as_array().unwrap();
    assert_eq!(peers.len(), 1);
    assert_eq!(peers[0]["state"], "live");
    assert_eq!(peers[0]["peer_id"], "peer-xyz");
}

/// `connected_peers` counts only Syncing and Live peers, not Connecting or
/// Disconnected, even when configured peers add placeholder entries.
#[tokio::test]
async fn test_status_connected_peers_count_only_active_states() {
    use cadence::peer_status::PeerTransport;

    let (base_url, engine, tracker) = start_test_server().await;
    let client = reqwest::Client::new();

    // Configure three addresses.
    engine
        .set_peers(vec![
            "ws://syncing.example.com/sync".to_string(),
            "ws://live.example.com/sync".to_string(),
            "ws://disconnected.example.com/sync".to_string(),
            "ws://unconnected.example.com/sync".to_string(), // never registered
        ])
        .await
        .unwrap();

    // Register three of them in various states.
    tracker.register("ws://syncing.example.com/sync", "p1", "ws://syncing.example.com/sync", PeerTransport::WebSocket);
    tracker.set_syncing("ws://syncing.example.com/sync");

    tracker.register("ws://live.example.com/sync", "p2", "ws://live.example.com/sync", PeerTransport::WebSocket);
    tracker.set_live("ws://live.example.com/sync");

    tracker.register("ws://disconnected.example.com/sync", "p3", "ws://disconnected.example.com/sync", PeerTransport::WebSocket);
    tracker.set_disconnected("ws://disconnected.example.com/sync", Some("timeout".to_string()));

    let resp = client.get(format!("{}/status", base_url)).send().await.unwrap();
    let body: Value = resp.json().await.unwrap();

    // 3 tracked + 1 placeholder = 4 total
    assert_eq!(body["total_peers"], 4);
    // Only syncing + live count as connected
    assert_eq!(body["connected_peers"], 2);

    let peers = body["peers"].as_array().unwrap();
    assert_eq!(peers.len(), 4);

    // The unconfigured placeholder should be disconnected with "Not connected".
    let placeholder = peers
        .iter()
        .find(|p| p["address"] == "ws://unconnected.example.com/sync")
        .unwrap();
    assert_eq!(placeholder["state"], "disconnected");
    assert_eq!(placeholder["last_error"], "Not connected");
}

/// Verify `status_snapshot()` directly on the engine (unit-level, no HTTP).
#[tokio::test]
async fn test_sync_engine_status_snapshot_direct() {
    use cadence::auth::JwtValidator;
    use cadence::config::CadenceConfig;
    use cadence::peer_status::{PeerTracker, PeerTransport};
    use cadence::schema::SchemaFingerprint;
    use cadence::state::SyncState;
    use cadence::storage::Storage;
    use cadence::sync::SyncEngine;
    use cadence::token::TokenStore;
    use std::sync::Arc;

    let storage = Arc::new(Storage::in_memory().unwrap());
    let state = Arc::new(SyncState::new());
    let key = jsonwebtoken::DecodingKey::from_secret(b"test-secret");
    let validator = Arc::new(JwtValidator::permissive(key));
    let token_store = Arc::new(TokenStore::new(storage.clone(), validator.clone()));
    let peer_tracker = Arc::new(PeerTracker::new());
    let config = Arc::new(CadenceConfig::default());

    let (engine, _peer_change_rx) = SyncEngine::new(
        config,
        state,
        storage,
        Arc::new(NoPrimaryReader) as Arc<dyn PrimaryDbReader>,
        validator,
        "local-peer".to_string(),
        SchemaFingerprint::empty(),
        token_store,
        peer_tracker.clone(),
    );
    let engine = Arc::new(engine);

    // No peers configured, no tracker entries.
    let status = engine.status_snapshot().await;
    assert_eq!(status.total_peers, 0);
    assert_eq!(status.connected_peers, 0);
    assert!(status.peers.is_empty());

    // Add a configured peer (not tracked).
    engine.set_peers(vec!["ws://remote.example.com/sync".to_string()]).await.unwrap();
    let status = engine.status_snapshot().await;
    assert_eq!(status.total_peers, 1);
    assert_eq!(status.connected_peers, 0);
    assert_eq!(status.peers[0].address, "ws://remote.example.com/sync");
    assert_eq!(status.peers[0].state, cadence::peer_status::PeerState::Disconnected);
    assert_eq!(status.peers[0].last_error.as_deref(), Some("Not connected"));

    // Now register the peer as live in the tracker.
    peer_tracker.register(
        "ws://remote.example.com/sync",
        "remote-peer-id",
        "ws://remote.example.com/sync",
        PeerTransport::WebSocket,
    );
    peer_tracker.set_live("ws://remote.example.com/sync");

    let status = engine.status_snapshot().await;
    assert_eq!(status.total_peers, 1); // no duplicate
    assert_eq!(status.connected_peers, 1);
    assert_eq!(status.peers[0].peer_id, "remote-peer-id");
    assert_eq!(status.peers[0].state, cadence::peer_status::PeerState::Live);
    assert!(status.peers[0].last_error.is_none());
}
