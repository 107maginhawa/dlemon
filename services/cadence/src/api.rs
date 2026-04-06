use anyhow::Result;
use axum::{
    extract::{
        ws::{WebSocket, WebSocketUpgrade},
        State,
    },
    http::{header, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use futures_util::StreamExt;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::config::CadenceConfig;
use crate::peer_status::{PeerTracker, PeerTransport};
use crate::state::{ChangeBroadcaster, SyncState};
use crate::stream::{WsSyncRead, WsSyncWrite};
use crate::sync::SyncEngine;

/// Content-Type for RFC 8890 health check responses.
const HEALTH_CONTENT_TYPE: &str = "application/health+json";

/// CORS headers for browser access.
fn cors_headers() -> [(header::HeaderName, &'static str); 3] {
    [
        (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*"),
        (
            header::ACCESS_CONTROL_ALLOW_METHODS,
            "GET, POST, DELETE, OPTIONS",
        ),
        (header::ACCESS_CONTROL_ALLOW_HEADERS, "Accept, Content-Type"),
    ]
}

struct ApiState {
    _config: Arc<CadenceConfig>,
    sync_state: Arc<SyncState>,
    sync_engine: Arc<SyncEngine>,
    _peer_tracker: Arc<PeerTracker>,
    broadcaster: Arc<ChangeBroadcaster>,
}

/// GET /health — RFC 8890 health check response (in-memory only, no DB pings).
/// DB connectivity is validated by the watcher and applier — no need to check here.
async fn health_handler(State(state): State<Arc<ApiState>>) -> impl IntoResponse {
    let has_token = state.sync_engine.peer_token().await.is_some();

    let body = json!({
        "status": "pass",
        "has_token": has_token,
        "checks": {
            "cadence:lamport": [{
                "componentType": "system",
                "observedValue": state.sync_state.lamport(),
                "status": "pass"
            }],
            "cadence:local_seq": [{
                "componentType": "system",
                "observedValue": state.sync_state.local_seq(),
                "status": "pass"
            }]
        }
    });

    let status_code = StatusCode::OK;

    (
        status_code,
        [
            (header::CONTENT_TYPE, HEALTH_CONTENT_TYPE),
            (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*"),
            (
                header::ACCESS_CONTROL_ALLOW_METHODS,
                "GET, POST, DELETE, OPTIONS",
            ),
        ],
        body.to_string(),
    )
}

/// GET /metrics — same shape, can be expanded later.
async fn metrics_handler(State(state): State<Arc<ApiState>>) -> impl IntoResponse {
    let body = json!({
        "status": "pass",
        "checks": {
            "cadence:lamport": [{
                "componentType": "system",
                "observedValue": state.sync_state.lamport(),
                "status": "pass"
            }],
            "cadence:local_seq": [{
                "componentType": "system",
                "observedValue": state.sync_state.local_seq(),
                "status": "pass"
            }]
        }
    });
    (
        [
            (header::CONTENT_TYPE, HEALTH_CONTENT_TYPE),
            (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*"),
            (
                header::ACCESS_CONTROL_ALLOW_METHODS,
                "GET, POST, DELETE, OPTIONS",
            ),
        ],
        body.to_string(),
    )
}

/// OPTIONS handler for CORS preflight requests.
async fn cors_preflight() -> impl IntoResponse {
    (cors_headers(), "")
}

/// GET /status — sync status with per-peer details.
async fn status_handler(State(state): State<Arc<ApiState>>) -> impl IntoResponse {
    let status = state.sync_engine.status_snapshot().await;
    let body = json!(status);
    (cors_headers(), Json(body))
}

// ── Peer Token endpoints ────────────────────────────────────────

#[derive(Deserialize)]
struct SetPeerTokenRequest {
    token: String,
}

/// POST /peer-token — set/replace the peer token.
async fn set_peer_token(
    State(state): State<Arc<ApiState>>,
    Json(body): Json<SetPeerTokenRequest>,
) -> impl IntoResponse {
    match state.sync_engine.set_peer_token(body.token).await {
        Ok(claims) => (
            StatusCode::OK,
            cors_headers(),
            Json(json!({
                "peer_id": claims.peer_id,
                "subject": claims.sub,
                "read_only": claims.read_only,
            })),
        ),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            cors_headers(),
            Json(json!({ "error": format!("{}", e) })),
        ),
    }
}

/// GET /peer-token — get current token status (not the raw JWT).
async fn get_peer_token(State(state): State<Arc<ApiState>>) -> impl IntoResponse {
    match state.sync_engine.peer_claims().await {
        Some(claims) => (
            cors_headers(),
            Json(json!({
                "has_token": true,
                "peer_id": claims.peer_id,
                "subject": claims.sub,
                "read_only": claims.read_only,
            })),
        ),
        None => (cors_headers(), Json(json!({ "has_token": false }))),
    }
}

/// DELETE /peer-token — clear the token.
async fn clear_peer_token(State(state): State<Arc<ApiState>>) -> impl IntoResponse {
    state.sync_engine.clear_peer_token().await;
    (StatusCode::NO_CONTENT, cors_headers())
}

// ── Peers endpoints ─────────────────────────────────────────────

#[derive(Deserialize)]
struct SetPeersRequest {
    peers: Vec<String>,
}

/// POST /peers — set peers list.
async fn set_peers(
    State(state): State<Arc<ApiState>>,
    Json(body): Json<SetPeersRequest>,
) -> impl IntoResponse {
    match state.sync_engine.set_peers(body.peers).await {
        Ok(()) => {
            let peers = state.sync_engine.get_peers().await;
            let total = peers.len();
            (
                StatusCode::OK,
                cors_headers(),
                Json(json!({ "data": peers, "total": total })),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            cors_headers(),
            Json(json!({ "error": format!("{}", e) })),
        ),
    }
}

/// GET /peers — get current peers.
async fn get_peers(State(state): State<Arc<ApiState>>) -> impl IntoResponse {
    let peers = state.sync_engine.get_peers().await;
    let total = peers.len();
    (
        cors_headers(),
        Json(json!({ "data": peers, "total": total })),
    )
}

/// DELETE /peers — clear peers.
async fn clear_peers(State(state): State<Arc<ApiState>>) -> impl IntoResponse {
    match state.sync_engine.clear_peers().await {
        Ok(()) => (StatusCode::NO_CONTENT, cors_headers()).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            cors_headers(),
            Json(json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

// ── WebSocket sync handlers ─────────────────────────────────────

/// GET /sync — WebSocket upgrade for sync connections.
async fn ws_sync_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<ApiState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws_sync(socket, state))
}

/// Handle an upgraded WebSocket connection for sync.
async fn handle_ws_sync(socket: WebSocket, state: Arc<ApiState>) {
    let (ws_send, ws_recv) = socket.split();
    let mut send = WsSyncWrite::new(ws_send);
    let mut recv = WsSyncRead::new(ws_recv);
    let change_rx = state.broadcaster.subscribe();

    let session_key = format!(
        "in:ws:{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    if let Err(e) = state
        .sync_engine
        .handle_incoming_stream(&mut send, &mut recv, change_rx, &session_key, PeerTransport::WebSocket)
        .await
    {
        tracing::debug!("WebSocket sync session ended: {}", e);
    }
}

/// Start the cadence API server. Returns immediately if not enabled.
/// When `config.api_server.ws_enabled` is true, the WebSocket sync endpoint
/// is served on the same port at `config.api_server.ws_path`.
pub async fn start_api_server(
    config: Arc<CadenceConfig>,
    state: Arc<SyncState>,
    sync_engine: Arc<SyncEngine>,
    peer_tracker: Arc<PeerTracker>,
    broadcaster: Arc<ChangeBroadcaster>,
) -> Result<()> {
    if !config.api_server.enabled {
        return Ok(());
    }

    let port = config.api_server.port;
    let ws_enabled = config.api_server.ws_enabled;
    let ws_path = config.api_server.ws_path.clone();

    let api_state = Arc::new(ApiState {
        _config: config,
        sync_state: state,
        sync_engine,
        _peer_tracker: peer_tracker,
        broadcaster,
    });

    let mut app = Router::new()
        .route(
            "/health",
            get(health_handler).options(cors_preflight),
        )
        .route(
            "/metrics",
            get(metrics_handler).options(cors_preflight),
        )
        .route(
            "/status",
            get(status_handler).options(cors_preflight),
        )
        .route(
            "/peer-token",
            get(get_peer_token)
                .post(set_peer_token)
                .delete(clear_peer_token)
                .options(cors_preflight),
        )
        .route(
            "/peers",
            get(get_peers)
                .post(set_peers)
                .delete(clear_peers)
                .options(cors_preflight),
        );

    if ws_enabled {
        tracing::info!("WebSocket sync endpoint enabled at {}", ws_path);
        app = app.route(&ws_path, get(ws_sync_handler));
    }

    let app = app.with_state(api_state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    tracing::info!("Cadence API server listening on port {}", port);

    axum::serve(listener, app).await?;
    Ok(())
}

/// Start the API server on a specific listener (for testing).
pub async fn start_api_server_on_listener(
    config: Arc<CadenceConfig>,
    state: Arc<SyncState>,
    sync_engine: Arc<SyncEngine>,
    peer_tracker: Arc<PeerTracker>,
    broadcaster: Arc<ChangeBroadcaster>,
    listener: tokio::net::TcpListener,
) -> Result<()> {
    let ws_enabled = config.api_server.ws_enabled;
    let ws_path = config.api_server.ws_path.clone();

    let api_state = Arc::new(ApiState {
        _config: config,
        sync_state: state,
        sync_engine,
        _peer_tracker: peer_tracker,
        broadcaster,
    });

    let mut app = Router::new()
        .route(
            "/health",
            get(health_handler).options(cors_preflight),
        )
        .route(
            "/metrics",
            get(metrics_handler).options(cors_preflight),
        )
        .route(
            "/status",
            get(status_handler).options(cors_preflight),
        )
        .route(
            "/peer-token",
            get(get_peer_token)
                .post(set_peer_token)
                .delete(clear_peer_token)
                .options(cors_preflight),
        )
        .route(
            "/peers",
            get(get_peers)
                .post(set_peers)
                .delete(clear_peers)
                .options(cors_preflight),
        );

    if ws_enabled {
        app = app.route(&ws_path, get(ws_sync_handler));
    }

    let app = app.with_state(api_state);

    axum::serve(listener, app).await?;
    Ok(())
}
