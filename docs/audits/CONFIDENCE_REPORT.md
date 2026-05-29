---
oli-version: "1.0"
based-on:
  - docs/audits/COMPLIANCE_REPORT.md
  - docs/audits/codebase-map/CODE_API_SURFACE.json
  - docs/audits/codebase-map/CODE_STATE_MACHINES.json
  - docs/product/EVENT_CONTRACTS.md
  - docs/product/modules/*/API_CONTRACTS.md
  - docs/execution/slices/*/TDD_PROOF.md (46 proofs; 17 verified)
last-modified: 2026-05-30
last-modified-by: oli-check (confidence dimension) — cycle-3 re-audit
---

# Confidence Stack Report

**Date:** 2026-05-30
**Team size:** small
**Layers audited:** 1–4 (static analysis)
**Layers deferred:** 5–6 (require CI/CD/runtime evidence)
**Prior audits used:** COMPLIANCE_REPORT.md + knowledge graph (CODE_API_SURFACE 237 endpoints, CODE_STATE_MACHINES 28 FSMs) + EVENT_CONTRACTS.md + 10 module API_CONTRACTS.md — **full behavior inventory, no shallow-extraction cap.**
**Scope:** api-ts backend = **188 test files, 2,684 pass / 0 fail** (verified `bun run test`, 37.1s, monobase_test DB). Frontend journeys scored separately by `/oli-check --journeys`.

## Cycle-3 Re-Audit (2026-05-30): before → after

| Layer | Cycle-2 | Cycle-3 | Driver of change |
|-------|---------|---------|------------------|
| L1 Coverage Integrity | 8 | **9** | API-routes class 63%→73% (imaging +13 wired handlers + ceph); BR class 74%→96% (BR-036..047 owned); auth 81%→86% (pmd/person/patient-merge deny). Raw 7.4→8.4, +1 TDD bonus. |
| L2 Behavior Traceability | 8 | **9** | Owners 278/370 (75%) → 322/375 (**86%**): events 6→16 traced, BR-036..047 owned, +13 imaging endpoints, person 4 handlers, patient-merge guard. |
| L3 Test Quality | 9 (9.36) | **9** | +142 cycle-3 tests verified STRONG (0 new weak/skip/snapshot); timing-waits 9→8. No regression. |
| L4 Release Gate | 8.75 | **8.75** | No CI/release-infra change this cycle. |
| **Test-Confidence (min L1–L3)** | **8.0** | **9.0** | **Graduation bar ≥9.0 — NOW MET.** |
| Ship-Readiness (min L1–L4) | 8.0 | **8.75** | Limited only by L4 release infra (migration down-files). |

**Verification of the +142 tests (all confirmed on disk, real-DB, strong):**
`dental-imaging/imaging-integration.test.ts` (55 tests, 122 `app.request` wirings, 13 distinct non-ceph endpoints: studies/images/findings/measurements/calibration/modality/patient-images, status+body+error/deny) · `dental-imaging/ceph-business-rules.test.ts` (22 tests / 62 expects; **BR-036..047 all referenced**) · `dental-billing-events.test.ts` + `dental-clinical-events.test.ts` + `dental-visit-events.test.ts` (16 tests; DE-007/008/009/012/013/016/003/004 assert real `dental_audit_log` rows w/ targetType/actorId/branchId) · `person/person.test.ts` (25 tests, all 4 handlers) · `dental-pmd/dental-pmd-auth.test.ts` (7 tests, 3 deny-403 + identity pins) · `patient/patient-merge-auth.test.ts` (4 tests, admin guard). Zero `toBeDefined`/`toBeTruthy`/`.skip`/snapshot in any cycle-3 file.

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | **9/10** | Strong — comprehensive class coverage w/ meaningful assertions (8.4 raw +1 TDD test-first bonus) | ~62 endpoints still status-only; 8 FSMs untested |
| 2. Behavior Traceability | **9/10** | Strong — 86% of behaviors have a test owner | events 16/24 (DE-017..023); 8 FSM transitions |
| 3. Test Quality Hardening | **9/10** | Strong — ~95% strong assertions, ~95% stable, 86% seeded, mocks appropriate | 4 over-mocked; 8 raw-timing waits |
| 4. Release Gate Readiness | **8.75/10** | Strong — full CI (test/lint/type/build/security), deep health, release infra | no migration down-files (Drizzle convention) |

**Overall Test-Confidence (min L1–L3):** **9.0/10** — headline test-quality signal
**Release-Readiness (L4):** **8.75/10** — separate release-infra gauge
**Ship-Readiness (min L1–L4):** **8.75/10** — conservative combined gate (weakest link = L4 release infra)
**Average Score:** 8.94/10

> **Graduation note:** the project's confidence threshold is **≥9.0** (clinical-grade bar in `.planning/config.json`). Test-Confidence = **9.0 → MET**. The cycle-3 coverage push closed the L1 (reach) and L2 (traceability) gaps that gated cycle-2. Ship-Readiness remains 8.75, limited solely by L4 (no migration rollback files — a Drizzle convention, not a test defect); this is a *release-infra* gauge, not a test-quality gate.

## Cross-Layer Consistency
- L1 (9) = L2 (9) — aligned; no line-coverage-vs-traceability divergence.
- L3 (9) = L1/L2 — quality and reach now matched (cycle-2's +1 quality-over-reach gap closed).
- L4 (8.75) within 1 of L1–L3. No inconsistency flagged.

## Per-Module Breakdown

| Module | L1 | L2 | L3* | L4* | Overall | Cycle-3 delta |
|--------|----|----|----|----|---------|---------------|
| dental-org | 8 | 8 | 9 | 8.75 | 8 | unchanged (strongest module) |
| dental-visit | 7 | 7→8 | 9 | 8.75 | 7→8 | +visit domain-event audit-row tests (DE-014/015/016) |
| dental-clinical | 7 | 7→8 | 9 | 8.75 | 7→8 | +clinical domain-event audit-row tests (DE-003/004/…) |
| dental-billing | 7 | 7→8 | 9 | 8.75 | 7→8 | +billing event tests (DE-007/008/009/012/013) |
| dental-scheduling | 7 | 7 | 9 | 8.75 | 7 | unchanged (DE-001/002 pre-existing; slot FSM still untested) |
| dental-audit | 7 | 7 | 9 | 8.75 | 7 | unchanged |
| dental-patient | 6 | 6→7 | 9 | 8.75 | 6→7 | +patient-merge admin guard (GAP-DENTAL-027 closed) |
| dental-perio | 5 | 5 | 9 | 8.75 | 5 | unchanged |
| dental-imaging | **4→8** | **4→8** | 9 | 8.75 | **4→8** | **+55 integration tests (13 wired endpoints) + 22 ceph-BR tests; 7 test files (was 5)** |
| dental-pmd | **4→7** | **4→7** | 9 | 8.75 | **4→7** | **+7 deny/identity tests (3 deny-403); generatePMD patientId pinned** |
| patient (base) | 3 | 3 | 9 | 8.75 | 3 | unchanged (base layer; dental-patient is the product surface) |
| person (base) | **3→6** | **3→6** | 9 | 8.75 | **3→6** | **+25 tests across all 4 handlers** |
| billing (base) | 6 | 6 | 9 | 8.75 | 6 | unchanged |

*L3/L4 are suite-wide signals (test-quality patterns + shared CI/release infra), not per-module-measurable; shown as the global score for each module.

## Layer 1: Coverage Integrity Detail

| Rule Class | Meaningful Coverage Requires | Items | Covered | Line-Only | None | Weight | Class % (c2→c3) |
|------------|------------------------------|-------|---------|-----------|------|--------|---------|
| Auth/permissions | deny + allow per gate | 252 | ~217 | ~18 | ~17 | 35% | 81%→**86%** |
| Business rules | assert business outcome | 47 | ~45 | ~1 | ~1 | 30% | 74%→**96%** |
| State transitions | guard + happy-path | 28 FSMs | ~20 | ~3 | ~5 | 20% | **71%** (unchanged) |
| API routes | status + body assertion | 237 | ~173 | ~40 | ~24 | 15% | 63%→**73%** |

Raw L1 = (86×.35 + 96×.30 + 71×.20 + 73×.15)/10 = **8.40 → 8**, **+1 TDD test-first bonus → 9**. (7,705 `expect()` in api-ts; 2,761 explicit HTTP-status assertions.) BR class now near-complete (BR-036..047 owned); imaging lifts the API-routes class out of the basement. Remaining weakest class: state transitions (8 FSMs — booking/notification/email-queue/slot/video-call/file — still lack transition-guard tests).

## Layer 2: Behavior Traceability Detail

**~375 critical behaviors; ~322 with a test owner → 86%.**

| Category | With owner (c2→c3) | Notes |
|----------|-----------|-------|
| Business rules | 35→45 / 47 | BR-001..022 STRONG; **BR-036..047 now owned** (`ceph-business-rules.test.ts`) |
| Permission gates (deny+allow) | 42→48 / 60 | +pmd (3 deny-403), +person, +patient-merge admin guard |
| State transitions | 20/28 | unchanged; NONE: booking/notification/email-queue/slot/video-call/file FSMs |
| Events | **6→16 / 24** | DE-001..016 publisher-asserts-audit-row (ADR-006 audit-log design); DE-017..023 still untraced |
| API endpoints | ~175→~188 / 237 | +13 imaging endpoints real-wired; 137 real-wiring (`app.request`/`buildTestApp`) files |

Raw L2 = 86% → band 81–90% → **9**. Proofs valid (no fabrication) sustain the score; NOT inflated to 10 — denominator gaps remain (DE-017..023, ~49 status-only endpoints, 8 FSM transitions).

### Untraced Behaviors (top 5, remaining)
1. **DE-017..023** — 7 domain events still have no test owner (publisher-audit-row triad).
2. **8 FSM transitions** — booking/notification/email-queue/slot/video-call/file state machines lack transition-guard tests.
3. **~49 status-only endpoints** — hit but assert status only (WEAK), no body-shape assertion.
4. **patient (base) module** — base layer remains at 3; product surface (dental-patient) is now 7.
5. **dental-perio** — 2 tests / 7 handlers (unchanged this cycle).

## Layer 3: Test Quality Detail

| Sub-audit | Metric | Subscore |
|-----------|--------|----------|
| Assertion strength | ~95% strong (642 weak / 7,705 raw; cycle-3 added 0 weak) | 3.80/4.0 |
| Mock appropriateness | 84 appropriate / 88 = **95.5%** | 1.91/2.0 |
| Stability | ~95% stable (26 skips pre-existing) | 1.90/2.0 |
| Data seeding | 132 seeded / 153 DB-tests = **86.3%** | 1.73/2.0 |

Composite = **9.34 → 9/10** (unchanged). **No new weak patterns from the +142 cycle-3 tests** — all use specific status/value assertions; the imaging-integration suite asserts response status + body shape + error/deny paths; the event suite asserts `dental_audit_log` row contents. Timing-waits improved 9→8.

- **Over-mocked (4):** `audit/listAuditLogs.test.ts`, `audit/jobs/jobs.test.ts` (repo mocked despite per-file test DB); 2 notif-isolation cases defensible.
- **Raw-timing waits (8):** mostly `dental-scheduling/domain-events.test.ts`. Replace with deterministic awaits.

## Layer 4: Release Gate Readiness Detail

### CI Pipeline (5/5 PRESENT) — union of quality/contract/postgres-services/openapi-drift/release
| Check | Status |
|-------|--------|
| Test step | PRESENT (unit + journey + Hurl contract; per-file DB clones) |
| Lint | PRESENT (`bun run lint`) |
| Type-check | PRESENT (`bun run typecheck`) |
| Build | PRESENT (Vite prod build) |
| Security scan | PRESENT (`scripts/check-audit.sh` blocking + `bun audit`) |

### Migration Safety — (rollback NO + CI dry-run YES)/2 = 0.5
Drizzle migrations (no down-files by convention); contract.yml drift gate (`db:generate` + `git diff --exit-code`), `lint:migrations`, real-PG `db:migrate` in CI.

### Version Management — 3/3
VERSION (`0.2.0.0`) + CHANGELOG.md + release.yml (tag-triggered).

### Health Check — DEEP
`services/api-ts/src/core/health.ts`: `/livez` (liveness) + `/readyz` checks DB + storage + jobs → 503 on failure.

## TDD Proof Verification

| Metric | Result |
|--------|--------|
| Proofs sampled | 17 / 46 (37%, stratified) |
| Test-first commit ordering | **11/11 checkable = 100%** (≥80% → L1 +1) |
| Proof validity vs SLICE_SPEC | **17/17 valid** |
| **Fabrication** | **NONE** |
| Cycle-3 proofs added | **0** (cycle-3 was additive coverage, not new slices — prior 46 proofs unchanged, re-verified clean) |
| Score adjustments | L1 +1 (test-first); L2 raw band already 9 (proof validity sustains, no further bonus to avoid double-count) |

Cycle-3 added test coverage to existing modules without new TDD_PROOF.md slices; the 46 prior proofs remain valid with 0 fabrication. No new adjustment.

## Unauditable Items
| Item | Reason | Manual Check |
|------|--------|--------------|
| Runtime test reliability (true flake rate) | static analysis can't run the suite N× | CI flake dashboard |
| Mutation-test adequacy | not configured | consider Stryker for critical modules |
| Per-endpoint STRONG/WEAK exactness | estimated from body-vs-status ratio | spot-review remaining status-only endpoints |

## Prioritized Action Plan

### P0 — Fix Now
_None._ GAP-DENTAL-027 (patient merge/unmerge admin guard) is now **CLOSED** (`patient-merge-auth.test.ts`).

### P1 — Fix Before Major New Work
_Graduation bar (≥9.0) is met._ Remaining items are now P2-grade polish, not gating:
- DE-017..023 — add publisher-audit-row tests for the last 7 events.
- 8 FSM transition-guard tests (booking/notification/email-queue/slot/video-call/file).

### P2 — Fix When Touching Module
- Upgrade the ~49 status-only endpoints to body-shape assertions.
- Replace 8 raw-timing waits with deterministic awaits (`dental-scheduling/domain-events.test.ts`).
- De-mock the 2 non-defensible audit repo mocks; use the real test DB.
- Raise patient (base) and dental-perio coverage.

## What's Next
- This report is consumed by `/oli-check --traceability` and the `/oli-magic --update` graduation check.
- **Test-Confidence 9.0 ≥ 9.0 graduation bar → MET.** Cycle-3 graduation should pass on the test-confidence dimension.
- Ship-Readiness 8.75 is gated only by L4 release infra (migration rollback files); revisit if release-safety hardening is scoped.
- Re-run after any further work: `/oli-check --confidence --layer 1` / `--layer 2`.
