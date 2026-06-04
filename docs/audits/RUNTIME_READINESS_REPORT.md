# Runtime Readiness Report (boot-smoke tier)

**Dimension:** RUNTIME (boot-smoke + plan) of `/oli-check`
**Date:** 2026-06-02
**Branch:** `feat/ceph-demoable-and-manual-ux`
**Mode:** LIVE boot-smoke (API + Web actually booted and probed). No `--live`
interaction loop, no full test suite.
**Verdict:** PASS

---

## JOB 1 — API Boot-Smoke (services/api-ts, :7213)

**Command:** `cd services/api-ts && bun src/index.ts` (DB → `monobase`).
**Result: PASS.**

- Server bound cleanly: `🚀 Server running on http://0.0.0.0:7213`.
- Job scheduler started: **10 jobs** (email.cleanup, notifs.processScheduled,
  notifs.cleanup, audit.retention, booking.slotGenerator, booking.slotCleanup,
  retention.enforcement, booking.confirmationTimer, + workers ready).
- Email template init from filesystem completed.
- **Zero errors/fatals/unhandled-rejections in the boot phase** (verified: 0
  ERROR/FATAL/exception/ECONNREFUSED lines before the "Server running" line).

**Health probes:**
| Probe | Result | Interpretation |
|---|---|---|
| `GET /livez` | 200 | process alive — PASS |
| `GET /readyz` | 503 `failed` | readiness degraded (see below) |
| `GET /readyz?verbose` | `database: pass`, `jobs: pass`, `storage: fail` | only storage check fails |

**Post-boot log noise (NOT boot crashes):**
- `ERROR: Error checking bucket existence — ECONNREFUSED` — emitted by the
  `/readyz` `storage.healthCheck()` against MinIO/S3, which is unreachable in
  this environment. **Known infra quirk** (MEMORY: "MinIO SSE 501 → direct S3
  write"; storage not provisioned locally). Does not affect API serving — all
  DB-backed endpoints replied 200. Not flagged as BLOCK.
- `WARN: Application error … VALIDATION_ERROR` on `/dental/appointments` and
  `/dental/patients` — these are the **seed-coherence replay's own** initial
  malformed probes (missing `branchId`/`date_from`); expected request-time
  validation, not a server fault.

> The 503 readyz is storage-only and is the documented MinIO-absent condition.
> It is recorded as an advisory, not a boot BLOCK; `database` and `jobs` checks
> pass and every seeded surface returned 200 (see SEED_COHERENCE_REPORT.md).

---

## JOB 2 — Web Boot-Smoke (apps/dentalemon)

**Command:** `cd apps/dentalemon && bun run dev` (Vite).
**Port:** **3003** (per `vite.config.ts` `server.port: 3003` — note: the
task's stated `:3001` is stale; the app's configured dev port is 3003).
**Result: PASS.**

- `VITE v7.3.2 ready in 821 ms`, `Local: http://localhost:3003/`.
- `GET /` → **200**, valid SPA shell (`<title>Dentalemon</title>`, `#root`
  mount, `/@vite/client`, react-refresh hook, `/src/app.tsx` entry).
- Client entry `GET /src/app.tsx` → **200**, transformed cleanly (valid ESM with
  HMR wrapper). **Zero** `Transform failed` / `Failed to resolve` /
  `Internal Server Error` / `Pre-transform error` markers in served HTML or
  entry module.
- Boot log: 0 error/transform-failure lines.

No page-crash, no console-error in the served boot output → web boot-smoke PASS
(not SKIP).

---

## JOB 3 — Runtime Test Plan (design-time)

`docs/execution/RUNTIME_TEST_PLAN.md` is **present and fresh** (newer than all
inputs: PERFORMANCE.md, THREAT_MODEL.md, ROLE_PERMISSION_MATRIX.md, per-module
API_CONTRACTS, CODE_ROUTE_MAP v5, CODE_COMPONENT_REGISTRY v5).

- Full **FE↔BE Cross-Layer Contract Walker** mode (registry version 5 ≥ 4):
  every declared `api_call` per route must fire + 5 s infinite-skeleton ceiling.
- Sections present: Test Coverage Summary, Load Test Scenarios (k6 templates),
  Per-Module Performance Budgets, Security/DAST + OWASP checklist, Auth Matrix,
  Accessibility (axe-core), Cross-Layer Walker, What's Next. All artifacts are
  TEMPLATES with placeholders.
- This run **refreshed the `runtime-live-status` header** to record the live
  boot-smoke above (plan body unchanged — it was already current; design-time
  template content not regenerated).

---

## Verdicts
| Tier | Verdict |
|---|---|
| API boot-smoke | **PASS** (clean boot; readyz storage 503 = known MinIO-absent advisory) |
| Web boot-smoke | **PASS** (root 200, entry transforms clean, no console/transform errors) |
| Runtime plan | **PRESENT & FRESH** (full-walker mode, v5 maps) |
| **Overall RUNTIME** | **PASS** |

---

## Artifacts
- `docs/audits/RUNTIME_READINESS_REPORT.md` (this file)
- `docs/audits/SEED_COHERENCE_REPORT.md` (companion — API replay)
- `docs/execution/RUNTIME_TEST_PLAN.md` (live-status header refreshed)
