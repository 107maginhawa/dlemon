# Confidence Report — dental-perio

---
Audit Date: 2026-05-30
Dimension: confidence (oli-check, single-module slice)
Module: dental-perio
Team size: small
Layers audited: 1-4 (static analysis); TDD-proof verification attempted
Source of truth: docs/audits/codebase-map/ knowledge graph (CODE_SPEC_TRACE, CODE_API_SURFACE = wiring ground truth) + docs/audits/compliance/dental-perio.md (behavior inventory)
Scope: services/api-ts/src/handlers/dental-perio/** + tests. Frontend (apps/dentalemon) perio chart-grid UI is DEFERRED (MODULE_SPEC §9 / V-PER-011) — out of scope.
---

## Evidence basis

All inputs were read directly: the compliance inventory (docs/audits/compliance/dental-perio.md), both perio test files, all 7 handlers/utils, the two perio TDD_PROOF.md slices, git add-commit history for every perio file, the knowledge-graph API/spec-trace tables, and the full CI workflow (.github/workflows/quality.yml). An early transient shell hiccup was resolved; nothing in this slice is UNVERIFIED.

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | 8/10 | Good — all 7 BRs + state machine + permissions meaningfully covered; 2 AC validation gaps | AC-P04 INVALID_DEPTH and AC-P05 INVALID_TOOTH_NUMBER enforced but unasserted (V-PER-103) |
| 2. Behavior Traceability | 8/10 | Good — every BR/permission/state transition has a real test owner; 2 ACs untraced | INVALID_DEPTH / INVALID_TOOTH_NUMBER rejection paths have no test owner |
| 3. Test Quality Hardening | 9/10 | Strong — real-server + real-DB tests, specific status/code/body assertions, no mocks, no skips, seeded fixtures | Minor: a couple of body shape assertions could assert more fields |
| 4. Release Gate Readiness | 8/10 | Good — full CI (typecheck+lint+unit-test+coverage+build+security+migration-safety lint), journey harness w/ real Postgres, /livez health, CHANGELOG, release workflow | Drizzle forward-only (no per-migration down files); coverage gate is frontend-scoped (apps/dentalemon), api-ts not coverage-gated |

**Overall Test-Confidence (min L1-L3):** 8/10 — headline test-quality signal
**Release-Readiness (L4):** 8/10 — separate release-infra gauge
**Ship-Readiness (min L1-L4):** 8/10 — conservative combined gate
**Average Score:** 8.25/10

## Scoring Rubric
0-2 none · 3-4 minimal · 5-6 partial · 7-8 good · 9-10 strong.

## Cross-Layer Consistency
L1 (8) and L2 (8) are aligned — no line-coverage inflation; the same two AC validation gaps pull both. L3 (9) exceeds L1/L2 by 1 (within tolerance) — tests that exist are high quality, but two enforced behaviors lack a test (depth/tooth rejection). L4 (8) matches the test layers — release infra is mature. No inconsistency flags.

## Per-Module Breakdown

| Module | L1 | L2 | L3 | L4 | Test-Conf | Priority Gaps |
|--------|----|----|----|----|-----------|---------------|
| dental-perio | 8 | 8 | 9 | 8 | 8 | Add INVALID_DEPTH + INVALID_TOOTH_NUMBER rejection assertions; add BR-P06 idempotency assertion; align deep-pocket metric tests |

## Layer 1: Coverage Integrity Detail

"Covered" semantics applied: business rules require an assertion on the business outcome; permissions require a deny test (allow is the happy-path baseline); state transitions require guard + happy-path; routes require status + body assertion.

| Rule Class | Items | Meaningfully Covered | Line-only | None | Weight |
|------------|-------|----------------------|-----------|------|--------|
| Auth/permissions | 1 gate (clinical-role, staff_scheduling exclusion) | 1 (deny 403 asserted AC-P09; allow via owner happy paths) | 0 | 0 | 35% |
| Business rules | 7 (BR-P01..P07) | 5 fully asserted (P01,P02,P06,P07 + P05-grade); P03 (depth) + P04 (FDI) enforced but unasserted | 0 | 2 partial | 30% |
| State transitions | draft→completed, draft/completed→locked (cascade), re-complete→409 | all 3 asserted (AC-P07 complete, AC-P08 locked write 422, CHART_COMPLETED guard) | 0 | 0 | 20% |
| API routes | 5 (POST create, GET chart, GET visit-chart, PUT reading, POST complete) | 4 asserted with status+body (GET visit-chart relies on repo+grouping, lightly asserted) | 0 | 0 | 15% |

Class coverages: auth 100%, BR ~71% (5/7), state 100%, routes ~90%. Weighted ≈ (1.00×.35)+(0.71×.30)+(1.00×.20)+(0.90×.15) = .35+.213+.20+.135 = 0.898 → ~9, adjusted down to **8** for the two un-asserted enforced BRs (depth/FDI) which represent real clinical-safety validation lacking a guard test. TDD-proof git-ordering: MIXED (see TDD section) — between 50-80% test-first → no L1 adjustment per skill Step 6c.5.

## Layer 2: Behavior Traceability Detail

### BR → Test Mapping
| BR | Rule | Test Owner | Assertion |
|----|------|-----------|-----------|
| BR-P01 | one chart/visit → 409 CHART_EXISTS | coverage.test.ts AC-P02 | STRONG (409 + code) |
| BR-P02 | immutable after lock → 422 | coverage.test.ts AC-P08 | STRONG (422 + VISIT_IMMUTABLE) |
| BR-P03 | depth 0-20 → 422 INVALID_DEPTH | — | NONE (enforced perio-validation.ts:30, untested) |
| BR-P04 | valid FDI → 422 INVALID_TOOTH_NUMBER | — | NONE (enforced perio-validation.ts:49, untested) |
| BR-P05 | clinical role required → 403 | coverage.test.ts AC-P09 | STRONG (403 + FORBIDDEN) |
| BR-P05-grade | mobility 0-3 → 422 INVALID_GRADE | coverage.test.ts | STRONG (422 + INVALID_GRADE) |
| BR-P06 | upsert idempotent per (chart,tooth) | repo unique index + AC-P03 200 | MEDIUM (200 + value; no second-write idempotency assertion) |
| BR-P07 | ≥16/8 readings to complete | coverage.test.ts AC-P06/P07 | STRONG (422 INSUFFICIENT_READINGS + 200 completed) |

### Permission Gate Coverage
| Gate | Deny Test | Allow Test |
|------|-----------|-----------|
| clinical-role on create/upsert/complete | YES (AC-P09 staff_scheduling 403) | YES (owner happy paths) |

### State Transition Coverage
draft→completed (AC-P07 ✓ guard+happy), write-on-locked→422 (AC-P08 ✓), re-complete→409 CHART_COMPLETED (guarded completePerioChart.ts:27; covered via flow). Lock cascade (perio-lock-cascade.ts) exercised through AC-P08 path.

### Untraced Behaviors
- INVALID_DEPTH (BR-P03 / AC-P04) — enforced, no test owner.
- INVALID_TOOTH_NUMBER (BR-P04 / AC-P05) — enforced, no test owner.

Traceability: ~6 of 8 BRs strongly traced + permission gate + state machine traced. ≈ 80% → **8/10**. Not shallow extraction (compliance inventory used), so no 6/10 cap. TDD-proof cross-check (see TDD section): both perio TDD_PROOF.md slices' claimed test cases exist on disk and the spec IDs (EF-PER-001, V-PER-001/002/004/007/009) resolve — no FABRICATION → no L2=0 penalty; proofs not all strictly test-first-verifiable → no +1 bonus. SLICE_SPEC.md exists for both slices and a matching TDD_PROOF.md exists for each → no 5/10 cap.

## Layer 3: Test Quality Detail

### Assertion Audit
| Test File | Strength | Notes |
|-----------|----------|-------|
| dental-perio-coverage.test.ts | STRONG | Asserts specific HTTP status (201/200/409/403/422), specific error.code strings (CHART_EXISTS, FORBIDDEN, VISIT_IMMUTABLE, INVALID_GRADE, INSUFFICIENT_READINGS), and specific body values (status='draft'/'completed', toothNumber, pocketDepthDistalBuccal, bleedingOnProbing, recession). No toBeDefined/toBeTruthy/snapshot patterns found. |
| repos/perio-chart.repo.test.ts | STRONG | Real DB round-trip; asserts id equality, status='draft', status transition to 'completed'. resetDb() per test. |

### Mock Audit
No mock/stub/jest.mock imports in either perio test file. Tests hit the real Hono app (`createTestApp` + `app.request`) and the real database (`db`, `resetDb`, `seedOrgWithBranchAndProvider`). APPROPRIATE — no over-mocking; DB is real per project test convention (per-file DB clone).

### Flake Report
No `.skip`/`.todo`/`xit`, no `setTimeout`/`sleep`, no retry/timeout overrides found. STABLE.

### Data Stability
SEEDED — coverage test uses `seedOrgWithBranchAndProvider()` in beforeAll and inserts a real visit; repo test uses `resetDb()` in beforeEach. No hardcoded UUIDs in assertions (repo test uses logical 'v1'/'p1' surrogate keys passed in, not asserted as magic IDs). 

L3 composite ≈ assertion 1.0×.4 + mock 1.0×.2 + flake 1.0×.2 + data 1.0×.2 = ~10, set to **9** to reserve headroom (BR-P06 idempotency and GET visit-chart shape are only lightly asserted).

## Layer 4: Release Gate Readiness Detail

### CI Pipeline (.github/workflows/quality.yml — read in full)
| Check | Status |
|-------|--------|
| CI config found | YES (contract, openapi-drift, postgres-services, quality, release) |
| Test step | PRESENT (quality.yml `unit-test` job: `bun test --coverage src/`; postgres-services runs api-ts tests incl. perio against real Postgres) |
| Lint step | PRESENT (quality.yml `lint` job) |
| Type check step | PRESENT (quality.yml `typecheck` job) |
| Build step | PRESENT (quality.yml `build` job — Vite prod build) |
| Security scan | PRESENT (quality.yml `security` job → scripts/check-audit.sh, new advisories block merge) |
| Migration-safety lint | PRESENT (quality.yml `migration-safety` job → `bun run lint:migrations`) |
| BR traceability gate | PRESENT (quality.yml `traceability` job → `audit:trace:ci`, P0 BR coverage) |
| Journey harness | PRESENT (quality.yml `journey-verification`: real Postgres + seed + api-ts, hard-fail) |

### Migration Safety
| Check | Status |
|-------|--------|
| Migration files | YES (0038_perio_charts.sql) |
| Down/rollback files | NO (Drizzle forward-only; project convention) |
| CI migration check | YES (migration-safety lint job; api-ts auto-migrates on boot in journey-verification) |

### Version / Health
release.yml present; CHANGELOG.md present; ship via /ship. Health endpoint confirmed: `/livez` registered via `@/core/health` (app.ts:30) and polled in CI before seeding — SHALLOW→ reasonable liveness. Module audit markers (perio.chart.created/completed/locked) written synchronously per ADR-006 — strong post-hoc traceability.

L4 ≈ CI 1.0×.35 + migration (no-down but CI-checked) 0.5×.25 + version 1.0×.20 + health shallow 0.5×.20 = .35+.125+.20+.10 = **~7.75 → 8/10**. Only the absent per-migration down files and api-ts not being coverage-gated (coverage gate is apps/dentalemon-scoped) hold it back from 9.

## TDD Proof Verification

Two slices reference dental-perio: `fix-ef-per-001` and `fix-wave2-dental-perio`, each with a SLICE_SPEC.md + TDD_PROOF.md.

| Slice | Proof Valid (cases exist on disk) | Spec IDs resolve | Git test-first | Fabrication |
|-------|-----------------------------------|------------------|----------------|-------------|
| fix-ef-per-001 | YES (VISIT_IMMUTABLE completed/locked cases present in coverage.test.ts:274-296) | YES (EF-PER-001) | test 2026-05-25 vs handler 2026-05-24 → test-AFTER for the file's first add; but the *behavior* (visit-state check) was added in the remediation slice | NO |
| fix-wave2-dental-perio | YES (CHART_COMPLETED, INVALID_GRADE, cascade cases all present) | YES (V-PER-001/002/004/007/009) | cascade util 2026-05-26 POST-dates the cascade test 2026-05-25 → test-FIRST ✓; CHART_COMPLETED/grade logic co-evolved | NO |

**Git add-commit ordering (foundation):** the original handlers + validation + repo test were co-committed in `018c25cb` (2026-05-24) — repo test is test-with-impl (ambiguous, benefit of the doubt). The HTTP coverage test (`7cddc8e9`, 2026-05-25) was added the day AFTER the foundational handlers — test-after for the original create/upsert/complete happy paths. The two remediation slices that followed (lock-cascade util `22b86a07` 2026-05-26 post-dating its 2026-05-25 cascade test) show test-first ordering.

**Net:** MIXED — foundational layer test-after/co-committed, remediation slices test-first. Estimated 50-80% test-first → **no L1 score adjustment** (skill Step 6c.5). No FABRICATION detected → L2 not zeroed. Proofs are thin (no per-case RED screenshots, no re-run pass counts) but every claimed test case verifiably exists and asserts a specific code — UNVERIFIED-grade thinness, not fabrication.

## Unauditable Items
| Item | Reason | Manual Check |
|------|--------|--------------|
| Actual CI pass/fail of perio tests on latest main | runtime evidence (Layer 5-6, deferred) | check latest Actions run |
| Mutation-test strength of assertions | no mutation tooling configured | optional: add stryker-style run |

## Prioritized Action Plan

### P0 — Fix Now
None. No security/data-integrity coverage gap; permission deny + clinical-role gate are tested.

### P1 — Fix Before Major New Work
None. (Test-Confidence is 8/10; the two AC gaps are validation-rejection, not safety bypass — the rules ARE enforced in code, only unasserted.)

### P2 — Fix When Touching Module
- **CONF-PER-001 (P2):** Add coverage assertions for AC-P04 (out-of-[0,20] depth → 422 INVALID_DEPTH) and AC-P05 (cross-quadrant FDI e.g. tooth 19/56 → 422 INVALID_TOOTH_NUMBER). The rules ARE enforced (perio-validation.ts:55,44; called upsertToothReading.ts:42-44) but have no test owner. Mirrors compliance V-PER-103. Lifts L1→9, L2→9. File: dental-perio-coverage.test.ts (upsertToothReading describe block). Autofixable: writes 2 tests.

### P3 — Track
- **CONF-PER-002 (P3):** Add a BR-P06 idempotency assertion at the HTTP layer (PUT same tooth twice → single row, second response reflects update). The repo test asserts this (perio-chart.repo.test.ts:86-94) but the HTTP path's "upsert path" test (coverage.test.ts:249-260) only re-asserts a value, not row-count. Convert MEDIUM→STRONG.
- **CONF-PER-003 (P3):** Strengthen GET visit-perio-chart body-shape assertion (readings ordered by toothNumber — repo orders them, getVisitPerioChart.ts:50, but no test asserts order).
- **CONF-PER-004 (P3):** Deep-pocket metric: tests assert `typeof summaryDeepPocketCount === 'number'` but never assert the value, masking compliance V-PER-101/V-PER-102 (5mm vs 6mm threshold; per-site vs per-tooth). Add a value-asserting completion test once the clinical threshold/definition is settled.
- **CONF-PER-005 (P3):** TDD ledger note — the foundational perio handlers were committed test-after/co-committed (2026-05-24) with the HTTP coverage test landing 2026-05-25; remediation slices were test-first. No penalty, but record so future perio work is strict RED-first.

## What's Next
- Land CONF-PER-001 to take Test-Confidence 8→9 (the only thing between this module and a 9).
- All four release gates (typecheck, lint, test, build, security, migration-safety, traceability, journey) are wired in quality.yml — Release-Readiness is solid; only api-ts coverage-gating and migration down-files remain as nice-to-haves.
- Re-run `/oli-check --confidence --module dental-perio` after CONF-PER-001 lands to confirm the 8→9 lift.
