//! Change log benchmarks for Cadence metadata backends
//!
//! Measures performance of change log operations with varying payload sizes
//! and batch operations on both SQLite and Valkey backends.

use cadence::state::{FieldChange, RowChange, SyncPayload};
use cadence::storage::{MetadataBackend, SqliteBackend, ValkeyBackend};
use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use tempfile::TempDir;
use tokio::runtime::Runtime;

/// Generate a RowChange with a given payload size in bytes
fn generate_change(payload_size: usize, seq: u64) -> RowChange {
    let value_str = "x".repeat(payload_size / 2); // JSON overhead doubles size roughly
    let field_changes = vec![FieldChange {
        field: "data".to_string(),
        value: serde_json::Value::String(value_str),
        lamport: seq,
        peer_id: "bench_peer".to_string(),
    }];

    RowChange {
        collection: "test_collection".to_string(),
        document_id: format!("doc_{}", seq),
        payload: SyncPayload::Fields(field_changes),
        deleted: false,
        seq,
    }
}

/// Generate a batch of RowChanges with small payloads
fn generate_batch(batch_size: usize, start_seq: u64) -> Vec<RowChange> {
    (0..batch_size)
        .map(|i| generate_change(100, start_seq + i as u64))
        .collect()
}

/// Setup SQLite backend for benchmarking
fn setup_sqlite() -> (TempDir, SqliteBackend) {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("bench.db");
    let backend = SqliteBackend::open(&db_path).unwrap();
    (temp_dir, backend)
}

/// Setup Valkey backend for benchmarking
/// Uses VALKEY_URL env var or defaults to stress test config
async fn setup_valkey() -> Result<ValkeyBackend, Box<dyn std::error::Error>> {
    let url = std::env::var("VALKEY_URL")
        .unwrap_or_else(|_| "redis://:stress-test@127.0.0.1:16380/0".to_string());
    let prefix = format!("bench:{}:", uuid::Uuid::new_v4());
    ValkeyBackend::connect_with_prefix(&url, &prefix).await.map_err(Into::into)
}

/// Benchmark SQLite append_change with varying payload sizes
fn bench_sqlite_append_payload_sizes(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let (_temp_dir, backend) = setup_sqlite();

    let mut group = c.benchmark_group("sqlite_append_by_payload_size");

    for size in [1024, 10 * 1024, 100 * 1024] {
        group.throughput(Throughput::Bytes(size));
        group.bench_with_input(BenchmarkId::from_parameter(size), &size, |b, &size| {
            let mut seq = 1u64;
            b.iter(|| {
                rt.block_on(async {
                    let change = generate_change(size as usize, seq);
                    seq += 1;
                    backend.append_change(black_box(&change)).await.unwrap();
                })
            });
        });
    }

    group.finish();
}

/// Benchmark Valkey append_change with varying payload sizes
fn bench_valkey_append_payload_sizes(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let backend = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    let mut group = c.benchmark_group("valkey_append_by_payload_size");

    for size in [1024, 10 * 1024, 100 * 1024] {
        group.throughput(Throughput::Bytes(size));
        group.bench_with_input(BenchmarkId::from_parameter(size), &size, |b, &size| {
            let mut seq = 1u64;
            b.iter(|| {
                rt.block_on(async {
                    let change = generate_change(size as usize, seq);
                    seq += 1;
                    backend.append_change(black_box(&change)).await.unwrap();
                })
            });
        });
    }

    group.finish();
}

/// Benchmark SQLite batch append with varying batch sizes
fn bench_sqlite_batch_append(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let (_temp_dir, backend) = setup_sqlite();

    let mut group = c.benchmark_group("sqlite_batch_append");

    for batch_size in [10, 100, 1000] {
        group.throughput(Throughput::Elements(batch_size));
        group.bench_with_input(
            BenchmarkId::from_parameter(batch_size),
            &batch_size,
            |b, &batch_size| {
                let mut start_seq = 1u64;
                b.iter(|| {
                    rt.block_on(async {
                        let batch = generate_batch(batch_size as usize, start_seq);
                        start_seq += batch_size as u64;

                        for change in batch {
                            backend.append_change(&change).await.unwrap();
                        }
                    })
                });
            },
        );
    }

    group.finish();
}

/// Benchmark Valkey batch append with varying batch sizes
fn bench_valkey_batch_append(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let backend = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    let mut group = c.benchmark_group("valkey_batch_append");

    for batch_size in [10, 100, 1000] {
        group.throughput(Throughput::Elements(batch_size));
        group.bench_with_input(
            BenchmarkId::from_parameter(batch_size),
            &batch_size,
            |b, &batch_size| {
                let mut start_seq = 1u64;
                b.iter(|| {
                    rt.block_on(async {
                        let batch = generate_batch(batch_size as usize, start_seq);
                        start_seq += batch_size as u64;

                        for change in batch {
                            backend.append_change(&change).await.unwrap();
                        }
                    })
                });
            },
        );
    }

    group.finish();
}

/// Benchmark SQLite query_since with varying result set sizes
fn bench_sqlite_query_since(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let (_temp_dir, backend) = setup_sqlite();

    // Pre-populate with 10,000 changes
    rt.block_on(async {
        for i in 1..=10_000 {
            let change = generate_change(100, i);
            backend.append_change(&change).await.unwrap();
        }
    });

    let mut group = c.benchmark_group("sqlite_query_since");

    for result_size in [10, 100, 1000] {
        group.throughput(Throughput::Elements(result_size));
        group.bench_with_input(
            BenchmarkId::from_parameter(result_size),
            &result_size,
            |b, &result_size| {
                b.iter(|| {
                    rt.block_on(async {
                        let since_seq = 10_000 - result_size;
                        let results = backend
                            .query_since(black_box(since_seq))
                            .await
                            .unwrap();
                        black_box(results);
                    })
                });
            },
        );
    }

    group.finish();
}

/// Benchmark Valkey query_since with varying result set sizes
fn bench_valkey_query_since(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let backend = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    // Pre-populate with 10,000 changes
    rt.block_on(async {
        for i in 1..=10_000 {
            let change = generate_change(100, i);
            backend.append_change(&change).await.unwrap();
        }
    });

    let mut group = c.benchmark_group("valkey_query_since");

    for result_size in [10, 100, 1000] {
        group.throughput(Throughput::Elements(result_size));
        group.bench_with_input(
            BenchmarkId::from_parameter(result_size),
            &result_size,
            |b, &result_size| {
                b.iter(|| {
                    rt.block_on(async {
                        let since_seq = 10_000 - result_size;
                        let results = backend
                            .query_since(black_box(since_seq))
                            .await
                            .unwrap();
                        black_box(results);
                    })
                });
            },
        );
    }

    group.finish();
}

/// Benchmark SQLite query_by_doc
fn bench_sqlite_query_by_doc(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let (_temp_dir, backend) = setup_sqlite();

    // Pre-populate with changes for 100 different documents
    rt.block_on(async {
        for doc_id in 0..100 {
            for version in 1..=100 {
                let mut change = generate_change(100, doc_id * 100 + version);
                change.document_id = format!("doc_{}", doc_id);
                backend.append_change(&change).await.unwrap();
            }
        }
    });

    c.bench_function("sqlite_query_by_doc", |b| {
        let mut doc_counter = 0u64;
        b.iter(|| {
            rt.block_on(async {
                let doc_id = format!("doc_{}", doc_counter % 100);
                doc_counter += 1;
                let results = backend
                    .query_by_doc(black_box("test_collection"), black_box(&doc_id))
                    .await
                    .unwrap();
                black_box(results);
            })
        });
    });
}

/// Benchmark Valkey query_by_doc
fn bench_valkey_query_by_doc(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let backend = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    // Pre-populate with changes for 100 different documents
    rt.block_on(async {
        for doc_id in 0..100 {
            for version in 1..=100 {
                let mut change = generate_change(100, doc_id * 100 + version);
                change.document_id = format!("doc_{}", doc_id);
                backend.append_change(&change).await.unwrap();
            }
        }
    });

    c.bench_function("valkey_query_by_doc", |b| {
        let mut doc_counter = 0u64;
        b.iter(|| {
            rt.block_on(async {
                let doc_id = format!("doc_{}", doc_counter % 100);
                doc_counter += 1;
                let results = backend
                    .query_by_doc(black_box("test_collection"), black_box(&doc_id))
                    .await
                    .unwrap();
                black_box(results);
            })
        });
    });
}

/// Benchmark SQLite max_seq operation
fn bench_sqlite_max_seq(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let (_temp_dir, backend) = setup_sqlite();

    // Pre-populate with 1,000 changes
    rt.block_on(async {
        for i in 1..=1_000 {
            let change = generate_change(100, i);
            backend.append_change(&change).await.unwrap();
        }
    });

    c.bench_function("sqlite_max_seq", |b| {
        b.iter(|| {
            rt.block_on(async {
                let max_seq = backend.max_seq().await.unwrap();
                black_box(max_seq);
            })
        });
    });
}

/// Benchmark Valkey max_seq operation
fn bench_valkey_max_seq(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let backend = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    // Pre-populate with 1,000 changes
    rt.block_on(async {
        for i in 1..=1_000 {
            let change = generate_change(100, i);
            backend.append_change(&change).await.unwrap();
        }
    });

    c.bench_function("valkey_max_seq", |b| {
        b.iter(|| {
            rt.block_on(async {
                let max_seq = backend.max_seq().await.unwrap();
                black_box(max_seq);
            })
        });
    });
}

/// Benchmark SQLite watermark operations
fn bench_sqlite_watermarks(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let (_temp_dir, backend) = setup_sqlite();

    c.bench_function("sqlite_set_watermark", |b| {
        let mut seq = 0u64;
        b.iter(|| {
            rt.block_on(async {
                seq += 1;
                backend
                    .set_watermark(black_box("peer_1"), black_box(seq))
                    .await
                    .unwrap();
            })
        });
    });

    // Pre-set a watermark for get benchmark
    rt.block_on(async {
        backend.set_watermark("peer_1", 1000).await.unwrap();
    });

    let (_temp_dir2, backend2) = setup_sqlite();
    rt.block_on(async {
        backend2.set_watermark("peer_1", 1000).await.unwrap();
    });

    c.bench_function("sqlite_get_watermark", |b| {
        b.iter(|| {
            rt.block_on(async {
                let seq = backend2
                    .get_watermark(black_box("peer_1"))
                    .await
                    .unwrap();
                black_box(seq);
            })
        });
    });
}

/// Benchmark Valkey watermark operations
fn bench_valkey_watermarks(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let backend = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    c.bench_function("valkey_set_watermark", |b| {
        let mut seq = 0u64;
        b.iter(|| {
            rt.block_on(async {
                seq += 1;
                backend
                    .set_watermark(black_box("peer_1"), black_box(seq))
                    .await
                    .unwrap();
            })
        });
    });

    // Pre-set a watermark for get benchmark
    let backend2 = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");
    rt.block_on(async {
        backend2.set_watermark("peer_1", 1000).await.unwrap();
    });

    c.bench_function("valkey_get_watermark", |b| {
        b.iter(|| {
            rt.block_on(async {
                let seq = backend2
                    .get_watermark(black_box("peer_1"))
                    .await
                    .unwrap();
                black_box(seq);
            })
        });
    });
}

/// Benchmark SQLite compact operation
fn bench_sqlite_compact(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("sqlite_compact");
    group.sample_size(10); // Compaction is expensive, reduce sample size

    for num_changes in [100, 1000] {
        group.bench_with_input(
            BenchmarkId::from_parameter(num_changes),
            &num_changes,
            |b, &num_changes| {
                b.iter_batched(
                    || {
                        // Setup: create a fresh backend with changes
                        let (_temp_dir, backend) = setup_sqlite();
                        rt.block_on(async {
                            for i in 1..=num_changes {
                                let change = generate_change(100, i);
                                backend.append_change(&change).await.unwrap();
                            }
                        });
                        (_temp_dir, backend)
                    },
                    |(_temp_dir, backend)| {
                        rt.block_on(async {
                            let deleted = backend.compact().await.unwrap();
                            black_box(deleted);
                        });
                    },
                    criterion::BatchSize::LargeInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark Valkey compact operation
fn bench_valkey_compact(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("valkey_compact");
    group.sample_size(10); // Compaction is expensive, reduce sample size

    for num_changes in [100, 1000] {
        group.bench_with_input(
            BenchmarkId::from_parameter(num_changes),
            &num_changes,
            |b, &num_changes| {
                b.iter_batched(
                    || {
                        // Setup: create a fresh backend with changes
                        let backend = rt.block_on(setup_valkey()).unwrap();
                        rt.block_on(async {
                            for i in 1..=num_changes {
                                let change = generate_change(100, i);
                                backend.append_change(&change).await.unwrap();
                            }
                        });
                        backend
                    },
                    |backend| {
                        rt.block_on(async {
                            let deleted = backend.compact().await.unwrap();
                            black_box(deleted);
                        });
                    },
                    criterion::BatchSize::LargeInput,
                );
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_sqlite_append_payload_sizes,
    bench_valkey_append_payload_sizes,
    bench_sqlite_batch_append,
    bench_valkey_batch_append,
    bench_sqlite_query_since,
    bench_valkey_query_since,
    bench_sqlite_query_by_doc,
    bench_valkey_query_by_doc,
    bench_sqlite_max_seq,
    bench_valkey_max_seq,
    bench_sqlite_watermarks,
    bench_valkey_watermarks,
    bench_sqlite_compact,
    bench_valkey_compact,
);
criterion_main!(benches);
