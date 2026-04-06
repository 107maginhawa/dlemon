use anyhow::Result;
use futures_util::StreamExt;

use crate::peer_status::PeerTransport;
use crate::stream::{TungsteniteWsSyncRead, TungsteniteWsSyncWrite};
use crate::sync::SyncEngine;

/// Connect to a remote peer via WebSocket (client side).
/// Returns after the sync session ends or errors.
pub async fn connect_ws_peer(
    url: &str,
    engine: &SyncEngine,
    jwt: &str,
    change_rx: tokio::sync::broadcast::Receiver<Vec<crate::state::RowChange>>,
    session_key: &str,
) -> Result<()> {
    let (ws_stream, _response) = tokio_tungstenite::connect_async(url)
        .await
        .map_err(|e| anyhow::anyhow!("WebSocket connect to {} failed: {}", url, e))?;

    tracing::info!("WebSocket connected to {}", url);

    let (ws_send, ws_recv) = ws_stream.split();
    let mut send = TungsteniteWsSyncWrite::new(ws_send);
    let mut recv = TungsteniteWsSyncRead::new(ws_recv);

    engine
        .initiate_sync_stream(&mut send, &mut recv, jwt, change_rx, session_key, PeerTransport::WebSocket)
        .await
}
