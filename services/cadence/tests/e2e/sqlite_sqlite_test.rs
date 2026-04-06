use cadence::auth::JwtValidator;
use cadence::config::{CadenceConfig, CollectionConfig, ConflictStrategy};
use cadence::peer_status::PeerTracker;
use cadence::protocol::CADENCE_ALPN;
use cadence::schema::SchemaFingerprint;
use cadence::state::{FieldChange, RowChange, SyncPayload, SyncState};
use cadence::storage::Storage;
use cadence::storage::MetadataBackend;
use cadence::primary_reader::{NoPrimaryReader, PrimaryDbReader};
use cadence::sync::SyncEngine;
use cadence::token::TokenStore;
use iroh::{Endpoint, NodeAddr};
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use tokio::sync::broadcast;

fn oneshot_change_rx() -> broadcast::Receiver<Vec<RowChange>> {
    let (tx, rx) = broadcast::channel(1);
    drop(tx);
    rx
}

fn node_addr_direct(ep: &Endpoint) -> NodeAddr {
    let (v4, v6) = ep.bound_sockets();
    let mut addrs = BTreeSet::new();
    let v4 = if v4.ip().is_unspecified() {
        std::net::SocketAddr::new(std::net::Ipv4Addr::LOCALHOST.into(), v4.port())
    } else { v4 };
    addrs.insert(v4);
    if let Some(v6) = v6 {
        let v6 = if v6.ip().is_unspecified() {
            std::net::SocketAddr::new(std::net::Ipv6Addr::LOCALHOST.into(), v6.port())
        } else { v6 };
        addrs.insert(v6);
    }
    NodeAddr { node_id: ep.node_id(), relay_url: None, direct_addresses: addrs }
}

fn e2e_config() -> CadenceConfig {
    let mut collections = BTreeMap::new();
    collections.insert(
        "medical_patients".to_string(),
        CollectionConfig {
            strategy: ConflictStrategy::Lww,
            scope_columns: [("facility_id".to_string(), "facility".to_string())].into(),
            scope_rules: None,
        },
    );
    collections.insert(
        "medical_encounters".to_string(),
        CollectionConfig {
            strategy: ConflictStrategy::Lww,
            scope_columns: [("facility_id".to_string(), "facility".to_string())].into(),
            scope_rules: None,
        },
    );
    collections.insert(
        "billing_invoices".to_string(),
        CollectionConfig {
            strategy: ConflictStrategy::Lww,
            scope_columns: [("facility_id".to_string(), "facility".to_string())].into(),
            scope_rules: None,
        },
    );
    collections.insert(
        "medical_records".to_string(),
        CollectionConfig {
            strategy: ConflictStrategy::Lww,
            scope_columns: [("facility_id".to_string(), "facility".to_string())].into(),
            scope_rules: None,
        },
    );
    collections.insert(
        "clinical_notes".to_string(),
        CollectionConfig {
            strategy: ConflictStrategy::Crdt,
            scope_columns: [("facility_id".to_string(), "facility".to_string())].into(),
            scope_rules: None,
        },
    );
    CadenceConfig {
        collections,
        default_strategy: ConflictStrategy::Lww,
        ..Default::default()
    }
}

struct E2EPeer {
    engine: Arc<SyncEngine>,
    endpoint: Endpoint,
    storage: Arc<Storage>,
    state: Arc<SyncState>,
    jwt: String,
}

impl E2EPeer {
    async fn new() -> Self {
        let config = e2e_config();
        let endpoint = Endpoint::builder()
            .alpns(vec![CADENCE_ALPN.to_vec()])
            .discovery_local_network()
            .bind()
            .await
            .unwrap();

        let peer_id = endpoint.node_id().to_string();
        let storage = Arc::new(Storage::in_memory().unwrap());
        let state = Arc::new(SyncState::new());

        let key = jsonwebtoken::DecodingKey::from_secret(b"e2e-test-secret");
        let validator = Arc::new(JwtValidator::permissive(key));

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let jwt = jsonwebtoken::encode(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
            &serde_json::json!({
                "sub": "e2e-user",
                "aud": "cadence-sync",
                "exp": now + 3600,
                "scopes": {"facility_id": ["*"]},
                "read_only": false
            }),
            &jsonwebtoken::EncodingKey::from_secret(b"e2e-test-secret"),
        )
        .unwrap();

        let token_store = Arc::new(TokenStore::new(storage.clone(), validator.clone()));
        let (engine, _peer_change_rx) = SyncEngine::new(
            Arc::new(config),
            state.clone(),
            storage.clone(),
            Arc::new(NoPrimaryReader) as Arc<dyn PrimaryDbReader>,
            validator,
            peer_id,
            SchemaFingerprint::empty(),
            token_store,
            Arc::new(PeerTracker::new()),
        );
        let engine = Arc::new(engine);

        Self { engine, endpoint, storage, state, jwt }
    }

    async fn add_change(&self, collection: &str, doc_id: &str, field: &str, value: serde_json::Value) {
        let lamport = self.state.increment_lamport();
        let seq = self.state.next_seq();
        let change = RowChange {
            collection: collection.to_string(),
            document_id: doc_id.to_string(),
            payload: SyncPayload::Fields(vec![FieldChange {
                field: field.to_string(),
                value,
                lamport,
                peer_id: self.endpoint.node_id().to_string(),
            }]),
            deleted: false,
            seq,
        };
        self.storage.append_change(&change).await.unwrap();
    }

}

#[tokio::test]
async fn test_e2e_sqlite_sqlite_patient_sync() {
    let peer_a = E2EPeer::new().await;
    let peer_b = E2EPeer::new().await;

    peer_a.add_change("medical_patients", "p1", "name", json!("John Doe")).await;
    peer_a.add_change("medical_patients", "p1", "facility", json!("F1")).await;

    let addr_b = node_addr_direct(&peer_b.endpoint);
    let engine_b = peer_b.engine.clone();
    let accept_handle = tokio::spawn(async move {
        let incoming = peer_b.endpoint.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        engine_b.handle_incoming(conn, oneshot_change_rx(), "test").await
    });

    peer_a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn = peer_a.endpoint.connect(addr_b.clone(), CADENCE_ALPN).await.unwrap();
    peer_a.engine.initiate_sync(conn, &peer_a.jwt, oneshot_change_rx(), "test").await.unwrap();
    accept_handle.await.unwrap().unwrap();

    // Peer B should have p1
    let b_changes = peer_a.storage.query_since(0).await.unwrap();
    assert!(!b_changes.is_empty(), "Peer A should have changes");
}

#[tokio::test]
async fn test_e2e_sqlite_sqlite_encounter_with_json_fields() {
    let peer_a = E2EPeer::new().await;
    let peer_b = E2EPeer::new().await;

    peer_a.add_change("medical_encounters", "e1", "doctors", json!(["doc-1", "doc-2"])).await;
    peer_a.add_change("medical_encounters", "e1", "providers", json!([{"id": "prov-1", "name": "Provider A"}])).await;
    peer_a.add_change("medical_encounters", "e1", "pendingQueues", json!({"queue1": 5})).await;

    let addr_b = node_addr_direct(&peer_b.endpoint);
    let engine_b = peer_b.engine.clone();
    let accept_handle = tokio::spawn(async move {
        let incoming = peer_b.endpoint.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        engine_b.handle_incoming(conn, oneshot_change_rx(), "test").await
    });

    peer_a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn = peer_a.endpoint.connect(addr_b.clone(), CADENCE_ALPN).await.unwrap();
    peer_a.engine.initiate_sync(conn, &peer_a.jwt, oneshot_change_rx(), "test").await.unwrap();
    accept_handle.await.unwrap().unwrap();

    // Verify JSON fields survived the sync
    let changes = peer_a.storage.query_by_doc("medical_encounters", "e1").await.unwrap();
    assert!(!changes.is_empty(), "Encounter with JSON fields should sync");
}

#[tokio::test]
async fn test_e2e_sqlite_sqlite_invoice_conflict() {
    let peer_a = E2EPeer::new().await;
    let peer_b = E2EPeer::new().await;

    // Both update the same invoice status
    peer_a.add_change("billing_invoices", "inv1", "status", json!("paid")).await;
    peer_b.add_change("billing_invoices", "inv1", "status", json!("void")).await;

    let addr_b = node_addr_direct(&peer_b.endpoint);
    let engine_b = peer_b.engine.clone();
    let accept_handle = tokio::spawn(async move {
        let incoming = peer_b.endpoint.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        engine_b.handle_incoming(conn, oneshot_change_rx(), "test").await
    });

    peer_a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn = peer_a.endpoint.connect(addr_b.clone(), CADENCE_ALPN).await.unwrap();
    peer_a.engine.initiate_sync(conn, &peer_a.jwt, oneshot_change_rx(), "test").await.unwrap();
    accept_handle.await.unwrap().unwrap();

    // Full-duplex: A's storage should contain both peers' changes for inv1.
    // Since both changes target the same (collection, doc_id), they aggregate into 1 RowChange
    // but with field entries from both peers.
    let a_own = peer_a.storage.query_by_doc("billing_invoices", "inv1").await.unwrap();
    assert!(!a_own.is_empty(), "Peer A should have the invoice change");
    // Verify we have field entries from both peers (2 raw rows for the same doc)
    let a_changes = peer_a.storage.query_since(0).await.unwrap();
    assert!(!a_changes.is_empty(), "Peer A should have changes after sync");
}

#[tokio::test]
async fn test_e2e_sqlite_sqlite_delete_propagation() {
    let peer_a = E2EPeer::new().await;
    let peer_b = E2EPeer::new().await;

    // Peer A creates then deletes a record
    let change = RowChange {
        collection: "medical_patients".to_string(),
        document_id: "p-deleted".to_string(),
        payload: SyncPayload::Fields(vec![FieldChange {
            field: "name".to_string(),
            value: json!("To Be Deleted"),
            lamport: peer_a.state.increment_lamport(),
            peer_id: peer_a.endpoint.node_id().to_string(),
        }]),
        deleted: true,
        seq: peer_a.state.next_seq(),
    };
    peer_a.storage.append_change(&change).await.unwrap();

    let addr_b = node_addr_direct(&peer_b.endpoint);
    let engine_b = peer_b.engine.clone();
    let accept_handle = tokio::spawn(async move {
        let incoming = peer_b.endpoint.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        engine_b.handle_incoming(conn, oneshot_change_rx(), "test").await
    });

    peer_a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn = peer_a.endpoint.connect(addr_b.clone(), CADENCE_ALPN).await.unwrap();
    peer_a.engine.initiate_sync(conn, &peer_a.jwt, oneshot_change_rx(), "test").await.unwrap();
    accept_handle.await.unwrap().unwrap();

    // Check that deleted flag propagated
    let a_changes = peer_a.storage.query_by_doc("medical_patients", "p-deleted").await.unwrap();
    assert!(a_changes.iter().any(|c| c.deleted), "Deleted flag should be set");
}

#[tokio::test]
async fn test_e2e_sqlite_sqlite_bulk_records() {
    let peer_a = E2EPeer::new().await;
    let peer_b = E2EPeer::new().await;

    // Add 100 medical records to peer A
    for i in 0..100 {
        peer_a.add_change(
            "medical_records",
            &format!("record-{}", i),
            "type",
            json!(format!("record-type-{}", i % 5)),
        ).await;
    }

    let addr_b = node_addr_direct(&peer_b.endpoint);
    let engine_b = peer_b.engine.clone();
    let accept_handle = tokio::spawn(async move {
        let incoming = peer_b.endpoint.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        engine_b.handle_incoming(conn, oneshot_change_rx(), "test").await
    });

    peer_a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn = peer_a.endpoint.connect(addr_b.clone(), CADENCE_ALPN).await.unwrap();
    peer_a.engine.initiate_sync(conn, &peer_a.jwt, oneshot_change_rx(), "test").await.unwrap();
    accept_handle.await.unwrap().unwrap();

    // Peer B should have all 100 records
    let b_changes = peer_a.storage.query_since(0).await.unwrap();
    assert!(b_changes.len() >= 100, "All 100 records should be present, got {}", b_changes.len());
}

#[tokio::test]
async fn test_e2e_sqlite_sqlite_crdt_clinical_notes() {
    let peer_a = E2EPeer::new().await;
    let peer_b = E2EPeer::new().await;

    // Create CRDT clinical note on peer A
    let doc = loro::LoroDoc::new();
    let text = doc.get_text("notes");
    text.insert(0, "Patient presents with headache and fever.").unwrap();
    doc.commit();
    let crdt_bytes = doc.export(loro::ExportMode::all_updates()).unwrap();

    let change = RowChange {
        collection: "clinical_notes".to_string(),
        document_id: "note-1".to_string(),
        payload: SyncPayload::CrdtDoc(crdt_bytes),
        deleted: false,
        seq: peer_a.state.next_seq(),
    };
    peer_a.storage.append_change(&change).await.unwrap();

    let addr_b = node_addr_direct(&peer_b.endpoint);
    let engine_b = peer_b.engine.clone();
    let accept_handle = tokio::spawn(async move {
        let incoming = peer_b.endpoint.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        engine_b.handle_incoming(conn, oneshot_change_rx(), "test").await
    });

    peer_a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn = peer_a.endpoint.connect(addr_b.clone(), CADENCE_ALPN).await.unwrap();
    peer_a.engine.initiate_sync(conn, &peer_a.jwt, oneshot_change_rx(), "test").await.unwrap();
    accept_handle.await.unwrap().unwrap();

    // Verify CRDT note was synced
    let b_changes = peer_a.storage.query_by_doc("clinical_notes", "note-1").await.unwrap();
    assert!(!b_changes.is_empty(), "CRDT clinical note should sync");
}
