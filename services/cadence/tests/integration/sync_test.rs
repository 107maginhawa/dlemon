use cadence::auth::JwtValidator;
use cadence::config::{CadenceConfig, CollectionConfig, ConflictStrategy};
use cadence::peer_status::PeerTracker;
use cadence::protocol::CADENCE_ALPN;
use cadence::schema::SchemaFingerprint;
use cadence::state::{FieldChange, RowChange, SyncPayload, SyncState};
use cadence::storage::Storage;
use cadence::storage::MetadataBackend;
use cadence::primary_reader::{NoPrimaryReader, PrimaryDbReader, SqlitePrimaryReader};
use cadence::sync::SyncEngine;
use cadence::token::TokenStore;
use iroh::{Endpoint, NodeAddr};
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use tokio::sync::broadcast;

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

fn test_config() -> CadenceConfig {
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

/// Create a closed broadcast receiver for one-shot sync tests.
/// The sender is immediately dropped, so recv() returns Closed,
/// causing the send loop to exit after the catch-up phase.
fn oneshot_change_rx() -> broadcast::Receiver<Vec<RowChange>> {
    let (tx, rx) = broadcast::channel(1);
    drop(tx);
    rx
}

struct TestSyncPeer {
    engine: Arc<SyncEngine>,
    endpoint: Endpoint,
    storage: Arc<Storage>,
    state: Arc<SyncState>,
    jwt: String,
    peer_tracker: Arc<PeerTracker>,
}

impl TestSyncPeer {
    async fn new(config: CadenceConfig) -> Self {
        let endpoint = Endpoint::builder()
            .alpns(vec![CADENCE_ALPN.to_vec()])
            .discovery_local_network()
            .bind()
            .await
            .unwrap();

        let peer_id = endpoint.node_id().to_string();
        let storage = Arc::new(Storage::in_memory().unwrap());
        let state = Arc::new(SyncState::new());

        // Use permissive HS256 validator for tests
        let key = jsonwebtoken::DecodingKey::from_secret(b"test-secret");
        let validator = Arc::new(JwtValidator::permissive(key));

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let claims = serde_json::json!({
            "sub": "test",
            "aud": "cadence-sync",
            "exp": now + 3600,
            "scopes": {"facility_id": ["*"]},
            "read_only": false
        });

        let jwt = jsonwebtoken::encode(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(b"test-secret"),
        )
        .unwrap();

        let token_store = Arc::new(TokenStore::new(storage.clone(), validator.clone()));
        let peer_tracker = Arc::new(PeerTracker::new());
        let (engine, _peer_change_rx) = SyncEngine::new(
            Arc::new(config),
            state.clone(),
            storage.clone(),
            Arc::new(NoPrimaryReader) as Arc<dyn PrimaryDbReader>,
            validator,
            peer_id,
            SchemaFingerprint::empty(),
            token_store,
            peer_tracker.clone(),
        );
        let engine = Arc::new(engine);

        Self {
            engine,
            endpoint,
            storage,
            state,
            jwt,
            peer_tracker,
        }
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
async fn test_two_peers_hello_handshake() {
    let peer_a = TestSyncPeer::new(test_config()).await;
    let peer_b = TestSyncPeer::new(test_config()).await;

    let addr_b = node_addr_direct(&peer_b.endpoint);

    let engine_b = peer_b.engine.clone();
    let accept_handle = tokio::spawn(async move {
        let incoming = peer_b.endpoint.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        engine_b.handle_incoming(conn, oneshot_change_rx(), "test").await
    });

    peer_a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn = peer_a.endpoint.connect(addr_b.clone(), CADENCE_ALPN).await.unwrap();
    let result = peer_a.engine.initiate_sync(conn, &peer_a.jwt, oneshot_change_rx(), "test").await;
    assert!(result.is_ok(), "Initiator sync should succeed: {:?}", result.err());

    let accept_result = accept_handle.await.unwrap();
    assert!(accept_result.is_ok(), "Acceptor sync should succeed: {:?}", accept_result.err());
}

#[tokio::test]
async fn test_sync_request_response_stream() {
    let peer_a = TestSyncPeer::new(test_config()).await;
    let peer_b = TestSyncPeer::new(test_config()).await;

    // Add 5 patients to peer B
    for i in 0..5 {
        peer_b.add_change(
            "medical_patients",
            &format!("patient-{}", i),
            "name",
            json!(format!("Patient {}", i)),
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

    // Peer A should now have the changes in its storage
    let changes = peer_a.storage.query_since(0).await.unwrap();
    assert_eq!(changes.len(), 5, "Peer A should have received 5 patient changes");

    accept_handle.await.unwrap().unwrap();

    // Verify peer status tracking on the initiator (peer_a)
    let a_snap = peer_a.peer_tracker.snapshot();
    assert_eq!(a_snap.len(), 1, "Initiator should have 1 tracked peer");
    assert_eq!(a_snap[0].state, cadence::peer_status::PeerState::Disconnected);
    assert_eq!(a_snap[0].changes_received, 5, "Initiator should have received 5 changes");
    assert!(a_snap[0].recv_progress.received >= 5, "Recv progress should reflect 5 changes");
}

#[tokio::test]
async fn test_incremental_sync_via_watermarks() {
    let peer_a = TestSyncPeer::new(test_config()).await;
    let peer_b = TestSyncPeer::new(test_config()).await;

    // Add 3 patients to peer B
    for i in 0..3 {
        peer_b.add_change("medical_patients", &format!("p-{}", i), "name", json!(format!("P{}", i))).await;
    }

    let _addr_b = node_addr_direct(&peer_b.endpoint);

    // For simplicity, test watermark logic directly
    peer_a.state.set_watermark("peer-b", 3);
    assert_eq!(peer_a.state.get_watermark("peer-b"), 3);

    // Add 2 more patients to B
    for i in 3..5 {
        peer_b.add_change("medical_patients", &format!("p-{}", i), "name", json!(format!("P{}", i))).await;
    }

    // Query since watermark=3 should only return the 2 new ones
    let new_changes = peer_b.storage.query_since(3).await.unwrap();
    assert_eq!(new_changes.len(), 2, "Should only get 2 new changes after watermark");
}

#[tokio::test]
async fn test_bidirectional_sync() {
    let peer_a = TestSyncPeer::new(test_config()).await;
    let peer_b = TestSyncPeer::new(test_config()).await;

    // A has patients, B has invoices
    peer_a.add_change("medical_patients", "p1", "name", json!("Alice")).await;
    peer_b.add_change("medical_patients", "p2", "name", json!("Bob")).await;

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

    // Forward sync: B's changes should now be in A's storage
    let a_changes = peer_a.storage.query_since(0).await.unwrap();

    // Full-duplex: A has its own 1 change + received B's 1 change = exactly 2
    assert!(a_changes.len() >= 2, "Peer A should have at least 2 changes (bidirectional), got {}", a_changes.len());

    // Verify peer status tracking reflects bidirectional sync
    let a_snap = peer_a.peer_tracker.snapshot();
    assert_eq!(a_snap.len(), 1, "Initiator should track 1 peer");
    assert_eq!(a_snap[0].state, cadence::peer_status::PeerState::Disconnected);
    assert!(a_snap[0].changes_sent >= 1, "A should have sent at least 1 change");
    assert!(a_snap[0].changes_received >= 1, "A should have received at least 1 change from B");
}

#[tokio::test]
async fn test_lww_conflict_resolution_over_wire() {
    let peer_a = TestSyncPeer::new(test_config()).await;
    let peer_b = TestSyncPeer::new(test_config()).await;

    // Both peers update the same patient's name concurrently
    peer_a.add_change("medical_patients", "patient-conflict", "name", json!("Alice-Version")).await;
    peer_b.add_change("medical_patients", "patient-conflict", "name", json!("Bob-Version")).await;

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

    let a_changes = peer_a.storage.query_since(0).await.unwrap();
    assert!(!a_changes.is_empty(), "Peer A should have changes");
    let conflict_changes = peer_a.storage.query_by_doc("medical_patients", "patient-conflict").await.unwrap();
    assert!(!conflict_changes.is_empty(), "Peer A should have the conflict document");
}

#[tokio::test]
async fn test_crdt_merge_over_wire() {
    let peer_a = TestSyncPeer::new(test_config()).await;
    let peer_b = TestSyncPeer::new(test_config()).await;

    // Create a CRDT document on peer A
    let doc_a = loro::LoroDoc::new();
    let text = doc_a.get_text("notes");
    text.insert(0, "Clinical note from peer A").unwrap();
    doc_a.commit();
    let crdt_bytes = doc_a.export(loro::ExportMode::all_updates()).unwrap();

    // Store as CRDT change
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

    let a_changes = peer_a.storage.query_since(0).await.unwrap();
    assert!(!a_changes.is_empty(), "Peer A should still have the CRDT change");
}

/// Create a peer that uses a real SQLite primary DB reader for snapshot catch-up.
/// The change log (metadata storage) is empty — all data comes from the primary DB.
struct PrimaryDbPeer {
    engine: Arc<SyncEngine>,
    endpoint: Endpoint,
    storage: Arc<Storage>,
    state: Arc<SyncState>,
    primary_conn: Arc<std::sync::Mutex<rusqlite::Connection>>,
}

impl PrimaryDbPeer {
    async fn new(config: CadenceConfig) -> Self {
        let endpoint = Endpoint::builder()
            .alpns(vec![CADENCE_ALPN.to_vec()])
            .discovery_local_network()
            .bind()
            .await
            .unwrap();

        let peer_id = endpoint.node_id().to_string();
        let storage = Arc::new(Storage::in_memory().unwrap());
        let state = Arc::new(SyncState::new());

        // Create an in-memory SQLite DB as the "primary database"
        let primary_conn = Arc::new(std::sync::Mutex::new(
            rusqlite::Connection::open_in_memory().unwrap(),
        ));
        {
            let conn = primary_conn.lock().unwrap();
            conn.execute_batch(
                "CREATE TABLE medical_patients (
                    id TEXT PRIMARY KEY,
                    facility_id TEXT,
                    name TEXT,
                    updatedAt TEXT DEFAULT (datetime('now'))
                );",
            )
            .unwrap();
        }

        let primary_reader: Arc<dyn PrimaryDbReader> = Arc::new(SqlitePrimaryReader::new(
            primary_conn.clone(),
            peer_id.clone(),
        ));

        let key = jsonwebtoken::DecodingKey::from_secret(b"test-secret");
        let validator = Arc::new(JwtValidator::permissive(key));

        let token_store = Arc::new(TokenStore::new(storage.clone(), validator.clone()));
        let peer_tracker = Arc::new(PeerTracker::new());
        let (engine, _peer_change_rx) = SyncEngine::new(
            Arc::new(config),
            state.clone(),
            storage.clone(),
            primary_reader,
            validator,
            peer_id,
            SchemaFingerprint::empty(),
            token_store,
            peer_tracker,
        );
        let engine = Arc::new(engine);

        Self {
            engine,
            endpoint,
            storage,
            state,
            primary_conn,
        }
    }

    /// Insert data directly into the primary DB (not the change log).
    fn insert_primary_row(&self, id: &str, facility: &str, name: &str) {
        let conn = self.primary_conn.lock().unwrap();
        conn.execute(
            "INSERT INTO medical_patients (id, facility_id, name) VALUES (?1, ?2, ?3)",
            rusqlite::params![id, facility, name],
        )
        .unwrap();
    }
}

#[tokio::test]
async fn test_primary_db_snapshot_catchup() {
    // Peer B has data in its primary DB but NOT in its change log.
    // Peer A (new peer, since_seq=0) should receive all data from B's primary DB.
    let peer_a = TestSyncPeer::new(test_config()).await;
    let peer_b = PrimaryDbPeer::new(test_config()).await;

    // Insert data directly into B's primary DB — no change log entries
    peer_b.insert_primary_row("p1", "F1", "Alice");
    peer_b.insert_primary_row("p2", "F1", "Bob");
    peer_b.insert_primary_row("p3", "F2", "Charlie");

    // Verify B's change log is empty
    let b_log = peer_b.storage.query_since(0).await.unwrap();
    assert!(b_log.is_empty(), "B's change log should be empty — data is only in primary DB");

    let addr_b = node_addr_direct(&peer_b.endpoint);
    let engine_b = peer_b.engine.clone();
    let accept_handle = tokio::spawn(async move {
        let incoming = peer_b.endpoint.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        engine_b.handle_incoming(conn, oneshot_change_rx(), "test").await
    });

    peer_a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn = peer_a.endpoint.connect(addr_b.clone(), CADENCE_ALPN).await.unwrap();
    peer_a
        .engine
        .initiate_sync(conn, &peer_a.jwt, oneshot_change_rx(), "test")
        .await
        .unwrap();

    accept_handle.await.unwrap().unwrap();

    // Peer A should have received all 3 rows from B's primary DB
    let a_changes = peer_a.storage.query_since(0).await.unwrap();
    assert_eq!(
        a_changes.len(),
        3,
        "Peer A should have received 3 rows via primary DB snapshot, got {}",
        a_changes.len()
    );

    // Verify the document IDs
    let mut doc_ids: Vec<String> = a_changes.iter().map(|c| c.document_id.clone()).collect();
    doc_ids.sort();
    assert_eq!(doc_ids, vec!["p1", "p2", "p3"]);
}

#[tokio::test]
async fn test_primary_db_catchup_with_empty_primary_falls_back_to_changelog() {
    // When the primary DB is empty but the change log has data,
    // send_catchup_batch should fall back to the change log.
    let peer_a = TestSyncPeer::new(test_config()).await;
    let peer_b = PrimaryDbPeer::new(test_config()).await;

    // Don't insert into primary DB — instead put data in the change log directly
    let lamport = peer_b.state.increment_lamport();
    let seq = peer_b.state.next_seq();
    let change = RowChange {
        collection: "medical_patients".to_string(),
        document_id: "p-changelog".to_string(),
        payload: SyncPayload::Fields(vec![FieldChange {
            field: "name".to_string(),
            value: json!("FromChangelog"),
            lamport,
            peer_id: "b".to_string(),
        }]),
        deleted: false,
        seq,
    };
    peer_b.storage.append_change(&change).await.unwrap();

    let addr_b = node_addr_direct(&peer_b.endpoint);
    let engine_b = peer_b.engine.clone();
    let accept_handle = tokio::spawn(async move {
        let incoming = peer_b.endpoint.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        engine_b.handle_incoming(conn, oneshot_change_rx(), "test").await
    });

    peer_a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn = peer_a.endpoint.connect(addr_b.clone(), CADENCE_ALPN).await.unwrap();
    peer_a
        .engine
        .initiate_sync(conn, &peer_a.jwt, oneshot_change_rx(), "test")
        .await
        .unwrap();

    accept_handle.await.unwrap().unwrap();

    // Should fall back to change log
    let a_changes = peer_a.storage.query_since(0).await.unwrap();
    assert_eq!(
        a_changes.len(),
        1,
        "Peer A should have received 1 row from B's change log fallback"
    );
    assert_eq!(a_changes[0].document_id, "p-changelog");
}
