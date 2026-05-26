# G0 Pool / Test Failure Diagnosis

**Run date:** 2026-05-20  
**Branch:** feat/v1.4-clinical-imaging  
**Result:** 1546 pass / 1272 fail / 946 errors — 2818 tests, 140 files, 480s

---

## Phase A.0 — Failure-string bucket table

| Signature | Count | Likely root cause |
|-----------|-------|-------------------|
| `ECONNREFUSED` | 322 | MinIO/S3 not running locally — ALL bucket checks in E2E storage tests |
| `TypeError` (all are `teardown is not a function`) | 299 | **Cascade** from `openTestTx()` failure: `teardown` undefined when `beforeEach` throws |
| `is not a function` (same root) | 269 | Same cascade — not a separate code-drift category |
| `violates foreign key` | 66 | **Root cause**: repo tests insert child rows without parent rows in same transaction |
| `FK violation` | 2 | Same category |
| `already exists` | 31 | 26× "Provider already exists" (E2E auth state leak) + 5× PG catalog (migration notice) |
| `does not exist` | 13 | Missing schema refs in test scope |
| `NotFoundError` | 3 | Handler-layer 404s |
| `UnauthorizedError` | 1 | Auth gate |

**Verdict: pool exhaustion is NOT the dominant failure mode.** There are ZERO occurrences of:
- `FATAL: sorry, too many clients`
- `connection terminated`
- `ECONNRESET` (DB — all ECONNREFUSED are MinIO)
- `deadlock`

The 80% pool / 20% code-drift assumption from v1 was wrong.

---

## Actual failure decomposition

| Category | ~Failures | Root cause | Phase |
|----------|-----------|------------|-------|
| Repo tests: FK cascade | ~680 | `openTestTx` wraps per-test tx; child inserts (dental_visit, prescription, etc.) reference FK parents that don't exist within that transaction | **B'' primary** |
| Storage E2E | ~320 | MinIO not running in local dev (ECONNREFUSED on bucket check) | Quarantine (need MinIO) |
| Handler tests | ~253 | Mix: (a) handler tests that depend on handler-test seed data that FK-violates; (b) BR-016 role hardening uncommitted | Phase 0 + B'' |
| E2E: EMR (52) | ~52 | "Route not found" for provider profile creation — EMR E2E test calls a Better-Auth provider route that isn't registered | Phase 0 code fix |
| E2E: Patient/Provider (52+39) | ~91 | Same Better-Auth provider route missing (client.ts helper) | Phase 0 |
| E2E: Booking (11) | ~11 | `booking.provider` undefined — response shape drift (provider field renamed/removed) | Phase 0 |
| E2E: CORS/Auth (18) | ~18 | E2E test state leak — provider creation conflicting across tests | Phase 0 |
| E2E: Email (64) | ~64 | SMTP not running locally | Quarantine (need SMTP) |
| BR-002/BR-006 state machine (2) | ~2 | Treatment state machine: diagnosed→planned→performed (two steps); single jump fails | Phase 0 |

---

## Structural findings (Phase A.1 — static analysis)

### Finding 1: 49 handler test files — module-level pg.Pool, max=20, never closed

```
grep -rn "^const db = createDatabase" services/api-ts/src/handlers/ --include="*.test.ts"
→ 49 matches
```

Every file declares `const db = createDatabase({ url: 'postgres://...' })` at module load time. `createDatabase` uses `pg.Pool(max: 20)` by default. None have `afterAll(() => db.$client.end())`. This creates up to 49 × 20 = 980 potential connections that are never released during a test run.

**However**: the run completed in 480s without any pool-exhaustion errors. Bun appears to be running enough workers that 49 pools don't exceed PG `max_connections` — or PG is configured with a high limit locally. This is a latent risk but not the current failure driver.

### Finding 2: E2E tests use createTestApp() — two-pool problem

22 E2E test files use `createTestApp()`. Each call:
1. Opens a `postgres` (postgres-js, max:10) pool via `createTestSchema()`
2. Opens a `pg.Pool` (node-postgres, max:10) via `createApp(config)` → `createDatabase()`

Two drivers on two pools per test app instance. Not causing failures today (schema isolation works), but adds connection overhead.

### Finding 3: test-tx.ts exists and works — T2 on pg is already implemented

`src/core/test-tx.ts` implements `openTestTx()`: shared `pg.Pool(max:5)` + `BEGIN`/`ROLLBACK` per test. Used by 8 repo test files. **This is the T2 pattern we need to expand to all repo tests.**

The repo tests failing are NOT failing because of a broken fixture — they're failing because the test itself doesn't insert the required parent records (branch, membership, patient, etc.) before inserting child records. Each test transaction starts empty; FK parents must be seeded within the transaction.

### Finding 4: bunfig.toml has no worker cap

```toml
[test]
coverage = true
coverageThreshold = { line = 70 }
```

No `--jobs` or worker limit. Default = CPU count. On an 8-core machine: 8 workers × 49 pools × 20 max = potential 7840 connections if all loaded simultaneously. Not hitting this limit today, but fragile.

### Finding 5: hardcoded DB URL in 49 handler test files

All 49 use `'postgres://postgres:password@localhost:5432/monobase'` — no `process.env.DATABASE_URL`. No schema isolation. Tests share the `public` schema and rely on `onConflictDoNothing()` for seed idempotency + `afterEach(truncate)` for invoice/payment tables.

---

## Per-cluster tier map

Based on the above, the tier ladder from the original plan is only partially applicable:

| Cluster | File count | Failing | Root cause | Fix tier |
|---------|-----------|---------|------------|----------|
| **Repo tests** (`src/handlers/*/repos/*.test.ts`) | ~30 | ~680 | FK missing in tx scope | **B'': add parent-record setup to each openTestTx beforeEach** |
| **Handler tests** (`src/handlers/*/*.test.ts`, not repo) | 49 | ~253 | Mix: FK seed + uncommitted BR-016 | **B'': seed fixture fix + Phase 0 for BR-016** |
| **E2E tests** (`tests/e2e/`) | 22 | ~320 | Storage: quarantine; EMR/Booking/Auth: code drift | **Phase 0 code fixes + quarantine storage/email** |
| **Pure unit tests** | 55 | 0 | — | No action needed |
| **Pool exhaustion** | — | 0 | Not present | **T1.5 is low priority; add afterAll cleanup for hygiene only** |

---

## T2 viability verdict (from static analysis + existing test-tx.ts)

**T2_VIABLE: yes — already implemented via `pg` in `src/core/test-tx.ts`.**

No A.5 spike needed. `openTestTx()` is the T2 pattern (BEGIN/ROLLBACK per test, shared pool max:5). It works for repo tests. The fix is expanding its usage to handler tests AND fixing the FK seed data within transactions.

**T1_5_T2_COEXIST: n/a** — pool exhaustion is not the issue; coexistence check not needed.

---

## Decision: plan reroutes to Phase B''

Per Phase A.0 decision rules:
- `violates foreign key` dominates (after stripping cascade TypeError) → **Phase B'' (seed/fixture fix)**
- No `FATAL: sorry, too many` / `ECONNRESET` → **Tier ladder (T1/T1.5/T2) deprioritized**
- `is not a function` = cascade, not real code drift → **no Phase 0.2 InvoiceRepository fix needed**

**Primary work order:**
1. Phase 0 (code fixes): BR-016 uncommitted, EMR E2E route (Better-Auth provider endpoint), Booking response shape, BR-002/BR-006 state machine
2. Phase B'' (seed/fixture): Fix repo tests' `beforeEach` to seed required FK parents within each `openTestTx` transaction
3. Phase B'' continued: Fix handler tests' `beforeAll` to not violate FK constraints  
4. Quarantine: storage E2E (needs MinIO), email E2E (needs SMTP) — with proper sunset headers
5. Phase D: CI gate + ratchet

**Pool hygiene (low priority, do alongside B''):**
- Add `afterAll(() => (db as any).$client.end())` to all 49 handler test files — 1-line fix, prevents latent connection leak

---

## What we are NOT doing (per A.0 finding)

- Not rebuilding the test harness with T1.5 (worker-scoped pools) — pool exhaustion is not the failure driver
- Not running Phase A.5 T2 spike — `test-tx.ts` already proves T2 viable on `pg`
- Not treating `teardown is not a function` as a separate code-drift issue — it's a cascade from FK failures
