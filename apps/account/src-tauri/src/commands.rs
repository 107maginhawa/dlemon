use serde::Serialize;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

use crate::cadence_embed::EmbeddedCadence;
use crate::config::AppConfig;

// ── Response types ──────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct PeerTokenResponse {
    pub success: bool,
    pub peer_id: Option<String>,
    pub subject: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PeerTokenStatus {
    pub has_token: bool,
    pub peer_id: Option<String>,
    pub subject: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PeersResponse {
    pub data: Vec<String>,
    pub total: usize,
}

// ── State types ────────────────────────────────────────────────

pub type CadenceState = Arc<Mutex<Option<EmbeddedCadence>>>;
pub type AppConfigState = Arc<AppConfig>;

// ── Cross-platform Commands ────────────────────────────────────

#[tauri::command]
pub fn get_runtime_config() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "api_url": "tauri://localhost",
        "mode": "local",
    }))
}

#[tauri::command]
pub async fn get_cadence_health(
    cadence: State<'_, CadenceState>,
) -> Result<serde_json::Value, String> {
    let guard = cadence.lock().await;
    let embedded = guard.as_ref().ok_or("Cadence not running")?;

    let has_token = embedded.token_store.token().await.is_some();
    let lamport = embedded.state.lamport();
    let local_seq = embedded.state.local_seq();

    Ok(serde_json::json!({
        "status": "pass",
        "has_token": has_token,
        "checks": {
            "lamport_clock": [{ "componentType": "clock", "observedValue": lamport, "status": "pass" }],
            "local_seq": [{ "componentType": "sequence", "observedValue": local_seq, "status": "pass" }],
        }
    }))
}

#[tauri::command]
pub async fn get_cadence_status(
    cadence: State<'_, CadenceState>,
) -> Result<serde_json::Value, String> {
    let guard = cadence.lock().await;
    let embedded = guard.as_ref().ok_or("Cadence not running")?;

    let status = embedded.sync_engine.status_snapshot().await;
    Ok(serde_json::to_value(status).map_err(|e| format!("Serialization error: {}", e))?)
}

#[tauri::command]
pub async fn set_peer_token(
    token: String,
    cadence: State<'_, CadenceState>,
) -> Result<PeerTokenResponse, String> {
    let guard = cadence.lock().await;
    let embedded = guard.as_ref().ok_or("Cadence not running")?;

    let claims = embedded
        .sync_engine
        .set_peer_token(token)
        .await
        .map_err(|e| format!("Failed to set peer token: {}", e))?;

    Ok(PeerTokenResponse {
        success: true,
        peer_id: claims.peer_id.clone(),
        subject: Some(claims.sub.clone()),
    })
}

#[tauri::command]
pub async fn get_peer_token(
    cadence: State<'_, CadenceState>,
) -> Result<PeerTokenStatus, String> {
    let guard = cadence.lock().await;
    let embedded = guard.as_ref().ok_or("Cadence not running")?;

    let claims = embedded.sync_engine.peer_claims().await;

    Ok(PeerTokenStatus {
        has_token: claims.is_some(),
        peer_id: claims.as_ref().and_then(|c| c.peer_id.clone()),
        subject: claims.as_ref().map(|c| c.sub.clone()),
    })
}

#[tauri::command]
pub async fn clear_peer_token(
    cadence: State<'_, CadenceState>,
) -> Result<(), String> {
    let guard = cadence.lock().await;
    let embedded = guard.as_ref().ok_or("Cadence not running")?;
    embedded.sync_engine.clear_peer_token().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn set_peers(
    peers: Vec<String>,
    cadence: State<'_, CadenceState>,
) -> Result<PeersResponse, String> {
    let guard = cadence.lock().await;
    let embedded = guard.as_ref().ok_or("Cadence not running")?;

    embedded
        .sync_engine
        .set_peers(peers)
        .await
        .map_err(|e| format!("Failed to set peers: {}", e))?;

    let data = embedded.sync_engine.get_peers().await;
    let total = data.len();

    Ok(PeersResponse { data, total })
}

#[tauri::command]
pub async fn get_peers(
    cadence: State<'_, CadenceState>,
) -> Result<PeersResponse, String> {
    let guard = cadence.lock().await;
    let embedded = guard.as_ref().ok_or("Cadence not running")?;

    let data = embedded.sync_engine.get_peers().await;
    let total = data.len();

    Ok(PeersResponse { data, total })
}

#[tauri::command]
pub async fn clear_peers(
    cadence: State<'_, CadenceState>,
) -> Result<(), String> {
    let guard = cadence.lock().await;
    let embedded = guard.as_ref().ok_or("Cadence not running")?;

    embedded
        .sync_engine
        .clear_peers()
        .await
        .map_err(|e| format!("Failed to clear peers: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_app_config(
    config: State<'_, AppConfigState>,
) -> Result<AppConfig, String> {
    Ok(config.inner().as_ref().clone())
}
