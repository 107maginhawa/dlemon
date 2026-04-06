use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::schema::{SchemaCompatibility, SchemaFingerprint};
use crate::state::{FieldChange, RowChange, SyncPayload};

/// ALPN protocol identifier for Cadence v2.
pub const CADENCE_ALPN: &[u8] = b"cadence-sync/v2";

/// Messages exchanged between peers over Iroh QUIC streams.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncMessage {
    /// Initial handshake: peer sends JWT, schema fingerprint, and watermark.
    Hello {
        jwt: String,
        peer_id: String,
        schema_fingerprint: SchemaFingerprint,
        since_seq: u64,
        /// When resuming an interrupted initial catchup, the seq up to which
        /// the client already has data. The server can skip records with
        /// seq <= this value in the full snapshot path. None means no resume.
        resume_after_seq: Option<u64>,
    },

    /// Handshake response with acceptor's watermark.
    HelloAck {
        peer_id: String,
        ok: bool,
        schema_compatibility: BTreeMap<String, SchemaCompatibility>,
        since_seq: u64,
        catch_up_total: u64,
    },

    /// Request changes since a given sequence number.
    SyncRequest { since_seq: u64 },

    /// A batch of row changes (or done marker).
    SyncData {
        changes: Vec<RowChange>,
        done: bool,
    },

    /// Acknowledgment of received changes.
    Ack { last_received_seq: u64 },

    /// Keepalive probe for persistent connections.
    Keepalive,
}

// --- Wire types for postcard serialization ---
// postcard requires non-self-describing types. serde_json::Value is self-describing,
// so we convert FieldChange.value to a JSON string for wire transfer.

#[derive(Serialize, Deserialize)]
struct WireFieldChange {
    field: String,
    /// JSON-encoded value string
    value: String,
    lamport: u64,
    peer_id: String,
}

#[derive(Serialize, Deserialize)]
enum WireSyncPayload {
    Fields(Vec<WireFieldChange>),
    CrdtDoc(Vec<u8>),
}

#[derive(Serialize, Deserialize)]
struct WireRowChange {
    collection: String,
    document_id: String,
    payload: WireSyncPayload,
    deleted: bool,
    seq: u64,
}

#[derive(Serialize, Deserialize)]
enum WireSyncMessage {
    Hello {
        jwt: String,
        peer_id: String,
        schema_fingerprint: String, // JSON-encoded SchemaFingerprint
        since_seq: u64,
        #[serde(default)]
        resume_after_seq: Option<u64>,
    },
    HelloAck {
        peer_id: String,
        ok: bool,
        schema_compatibility: String, // JSON-encoded
        since_seq: u64,
        catch_up_total: u64,
    },
    SyncRequest {
        since_seq: u64,
    },
    SyncData {
        changes: Vec<WireRowChange>,
        done: bool,
    },
    Ack {
        last_received_seq: u64,
    },
    Keepalive,
}

fn to_wire_msg(msg: &SyncMessage) -> anyhow::Result<WireSyncMessage> {
    Ok(match msg {
        SyncMessage::Hello { jwt, peer_id, schema_fingerprint, since_seq, resume_after_seq } => {
            WireSyncMessage::Hello {
                jwt: jwt.clone(),
                peer_id: peer_id.clone(),
                schema_fingerprint: serde_json::to_string(schema_fingerprint)?,
                since_seq: *since_seq,
                resume_after_seq: *resume_after_seq,
            }
        }
        SyncMessage::HelloAck { peer_id, ok, schema_compatibility, since_seq, catch_up_total } => {
            WireSyncMessage::HelloAck {
                peer_id: peer_id.clone(),
                ok: *ok,
                schema_compatibility: serde_json::to_string(schema_compatibility)?,
                since_seq: *since_seq,
                catch_up_total: *catch_up_total,
            }
        }
        SyncMessage::SyncRequest { since_seq } => {
            WireSyncMessage::SyncRequest { since_seq: *since_seq }
        }
        SyncMessage::SyncData { changes, done } => {
            let wire_changes: Vec<WireRowChange> = changes.iter().map(|c| {
                let payload = match &c.payload {
                    SyncPayload::Fields(fields) => {
                        WireSyncPayload::Fields(fields.iter().map(|f| WireFieldChange {
                            field: f.field.clone(),
                            value: serde_json::to_string(&f.value).unwrap_or_default(),
                            lamport: f.lamport,
                            peer_id: f.peer_id.clone(),
                        }).collect())
                    }
                    SyncPayload::CrdtDoc(bytes) => WireSyncPayload::CrdtDoc(bytes.clone()),
                };
                WireRowChange {
                    collection: c.collection.clone(),
                    document_id: c.document_id.clone(),
                    payload,
                    deleted: c.deleted,
                    seq: c.seq,
                }
            }).collect();
            WireSyncMessage::SyncData { changes: wire_changes, done: *done }
        }
        SyncMessage::Ack { last_received_seq } => {
            WireSyncMessage::Ack { last_received_seq: *last_received_seq }
        }
        SyncMessage::Keepalive => WireSyncMessage::Keepalive,
    })
}

fn from_wire_msg(wire: WireSyncMessage) -> anyhow::Result<SyncMessage> {
    Ok(match wire {
        WireSyncMessage::Hello { jwt, peer_id, schema_fingerprint, since_seq, resume_after_seq } => {
            SyncMessage::Hello {
                jwt,
                peer_id,
                schema_fingerprint: serde_json::from_str(&schema_fingerprint)?,
                since_seq,
                resume_after_seq,
            }
        }
        WireSyncMessage::HelloAck { peer_id, ok, schema_compatibility, since_seq, catch_up_total } => {
            SyncMessage::HelloAck {
                peer_id,
                ok,
                schema_compatibility: serde_json::from_str(&schema_compatibility)?,
                since_seq,
                catch_up_total,
            }
        }
        WireSyncMessage::SyncRequest { since_seq } => {
            SyncMessage::SyncRequest { since_seq }
        }
        WireSyncMessage::SyncData { changes, done } => {
            let row_changes: Vec<RowChange> = changes.into_iter().map(|c| {
                let payload = match c.payload {
                    WireSyncPayload::Fields(fields) => {
                        SyncPayload::Fields(fields.into_iter().map(|f| FieldChange {
                            field: f.field,
                            value: serde_json::from_str(&f.value).unwrap_or(serde_json::Value::Null),
                            lamport: f.lamport,
                            peer_id: f.peer_id,
                        }).collect())
                    }
                    WireSyncPayload::CrdtDoc(bytes) => SyncPayload::CrdtDoc(bytes),
                };
                RowChange {
                    collection: c.collection,
                    document_id: c.document_id,
                    payload,
                    deleted: c.deleted,
                    seq: c.seq,
                }
            }).collect();
            SyncMessage::SyncData { changes: row_changes, done }
        }
        WireSyncMessage::Ack { last_received_seq } => {
            SyncMessage::Ack { last_received_seq }
        }
        WireSyncMessage::Keepalive => SyncMessage::Keepalive,
    })
}

/// Serialize a SyncMessage to bytes with a 4-byte length prefix (postcard format).
pub fn encode_message(msg: &SyncMessage) -> anyhow::Result<Vec<u8>> {
    let wire = to_wire_msg(msg)?;
    let payload = postcard::to_allocvec(&wire)
        .map_err(|e| anyhow::anyhow!("postcard encode error: {}", e))?;
    let len = payload.len() as u32;
    let mut buf = Vec::with_capacity(4 + payload.len());
    buf.extend_from_slice(&len.to_be_bytes());
    buf.extend_from_slice(&payload);
    Ok(buf)
}

/// Deserialize a SyncMessage from bytes (expects 4-byte length prefix, postcard format).
pub fn decode_message(data: &[u8]) -> anyhow::Result<SyncMessage> {
    if data.len() < 4 {
        anyhow::bail!("Message too short: {} bytes", data.len());
    }
    let len = u32::from_be_bytes([data[0], data[1], data[2], data[3]]) as usize;
    if data.len() < 4 + len {
        anyhow::bail!(
            "Message truncated: expected {} bytes, got {}",
            4 + len,
            data.len()
        );
    }
    let wire: WireSyncMessage = postcard::from_bytes(&data[4..4 + len])
        .map_err(|e| anyhow::anyhow!("postcard decode error: {}", e))?;
    from_wire_msg(wire)
}

/// Serialize a SyncMessage to raw bytes without length prefix (postcard format).
pub fn encode_message_raw(msg: &SyncMessage) -> anyhow::Result<Vec<u8>> {
    let wire = to_wire_msg(msg)?;
    postcard::to_allocvec(&wire)
        .map_err(|e| anyhow::anyhow!("postcard encode error: {}", e))
}

/// Deserialize a SyncMessage from raw bytes without length prefix (postcard format).
pub fn decode_message_raw(data: &[u8]) -> anyhow::Result<SyncMessage> {
    let wire: WireSyncMessage = postcard::from_bytes(data)
        .map_err(|e| anyhow::anyhow!("postcard decode error: {}", e))?;
    from_wire_msg(wire)
}
