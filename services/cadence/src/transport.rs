use anyhow::{Context, Result};
use iroh::{Endpoint, NodeId, SecretKey};
use std::time::Duration;

use crate::protocol::CADENCE_ALPN;
use crate::stream::{SyncRead, SyncWrite};

/// Create an Iroh endpoint with mDNS discovery enabled.
///
/// If a secret key is provided, the endpoint will use that key for its identity,
/// ensuring a stable node ID across restarts. If None, a new random key is generated.
pub async fn create_endpoint(secret_key: Option<SecretKey>) -> Result<Endpoint> {
    let mut builder = Endpoint::builder()
        .alpns(vec![CADENCE_ALPN.to_vec()])
        .discovery_local_network();

    if let Some(key) = secret_key {
        builder = builder.secret_key(key);
    }

    let endpoint = builder
        .bind()
        .await
        .context("Failed to bind Iroh endpoint")?;

    tracing::info!(
        "Iroh endpoint bound. Node ID: {}",
        endpoint.node_id()
    );

    Ok(endpoint)
}

/// Generate a new Iroh secret key.
pub fn generate_secret_key() -> SecretKey {
    SecretKey::generate(&mut rand::thread_rng())
}

/// Connect to a peer by NodeId.
pub async fn connect_to_peer(
    endpoint: &Endpoint,
    node_id: NodeId,
) -> Result<iroh::endpoint::Connection> {
    let conn = endpoint
        .connect(node_id, CADENCE_ALPN)
        .await
        .context(format!("Failed to connect to peer {}", node_id))?;
    Ok(conn)
}

/// Accept an incoming connection.
pub async fn accept_connection(
    endpoint: &Endpoint,
) -> Result<iroh::endpoint::Connection> {
    let incoming = endpoint
        .accept()
        .await
        .context("No more incoming connections")?;
    let conn = incoming.await.context("Failed to accept connection")?;
    Ok(conn)
}

/// Read a length-prefixed message from a sync-compatible stream.
pub async fn read_message(
    recv: &mut dyn SyncRead,
) -> Result<Vec<u8>> {
    let mut len_buf = [0u8; 4];
    recv.read_exact(&mut len_buf)
        .await
        .context("Failed to read message length")?;
    let len = u32::from_be_bytes(len_buf) as usize;

    if len > 16 * 1024 * 1024 {
        anyhow::bail!("Message too large: {} bytes", len);
    }

    let mut buf = vec![0u8; len];
    recv.read_exact(&mut buf)
        .await
        .context("Failed to read message body")?;

    Ok(buf)
}

/// Read a length-prefixed message with a timeout.
/// Returns `Err` if the timeout expires or the read fails.
pub async fn read_message_timeout(
    recv: &mut dyn SyncRead,
    timeout: Duration,
) -> Result<Vec<u8>> {
    // Use select! for reliable cancellation with trait objects
    tokio::select! {
        result = read_message(recv) => result,
        _ = tokio::time::sleep(timeout) => {
            anyhow::bail!("Read timed out (liveness timeout exceeded)")
        }
    }
}

/// Write a length-prefixed message to a sync-compatible stream.
pub async fn write_message(
    send: &mut dyn SyncWrite,
    data: &[u8],
) -> Result<()> {
    let len = data.len() as u32;
    send.write_all(&len.to_be_bytes())
        .await
        .context("Failed to write message length")?;
    send.write_all(data)
        .await
        .context("Failed to write message body")?;
    Ok(())
}
