# Runtime + Release-Gate Readiness Report

**Dimension:** RUNTIME + RELEASE-GATE (Confidence Layer 4) of `/oli-check`
**Date:** 2026-05-31
**Branch:** `feat/ceph-demoable-and-manual-ux`
**Mode:** Read-only static verification (no `--live` loop, no full test suite)

---

## JOB 1 — Boot-Smoke Readiness

### Typecheck

| Target | Command | Result |
|--------|---------|--------|
| API service | `cd services/api-ts && bun run typecheck` (`tsc --noEmit`) | **PASS** — 0 errors |
| Frontend | `cd apps/dentalemon && bun run typecheck` (`tsc --noEmit`) | **PASS** — 0 errors |

Both sides compile clean. No type-level boot blockers.

### Config / Env Boot Blockers

`services/api-ts/src/core/config.ts` is **safe-by-default**: every env var has a
sensible development fallback (`SERVER_PORT`→7213, `DATABASE_URL`→local postgres,
`STORAGE_*`→minio defaults, `AUTH_SECRET`→random fallback). The service therefore
boots with zero required env vars in dev.

A **production hard-guard** exists (lines 252–276): when `NODE_ENV=production`,
startup is *refused* (`throw`) if any of `AUTH_SECRET` (<32 chars), `INTERNAL_SERVICE_TOKEN`
(<32 chars), `DATABASE_URL` (default localhost/password), `STORAGE_ACCESS_KEY_ID`
(`minioadmin`), or `STORAGE_SECRET_ACCESS_KEY` (`minioadmin`) are weak/unset. This is
a correct fail-closed posture — no insecure defaults can reach prod. **No boot blocker.**

### Migration Drift

- Journaled migrations: **76** entries in `_journal.json` (latest `0075_gifted_vector`).
- SQL files on disk: **79**.
- **3 orphan SQL files NOT in the journal:** `0059_gap003_treatment_plan_partial.sql`,
  `0059a_gap003_treatment_plan_partial.sql`, `0067_ef_pmd_005_source_description.sql`.

Migrations are applied by drizzle-orm's `migrate()` (`src/core/database.ts:212`), which
is **journal-driven** — it only applies entries listed in `_journal.json`. The 3 orphan
files are therefore inert (superseded hand-written SQL). Verified: the `source_description`
column from orphan `0067_ef_pmd_005` was re-issued in the journaled `0069_kind_triton.sql`,
so the live schema is intact. **Not a boot blocker** — file-hygiene clutter only (P2).

### Runtime Targets

`docs/product/PERFORMANCE.md` exists and CI enforces a **Performance Ratchet**
(`services/api-ts/bun run tests/perf/run.ts`) on every push/PR. Runtime budgets are gated.

**Boot-smoke verdict: PASS.**

---

## JOB 2 — Release-Gate Readiness

### CI Gate Inventory (`.github/workflows/`)

| Gate | Present? | Where |
|------|----------|-------|
| Typecheck | ✅ | `quality.yml` (TypeScript job) + `postgres-services.yml` |
| Lint | ✅ | `quality.yml` (Lint job) |
| Unit tests (frontend) | ✅ | `quality.yml` (Unit Tests, `bun test --coverage`) |
| Unit tests (API + coverage) | ✅ | `postgres-services.yml` (`test:coverage` w/ real Postgres) |
| Production build | ✅ | `quality.yml` (Production Build, `bun run build`) |
| Contract tests (Hurl) | ✅ | `contract.yml` (`test:contract` + fuzz/Schemathesis) |
| Security audit (deps) | ✅ | `quality.yml` (`scripts/check-audit.sh`) + `bun audit` in `contract.yml` |
| Migration safety lint | ✅ | `quality.yml` (`lint:migrations`) |
| Duplicate operationId check | ✅ | `quality.yml` (`check:duplicate-ops`) |
| BR traceability gate | ✅ | `quality.yml` (`audit:trace:ci`) |
| OpenAPI drift detection | ✅ | `openapi-drift.yml` |
| E2E (Playwright) | ✅ | `quality.yml` (E2E Tests, chromium) |
| Journey harness | ✅ | `quality.yml` (Journey Harness w/ reseed) |
| Performance ratchet | ✅ | `quality.yml` (Performance Ratchet) |
| Release build | ✅ | `release.yml` (on `v*` tag → gh-release) |

**CI gate coverage: 15/15 expected gates PRESENT.** This is a strong, comprehensive
pipeline — typecheck, lint, unit, contract, security, build, E2E, perf, and drift all gate `main`.

Triggers: `quality.yml` runs on push-to-main + all PRs. `release.yml` runs on `v*` tags.

### Migration Safety

- **Forward path:** ✅ journal-driven, auto-applies pending migrations on server start;
  `lint:migrations` gates migration safety in CI.
- **Rollback story:** ❌ **No down/rollback migrations** present (drizzle-kit doesn't emit
  them by default). Recovery in prod would be manual/restore-from-backup. P1 for a healthcare
  product handling PHI.

### Version Management

- `VERSION` file: ✅ `0.2.0.0`
- `CHANGELOG.md`: ✅ present, maintained (latest `[0.2.0.0] - 2026-05-18`, Keep-a-Changelog format)
- Release script: ✅ `release.yml` on tag push (builds + `softprops/action-gh-release`)

### Health Endpoint

- `/livez` (liveness) and `/readyz` (readiness) implemented in `src/core/health.ts`.
- **`/readyz` checks DB** (`checkDatabaseConnection`), **storage** (`storage.healthCheck()`),
  and **background jobs** (`jobs.getHealth()`); returns 503 when any fail. RFC-compliant
  `application/health+json` verbose mode + k8s-style plaintext. **Excellent — DB-aware readiness.**

---

## Findings

### P0 (boot/release blockers) — NONE

### P1
- **P1-1 — No migration rollback story.** Drizzle migrations are forward-only; no down
  migrations or documented restore runbook. For a PHI-handling healthcare product, a failed
  prod migration has no scripted recovery path. *Recommend: document a backup/restore runbook
  and/or adopt reversible migration discipline.*

### P2
- **P2-1 — 3 orphan migration SQL files** not in `_journal.json`
  (`0059_`, `0059a_gap003_treatment_plan_partial`, `0067_ef_pmd_005_source_description`).
  Inert (drizzle is journal-driven; columns re-issued in journaled migrations) but should be
  deleted to avoid confusion. *File hygiene.*
- **P2-2 — Frontend has no production typecheck in its own `build`** beyond the standalone
  `typecheck` job; CI covers it via `quality.yml` TypeScript job, so low risk.

---

## Overall Verdict: **PASS**

Both API and frontend typecheck clean (0 errors). No hard boot blockers — config is
safe-by-default with a fail-closed production secret guard. Release gates are comprehensive
(15/15: typecheck, lint, unit, contract, security, build, E2E, perf, drift, traceability).
Health endpoints are DB-aware. The sole non-trivial gap is the absence of a migration
rollback/restore story (P1) — notable for a healthcare/PHI product but not a release blocker
for the current demo-stage milestone.
