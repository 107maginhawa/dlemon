use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::{watch, Mutex};
use tokio::task::AbortHandle;

use crate::config::CadenceConfig;
use crate::peer_status::PeerTransport;
use crate::state::ChangeBroadcaster;
use crate::sync::SyncEngine;
use crate::token::TokenStore;

/// Manages outbound peer connections, reconciling desired peers with running tasks.
pub struct ConnectionManager {
    engine: Arc<SyncEngine>,
    token_store: Arc<TokenStore>,
    broadcaster: Arc<ChangeBroadcaster>,
    base_delay_ms: u64,
    max_delay_ms: u64,
    endpoint: Option<Arc<iroh::Endpoint>>,
    tasks: Mutex<HashMap<String, AbortHandle>>,
}

impl ConnectionManager {
    pub fn new(
        engine: Arc<SyncEngine>,
        token_store: Arc<TokenStore>,
        broadcaster: Arc<ChangeBroadcaster>,
        config: &CadenceConfig,
        endpoint: Option<Arc<iroh::Endpoint>>,
    ) -> Arc<Self> {
        Arc::new(Self {
            engine,
            token_store,
            broadcaster,
            base_delay_ms: config.reconnect_base_delay_ms,
            max_delay_ms: config.reconnect_max_delay_ms,
            endpoint,
            tasks: Mutex::new(HashMap::new()),
        })
    }

    /// Start the background reconciliation loop that watches for peer list changes.
    pub fn start(self: &Arc<Self>, mut peer_change_rx: watch::Receiver<Vec<String>>) -> AbortHandle {
        let mgr = Arc::clone(self);
        let handle = tokio::spawn(async move {
            // Process the initial value
            {
                let initial = peer_change_rx.borrow_and_update().clone();
                if !initial.is_empty() {
                    mgr.reconcile(initial).await;
                }
            }
            // Watch for changes
            while peer_change_rx.changed().await.is_ok() {
                let desired = peer_change_rx.borrow_and_update().clone();
                mgr.reconcile(desired).await;
            }
        });
        handle.abort_handle()
    }

    /// Diff desired peers against running tasks: spawn new, abort removed.
    async fn reconcile(&self, desired: Vec<String>) {
        let mut tasks = self.tasks.lock().await;

        let desired_set: std::collections::HashSet<&str> =
            desired.iter().map(|s| s.as_str()).collect();
        let current_keys: Vec<String> = tasks.keys().cloned().collect();

        // Remove peers no longer in the desired list
        for key in &current_keys {
            // The task key is "out:<addr>"
            let addr = key.strip_prefix("out:").unwrap_or(key);
            if !desired_set.contains(addr) {
                if let Some(handle) = tasks.remove(key) {
                    handle.abort();
                    self.engine.peer_tracker().set_disconnected(key, Some("Peer removed".to_string()));
                    self.engine.peer_tracker().remove(key);
                }
            }
        }

        // Spawn tasks for new peers
        for addr in &desired {
            let session_key = format!("out:{}", addr);
            if tasks.contains_key(&session_key) {
                continue;
            }
            let abort_handle = self.spawn_peer_loop(addr.clone(), session_key.clone());
            tasks.insert(session_key, abort_handle);
        }
    }

    /// Spawn a reconnection loop for a single peer. Returns its AbortHandle.
    fn spawn_peer_loop(&self, addr: String, session_key: String) -> AbortHandle {
        let engine = Arc::clone(&self.engine);
        let token_store = Arc::clone(&self.token_store);
        let broadcaster = Arc::clone(&self.broadcaster);
        let endpoint = self.endpoint.clone();
        let base_delay = self.base_delay_ms;
        let max_delay = self.max_delay_ms;

        let handle = tokio::spawn(async move {
            let is_ws = addr.starts_with("ws://") || addr.starts_with("wss://");
            let transport_type = if is_ws {
                PeerTransport::WebSocket
            } else {
                PeerTransport::Quic
            };
            let mut backoff_ms = base_delay;

            loop {
                // Wait for a token to be available
                let jwt = match token_store.token().await {
                    Some(t) => t,
                    None => {
                        tracing::warn!(
                            "No peer token available, waiting before connecting to {}",
                            addr
                        );
                        tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                        continue;
                    }
                };

                tracing::info!("Connecting to peer: {}", addr);

                // Register as connecting before attempting connection
                engine
                    .peer_tracker()
                    .register(&session_key, "", &addr, transport_type);

                let sync_result = if is_ws {
                    let change_rx = broadcaster.subscribe();
                    crate::ws::connect_ws_peer(&addr, &engine, &jwt, change_rx, &session_key).await
                } else if let Some(ref ep) = endpoint {
                    let node_id: iroh::NodeId = match addr.parse() {
                        Ok(id) => id,
                        Err(e) => {
                            tracing::error!("Invalid peer NodeId {}: {}", addr, e);
                            engine.peer_tracker().set_disconnected(
                                &session_key,
                                Some(format!("Invalid NodeId: {}", e)),
                            );
                            return; // Fatal for this peer — don't retry
                        }
                    };
                    match crate::transport::connect_to_peer(ep, node_id).await {
                        Ok(conn) => {
                            let change_rx = broadcaster.subscribe();
                            engine
                                .initiate_sync(conn, &jwt, change_rx, &session_key)
                                .await
                        }
                        Err(e) => {
                            engine.peer_tracker().set_disconnected(
                                &session_key,
                                Some(format!("{}", e)),
                            );
                            Err(e)
                        }
                    }
                } else {
                    tracing::error!(
                        "QUIC peer {} configured but no Iroh endpoint available",
                        addr
                    );
                    engine.peer_tracker().set_disconnected(
                        &session_key,
                        Some("No QUIC endpoint available".to_string()),
                    );
                    return; // Fatal — don't retry
                };

                match sync_result {
                    Ok(()) => {
                        backoff_ms = base_delay;
                        tracing::info!("Sync with {} ended cleanly", addr);
                    }
                    Err(e) => {
                        tracing::error!("Sync with peer {} failed: {}", addr, e);
                        engine
                            .peer_tracker()
                            .set_disconnected(&session_key, Some(format!("{}", e)));
                    }
                }

                // Exponential backoff with jitter before reconnecting
                let jitter = (backoff_ms as f64 * 0.1 * rand_jitter()) as u64;
                let delay = backoff_ms + jitter;
                tracing::info!(
                    "Reconnecting to {} in {}ms (backoff: {}ms)",
                    addr,
                    delay,
                    backoff_ms
                );
                tokio::time::sleep(Duration::from_millis(delay)).await;
                backoff_ms = std::cmp::min(backoff_ms * 2, max_delay);
            }
        });
        handle.abort_handle()
    }
}

/// Simple jitter factor (0.0..1.0) using timestamp entropy.
/// Avoids adding a rand dependency just for this.
fn rand_jitter() -> f64 {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    (nanos % 1000) as f64 / 1000.0
}
