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
use std::time::Instant;
use tokio::sync::broadcast;
use futures_util::future;

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

fn stress_config() -> CadenceConfig {
    let mut collections = BTreeMap::new();
    collections.insert("medical_patients".to_string(), CollectionConfig {
        strategy: ConflictStrategy::Lww,
        scope_columns: [("facility_id".to_string(), "facility".to_string())].into(),
            scope_rules: None,
    });
    collections.insert("billing_invoices".to_string(), CollectionConfig {
        strategy: ConflictStrategy::Lww,
        scope_columns: [("facility_id".to_string(), "facility".to_string())].into(),
            scope_rules: None,
    });
    collections.insert("appointments".to_string(), CollectionConfig {
        strategy: ConflictStrategy::Lww,
        scope_columns: [("facility_id".to_string(), "facility".to_string())].into(),
            scope_rules: None,
    });
    CadenceConfig {
        collections,
        default_strategy: ConflictStrategy::Lww,
        ..Default::default()
    }
}

fn oneshot_change_rx() -> broadcast::Receiver<Vec<RowChange>> {
    let (tx, rx) = broadcast::channel(1);
    drop(tx);
    rx
}

struct StressPeer {
    engine: Arc<SyncEngine>,
    endpoint: Endpoint,
    storage: Arc<Storage>,
    state: Arc<SyncState>,
    jwt: String,
}

impl StressPeer {
    async fn new() -> Self {
        let config = stress_config();
        let endpoint = Endpoint::builder()
            .alpns(vec![CADENCE_ALPN.to_vec()])
            .discovery_local_network()
            .bind()
            .await
            .unwrap();

        let peer_id = endpoint.node_id().to_string();
        let storage = Arc::new(Storage::in_memory().unwrap());
        let state = Arc::new(SyncState::new());

        let key = jsonwebtoken::DecodingKey::from_secret(b"stress-test-secret");
        let validator = Arc::new(JwtValidator::permissive(key));

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let jwt = jsonwebtoken::encode(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
            &serde_json::json!({
                "sub": "stress-user",
                "aud": "cadence-sync",
                "exp": now + 7200,
                "scopes": {"facility_id": ["*"]},
                "read_only": false
            }),
            &jsonwebtoken::EncodingKey::from_secret(b"stress-test-secret"),
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

    async fn document_count(&self) -> usize {
        // `query_since` caps at 10_000 raw rows (see SqliteBackend::query_since
        // in storage/sqlite.rs) — that's a deliberate safety limit, but it
        // breaks document-count assertions in stress tests where multiple
        // FieldChanges per document inflate the raw-row count past 10_000.
        // Paginate via `query_since_batched` and count unique
        // (collection, document_id) pairs across all batches.
        let mut seen: std::collections::HashSet<(String, String)> =
            std::collections::HashSet::new();
        let mut last_seq: u64 = 0;
        loop {
            let (changes, has_more) = self
                .storage
                .query_since_batched(last_seq, 10_000)
                .await
                .unwrap();
            if changes.is_empty() {
                break;
            }
            // Track the highest seq seen so the next batch picks up after it.
            for change in &changes {
                if change.seq > last_seq {
                    last_seq = change.seq;
                }
                seen.insert((change.collection.clone(), change.document_id.clone()));
            }
            if !has_more {
                break;
            }
        }
        seen.len()
    }
}

async fn do_sync(a: &StressPeer, b: &StressPeer) {
    let addr_b = node_addr_direct(&b.endpoint);
    a.endpoint.add_node_addr(addr_b.clone()).ok();

    // Spawn the initiator (connect) side so the acceptor can call
    // `accept().await` synchronously in the current task. The original
    // pattern (spawn the acceptor, then immediately connect) had a race
    // where the spawned acceptor task hadn't yet been polled by the time
    // the initiator's connect fired, causing iroh to silently drop the
    // attempt and the sync to "succeed" without exchanging data.
    let a_ep = a.endpoint.clone();
    let engine_a = a.engine.clone();
    let jwt_a = a.jwt.clone();
    let initiate_handle = tokio::spawn(async move {
        let conn = a_ep.connect(addr_b, CADENCE_ALPN).await.unwrap();
        engine_a
            .initiate_sync(conn, &jwt_a, oneshot_change_rx(), "stress")
            .await
    });

    let incoming = b.endpoint.accept().await.unwrap();
    let conn = incoming.await.unwrap();
    b.engine
        .handle_incoming(conn, oneshot_change_rx(), "stress")
        .await
        .unwrap();

    initiate_handle.await.unwrap().unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_five_peer_mesh_1k_documents() {
    let start = Instant::now();

    // Create 5 peers
    let peers = future::join_all((0..5).map(|_| StressPeer::new())).await;

    let peer_creation_time = start.elapsed();
    println!("Peer creation: {:?}", peer_creation_time);

    // Each peer creates 1000 documents (200 per collection)
    let doc_creation_start = Instant::now();
    for (peer_idx, peer) in peers.iter().enumerate() {
        for i in 0..200 {
            peer.add_change(
                "medical_patients",
                &format!("peer{}-patient-{}", peer_idx, i),
                "name",
                json!(format!("Patient {} from peer {}", i, peer_idx)),
            ).await;

            peer.add_change(
                "billing_invoices",
                &format!("peer{}-invoice-{}", peer_idx, i),
                "total",
                json!(i * 100),
            ).await;

            peer.add_change(
                "appointments",
                &format!("peer{}-appt-{}", peer_idx, i),
                "status",
                json!("scheduled"),
            ).await;

            // Add multiple fields to make documents more realistic
            if i % 50 == 0 {
                peer.add_change(
                    "medical_patients",
                    &format!("peer{}-patient-{}", peer_idx, i),
                    "age",
                    json!(20 + i % 60),
                ).await;
            }

            if i % 100 == 0 {
                peer.add_change(
                    "billing_invoices",
                    &format!("peer{}-invoice-{}", peer_idx, i),
                    "status",
                    json!("paid"),
                ).await;
            }
        }
    }

    let doc_creation_time = doc_creation_start.elapsed();
    println!("Document creation (5000 docs): {:?}", doc_creation_time);

    // Full mesh sync with convergence retry. Iroh local-network discovery
    // is racy: an individual `do_sync` call may complete without errors but
    // transfer no data because the QUIC connection raced with the accept
    // loop. We compensate by running multiple mesh passes until convergence
    // (max 5 passes) — each pass that any peer is short triggers another.
    let sync_start = Instant::now();
    let expected_min_docs = 5 * 600; // 5 peers * 600 docs (200 per collection * 3 collections)
    let mut converged = false;
    for pass in 0..5 {
        for i in 0..peers.len() {
            for j in (i + 1)..peers.len() {
                do_sync(&peers[i], &peers[j]).await;
            }
        }
        // Check convergence
        let mut all_converged = true;
        for peer in peers.iter() {
            if peer.document_count().await < expected_min_docs {
                all_converged = false;
                break;
            }
        }
        if all_converged {
            println!("Converged after {} pass(es)", pass + 1);
            converged = true;
            break;
        }
    }

    let initial_sync_time = sync_start.elapsed();
    println!("Mesh sync time: {:?}", initial_sync_time);

    if !converged {
        for (idx, peer) in peers.iter().enumerate() {
            let count = peer.document_count().await;
            assert!(
                count >= expected_min_docs,
                "Peer {} should have >= {} documents after 5 passes, got {}",
                idx,
                expected_min_docs,
                count
            );
        }
    }

    let total_time = start.elapsed();
    println!("Total test time: {:?}", total_time);
    println!("Documents per peer: {}", peers[0].document_count().await);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_ten_peer_star_convergence() {
    // Star topology is more scalable than full mesh for 10 peers
    let start = Instant::now();

    // Create central hub + 9 edge peers
    let hub = StressPeer::new().await;
    let edges = future::join_all((0..9).map(|_| StressPeer::new())).await;

    println!("Hub + 9 edge peer creation: {:?}", start.elapsed());

    // Hub creates 100 documents
    let doc_start = Instant::now();
    for i in 0..100 {
        hub.add_change(
            "medical_patients",
            &format!("hub-doc-{}", i),
            "data",
            json!(format!("Data from hub doc {}", i)),
        ).await;
    }

    // Each edge creates 100 documents
    for (edge_idx, edge) in edges.iter().enumerate() {
        for i in 0..100 {
            edge.add_change(
                "medical_patients",
                &format!("edge{}-doc-{}", edge_idx, i),
                "data",
                json!(format!("Data from edge {} doc {}", edge_idx, i)),
            ).await;
        }
    }

    println!("10 peers x 100 docs creation: {:?}", doc_start.elapsed());

    // Edge → hub then hub → edges, with convergence retry. Iroh local
    // discovery is racy; see do_sync comments.
    let sync_start = Instant::now();
    let expected_min = 10 * 100; // 10 peers * 100 docs each

    for pass in 0..5 {
        for edge in edges.iter() {
            do_sync(edge, &hub).await;
        }
        for edge in edges.iter() {
            do_sync(&hub, edge).await;
        }
        let mut all_converged = hub.document_count().await >= expected_min;
        if all_converged {
            for edge in edges.iter() {
                if edge.document_count().await < expected_min {
                    all_converged = false;
                    break;
                }
            }
        }
        if all_converged {
            println!("Star converged after {} pass(es)", pass + 1);
            break;
        }
    }

    let sync_duration = sync_start.elapsed();
    println!("Star sync time: {:?}", sync_duration);

    let hub_count = hub.document_count().await;
    assert!(
        hub_count >= expected_min,
        "Hub should have >= {} documents, got {}",
        expected_min,
        hub_count
    );

    for (idx, edge) in edges.iter().enumerate() {
        let count = edge.document_count().await;
        assert!(
            count >= expected_min,
            "Edge {} should have >= {} documents, got {}",
            idx,
            expected_min,
            count
        );
    }

    println!("Total convergence time: {:?}", start.elapsed());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_new_peer_bootstrap_10k() {
    let start = Instant::now();

    // Create existing peer with 10,000 documents
    let existing = StressPeer::new().await;

    let doc_creation_start = Instant::now();
    for i in 0..10_000 {
        existing.add_change(
            "medical_patients",
            &format!("patient-{}", i),
            "name",
            json!(format!("Patient {}", i)),
        ).await;

        // Add extra fields every 100 docs for variety
        if i % 100 == 0 {
            existing.add_change(
                "medical_patients",
                &format!("patient-{}", i),
                "age",
                json!(20 + i % 80),
            ).await;

            existing.add_change(
                "medical_patients",
                &format!("patient-{}", i),
                "status",
                json!("active"),
            ).await;
        }
    }

    let doc_creation_time = doc_creation_start.elapsed();
    println!("Created 10k documents: {:?}", doc_creation_time);

    // Create new peer and sync. Retry to convergence — iroh local discovery
    // is racy; a single do_sync may complete without exchanging data on a
    // slow path. See do_sync comments.
    let new_peer = StressPeer::new().await;

    let sync_start = Instant::now();
    for pass in 0..5 {
        do_sync(&existing, &new_peer).await;
        if new_peer.document_count().await >= 10_000 {
            println!("Bootstrap converged after {} pass(es)", pass + 1);
            break;
        }
    }
    let sync_time = sync_start.elapsed();

    println!("Bootstrap sync time: {:?}", sync_time);

    // Verify new peer received all documents
    let new_peer_count = new_peer.document_count().await;
    let existing_count = existing.document_count().await;

    println!("Existing peer docs: {}", existing_count);
    println!("New peer docs: {}", new_peer_count);

    assert!(
        new_peer_count >= 10_000,
        "New peer should have >= 10,000 documents, got {}",
        new_peer_count
    );

    assert_eq!(
        new_peer_count,
        existing_count,
        "New peer should have same count as existing peer"
    );

    let total_time = start.elapsed();
    println!("Total bootstrap test time: {:?}", total_time);

    // Calculate throughput
    let docs_per_sec = new_peer_count as f64 / sync_time.as_secs_f64();
    println!("Bootstrap throughput: {:.0} docs/sec", docs_per_sec);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_parallel_sync_load() {
    let start = Instant::now();

    // Create central hub peer
    let hub = StressPeer::new().await;

    // Create 8 edge peers
    let edges = future::join_all((0..8).map(|_| StressPeer::new())).await;

    println!("Created hub + 8 edge peers: {:?}", start.elapsed());

    // Each edge creates 500 documents
    let doc_start = Instant::now();
    for (idx, edge) in edges.iter().enumerate() {
        for i in 0..500 {
            edge.add_change(
                "medical_patients",
                &format!("edge{}-patient-{}", idx, i),
                "name",
                json!(format!("Edge {} Patient {}", idx, i)),
            ).await;
        }
    }
    println!("Edge document creation: {:?}", doc_start.elapsed());

    // All edges sync with hub. Retry to convergence — iroh local-network
    // discovery is racy and individual `do_sync` calls may complete without
    // exchanging data on a slow discovery path. See do_sync comments.
    let sync_start = Instant::now();
    let expected_min = 8 * 500;
    for pass in 0..5 {
        for edge in edges.iter() {
            do_sync(edge, &hub).await;
        }
        if hub.document_count().await >= expected_min {
            println!("Hub converged after {} pass(es)", pass + 1);
            break;
        }
    }

    let sync_time = sync_start.elapsed();
    println!("Sync time (8 edges -> hub): {:?}", sync_time);

    // Hub should have all documents
    let hub_count = hub.document_count().await;
    assert!(
        hub_count >= expected_min,
        "Hub should have >= {} documents, got {}",
        expected_min,
        hub_count
    );

    // Backfill: hub syncs back to edges, with the same convergence retry.
    let backfill_start = Instant::now();
    for pass in 0..5 {
        for edge in edges.iter() {
            do_sync(&hub, edge).await;
        }
        let mut all_converged = true;
        for edge in edges.iter() {
            if edge.document_count().await < expected_min {
                all_converged = false;
                break;
            }
        }
        if all_converged {
            println!("Edges converged after {} backfill pass(es)", pass + 1);
            break;
        }
    }
    println!("Backfill sync time (hub -> edges): {:?}", backfill_start.elapsed());

    // All edges should have all documents
    for (idx, edge) in edges.iter().enumerate() {
        let count = edge.document_count().await;
        assert!(
            count >= expected_min,
            "Edge {} should have >= {} documents, got {}",
            idx,
            expected_min,
            count
        );
    }

    println!("Total parallel sync test: {:?}", start.elapsed());
}
