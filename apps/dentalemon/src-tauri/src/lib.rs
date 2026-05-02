//! Monobase Account - Cross-platform reference desktop/mobile app
//!
//! Desktop and mobile share an embedded backend for offline-first
//! operation, plus a cadence P2P sync engine for synchronization with
//! the cloud and other peers. Desktop additionally has tray icon,
//! updater, and single-instance support.

use tauri::Manager;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::Mutex;

// ===== Desktop-only modules =====
#[cfg(not(any(target_os = "ios", target_os = "android")))]
pub mod tray;

// ===== Cross-platform modules =====
mod cadence_embed;
mod commands;
mod config;
pub mod mobile;

use commands::CadenceState;

// ===== Desktop-only imports =====
#[cfg(not(any(target_os = "ios", target_os = "android")))]
use tauri::{Emitter, WindowEvent};
#[cfg(not(any(target_os = "ios", target_os = "android")))]
use tauri_plugin_updater::UpdaterExt;
#[cfg(not(any(target_os = "ios", target_os = "android")))]
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

// ===== Graceful Shutdown =====

async fn graceful_shutdown(reason: &str, cadence: Option<CadenceState>) {
    println!("Graceful shutdown initiated: {}", reason);

    if let Some(cadence) = cadence {
        if let Some(ref mut c) = *cadence.lock().await {
            c.stop().await;
        }
    }

    std::process::exit(0);
}

// ===== Desktop-only Functions =====

#[cfg(not(any(target_os = "ios", target_os = "android")))]
pub async fn check_for_updates<R: tauri::Runtime>(handle: tauri::AppHandle<R>, is_manual: bool) {
    if let Ok(updater) = handle.updater() {
        match updater.check().await {
            Ok(Some(update)) => {
                println!("Update available: {} -> {}", update.current_version, update.version);

                let message = format!(
                    "Update v{} is available. Would you like to install it now?",
                    update.version
                );

                let confirm = handle
                    .dialog()
                    .message(message)
                    .title("Update Available")
                    .kind(MessageDialogKind::Info)
                    .buttons(MessageDialogButtons::YesNo)
                    .blocking_show();

                if confirm {
                    println!("User confirmed update, downloading and installing...");

                    use std::sync::{Arc, Mutex};
                    let downloaded = Arc::new(Mutex::new(0u64));
                    let last_percentage = Arc::new(Mutex::new(0u8));
                    let handle_for_progress = handle.clone();

                    if let Err(e) = update.download_and_install(
                        move |chunk_length, content_length| {
                            let mut downloaded_bytes = downloaded.lock().unwrap();
                            *downloaded_bytes += chunk_length as u64;

                            if let Some(total) = content_length {
                                let percentage = ((*downloaded_bytes as f64 / total as f64) * 100.0) as u8;
                                let mut last_pct = last_percentage.lock().unwrap();

                                if percentage >= *last_pct + 5 || percentage == 100 {
                                    *last_pct = percentage;
                                    println!("Download progress: {}% ({}/{})", percentage, *downloaded_bytes, total);

                                    let _ = handle_for_progress.emit("update-download-progress", json!({
                                        "percentage": percentage,
                                        "downloaded": *downloaded_bytes,
                                        "total": total
                                    }));
                                }
                            } else {
                                println!("Downloaded: {} bytes", *downloaded_bytes);
                            }
                        },
                        || {
                            println!("Update download completed, installing...");
                        }
                    ).await {
                        eprintln!("Failed to download and install update: {}", e);
                        handle
                            .dialog()
                            .message(format!("Failed to install update: {}", e))
                            .title("Update Error")
                            .kind(MessageDialogKind::Error)
                            .blocking_show();
                    } else {
                        println!("Update installed successfully, preparing to restart...");

                        handle
                            .dialog()
                            .message("Update downloaded and installed successfully. The application will restart to apply the update.")
                            .title("Update Complete")
                            .kind(MessageDialogKind::Info)
                            .buttons(MessageDialogButtons::Ok)
                            .blocking_show();

                        println!("Restarting application...");
                        handle.restart();
                    }
                } else {
                    println!("User declined update");
                }
            }
            Ok(None) => {
                println!("No updates available");
                if is_manual {
                    let current_version = handle.package_info().version.to_string();
                    handle
                        .dialog()
                        .message(format!("You're running the latest version (v{}).", current_version))
                        .title("No Updates Available")
                        .kind(MessageDialogKind::Info)
                        .buttons(MessageDialogButtons::Ok)
                        .blocking_show();
                }
            }
            Err(e) => {
                eprintln!("Failed to check for updates: {}", e);
                if is_manual {
                    handle
                        .dialog()
                        .message(format!("Failed to check for updates: {}", e))
                        .title("Update Check Error")
                        .kind(MessageDialogKind::Error)
                        .blocking_show();
                }
            }
        }
    }
}

// ===== Main Entry Point =====

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // ===== Cross-platform plugins =====
    builder = builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    // ===== Desktop-only plugins =====
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.unminimize();
                }
            }))
            .plugin(tauri_plugin_shell::init())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    // ===== Desktop-only window close handler =====
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        builder = builder.on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();

                let window_clone = window.clone();

                tauri::async_runtime::spawn(async move {
                    let confirm = window_clone
                        .dialog()
                        .message("Are you sure you want to close Monobase Account?")
                        .title("Confirm Exit")
                        .kind(MessageDialogKind::Warning)
                        .buttons(MessageDialogButtons::YesNo)
                        .blocking_show();

                    if confirm {
                        let cadence = window_clone.try_state::<CadenceState>().map(|s| s.inner().clone());
                        graceful_shutdown("user confirmation", cadence).await;
                    }
                });
            }
            _ => {}
        });
    }

    // ===== Setup =====
    builder = builder.setup(|app| {
        // Initialize log plugin with proper devtools integration
        #[cfg(not(any(target_os = "ios", target_os = "android")))]
        {
            let (tauri_plugin_log, max_level, logger) =
                tauri_plugin_log::Builder::default().split(app.handle())?;

            let mut devtools_builder = tauri_plugin_devtools::Builder::default();
            devtools_builder.attach_logger(logger);
            app.handle().plugin(devtools_builder.init())?;

            app.handle().plugin(tauri_plugin_log)?;
            let _ = max_level;
        }

        #[cfg(any(target_os = "ios", target_os = "android"))]
        {
            if let Err(e) = app.handle().plugin(tauri_plugin_log::Builder::default().build()) {
                eprintln!("Failed to initialize log plugin: {} - continuing without logging", e);
            }
        }

        // Resolve configuration
        let data_dir_override = app.path().app_data_dir().ok();
        let app_config = Arc::new(config::AppConfig::resolve(data_dir_override));

        // Extract database path from config (strip sqlite:// prefix)
        let db_path = app_config
            .embedded_database_url
            .strip_prefix("sqlite://")
            .unwrap_or(&app_config.embedded_database_url)
            .to_string();

        // Initialize embedded api-ts (QuickJS bundle + native SQLite bridge)
        let (api_state, init_error_state) = mobile::setup_api_ts(app, &db_path);

        // Cadence state (started async after a short delay)
        let cadence: CadenceState = Arc::new(Mutex::new(None));

        // Manage state
        app.manage(app_config.clone() as commands::AppConfigState);
        app.manage(api_state);
        app.manage(init_error_state);
        app.manage(cadence.clone());

        // Start cadence in background (200 ms delay so the UI isn't blocked on first paint)
        {
            let config_for_setup = app_config.clone();
            let cadence_for_setup = cadence.clone();
            let app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(200)).await;

                #[cfg(not(any(target_os = "ios", target_os = "android")))]
                {
                    let _ = app_handle.emit("service:starting", "Starting services...");
                }

                match cadence_embed::EmbeddedCadence::start(&config_for_setup).await {
                    Ok(embedded) => {
                        *cadence_for_setup.lock().await = Some(embedded);
                        log::info!("Cadence started (embedded, no API/WS servers)");
                    }
                    Err(e) => {
                        log::error!("Failed to start cadence: {}", e);
                        #[cfg(not(any(target_os = "ios", target_os = "android")))]
                        {
                            let _ = app_handle.emit("service:error", &format!("Cadence error: {}", e));
                        }
                    }
                }

                #[cfg(not(any(target_os = "ios", target_os = "android")))]
                {
                    let _ = app_handle.emit("service:ready", "All services started");
                }
            });
        }

        // Desktop-specific setup (tray, updater, signal handling)
        #[cfg(not(any(target_os = "ios", target_os = "android")))]
        {
            setup_desktop(app, cadence)?;
        }

        Ok(())
    });

    // ===== Commands =====
    builder = builder.invoke_handler(tauri::generate_handler![
        commands::get_runtime_config,
        commands::get_app_config,
        // Cadence
        commands::get_cadence_health,
        commands::get_cadence_status,
        commands::set_peer_token,
        commands::get_peer_token,
        commands::clear_peer_token,
        commands::set_peers,
        commands::get_peers,
        commands::clear_peers,
        // Embedded api-ts backend
        commands::api_request,
        commands::get_backend_status,
        commands::restart_engine,
        commands::reset_databases,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ===== Desktop Setup =====

#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn setup_desktop(app: &tauri::App, cadence: CadenceState) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle().clone();

    // Signal handling for graceful shutdown
    let cadence_for_signal = cadence.clone();
    tauri::async_runtime::spawn(async move {
        use tokio::signal;

        let shutdown_signal = async {
            let ctrl_c = async {
                signal::ctrl_c().await
                    .expect("failed to install Ctrl+C handler");
            };

            #[cfg(unix)]
            let terminate = async {
                signal::unix::signal(signal::unix::SignalKind::terminate())
                    .expect("failed to install signal handler")
                    .recv()
                    .await;
            };

            #[cfg(not(unix))]
            let terminate = std::future::pending::<()>();

            tokio::select! {
                _ = ctrl_c => {
                    println!("Received Ctrl+C signal");
                },
                _ = terminate => {
                    println!("Received terminate signal");
                },
            }
        };

        shutdown_signal.await;
        graceful_shutdown("system signal", Some(cadence_for_signal)).await;
    });

    // Setup system tray
    tray::setup_system_tray(&app_handle)?;

    // Check for updates on startup (in background)
    let handle = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        check_for_updates(handle, false).await;
    });

    Ok(())
}
