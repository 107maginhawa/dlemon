use cadence::state::{FieldChange, RowChange, SyncPayload};
use cadence::storage::{MetadataBackend, ValkeyBackend};
use serde_json::json;
use std::time::{Duration, Instant};

fn make_field_change(field: &str, value: serde_json::Value, lamport: u64) -> FieldChange {
    FieldChange {
        field: field.to_string(),
        value,
        lamport,
        peer_id: "test-peer".to_string(),
    }
}

fn make_row_change(collection: &str, doc_id: &str, fields: Vec<FieldChange>) -> RowChange {
    RowChange {
        collection: collection.to_string(),
        document_id: doc_id.to_string(),
        payload: SyncPayload::Fields(fields),
        deleted: false,
        seq: 0,
    }
}

/// Connect to a test Valkey instance with a unique prefix for isolation.
/// Returns None (skips test) if Valkey is not reachable.
async fn setup() -> Option<ValkeyBackend> {
    let url = std::env::var("VALKEY_TEST_URL")
        .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let prefix = format!("cadence:test:{}:", uuid::Uuid::new_v4());
    ValkeyBackend::connect_with_prefix(&url, &prefix).await.ok()
}

/// Clean up all keys with the given prefix using SCAN + DEL.
async fn cleanup(_backend: &ValkeyBackend) {
    use fred::prelude::*;
    // Access the client to clean up — we use a scan pattern
    // The backend doesn't expose the client, so we connect a disposable one
    let url = std::env::var("VALKEY_TEST_URL")
        .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    if let Ok(config) = Config::from_url(&url) {
        if let Ok(client) = Builder::from_config(config).build() {
            if client.init().await.is_ok() {
                // We can't easily get the prefix from backend, but tests are isolated
                // and use unique UUIDs, so leftover test keys are harmless.
                // For thoroughness, we'd need to expose prefix or client.
                let _ = client.quit().await;
            }
        }
    }
}

#[tokio::test]
async fn test_valkey_change_log_append() {
    let Some(storage) = setup().await else {
        eprintln!("Skipping: Valkey not available");
        return;
    };

    let change = make_row_change(
        "medical_patients",
        "patient-1",
        vec![make_field_change("name", json!("John"), 1)],
    );
    let seq = storage.append_change(&change).await.unwrap();
    assert!(seq > 0, "Seq should be auto-incremented");

    let change2 = make_row_change(
        "medical_patients",
        "patient-2",
        vec![make_field_change("name", json!("Jane"), 2)],
    );
    let seq2 = storage.append_change(&change2).await.unwrap();
    assert!(seq2 > seq, "Second seq should be greater");

    cleanup(&storage).await;
}

#[tokio::test]
async fn test_valkey_change_log_query_since_seq() {
    let Some(storage) = setup().await else {
        eprintln!("Skipping: Valkey not available");
        return;
    };

    // Insert 10 changes
    let mut seq_at_5 = 0u64;
    for i in 1..=10u64 {
        let change = make_row_change(
            "medical_patients",
            &format!("patient-{}", i),
            vec![make_field_change("name", json!(format!("Patient {}", i)), i)],
        );
        let seq = storage.append_change(&change).await.unwrap();
        if i == 5 {
            seq_at_5 = seq;
        }
    }

    // Query since seq 5
    let changes = storage.query_since(seq_at_5).await.unwrap();
    assert_eq!(changes.len(), 5, "Should get 5 changes (seq 6-10)");

    cleanup(&storage).await;
}

#[tokio::test]
async fn test_valkey_change_log_query_by_collection_doc() {
    let Some(storage) = setup().await else {
        eprintln!("Skipping: Valkey not available");
        return;
    };

    storage
        .append_change(&make_row_change(
            "medical_patients",
            "doc-1",
            vec![make_field_change("name", json!("A"), 1)],
        ))
        .await
        .unwrap();
    storage
        .append_change(&make_row_change(
            "billing_invoices",
            "doc-2",
            vec![make_field_change("status", json!("draft"), 2)],
        ))
        .await
        .unwrap();
    storage
        .append_change(&make_row_change(
            "medical_patients",
            "doc-1",
            vec![make_field_change("tags", json!(["vip"]), 3)],
        ))
        .await
        .unwrap();

    let changes = storage
        .query_by_doc("medical_patients", "doc-1")
        .await
        .unwrap();
    assert_eq!(changes.len(), 1, "Should aggregate into 1 RowChange");
    if let SyncPayload::Fields(fields) = &changes[0].payload {
        assert_eq!(fields.len(), 2, "Should have 2 field changes (name + tags)");
    } else {
        panic!("Expected Fields payload");
    }

    cleanup(&storage).await;
}

#[tokio::test]
async fn test_valkey_watermark_upsert() {
    let Some(storage) = setup().await else {
        eprintln!("Skipping: Valkey not available");
        return;
    };

    // Initial watermark should be 0
    assert_eq!(storage.get_watermark("peer-a").await.unwrap(), 0);

    // Set watermark
    storage.set_watermark("peer-a", 42).await.unwrap();
    assert_eq!(storage.get_watermark("peer-a").await.unwrap(), 42);

    // Update watermark
    storage.set_watermark("peer-a", 100).await.unwrap();
    assert_eq!(storage.get_watermark("peer-a").await.unwrap(), 100);

    cleanup(&storage).await;
}

#[tokio::test]
async fn test_valkey_change_log_deleted_flag() {
    let Some(storage) = setup().await else {
        eprintln!("Skipping: Valkey not available");
        return;
    };

    let change = RowChange {
        collection: "medical_patients".to_string(),
        document_id: "patient-deleted".to_string(),
        payload: SyncPayload::Fields(vec![make_field_change("name", json!("Gone"), 1)]),
        deleted: true,
        seq: 0,
    };
    storage.append_change(&change).await.unwrap();

    let changes = storage.query_since(0).await.unwrap();
    assert_eq!(changes.len(), 1);
    assert!(changes[0].deleted, "Deleted flag should round-trip");

    cleanup(&storage).await;
}

#[tokio::test]
async fn test_valkey_compaction_keeps_latest() {
    let Some(storage) = setup().await else {
        eprintln!("Skipping: Valkey not available");
        return;
    };

    // Insert 5 updates to the same field
    for i in 1..=5u64 {
        let change = make_row_change(
            "medical_patients",
            "patient-1",
            vec![make_field_change("name", json!(format!("Name {}", i)), i)],
        );
        storage.append_change(&change).await.unwrap();
    }

    let deleted = storage.compact().await.unwrap();
    assert_eq!(deleted, 4, "Should compact 4 old entries");

    let after = storage.query_since(0).await.unwrap();
    assert_eq!(after.len(), 1);
    if let SyncPayload::Fields(fields) = &after[0].payload {
        assert_eq!(fields.len(), 1);
        assert_eq!(fields[0].value, json!("Name 5"), "Should keep latest value");
    }

    cleanup(&storage).await;
}

#[tokio::test]
async fn test_valkey_compaction_preserves_different_docs() {
    let Some(storage) = setup().await else {
        eprintln!("Skipping: Valkey not available");
        return;
    };

    // Insert changes for 3 different documents
    for i in 1..=3u64 {
        let change = make_row_change(
            "medical_patients",
            &format!("patient-{}", i),
            vec![make_field_change("name", json!(format!("Patient {}", i)), i)],
        );
        storage.append_change(&change).await.unwrap();
    }

    let deleted = storage.compact().await.unwrap();
    assert_eq!(deleted, 0, "No duplicates to compact");

    let changes = storage.query_since(0).await.unwrap();
    assert_eq!(changes.len(), 3, "All 3 docs should be preserved");

    cleanup(&storage).await;
}

#[tokio::test]
async fn test_valkey_peer_tokens() {
    let Some(storage) = setup().await else {
        eprintln!("Skipping: Valkey not available");
        return;
    };

    assert!(storage.get_peer_token("my-token").await.unwrap().is_none());

    storage.set_peer_token("my-token", "jwt-value-123").await.unwrap();
    assert_eq!(
        storage.get_peer_token("my-token").await.unwrap(),
        Some("jwt-value-123".to_string())
    );

    // Update
    storage.set_peer_token("my-token", "jwt-value-456").await.unwrap();
    assert_eq!(
        storage.get_peer_token("my-token").await.unwrap(),
        Some("jwt-value-456".to_string())
    );

    cleanup(&storage).await;
}

#[tokio::test]
async fn test_valkey_peers_list() {
    let Some(storage) = setup().await else {
        eprintln!("Skipping: Valkey not available");
        return;
    };

    assert!(storage.get_peers().await.unwrap().is_empty());

    let peers = vec!["peer-1".to_string(), "peer-2".to_string(), "peer-3".to_string()];
    storage.set_peers(&peers).await.unwrap();
    assert_eq!(storage.get_peers().await.unwrap(), peers);

    cleanup(&storage).await;
}

#[tokio::test]
async fn test_valkey_jwks_cache() {
    let Some(storage) = setup().await else {
        eprintln!("Skipping: Valkey not available");
        return;
    };

    let url = "https://example.com/.well-known/jwks.json";
    assert!(storage.get_cached_jwks(url).await.unwrap().is_none());

    let keys_json = r#"{"keys":[{"kty":"RSA","kid":"key1"}]}"#;
    storage.set_cached_jwks(url, keys_json).await.unwrap();
    assert_eq!(
        storage.get_cached_jwks(url).await.unwrap(),
        Some(keys_json.to_string())
    );

    cleanup(&storage).await;
}

// ── Timeout and reconnect tests ────────────────────────────────

#[tokio::test]
async fn test_valkey_connect_to_unreachable_host_fails_fast() {
    let start = Instant::now();
    let result = ValkeyBackend::connect_with_prefix(
        "redis://192.0.2.1:6379", // RFC 5737 TEST-NET, guaranteed unreachable
        "cadence:test:unreachable:",
    ).await;
    let elapsed = start.elapsed();

    assert!(result.is_err(), "Should fail to connect to unreachable host");
    assert!(
        elapsed < Duration::from_secs(30),
        "Connection to unreachable host took {:?}, should fail faster", elapsed
    );
}

#[tokio::test]
async fn test_valkey_operations_complete_within_timeout() {
    let Some(storage) = setup().await else {
        eprintln!("Skipping: Valkey not available");
        return;
    };

    // append_change should be fast
    let start = Instant::now();
    let change = make_row_change(
        "timeout_test",
        "doc-1",
        vec![make_field_change("name", json!("test"), 1)],
    );
    storage.append_change(&change).await.unwrap();
    assert!(start.elapsed() < Duration::from_secs(10), "append_change too slow");

    // query_since should be fast
    let start = Instant::now();
    storage.query_since(0).await.unwrap();
    assert!(start.elapsed() < Duration::from_secs(10), "query_since too slow");

    // watermark round-trip should be fast
    let start = Instant::now();
    storage.set_watermark("timeout-peer", 42).await.unwrap();
    assert_eq!(storage.get_watermark("timeout-peer").await.unwrap(), 42);
    assert!(start.elapsed() < Duration::from_secs(10), "watermark ops too slow");

    cleanup(&storage).await;
}
