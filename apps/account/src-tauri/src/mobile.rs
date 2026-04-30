//! api-ts-embedded setup for the offline-first backend.
//!
//! Initializes the embedded api-ts runtime with SQLite storage.
//! Commands are in commands.rs; this module only handles initialization.

use crate::commands::{ApiTsContainer, ApiTsState, InitErrorState};
use api_ts_embedded::ApiTsEmbedded;
use std::sync::Arc;

/// Set up the embedded api-ts runtime and return the Tauri state.
///
/// Designed to NEVER crash the app — all errors are logged and the app
/// continues with degraded functionality (commands return an error and
/// `get_backend_status` reports the init failure).
pub fn setup_api_ts(_app: &tauri::App, db_path: &str) -> (ApiTsState, InitErrorState) {
    log::info!("Initializing embedded api-ts (background thread)...");

    let error_state: InitErrorState = Arc::new(std::sync::Mutex::new(None));

    // QuickJS needs ~64 MB stack space; running on the main thread blocks the UI.
    // We join() here but the thread has its own stack so the main thread's
    // stack isn't consumed. Wall-clock time is ~2–5 s on device.
    let db_path_owned = db_path.to_string();
    let error_clone = error_state.clone();

    let handle = std::thread::Builder::new()
        .name("api-ts-init".into())
        .stack_size(64 * 1024 * 1024)
        .spawn(move || -> Option<ApiTsEmbedded> {
            match ApiTsEmbedded::new(&db_path_owned) {
                Ok(api) => {
                    log::info!("Embedded api-ts initialized successfully");
                    Some(api)
                }
                Err(e) => {
                    let err_msg = format!("api-ts initialization failed: {}", e);
                    log::error!("{}", err_msg);
                    if let Ok(mut guard) = error_clone.lock() {
                        *guard = Some(err_msg);
                    }
                    log::warn!("Monobase Account starting with degraded functionality");
                    None
                }
            }
        })
        .expect("Failed to spawn api-ts-init thread");

    let api = handle.join().unwrap_or(None);

    let api_state = std::sync::Mutex::new(ApiTsContainer {
        api,
        db_path: db_path.to_string(),
    });

    (api_state, error_state)
}
