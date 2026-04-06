# Cadence Benchmarks

This directory contains Criterion benchmarks for the Cadence sync engine.

## Prerequisites

- **Valkey/Redis**: The benchmarks require a running Valkey or Redis instance on `127.0.0.1:6379`.
  - You can start one using Docker: `docker run -d -p 6379:6379 valkey/valkey:latest`
  - Or use Redis: `docker run -d -p 6379:6379 redis:latest`

## Running Benchmarks

### Run all benchmarks

```bash
cargo bench
```

### Run specific benchmark suite

```bash
# Run only Valkey operations benchmarks
cargo bench --bench valkey_ops

# Run only change log benchmarks
cargo bench --bench change_log
```

### Run specific benchmark

```bash
# Run a single benchmark by name pattern
cargo bench -- valkey_set
cargo bench -- sqlite_append
```

## Benchmark Suites

### 1. `valkey_ops.rs` - Valkey/Redis Operations

Measures performance of low-level Valkey operations:

- **SET/GET operations**: Basic key-value operations
- **LPUSH/LRANGE**: List operations with varying sizes (10, 100, 1000 items)
- **Pipeline batching**: Batched operations (10, 100, 1000 ops per batch)
- **INCR**: Counter increments
- **HSET/HGETALL**: Hash operations
- **ZADD/ZRANGEBYSCORE**: Sorted set operations with varying ranges

### 2. `change_log.rs` - Change Log Operations

Compares SQLite and Valkey backends for Cadence metadata operations:

#### Append Operations
- **Payload sizes**: 1KB, 10KB, 100KB payloads
- **Batch append**: 10, 100, 1000 changes per batch

#### Query Operations
- **query_since**: Retrieve 10, 100, 1000 most recent changes
- **query_by_doc**: Lookup all changes for a specific document
- **max_seq**: Get the maximum sequence number

#### Metadata Operations
- **Watermarks**: Get/set peer synchronization watermarks
- **Compaction**: Remove old entries, keeping only latest per field

## Interpreting Results

Criterion will:
- Generate HTML reports in `target/criterion/`
- Show throughput (ops/sec or bytes/sec) for each benchmark
- Compare against previous runs to detect regressions
- Highlight statistically significant performance changes

## Configuration

### Valkey Connection

By default, benchmarks connect to `redis://127.0.0.1:6379/0`. To use a different URL:

```bash
# Set environment variable (not currently used, but reserved for future)
export VALKEY_BENCH_URL="redis://localhost:6380"
```

### Benchmark Parameters

Edit the benchmark files to adjust:
- Payload sizes
- Batch sizes
- Number of pre-populated entries
- Sample sizes (for expensive operations like compaction)

## Notes

- **Isolation**: The Valkey benchmarks use unique key prefixes (UUID-based) to avoid interference
- **Cleanup**: SQLite benchmarks use temporary directories that are automatically cleaned up
- **Sample size**: Expensive operations (e.g., compaction) use smaller sample sizes (10 instead of default 100)
- **Warmup**: Criterion automatically handles warmup iterations

## Performance Tips

For stable benchmark results:
- Close unnecessary applications
- Disable CPU frequency scaling: `sudo cpupower frequency-set --governor performance`
- Run on a quiet system (minimal background tasks)
- Use a local Valkey instance (not remote)

## CI Integration

To run benchmarks in CI without statistical analysis:

```bash
cargo bench --bench valkey_ops -- --quick
```

This skips the analysis phase and runs fewer iterations.
