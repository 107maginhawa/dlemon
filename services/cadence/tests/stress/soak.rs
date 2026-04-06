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
use std::time::{Duration, Instant};
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

fn soak_config() -> CadenceConfig {
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

struct SoakPeer {
    engine: Arc<SyncEngine>,
    endpoint: Endpoint,
    storage: Arc<Storage>,
    state: Arc<SyncState>,
    jwt: String,
    peer_index: usize,
}

impl SoakPeer {
    async fn new(peer_index: usize) -> Self {
        let config = soak_config();
        let endpoint = Endpoint::builder()
            .alpns(vec![CADENCE_ALPN.to_vec()])
            .discovery_local_network()
            .bind()
            .await
            .unwrap();

        let peer_id = endpoint.node_id().to_string();
        let storage = Arc::new(Storage::in_memory().unwrap());
        let state = Arc::new(SyncState::new());

        let key = jsonwebtoken::DecodingKey::from_secret(b"soak-test-secret");
        let validator = Arc::new(JwtValidator::permissive(key));

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let jwt = jsonwebtoken::encode(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
            &serde_json::json!({
                "sub": format!("soak-user-{}", peer_index),
                "aud": "cadence-sync",
                "exp": now + 7200,
                "scopes": {"facility_id": ["*"]},
                "read_only": false
            }),
            &jsonwebtoken::EncodingKey::from_secret(b"soak-test-secret"),
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

        Self { engine, endpoint, storage, state, jwt, peer_index }
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
        self.storage.query_since(0).await.unwrap().len()
    }

    async fn health_check(&self) -> bool {
        // Check if storage is responsive
        self.storage.query_since(0).await.is_ok()
    }
}

async fn do_sync(a: &SoakPeer, b: &SoakPeer) {
    let addr_b = node_addr_direct(&b.endpoint);
    let engine_b = b.engine.clone();
    let b_ep = b.endpoint.clone();

    let accept_handle = tokio::spawn(async move {
        let incoming = b_ep.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        engine_b.handle_incoming(conn, oneshot_change_rx(), "soak").await
    });

    a.endpoint.add_node_addr(addr_b.clone()).ok();
    let conn = a.endpoint.connect(addr_b, CADENCE_ALPN).await.unwrap();
    a.engine.initiate_sync(conn, &a.jwt, oneshot_change_rx(), "soak").await.unwrap();
    accept_handle.await.unwrap().unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore] // Run manually with: cargo test --release test_soak_1_hour -- --ignored --nocapture
async fn test_soak_1_hour() {
    let test_duration = Duration::from_secs(3600); // 1 hour
    let health_check_interval = Duration::from_secs(300); // 5 minutes
    let sync_interval = Duration::from_secs(60); // 1 minute
    let write_interval = Duration::from_millis(100); // Write every 100ms

    println!("Starting 1-hour soak test");
    println!("Test duration: {:?}", test_duration);
    println!("Health check interval: {:?}", health_check_interval);
    println!("Sync interval: {:?}", sync_interval);
    println!("Write interval: {:?}", write_interval);

    let start_time = Instant::now();

    // Create 3 peers for continuous sync testing
    let peers = vec![
        SoakPeer::new(0).await,
        SoakPeer::new(1).await,
        SoakPeer::new(2).await,
    ];

    println!("Created 3 peers for soak test");

    let mut write_counter = 0;
    let mut sync_counter = 0;
    let mut health_check_counter = 0;

    let mut last_sync = Instant::now();
    let mut last_health_check = Instant::now();

    // Continuous operation loop
    loop {
        let elapsed = start_time.elapsed();

        if elapsed >= test_duration {
            println!("Test duration reached: {:?}", elapsed);
            break;
        }

        // Random writes on all peers
        for (idx, peer) in peers.iter().enumerate() {
            let collection = if write_counter % 2 == 0 {
                "medical_patients"
            } else {
                "billing_invoices"
            };

            let doc_id = format!("peer{}-doc-{}", idx, write_counter);
            let field = if write_counter % 3 == 0 { "name" } else { "status" };
            let value = json!(format!("value-{}-{}", idx, write_counter));

            peer.add_change(collection, &doc_id, field, value).await;
        }

        write_counter += 1;

        // Periodic sync
        if last_sync.elapsed() >= sync_interval {
            println!(
                "[{:?}] Performing sync round {} (writes: {})",
                elapsed,
                sync_counter,
                write_counter
            );

            // Full mesh sync
            do_sync(&peers[0], &peers[1]).await;
            do_sync(&peers[1], &peers[2]).await;
            do_sync(&peers[0], &peers[2]).await;

            sync_counter += 1;
            last_sync = Instant::now();

            // Log document counts
            for (idx, peer) in peers.iter().enumerate() {
                let count = peer.document_count().await;
                println!("  Peer {} doc count: {}", idx, count);
            }
        }

        // Periodic health check
        if last_health_check.elapsed() >= health_check_interval {
            println!(
                "[{:?}] Health check {} (syncs: {}, writes: {})",
                elapsed,
                health_check_counter,
                sync_counter,
                write_counter
            );

            for (idx, peer) in peers.iter().enumerate() {
                let healthy = peer.health_check().await;
                let count = peer.document_count().await;
                println!(
                    "  Peer {}: healthy={}, docs={}, lamport={}, seq={}",
                    idx,
                    healthy,
                    count,
                    peer.state.lamport(),
                    peer.state.local_seq()
                );

                assert!(healthy, "Peer {} failed health check", idx);
            }

            health_check_counter += 1;
            last_health_check = Instant::now();
        }

        tokio::time::sleep(write_interval).await;
    }

    // Final convergence check
    println!("Performing final convergence sync");

    for _ in 0..3 {
        do_sync(&peers[0], &peers[1]).await;
        do_sync(&peers[1], &peers[2]).await;
        do_sync(&peers[0], &peers[2]).await;
    }

    // Verify all peers converged
    let counts: Vec<_> = future::join_all(
        peers.iter().map(|p| p.document_count())
    ).await;

    println!("Final document counts: {:?}", counts);

    assert_eq!(
        counts[0], counts[1],
        "Peer 0 and Peer 1 should have same count"
    );
    assert_eq!(
        counts[1], counts[2],
        "Peer 1 and Peer 2 should have same count"
    );

    println!("Soak test completed successfully");
    println!("Total writes: {}", write_counter);
    println!("Total syncs: {}", sync_counter);
    println!("Total health checks: {}", health_check_counter);
    println!("Final document count per peer: {}", counts[0]);
    println!("Total test duration: {:?}", start_time.elapsed());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore] // Run manually with: cargo test --release test_soak_sustained_writes -- --ignored --nocapture
async fn test_soak_sustained_writes() {
    // Shorter soak test focused on sustained write load
    let test_duration = Duration::from_secs(600); // 10 minutes
    let writes_per_second = 50;
    let write_interval = Duration::from_millis(1000 / writes_per_second);

    println!("Starting 10-minute sustained write soak test");
    println!("Target: {} writes/second", writes_per_second);

    let start_time = Instant::now();

    let peer = SoakPeer::new(0).await;

    let mut write_counter = 0;
    let mut last_report = Instant::now();

    loop {
        if start_time.elapsed() >= test_duration {
            break;
        }

        // Alternate between collections
        let collection = if write_counter % 2 == 0 {
            "medical_patients"
        } else {
            "billing_invoices"
        };

        peer.add_change(
            collection,
            &format!("doc-{}", write_counter),
            "data",
            json!(format!("write-{}", write_counter)),
        ).await;

        write_counter += 1;

        // Report every 10 seconds
        if last_report.elapsed() >= Duration::from_secs(10) {
            let elapsed = start_time.elapsed();
            let doc_count = peer.document_count().await;
            let actual_rate = write_counter as f64 / elapsed.as_secs_f64();

            println!(
                "[{:?}] writes={}, docs={}, rate={:.1}/s, lamport={}, seq={}",
                elapsed,
                write_counter,
                doc_count,
                actual_rate,
                peer.state.lamport(),
                peer.state.local_seq()
            );

            last_report = Instant::now();
        }

        tokio::time::sleep(write_interval).await;
    }

    let final_count = peer.document_count().await;
    let total_time = start_time.elapsed();
    let actual_rate = write_counter as f64 / total_time.as_secs_f64();

    println!("Sustained write test completed");
    println!("Total writes: {}", write_counter);
    println!("Final doc count: {}", final_count);
    println!("Duration: {:?}", total_time);
    println!("Actual rate: {:.1} writes/second", actual_rate);

    assert!(final_count >= write_counter, "Document count should match or exceed write count");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore] // Run manually with: cargo test --release test_soak_continuous_sync -- --ignored --nocapture
async fn test_soak_continuous_sync() {
    // Test continuous syncing between peers over extended period
    let test_duration = Duration::from_secs(1800); // 30 minutes
    let sync_interval = Duration::from_secs(30);
    let write_batch_interval = Duration::from_secs(10);

    println!("Starting 30-minute continuous sync soak test");

    let start_time = Instant::now();

    let peers = vec![
        SoakPeer::new(0).await,
        SoakPeer::new(1).await,
    ];

    let mut write_counter = 0;
    let mut sync_counter = 0;
    let mut last_sync = Instant::now();
    let mut last_write_batch = Instant::now();

    loop {
        let elapsed = start_time.elapsed();

        if elapsed >= test_duration {
            break;
        }

        // Write batch every interval
        if last_write_batch.elapsed() >= write_batch_interval {
            for peer in peers.iter() {
                for i in 0..10 {
                    peer.add_change(
                        "medical_patients",
                        &format!("peer{}-doc-{}", peer.peer_index, write_counter + i),
                        "data",
                        json!(format!("value-{}", write_counter + i)),
                    ).await;
                }
            }

            write_counter += 10;
            last_write_batch = Instant::now();
        }

        // Continuous sync
        if last_sync.elapsed() >= sync_interval {
            do_sync(&peers[0], &peers[1]).await;
            sync_counter += 1;

            let counts: Vec<_> = future::join_all(
                peers.iter().map(|p| p.document_count())
            ).await;

            println!(
                "[{:?}] Sync {} complete - counts: {:?}, writes: {}",
                elapsed,
                sync_counter,
                counts,
                write_counter
            );

            last_sync = Instant::now();
        }

        tokio::time::sleep(Duration::from_secs(1)).await;
    }

    // Final sync and verification
    for _ in 0..3 {
        do_sync(&peers[0], &peers[1]).await;
    }

    let final_counts: Vec<_> = future::join_all(
        peers.iter().map(|p| p.document_count())
    ).await;

    println!("Continuous sync test completed");
    println!("Total syncs: {}", sync_counter);
    println!("Total writes: {}", write_counter);
    println!("Final counts: {:?}", final_counts);
    println!("Duration: {:?}", start_time.elapsed());

    assert_eq!(
        final_counts[0], final_counts[1],
        "Peers should converge after continuous syncing"
    );
}
