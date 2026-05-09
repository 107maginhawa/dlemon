use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

use crate::cadence_embed::EmbeddedCadence;
use crate::config::AppConfig;
use api_ts_embedded::{ApiTsEmbedded, ApiTsResponse};

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

/// Wraps the embedded api-ts in a restartable container.
pub struct ApiTsContainer {
    pub api: Option<ApiTsEmbedded>,
    pub db_path: String,
}

pub type ApiTsState = std::sync::Mutex<ApiTsContainer>;
pub type InitErrorState = Arc<std::sync::Mutex<Option<String>>>;

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

// ── Embedded api-ts commands ───────────────────────────────────

#[tauri::command]
pub fn api_request(
    method: String,
    path: String,
    body: Option<String>,
    headers: Option<HashMap<String, String>>,
    state: State<'_, ApiTsState>,
) -> Result<ApiTsResponse, String> {
    let header_pairs: Vec<(String, String)> = headers
        .unwrap_or_default()
        .into_iter()
        .collect();
    let header_refs: Vec<(&str, &str)> = header_pairs
        .iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();
    let guard = state.lock().map_err(|e| e.to_string())?;
    let api = guard.api.as_ref().ok_or("api-ts not initialized")?;
    api.request(&method, &path, body.as_deref(), header_refs)
}

#[tauri::command]
pub fn get_backend_status(
    error_state: State<'_, InitErrorState>,
    api_state: State<'_, ApiTsState>,
) -> Result<serde_json::Value, String> {
    let initialized = api_state
        .lock()
        .map_err(|e| e.to_string())?
        .api
        .is_some();
    let error = error_state.lock().map_err(|e| e.to_string())?.clone();

    Ok(serde_json::json!({
        "status": if initialized { "pass" } else { "fail" },
        "mode": "embedded",
        "initialized": initialized,
        "error": error,
    }))
}

/// Restart the embedded api-ts (e.g., after a schema reset).
#[tauri::command]
pub fn restart_engine(state: State<'_, ApiTsState>) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.api = None;
    let db_path = guard.db_path.clone();
    let new_api = ApiTsEmbedded::new(&db_path).map_err(|e| format!("Failed to restart api-ts: {}", e))?;
    guard.api = Some(new_api);
    log::info!("Embedded api-ts restarted successfully");
    Ok(())
}

#[tauri::command]
pub async fn reset_databases(
    app: tauri::AppHandle,
    config: State<'_, AppConfigState>,
) -> Result<(), String> {
    // Delete embedded backend DB (strip sqlite:// prefix to get file path)
    let db_url = &config.embedded_database_url;
    if let Some(path) = db_url.strip_prefix("sqlite://") {
        let _ = std::fs::remove_file(path);
        let _ = std::fs::remove_file(format!("{}-wal", path));
        let _ = std::fs::remove_file(format!("{}-shm", path));
    }

    // Delete cadence metadata DB
    let meta_path = &config.cadence_metadata_path;
    let _ = std::fs::remove_file(meta_path);
    let _ = std::fs::remove_file(format!("{}-wal", meta_path.display()));
    let _ = std::fs::remove_file(format!("{}-shm", meta_path.display()));

    // Restart the entire app to reinitialize
    app.restart();
}
