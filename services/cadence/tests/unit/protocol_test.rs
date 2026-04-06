use cadence::protocol::*;
use cadence::schema::{SchemaCompatibility, SchemaFingerprint};
use cadence::state::{FieldChange, RowChange, SyncPayload};
use serde_json::json;
use std::collections::BTreeMap;

fn roundtrip(msg: &SyncMessage) -> SyncMessage {
    let encoded = encode_message(msg).unwrap();
    decode_message(&encoded).unwrap()
}

#[test]
fn test_hello_serialize_roundtrip() {
    let msg = SyncMessage::Hello {
        jwt: "eyJ0eXAi...".to_string(),
        peer_id: "peer-abc".to_string(),
        schema_fingerprint: SchemaFingerprint::empty(),
        since_seq: 42,
        resume_after_seq: None,
    };
    assert_eq!(roundtrip(&msg), msg);
}

#[test]
fn test_hello_with_resume_serialize_roundtrip() {
    let msg = SyncMessage::Hello {
        jwt: "eyJ0eXAi...".to_string(),
        peer_id: "peer-abc".to_string(),
        schema_fingerprint: SchemaFingerprint::empty(),
        since_seq: 0,
        resume_after_seq: Some(5000),
    };
    assert_eq!(roundtrip(&msg), msg);
}

#[test]
fn test_hello_ack_serialize_roundtrip() {
    let mut compat = BTreeMap::new();
    compat.insert(
        "medical_patients".to_string(),
        SchemaCompatibility::Identical,
    );
    compat.insert(
        "billing_invoices".to_string(),
        SchemaCompatibility::Compatible {
            warnings: vec!["Extra column on remote".to_string()],
        },
    );

    let msg = SyncMessage::HelloAck {
        peer_id: "peer-xyz".to_string(),
        ok: true,
        schema_compatibility: compat,
        since_seq: 10,
        catch_up_total: 42,
    };
    assert_eq!(roundtrip(&msg), msg);
}

#[test]
fn test_sync_request_serialize_roundtrip() {
    let msg = SyncMessage::SyncRequest { since_seq: 42 };
    assert_eq!(roundtrip(&msg), msg);
}

#[test]
fn test_sync_data_fields_serialize_roundtrip() {
    let msg = SyncMessage::SyncData {
        changes: vec![RowChange {
            collection: "medical_patients".to_string(),
            document_id: "patient-1".to_string(),
            payload: SyncPayload::Fields(vec![
                FieldChange {
                    field: "name".to_string(),
                    value: json!("John Doe"),
                    lamport: 5,
                    peer_id: "peer-a".to_string(),
                },
                FieldChange {
                    field: "tags".to_string(),
                    value: json!(["vip", "regular"]),
                    lamport: 5,
                    peer_id: "peer-a".to_string(),
                },
            ]),
            deleted: false,
            seq: 10,
        }],
        done: false,
    };
    assert_eq!(roundtrip(&msg), msg);
}

#[test]
fn test_sync_data_crdt_serialize_roundtrip() {
    let msg = SyncMessage::SyncData {
        changes: vec![RowChange {
            collection: "clinical_notes".to_string(),
            document_id: "note-1".to_string(),
            payload: SyncPayload::CrdtDoc(vec![1, 2, 3, 4, 5, 6, 7, 8]),
            deleted: false,
            seq: 20,
        }],
        done: false,
    };
    assert_eq!(roundtrip(&msg), msg);
}

#[test]
fn test_sync_data_done_marker() {
    let msg = SyncMessage::SyncData {
        changes: vec![],
        done: true,
    };
    assert_eq!(roundtrip(&msg), msg);
}

#[test]
fn test_ack_serialize_roundtrip() {
    let msg = SyncMessage::Ack {
        last_received_seq: 999,
    };
    assert_eq!(roundtrip(&msg), msg);
}

#[test]
fn test_keepalive_serialize_roundtrip() {
    let msg = SyncMessage::Keepalive;
    assert_eq!(roundtrip(&msg), msg);
}

#[test]
fn test_invalid_message_deserialization() {
    let garbage = vec![0xFF, 0xFE, 0xFD, 0xFC, 0xFB, 0xFA, 0xF9, 0xF8];

    // With length prefix pointing to garbage
    let mut data = vec![0, 0, 0, 4]; // length = 4
    data.extend_from_slice(&garbage[..4]);

    let result = decode_message(&data);
    assert!(result.is_err(), "Random bytes should fail to deserialize");

    // Raw bytes
    let result = decode_message_raw(&garbage);
    assert!(result.is_err(), "Random bytes should fail to deserialize");
}
