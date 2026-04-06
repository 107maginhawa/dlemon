use cadence::stream::{SyncRead, SyncWrite};
use cadence::transport;
use cadence::protocol::{self, SyncMessage};
use cadence::state::{FieldChange, RowChange, SyncPayload};

// ── In-memory stream for testing ────────────────────────────────

use std::collections::VecDeque;

struct MemSyncWrite {
    data: std::sync::Arc<tokio::sync::Mutex<Vec<u8>>>,
    finished: bool,
}

impl Unpin for MemSyncWrite {}

#[async_trait::async_trait]
impl SyncWrite for MemSyncWrite {
    async fn write_all(&mut self, buf: &[u8]) -> anyhow::Result<()> {
        self.data.lock().await.extend_from_slice(buf);
        Ok(())
    }
    fn finish(&mut self) -> anyhow::Result<()> {
        self.finished = true;
        Ok(())
    }
}

struct MemSyncRead {
    data: VecDeque<u8>,
}

impl Unpin for MemSyncRead {}

#[async_trait::async_trait]
impl SyncRead for MemSyncRead {
    async fn read_exact(&mut self, buf: &mut [u8]) -> anyhow::Result<()> {
        if self.data.len() < buf.len() {
            anyhow::bail!("Not enough data");
        }
        for byte in buf.iter_mut() {
            *byte = self.data.pop_front().unwrap();
        }
        Ok(())
    }
}

#[tokio::test]
async fn test_write_message_with_sync_write_trait() {
    let data = std::sync::Arc::new(tokio::sync::Mutex::new(Vec::new()));
    let mut writer = MemSyncWrite { data: data.clone(), finished: false };
    let payload = b"hello world";
    transport::write_message(&mut writer, payload).await.unwrap();

    let written = data.lock().await;
    // Should be 4-byte length prefix + payload
    assert_eq!(written.len(), 4 + payload.len());
    let len = u32::from_be_bytes([written[0], written[1], written[2], written[3]]) as usize;
    assert_eq!(len, payload.len());
    assert_eq!(&written[4..], payload);
}

#[tokio::test]
async fn test_read_message_with_sync_read_trait() {
    let payload = b"test message";
    let len = payload.len() as u32;
    let mut raw = Vec::new();
    raw.extend_from_slice(&len.to_be_bytes());
    raw.extend_from_slice(payload);

    let mut reader = MemSyncRead { data: VecDeque::from(raw) };
    let result = transport::read_message(&mut reader).await.unwrap();
    assert_eq!(result, payload);
}

#[tokio::test]
async fn test_read_write_roundtrip_via_traits() {
    let data = std::sync::Arc::new(tokio::sync::Mutex::new(Vec::new()));

    // Write
    let mut writer = MemSyncWrite { data: data.clone(), finished: false };
    let payload = b"roundtrip test payload";
    transport::write_message(&mut writer, payload).await.unwrap();

    // Read
    let written = data.lock().await.clone();
    let mut reader = MemSyncRead { data: VecDeque::from(written) };
    let result = transport::read_message(&mut reader).await.unwrap();
    assert_eq!(result, payload);
}

#[tokio::test]
async fn test_message_encode_decode_through_trait_adapter() {
    let msg = SyncMessage::SyncData {
        changes: vec![RowChange {
            collection: "patients".to_string(),
            document_id: "p1".to_string(),
            payload: SyncPayload::Fields(vec![FieldChange {
                field: "name".to_string(),
                value: serde_json::json!("Alice"),
                lamport: 42,
                peer_id: "peer-1".to_string(),
            }]),
            deleted: false,
            seq: 1,
        }],
        done: true,
    };

    // Encode → write → read → decode
    let encoded = protocol::encode_message_raw(&msg).unwrap();

    let data = std::sync::Arc::new(tokio::sync::Mutex::new(Vec::new()));
    let mut writer = MemSyncWrite { data: data.clone(), finished: false };
    transport::write_message(&mut writer, &encoded).await.unwrap();

    let written = data.lock().await.clone();
    let mut reader = MemSyncRead { data: VecDeque::from(written) };
    let raw = transport::read_message(&mut reader).await.unwrap();
    let decoded: SyncMessage = protocol::decode_message_raw(&raw).unwrap();

    assert_eq!(msg, decoded);
}

#[tokio::test]
async fn test_sync_write_finish() {
    let data = std::sync::Arc::new(tokio::sync::Mutex::new(Vec::new()));
    let mut writer = MemSyncWrite { data, finished: false };
    assert!(!writer.finished);
    writer.finish().unwrap();
    assert!(writer.finished);
}

#[tokio::test]
async fn test_multiple_messages_through_traits() {
    let data = std::sync::Arc::new(tokio::sync::Mutex::new(Vec::new()));
    let mut writer = MemSyncWrite { data: data.clone(), finished: false };

    // Write 3 messages
    transport::write_message(&mut writer, b"msg-1").await.unwrap();
    transport::write_message(&mut writer, b"msg-2").await.unwrap();
    transport::write_message(&mut writer, b"msg-3").await.unwrap();

    // Read them back
    let written = data.lock().await.clone();
    let mut reader = MemSyncRead { data: VecDeque::from(written) };
    assert_eq!(transport::read_message(&mut reader).await.unwrap(), b"msg-1");
    assert_eq!(transport::read_message(&mut reader).await.unwrap(), b"msg-2");
    assert_eq!(transport::read_message(&mut reader).await.unwrap(), b"msg-3");
}
