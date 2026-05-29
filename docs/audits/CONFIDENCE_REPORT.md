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
last-modified-by: oli-check (confidence dimension)
---

# Confidence Stack Report

**Date:** 2026-05-30
**Team size:** small
**Layers audited:** 1–4 (static analysis)
**Layers deferred:** 5–6 (require CI/CD/runtime evidence)
**Prior audits used:** COMPLIANCE_REPORT.md + knowledge graph (CODE_API_SURFACE 237 endpoints, CODE_STATE_MACHINES 28 FSMs) + EVENT_CONTRACTS.md + 10 module API_CONTRACTS.md — **full behavior inventory, no shallow-extraction cap.**
**Scope:** 359 test files (180 api-ts unit + 115 web unit + 64 e2e). Confidence stack scores backend behaviors primarily; frontend journeys are scored separately by `/oli-check --journeys`.

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | **8/10** | Good — most critical behaviors covered w/ meaningful assertions (7 raw +1 TDD test-first bonus) | imaging API surface; patient/person thin |
| 2. Behavior Traceability | **8/10** | Good — 75% of behaviors have a test owner (7 raw +1 valid-proof bonus) | events 6/24; BR-036..047 untraced; pmd no deny tests |
| 3. Test Quality Hardening | **9/10** | Strong — 95.6% strong assertions, 95% stable, 86% seeded, mocks appropriate | 4 over-mocked; 9 raw-timing waits; 21 no-hook DB files |
| 4. Release Gate Readiness | **8.75/10** | Strong — full CI (test/lint/type/build/security), deep health, release infra | no migration down-files (Drizzle convention) |

**Overall Test-Confidence (min L1–L3):** **8/10** — headline test-quality signal
**Release-Readiness (L4):** **8.75/10** — separate release-infra gauge
**Ship-Readiness (min L1–L4):** **8/10** — conservative combined gate
**Average Score:** 8.44/10

> **Graduation note:** the project's confidence threshold is **≥9.0** (clinical-grade bar in `.planning/config.json`). Test-Confidence = **8.0 → NOT MET**. The gate is coverage breadth (L1) and traceability (L2), not test quality (L3=9) or release infra (L4=8.75). The tests that exist are strong; the gap is *reach* into imaging, pmd, patient/person, the event layer, and the highest-numbered business rules.

## Cross-Layer Consistency
- L1 (8) ≈ L2 (8) — aligned; no line-coverage-vs-traceability divergence.
- L3 (9) exceeds L1/L2 by 1 (< 4 threshold) — tests are slightly higher *quality* than *breadth*. Awareness note only: harden reach, not assertions.
- L4 (8.75) in range with L1–L3. No inconsistency flagged.

## Per-Module Breakdown

| Module | L1 | L2 | L3* | L4* | Overall | Priority Gaps |
|--------|----|----|----|----|---------|---------------|
| dental-org | 8 | 8 | 9 | 8.75 | 8 | strongest module (11/23 deny+allow, FSM) |
| dental-visit | 7 | 7 | 9 | 8.75 | 7 | more deny tests (3/11) |
| dental-clinical | 7 | 7 | 9 | 8.75 | 7 | deny coverage (4/11) |
| dental-billing | 7 | 7 | 9 | 8.75 | 7 | BR-010/011/012 strong; widen deny |
| dental-scheduling | 7 | 7 | 9 | 8.75 | 7 | booking/slot FSM transitions untested |
| dental-audit | 7 | 7 | 9 | 8.75 | 7 | PHI-sanitize + isolation solid |
| dental-patient | 6 | 6 | 9 | 8.75 | 6 | 14 tests / 53 handlers; 2/12 deny |
| dental-perio | 5 | 5 | 9 | 8.75 | 5 | 2 tests / 7 handlers |
| dental-imaging | **4** | **4** | 9 | 8.75 | **4** | **5 tests / 42 handlers (~12%)** — worst |
| dental-pmd | **4** | **4** | 9 | 8.75 | **4** | **0 deny-403 tests**; 3 tests / 7 handlers |
| patient (base) | **3** | **3** | 9 | 8.75 | **3** | minimal coverage |
| person (base) | **3** | **3** | 9 | 8.75 | **3** | minimal (upstream template) |
| billing (base) | 6 | 6 | 9 | 8.75 | 6 | moderate |

*L3/L4 are suite-wide signals (test-quality patterns + shared CI/release infra), not per-module-measurable; shown as the global score for each module.

## Layer 1: Coverage Integrity Detail

| Rule Class | Meaningful Coverage Requires | Items | Covered | Line-Only | None | Weight | Class % |
|------------|------------------------------|-------|---------|-----------|------|--------|---------|
| Auth/permissions | deny + allow per gate | 252 | ~205 | ~22 | ~25 | 35% | 81% |
| Business rules | assert business outcome | 47 | ~35 | ~4 | ~8 | 30% | 74% |
| State transitions | guard + happy-path | 28 FSMs | ~20 | ~3 | ~5 | 20% | 71% |
| API routes | status + body assertion | 237 | ~150 | ~50 | ~37 | 15% | 63% |

Raw L1 = (81×.35 + 74×.30 + 71×.20 + 63×.15)/10 = **7.4 → 7**, **+1 TDD test-first bonus → 8**. (5,029 `expect()` in api-ts; healthy 1,956 error-status vs 1,414 body/code assertion ratio.) API routes are the weakest class — imaging and patient are thin relative to handler count.

## Layer 2: Behavior Traceability Detail

**~370 critical behaviors; ~278 with a test owner → 75%.**

| Category | With owner | Notes |
|----------|-----------|-------|
| Business rules | 35/47 | BR-001..022 STRONG (central `business-rules.test.ts`); BR-036..047 untraced |
| Permission gates (deny+allow) | 42/60 | dedicated `rbac-http.test.ts`, `cross-org-isolation.test.ts`; gaps: pmd, person, patient lack deny tests |
| State transitions | 20/28 | strong: treatment (property-based), invoice, visit, perio, consent; NONE: booking/notification/email-queue/slot/ceph-landmark/video-call/file FSMs |
| Events | 6/24 | audit-log-only by design (ADR-006); no publisher+consumer+idempotency triad anywhere |
| API endpoints | ~175/237 | 108 real-wiring (`app.request`/`buildTestApp`) files; ~50 status-only (WEAK) |

Raw L2 = 75% → **7**, **+1 valid-proof bonus → 8**.

### Untraced Behaviors (top 5)
1. Domain-event idempotency/consumer reaction — 18/24 events untraced (DE-002/003/004..009/012/013/016..023); zero replay-dedup tests for the event layer.
2. `generatePMD` patientId binding (dental-pmd) — N-PMD-02 fixed but 0 deny-403 tests; immutable-record identity guard thinly pinned.
3. dental-imaging endpoint surface — 5 test files / ~42 handlers; batch-landmark mutation + most study/annotation routes untraced.
4. booking/notifs/slot FSM transitions — no transition-guard tests.
5. BR-036..047 — 12 highest-numbered business rules have no test reference.

## Layer 3: Test Quality Detail

| Sub-audit | Metric | Subscore |
|-----------|--------|----------|
| Assertion strength | 7,359 strong / 7,696 total = **95.6%** | 3.82/4.0 |
| Mock appropriateness | 84 appropriate / 88 = **95.5%** | 1.91/2.0 |
| Stability | 341 stable / 359 = **95.0%** | 1.90/2.0 |
| Data seeding | 132 seeded / 153 DB-tests = **86.3%** | 1.73/2.0 |

Composite = **9.36 → 9/10**. Sensitivity: reclassifying the 901 `toBe(true)/toBe(false)` as weak would drop strength to ~84% and composite to ~8.9 (still rounds to 9).

- **Over-mocked (4):** `audit/listAuditLogs.test.ts`, `audit/jobs/jobs.test.ts` mock the repo despite the real per-file test DB; 2 notif-isolation cases defensible.
- **Raw-timing waits (9):** `dental-scheduling/domain-events.test.ts` (6× `setTimeout` for async dispatch), several web hooks (50ms). Replace with deterministic awaits.
- **No-hook DB files (21):** rely solely on the per-file Postgres clone for isolation — acceptable but add explicit setup for clarity.

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
| Proofs sampled | 17 / 46 (37%, stratified: feature / P2-* / p1-* / fix-*) |
| Test-first commit ordering | **11/11 checkable = 100%** (≥80% → L1 +1) |
| Proof validity vs SLICE_SPEC | **17/17 valid** (all claimed test files exist, case-count ≥ claim) |
| **Fabrication** | **NONE** |
| Score adjustments | L1 +1 (test-first), L2 +1 (all valid) |

A 2026-05-02 bootstrap squash (`c55660b3`) coupled many test+impl files → correctly scored UNVERIFIED (no penalty). All later feature + fix slices show genuine test-before-impl/fix ordering. One stale worktree-only run-command path noted (not a coverage claim, not fabrication).

## Unauditable Items
| Item | Reason | Manual Check |
|------|--------|--------------|
| Runtime test reliability (true flake rate) | static analysis can't run the suite N× | CI flake dashboard |
| Mutation-test adequacy | not configured | consider Stryker for critical modules |
| Per-endpoint STRONG/WEAK exactness | estimated from body-vs-status ratio, not endpoint-by-endpoint | spot-review imaging/patient |

## Prioritized Action Plan

### P0 — Fix Now
_None._ No security/data-integrity test gap rises to P0 (the compliance P0s are already remediated; this is coverage breadth, not active risk). Exception to watch: GAP-DENTAL-027 (patient merge/unmerge admin guard) — latent, tracked separately.

### P1 — Fix Before Major New Work (to reach ≥9 confidence)
1. **dental-imaging coverage** — add handler/contract tests across the ~42-handler surface (study, annotation, batch-landmark mutation + audit). Currently L1/L2=4.
2. **dental-pmd deny tests** — add deny-403 RBAC tests; pin `generatePMD` patientId-binding (N-PMD-02) with a regression test.
3. **Event-layer traceability** — for the 18 untraced DE-NNN events, add at least publisher-asserts-audit-row tests (consumer/idempotency deferred per ADR-006, but document the decision in the report denominator).
4. **BR-036..047** — add test owners for the 12 untraced business rules.
5. **patient / person base modules** — raise from minimal (3) coverage.

### P2 — Fix When Touching Module
- Replace 9 raw-timing waits with deterministic awaits (esp. `dental-scheduling/domain-events.test.ts`).
- De-mock the 2 non-defensible audit repo mocks; use the real test DB.
- Add explicit setup/teardown to the 21 no-hook DB-backed files.

## What's Next
- This report is consumed by `/oli-check --traceability` and the `/oli-magic --update` graduation check.
- Test-Confidence 8.0 < 9.0 graduation bar → expect this to gate Cycle-2 graduation. The P1 plan above is the cycle-3 remediation scope.
- Re-run after remediation: `/oli-check --confidence --layer 1` and `--layer 2`.
