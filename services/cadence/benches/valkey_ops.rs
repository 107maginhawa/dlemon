//! Valkey/Redis operations benchmarks
//!
//! Measures performance of basic Valkey operations including:
//! - SET/GET operations
//! - LPUSH/LRANGE for list operations
//! - Pipeline batching with varying batch sizes

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use fred::prelude::*;
use tokio::runtime::Runtime;

/// Setup a Valkey client for benchmarking
/// Uses VALKEY_URL env var or defaults to stress test config
async fn setup_valkey() -> Result<Client, Box<dyn std::error::Error>> {
    let url = std::env::var("VALKEY_URL")
        .unwrap_or_else(|_| "redis://:stress-test@127.0.0.1:16380/0".to_string());
    let config = Config::from_url(&url)?;
    let client = Builder::from_config(config).build()?;
    client.init().await?;

    Ok(client)
}

/// Benchmark SET operations
fn bench_set(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let client = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    c.bench_function("valkey_set", |b| {
        b.iter(|| {
            rt.block_on(async {
                let key = format!("bench:set:{}", rand::random::<u64>());
                let value = "benchmark_value";
                client.set::<(), _, _>(black_box(&key), black_box(value), None, None, false)
                    .await
                    .unwrap();
            })
        });
    });
}

/// Benchmark GET operations
fn bench_get(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let client = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    // Pre-populate keys
    rt.block_on(async {
        for i in 0..1000 {
            let key = format!("bench:get:{}", i);
            let _: () = client.set(&key, "benchmark_value", None, None, false).await.unwrap();
        }
    });

    c.bench_function("valkey_get", |b| {
        let mut counter = 0u32;
        b.iter(|| {
            rt.block_on(async {
                let key = format!("bench:get:{}", counter % 1000);
                counter += 1;
                let _: Option<String> = client.get(black_box(&key)).await.unwrap();
            })
        });
    });
}

/// Benchmark SET/GET round-trip
fn bench_set_get_roundtrip(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let client = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    c.bench_function("valkey_set_get_roundtrip", |b| {
        b.iter(|| {
            rt.block_on(async {
                let key = format!("bench:roundtrip:{}", rand::random::<u64>());
                let value = "benchmark_value";

                let _: () = client.set(&key, value, None, None, false).await.unwrap();
                let result: Option<String> = client.get(black_box(&key)).await.unwrap();
                black_box(result);
            })
        });
    });
}

/// Benchmark LPUSH operations
fn bench_lpush(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let client = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    c.bench_function("valkey_lpush", |b| {
        let key = "bench:list";
        b.iter(|| {
            rt.block_on(async {
                let value = format!("item_{}", rand::random::<u64>());
                let _: i64 = client.lpush(black_box(key), black_box(value)).await.unwrap();
            })
        });
    });
}

/// Benchmark LRANGE operations
fn bench_lrange(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let client = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    let key = "bench:lrange";

    // Pre-populate list with 1000 items
    rt.block_on(async {
        for i in 0..1000 {
            let _: i64 = client.lpush(key, format!("item_{}", i)).await.unwrap();
        }
    });

    let mut group = c.benchmark_group("valkey_lrange");

    for size in [10, 100, 1000] {
        group.throughput(Throughput::Elements(size));
        group.bench_with_input(BenchmarkId::from_parameter(size), &size, |b, &size| {
            b.iter(|| {
                rt.block_on(async {
                    let result: Vec<String> = client
                        .lrange(black_box(key), 0, black_box(size as i64 - 1))
                        .await
                        .unwrap();
                    black_box(result);
                })
            });
        });
    }

    group.finish();
}

/// Benchmark pipeline batching with varying batch sizes
fn bench_pipeline_batching(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let client = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    let mut group = c.benchmark_group("valkey_pipeline");

    for batch_size in [10, 100, 1000] {
        group.throughput(Throughput::Elements(batch_size));
        group.bench_with_input(
            BenchmarkId::from_parameter(batch_size),
            &batch_size,
            |b, &batch_size| {
                b.iter(|| {
                    rt.block_on(async {
                        let pipeline = client.pipeline();

                        for i in 0..batch_size {
                            let key = format!("bench:pipeline:{}", i);
                            let value = format!("value_{}", i);
                            let _: () = pipeline.set(&key, value, None, None, false).await.unwrap();
                        }

                        let _: Vec<()> = pipeline.all().await.unwrap();
                    })
                });
            },
        );
    }

    group.finish();
}

/// Benchmark INCR operations
fn bench_incr(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let client = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    c.bench_function("valkey_incr", |b| {
        let key = "bench:counter";
        b.iter(|| {
            rt.block_on(async {
                let _: i64 = client.incr(black_box(key)).await.unwrap();
            })
        });
    });
}

/// Benchmark HSET operations
fn bench_hset(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let client = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    c.bench_function("valkey_hset", |b| {
        let key = "bench:hash";
        b.iter(|| {
            rt.block_on(async {
                let field = format!("field_{}", rand::random::<u64>());
                let value = "benchmark_value";
                let _: i64 = client
                    .hset(black_box(key), (black_box(field), black_box(value)))
                    .await
                    .unwrap();
            })
        });
    });
}

/// Benchmark HGETALL operations
fn bench_hgetall(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let client = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    let key = "bench:hgetall";

    // Pre-populate hash with 100 fields
    rt.block_on(async {
        for i in 0..100 {
            let _: i64 = client
                .hset(key, (format!("field_{}", i), format!("value_{}", i)))
                .await
                .unwrap();
        }
    });

    c.bench_function("valkey_hgetall", |b| {
        b.iter(|| {
            rt.block_on(async {
                let result: std::collections::HashMap<String, String> =
                    client.hgetall(black_box(key)).await.unwrap();
                black_box(result);
            })
        });
    });
}

/// Benchmark ZADD operations
fn bench_zadd(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let client = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    c.bench_function("valkey_zadd", |b| {
        let key = "bench:zset";
        let mut counter = 0u64;
        b.iter(|| {
            rt.block_on(async {
                counter += 1;
                let member = format!("member_{}", rand::random::<u64>());
                let _: i64 = client
                    .zadd(
                        black_box(key),
                        None,
                        None,
                        false,
                        false,
                        (black_box(counter as f64), black_box(member)),
                    )
                    .await
                    .unwrap();
            })
        });
    });
}

/// Benchmark ZRANGEBYSCORE operations
fn bench_zrangebyscore(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let client = rt.block_on(setup_valkey()).expect("Failed to connect to Valkey");

    let key = "bench:zrangebyscore";

    // Pre-populate sorted set with 1000 members
    rt.block_on(async {
        for i in 0..1000 {
            let _: i64 = client
                .zadd(
                    key,
                    None,
                    None,
                    false,
                    false,
                    (i as f64, format!("member_{}", i)),
                )
                .await
                .unwrap();
        }
    });

    let mut group = c.benchmark_group("valkey_zrangebyscore");

    for range in [10, 100, 1000] {
        group.throughput(Throughput::Elements(range));
        group.bench_with_input(
            BenchmarkId::from_parameter(range),
            &range,
            |b, &range| {
                b.iter(|| {
                    rt.block_on(async {
                        let result: Vec<String> = client
                            .zrangebyscore(black_box(key), 0.0, black_box(range as f64), false, None)
                            .await
                            .unwrap();
                        black_box(result);
                    })
                });
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_set,
    bench_get,
    bench_set_get_roundtrip,
    bench_lpush,
    bench_lrange,
    bench_pipeline_batching,
    bench_incr,
    bench_hset,
    bench_hgetall,
    bench_zadd,
    bench_zrangebyscore,
);
criterion_main!(benches);
