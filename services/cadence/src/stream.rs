use anyhow::Result;
use async_trait::async_trait;

/// Trait for reading bytes from a sync stream (QUIC or WebSocket).
#[async_trait]
pub trait SyncRead: Send + Unpin {
    async fn read_exact(&mut self, buf: &mut [u8]) -> Result<()>;
}

/// Trait for writing bytes to a sync stream (QUIC or WebSocket).
#[async_trait]
pub trait SyncWrite: Send + Unpin {
    async fn write_all(&mut self, buf: &[u8]) -> Result<()>;
    fn finish(&mut self) -> Result<()>;
    /// Wait for the remote to acknowledge stream completion.
    /// QUIC implementations should block until the remote drops the connection,
    /// ensuring all data is delivered before CONNECTION_CLOSE is sent.
    /// Default is no-op (suitable for WebSocket).
    async fn stopped(&mut self) -> Result<()> { Ok(()) }
}

// ── Iroh implementations ───────────────────────────────────────────

pub struct IrohSyncRead(pub iroh::endpoint::RecvStream);

#[async_trait]
impl SyncRead for IrohSyncRead {
    async fn read_exact(&mut self, buf: &mut [u8]) -> Result<()> {
        self.0
            .read_exact(buf)
            .await
            .map_err(|e| anyhow::anyhow!("Iroh read error: {}", e))?;
        Ok(())
    }
}

pub struct IrohSyncWrite(pub iroh::endpoint::SendStream);

#[async_trait]
impl SyncWrite for IrohSyncWrite {
    async fn write_all(&mut self, buf: &[u8]) -> Result<()> {
        self.0
            .write_all(buf)
            .await
            .map_err(|e| anyhow::anyhow!("Iroh write error: {}", e))?;
        Ok(())
    }

    fn finish(&mut self) -> Result<()> {
        self.0
            .finish()
            .map_err(|e| anyhow::anyhow!("Iroh finish error: {}", e))
    }

    async fn stopped(&mut self) -> Result<()> {
        // stopped() resolves when the remote drops the Connection (ClosedStream),
        // which is the normal case. Convert both Ok and Err to Ok(()).
        let _ = self.0.stopped().await;
        Ok(())
    }
}

// ── WebSocket implementations ──────────────────────────────────────

use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use futures_util::stream::SplitSink;
use futures_util::stream::SplitStream;
use std::collections::VecDeque;

/// WebSocket writer that sends binary frames with length-prefixed messages.
pub struct WsSyncWrite {
    sink: SplitSink<WebSocket, Message>,
}

impl WsSyncWrite {
    pub fn new(sink: SplitSink<WebSocket, Message>) -> Self {
        Self { sink }
    }
}

impl Unpin for WsSyncWrite {}

#[async_trait]
impl SyncWrite for WsSyncWrite {
    async fn write_all(&mut self, buf: &[u8]) -> Result<()> {
        self.sink
            .send(Message::Binary(buf.to_vec().into()))
            .await
            .map_err(|e| anyhow::anyhow!("WebSocket send error: {}", e))
    }

    fn finish(&mut self) -> Result<()> {
        // WebSocket has no explicit finish; close is handled at connection level
        Ok(())
    }
}

/// WebSocket reader that reads binary frames and presents them as a byte stream.
/// The sync protocol uses length-prefixed messages, and each WS binary frame
/// may contain partial or multiple length-prefixed messages. This adapter
/// buffers incoming data so `read_exact` works seamlessly.
pub struct WsSyncRead {
    stream: SplitStream<WebSocket>,
    buffer: VecDeque<u8>,
}

impl WsSyncRead {
    pub fn new(stream: SplitStream<WebSocket>) -> Self {
        Self {
            stream,
            buffer: VecDeque::new(),
        }
    }
}

impl Unpin for WsSyncRead {}

#[async_trait]
impl SyncRead for WsSyncRead {
    async fn read_exact(&mut self, buf: &mut [u8]) -> Result<()> {
        while self.buffer.len() < buf.len() {
            match self.stream.next().await {
                Some(Ok(Message::Binary(data))) => {
                    self.buffer.extend(data.iter());
                }
                Some(Ok(Message::Close(_))) | None => {
                    anyhow::bail!("WebSocket closed before read completed");
                }
                Some(Ok(Message::Ping(_) | Message::Pong(_))) => {
                    // Skip control frames
                    continue;
                }
                Some(Ok(Message::Text(_))) => {
                    // Ignore text frames; sync uses binary only
                    continue;
                }
                Some(Err(e)) => {
                    anyhow::bail!("WebSocket read error: {}", e);
                }
            }
        }

        // Drain exactly buf.len() bytes from the front of the buffer
        for byte in buf.iter_mut() {
            *byte = self.buffer.pop_front().unwrap();
        }

        Ok(())
    }
}

// ── Tungstenite (client-side) WebSocket implementations ────────────

use tokio_tungstenite::WebSocketStream;
use tokio::net::TcpStream;
use tokio_tungstenite::MaybeTlsStream;
use tokio_tungstenite::tungstenite::Message as TungsteniteMessage;

type TungsteniteWsStream = WebSocketStream<MaybeTlsStream<TcpStream>>;

/// Client-side WebSocket writer using tokio-tungstenite.
pub struct TungsteniteWsSyncWrite {
    sink: futures_util::stream::SplitSink<TungsteniteWsStream, TungsteniteMessage>,
}

impl TungsteniteWsSyncWrite {
    pub fn new(sink: futures_util::stream::SplitSink<TungsteniteWsStream, TungsteniteMessage>) -> Self {
        Self { sink }
    }
}

impl Unpin for TungsteniteWsSyncWrite {}

#[async_trait]
impl SyncWrite for TungsteniteWsSyncWrite {
    async fn write_all(&mut self, buf: &[u8]) -> Result<()> {
        self.sink
            .send(TungsteniteMessage::Binary(buf.to_vec().into()))
            .await
            .map_err(|e| anyhow::anyhow!("Tungstenite send error: {}", e))
    }

    fn finish(&mut self) -> Result<()> {
        Ok(())
    }
}

/// Client-side WebSocket reader using tokio-tungstenite.
pub struct TungsteniteWsSyncRead {
    stream: futures_util::stream::SplitStream<TungsteniteWsStream>,
    buffer: VecDeque<u8>,
}

impl TungsteniteWsSyncRead {
    pub fn new(stream: futures_util::stream::SplitStream<TungsteniteWsStream>) -> Self {
        Self {
            stream,
            buffer: VecDeque::new(),
        }
    }
}

impl Unpin for TungsteniteWsSyncRead {}

#[async_trait]
impl SyncRead for TungsteniteWsSyncRead {
    async fn read_exact(&mut self, buf: &mut [u8]) -> Result<()> {
        while self.buffer.len() < buf.len() {
            match self.stream.next().await {
                Some(Ok(TungsteniteMessage::Binary(data))) => {
                    self.buffer.extend(data.iter());
                }
                Some(Ok(TungsteniteMessage::Close(_))) | None => {
                    anyhow::bail!("WebSocket closed before read completed");
                }
                Some(Ok(TungsteniteMessage::Ping(_) | TungsteniteMessage::Pong(_))) => {
                    continue;
                }
                Some(Ok(TungsteniteMessage::Text(_))) => {
                    continue;
                }
                Some(Ok(TungsteniteMessage::Frame(_))) => {
                    continue;
                }
                Some(Err(e)) => {
                    anyhow::bail!("Tungstenite read error: {}", e);
                }
            }
        }

        for byte in buf.iter_mut() {
            *byte = self.buffer.pop_front().unwrap();
        }

        Ok(())
    }
}
