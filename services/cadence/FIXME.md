# Cadence Known Issues

## PgPollWatcher: Unbounded Memory from Full-Table Diffing (FIXED)

**Status**: Fixed — implemented hash-based diffing with LRU eviction

**Previous Severity**: High — caused OOM at 512Mi with 115 tables

### Original Problem

The watcher stored complete row data in `last_known: HashMap<(String, String), HashMap<String, Value>>`:
- 115 tables × ~100-200 rows = 11,500-23,000 rows stored as full JSON
- Each row: 2-10 KB → 50-200 MB memory usage
- No eviction — HashMap grew unbounded

### Fix Applied

1. **Hash-based diffing**: Changed `last_known` to store SHA256 hashes per field instead of full JSON values
   - Memory per row: ~200 bytes (vs ~5 KB before) = **96% reduction**

2. **LRU eviction**: Replaced `HashMap` with `LruCache` (default capacity: 100,000 rows)
   - Memory bounded to ~20 MB maximum regardless of table count

3. **Configurable capacity**: Added `watcher_lru_capacity` config option

**Files changed**:
- `src/watcher/mod.rs` — added `FieldHash` type and `hash_json_value()` function
- `src/watcher/pg_poll.rs` — hash-based LRU cache
- `src/watcher/sqlite.rs` — same changes
- `src/watcher/postgresql.rs` — same changes
- `src/config.rs` — `watcher_lru_capacity` option
- `Cargo.toml` — added `lru` dependency

## Sent/Received Counter Display (Investigated — NOT a Bug)

**Status**: Closed — counters are correct

Investigation showed the cloud cadence had no collections configured, so it had no data to send. The local peer sent its data to the cloud (correctly counted as `changes_sent`). The fix was adding the wildcard collections config to the Helm chart.

Integration regression tests added in `tests/integration/ws_sync_test.rs`:
- `test_ws_counter_direction_server_has_data`
- `test_ws_counter_direction_client_has_data`
