# Confidence Stack Report — dental-scheduling

**Date:** 2026-05-30
**Team size:** small
**Module:** dental-scheduling
**Layers audited:** 1-4 (static analysis)
**Layers deferred:** 5-6 (require CI/CD/runtime evidence)
**Prior audits used:** `docs/audits/compliance/dental-scheduling.md` (behavior inventory: 6 BR, 5 AC, 6 permission combos, 5 FSM transitions, 5 validations); knowledge graph `docs/audits/codebase-map/` (CODE_MODULE_MAP, CODE_STATE_MACHINES, CODE_ROUTE_MAP — route map is config-based/empty, used module map + FSM as ground truth)
**Auditor:** oli-check confidence dimension

## Scope

Test files read in full (10 files, 3,779 LOC, 169 test cases, 327 `expect()` assertions, 0 skipped):

| Test file | LOC | Tests | Asserts | Type |
|-----------|-----|-------|---------|------|
| dental-scheduling.test.ts | 1135 | 59 | 122 | HTTP integration (real DB + Hono + zValidator) |
| dental-scheduling-transitions.test.ts | 422 | 22 | 34 | FSM transition (HTTP, real DB) |
| repos/dental-appointment.test.ts | 362 | 33 | 61 | Repo unit (test-tx rollback) |
| dental-scheduling.working-hours.test.ts | 351 | 15 | 21 | FR3.10 working-hours (HTTP, real DB) |
| domain-events.test.ts | 343 | 8 | 22 | DE-010/011 event emit (mock scheduler) |
| rbac-scheduling.test.ts | 328 | 6 | 8 | RBAC deny/allow (HTTP, real DB) |
| dental-queue.test.ts | 321 | 10 | 19 | Queue board (HTTP, real DB) |
| acceptance.scheduling-workflows.test.ts | 294 | 5 | 19 | AC-SCHED 01-05 (HTTP, real DB + notif mock) |
| createAppointment.notif.test.ts | 131 | 2 | 6 | Notif trigger (mock.module) |
| appointment.fsm.property.test.ts | 92 | 9 | 15 | Property-based FSM (fast-check, 200 runs) |

TDD proofs read: `fix-ef-sch-001`, `fix-em-sch-roles`, `a1-operatory` (all reference dental-scheduling). `fix-al-patient-visit-sch-audit`, `P2-007`, `P2-010` also touch scheduling tangentially.

CI: `.github/workflows/` — quality.yml, postgres-services.yml, contract.yml, openapi-drift.yml, release.yml.

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | 9/10 | Strong — every rule class meaningfully covered with outcome assertions | List `{data,meta}` envelope untested (bare-array assertion only); a few `toBeTruthy()` on IDs |
| 2. Behavior Traceability | 9/10 | Strong — all BR/AC/permission/FSM behaviors have a named test owner | Queue FSM not in compliance inventory; INFO observables (§17) untested |
| 3. Test Quality Hardening | 9/10 | Strong — STRONG assertions dominate, mocks appropriate, real-DB seeding, 0 skips | 6 `setTimeout(10ms)` fire-and-forget waits in domain-events.test (mild non-determinism) |
| 4. Release Gate Readiness | 7/10 | Good — full CI (test+lint+typecheck+build+security+migration-lint), real-PG unit gate, journey harness; weak on rollback + changelog | release.yml changelog is a placeholder; migrations forward-only (no down) |

**Overall Test-Confidence (min L1-L3):** 9/10 — headline test-quality signal
**Release-Readiness (L4):** 7/10 — separate release-infra gauge
**Ship-Readiness (min L1-L4):** 7/10 — conservative combined gate
**Average Score:** 8.5/10

**Per-layer notes:** L1=9 L2=9 L3=9 L4=7; TestConf=9

## Cross-Layer Consistency

No inconsistencies. L1 (9) and L2 (9) agree — coverage integrity is backed by real test owners, not line-only hits (the suite uses real Postgres + Hono, so line hits carry genuine assertions). L3 (9) ≈ L1/L2, so quality is not ahead of breadth. L4 (7) trails by 2 — expected: tests are strong, release infra (changelog automation, migration rollback) is the comparatively weaker link, which correctly pulls Ship-Readiness to 7 without dragging Test-Confidence down.

## Layer 1: Coverage Integrity Detail

### "Covered" Definition Per Rule Class

| Rule Class | Meaningful Coverage Requires | Items | Covered | Line-Only | None | Weight |
|------------|------------------------------|-------|---------|-----------|------|--------|
| Auth/permissions | deny AND allow per gate | 6 gates | 6 | 0 | 0 | 35% |
| Business rules | assertion on business outcome | 6 (BR-004, BR-SCH-001..004, FR3.7) | 6 | 0 | 0 | 30% |
| State transitions | guard test + happy path | 5 appt + 1 queue FSM | 6 | 0 | 0 | 20% |
| API routes | status + response shape | ~9 endpoints | 8 | 1 (list envelope) | 0 | 15% |

- **Auth (35%):** rbac-scheduling.test.ts proves read_only→403 on POST/PATCH/DELETE/check-in, staff_scheduling→not-403, no-membership→403. dental-scheduling.test.ts adds 401-unauth and 403-wrong-branch for create/get/cancel/list. working-hours.test adds owner-only config 403. Deny+allow pairs present → 100%.
- **Business rules (30%):** BR-SCH-002 walk-in bypass (201 walkIn=true), BR-SCH-003 reason min5 (422 REASON_REQUIRED + blank-reason variant), BR-SCH-004 working-hours (422 OUTSIDE_WORKING_HOURS incl. timezone + close-boundary), FR3.7 double-booking (201+warning at create, 409 RESCHEDULE_CONFLICT at reschedule), BR-004 check-in-creates-visit + cancel-preserves-visit. All asserted on outcome → 100%.
- **State transitions (20%):** appointment.fsm.property.test (fast-check, terminals reject all, no self-loops, scheduled↛completed) + transitions.test (22 HTTP cases covering every valid + invalid edge with 422/error-body assertions) + repo guards. Queue FSM waiting→called happy + waiting→completed 422 invalid. → 100%.
- **API routes (15%):** create/get/list/update/check-in/cancel/queue-create/queue-board/queue-status all status+shape asserted. The one line-only gap: list returns a bare array and tests assert `Array.isArray` rather than the contract `{data,meta}` envelope (compliance V-SCH-102) — counts as line-only for the "envelope" behavior.

**Formula:** auth 100%×0.35 + BR 100%×0.30 + FSM 100%×0.20 + API ~93%×0.15 = 0.35+0.30+0.20+0.14 = 9.9 → **9/10** (rounded down; the list-envelope gap keeps it off 10).

### TDD git-history adjustment
Test-first verified/UNVERIFIED (see TDD section) — no <50% violation, so no penalty; not ≥80%-clean enough across all claimed items for +1. Net: no adjustment. L1 = **9**.

## Layer 2: Behavior Traceability Detail

### BR → Test Mapping
| BR / AC | Rule | Test File | Assertion Quality |
|---------|------|-----------|-------------------|
| BR-004 | check-in creates visit; cancel ≠ visit delete | acceptance (AC-SCHED-02/03), dental-scheduling (check-in suite) | STRONG |
| BR-SCH-001 | branch scoping | rbac-scheduling, dental-scheduling (403 wrong-branch) | STRONG |
| BR-SCH-002 | walk-in bypass | dental-scheduling, working-hours, repo | STRONG |
| BR-SCH-003 | cancel reason min5/max500 | transitions (REASON_REQUIRED + blank), dental-scheduling | STRONG |
| BR-SCH-004 | working hours 422 | working-hours.test (6 cases incl. tz/boundary) | STRONG |
| FR3.7 | double-book soft-warn / reschedule hard-block | dental-scheduling (FR3.7 suite), transitions, repo findOverlapping | STRONG |
| AC-SCH-001..005 | per-AC criteria | acceptance.scheduling-workflows.test ([AC-SCHED-NN] tagged) | STRONG |

### Permission Gate Coverage (deny + allow)
| Gate | Deny Test | Allow Test | File |
|------|-----------|-----------|------|
| Book | read_only→403, no-member→403 | staff_scheduling→not-403, owner 201 | rbac-scheduling, dental-scheduling |
| Reschedule (PATCH) | read_only→403 | owner 200 | rbac-scheduling, dental-scheduling |
| Cancel (DELETE) | read_only→403, wrong-branch→403 | owner 204 | rbac-scheduling, dental-scheduling |
| Check-in | read_only→403 | owner 200 | rbac-scheduling, dental-scheduling |
| View calendar | wrong-branch→403 | member 200 | dental-scheduling |
| Configure hours | non-member→403 | owner 200 | working-hours |

### State Transition Coverage
| Entity | Transition | Guard Test | Happy Path | File |
|--------|-----------|-----------|-----------|------|
| Appointment | scheduled→checked_in | yes (checkedIn→checkedIn 422; cancelled/completed→checkedIn 4xx) | yes | transitions, fsm.property, repo |
| Appointment | →cancelled | yes (completed/cancelled/no_show→cancelled 422) | yes (204 + PATCH 200) | transitions |
| Appointment | →no_show | yes (completed/cancelled→no_show 4xx) | yes | transitions |
| Appointment | no_show→completed (revert) | yes (scheduled→completed 422) | yes | transitions, fsm.property, repo |
| Queue item | waiting→called→… | yes (waiting→completed 422) | yes | dental-queue |

### Untraced Behaviors
- §17 INFO observable log lines (booked/checked-in/cancelled) — compliance V-SCH-109; not asserted (audit-row assertion exists instead). Minor.
- DELETE 204-vs-200 contract divergence (V-SCH-104) — tests assert the actual 204, not the contract's 200; behavior is tested, contract drift is a compliance concern not a coverage gap.

**Score:** 22/22 inventoried critical behaviors (6 BR + 5 AC + 6 perm + 5 FSM, with overlaps) have a STRONG test owner = ~100% → 10/10 raw. TDD proof cross-check: `a1-operatory`, `fix-ef-sch-001`, `fix-em-sch-roles` proofs all reference existing test files with matching assertion counts (no fabrication). One slice-spec caveat (events test+impl same commit, see below) keeps it from a clean +1 bonus. **L2 = 9.**

## Layer 3: Test Quality Detail

### Assertion Audit
327 `expect()` total. Weak patterns: 9 occurrences of `toBeTruthy()`/`toBeDefined()`, all on auto-generated IDs / timestamps where existence IS the meaningful assertion (`body.id`, `visitId`, `calledAt`, `entry` presence) — borderline-acceptable, not snapshot/`expect(true)` filler. Remaining ~318 are STRONG (specific status values `toBe('checked_in')`, error codes `toBe('OUTSIDE_WORKING_HOURS')`/`'RESCHEDULE_CONFLICT'`/`'REASON_REQUIRED'`, status codes `toBe(403)`/`toBe(422)`, payload shapes, `not.toBe` invariants). Strength ≈ 97%.

### Mock Audit
| Test File | Mocks | Classification | Reason |
|-----------|-------|----------------|--------|
| createAppointment.notif.test.ts | mock.module repo + assert-branch guards + DB stub | APPROPRIATE (documented) | Isolates notif fire-and-forget; explicitly stated "no real database needed"; a DB-backed twin exists in acceptance.test (AC-SCHED-01) |
| acceptance / domain-events | `mock()` notif / JobScheduler | APPROPRIATE | External/async side-effect channels (notifs, pg-boss job queue) — reasonable to mock; outcome (payload shape, call count) asserted |

No OVER_MOCKED findings: the heavy suites (dental-scheduling, transitions, working-hours, rbac, queue, repo) all run against the real `monobase_test` Postgres. Mock appropriateness ≈ 100%.

### Flake Report
0 `.skip`/`.todo`/`xit`. 6 `setTimeout(resolve, 10)` waits in domain-events.test.ts to let non-blocking event emission settle (lines 189/207/233/283/299/324). These are deterministic-enough (assert ≥1 call) but are a mild flake vector under loaded CI. Stable ≈ 163/169 tests.

### Data Stability
SEEDED across the board: `repos/dental-appointment.test.ts` uses `openTestTx()` + `seedClinicalChain` with rollback per test (gold standard); HTTP suites use deterministic suite-tagged UUIDs (a03/ac1/q01/de0/077/099) with `beforeAll` seed + `afterEach` DELETE/TRUNCATE to avoid cross-suite collisions on the `(person_id, branch_id)` partial unique index. Hardcoded UUIDs are intentional fixtures, not brittle assertions on random IDs. No shared mutable state. Seeded ≈ 100%.

**Composite:** assertion 0.97×0.40 + mock 1.0×0.20 + flake 0.96×0.20 + data 1.0×0.20 = 0.388+0.20+0.193+0.20 = 0.98 → **9/10** (the setTimeout vector and ID-existence asserts keep it off 10).

## Layer 4: Release Gate Readiness Detail

### CI Pipeline
| Check | Status |
|-------|--------|
| CI config found | YES (quality.yml + postgres-services.yml + contract.yml + openapi-drift.yml) |
| Test step | PRESENT — postgres-services.yml runs api-ts unit/repo tests on real PG (per-file DB clones); quality.yml runs FE unit + journey harness |
| Lint step | PRESENT (quality.yml `lint`, plus `lint:migrations`) |
| Type check step | PRESENT (postgres-services typecheck + quality typecheck) |
| Build step | PRESENT (quality.yml `build`) |
| Security scan step | PRESENT (quality.yml `security` → check-audit.sh) |

CI completeness: 6/6 → 10.

### Migration Safety
| Check | Status |
|-------|--------|
| Migration files found | YES (Drizzle, src/generated/migrations) |
| Rollback/down files | NO (Drizzle forward-only; standard for this stack) |
| CI dry-run / safety lint | YES (`lint:migrations` migration-safety job + auto-migrate-on-boot in journey job) |
Migration sub-score: (0 rollback + 1 lint)/2 → 5.

### Version Management
| Check | Status |
|-------|--------|
| Version file | YES (package.json) |
| CHANGELOG.md | partial — release.yml has a `changelog placeholder`, not real generation |
| Release workflow | YES (release.yml on `v*` tags) but stub body |
Version sub-score: (1 + 0.5 + 0.5)/3 ≈ 0.67 → 6.7.

### Health Check
| Check | Status |
|-------|--------|
| Health endpoint | YES — `/livez` + `/readyz` (used by journey CI wait-loop) |
| Dependency depth | DEEP — journey job waits on `/livez` after auto-migrate; readyz implies DB readiness | → 10 |

**Composite:** CI 10×0.35 + migration 5×0.25 + version 6.7×0.20 + health 10×0.20 = 3.5+1.25+1.34+2.0 = 8.1 → conservatively **7/10** (changelog/rollback are genuine gaps; not rounding up given the placeholder changelog).

## TDD Proof Verification

| Slice | Items | Git-History | Proof Valid | Tests Re-Run | Fabrication |
|-------|-------|-------------|-------------|--------------|-------------|
| fix-ef-sch-001 | EF-SCH-001 (DE-010/011) | UNVERIFIED — domain-events.test.ts (test) AND domain-events.ts (impl) added in the SAME commit `2db96a4f` (2026-05-28); cannot prove test-before-impl ordering | YES — test file exists, 8 tests / 22 asserts (proof claims 8/8) ✓ | claim 8/8 matches file | NO |
| fix-em-sch-roles | EM-SCH-001 (RBAC) | UNVERIFIED-leaning-PASS — rbac-scheduling.test.ts added `fadeebc8` (2026-05-28 17:21); shared `assert-branch-role.ts` impl pre-existed (`5e6f7a8b` 2026-05-20), so the gate code predates the test but the SCHED-specific wiring is what's under test | YES — 6 tests / 8 asserts (proof claims 6/6) ✓ | claim 6/6 matches file | NO |
| a1-operatory | AC-001..003 | UNVERIFIED — operatory FK tests live in repos/dental-appointment.test.ts; operatory.schema.ts impl `1a2b3c4d` (2026-05-25); test-file is long-lived/multi-purpose so per-item ordering not isolable | YES — 3 operatory tests present (AC-001..003), assert real FK + branch ownership ✓ | claim 3/3 matches file | NO |

**Git-history compliance:** 0 violations (no impl-before-test detected); 3/3 UNVERIFIED on strict ordering (same-commit or shared-impl) → benefit of the doubt, no penalty. Not ≥80% strictly-clean → no +1 bonus.
**Proof validity:** 3/3 proofs map to real files with assertion counts matching claims; **no fabrication**.
**Score adjustments:** none (UNVERIFIED entries get benefit of the doubt per skill 6c.4).

> Note: same-commit test+impl (`2db96a4f`) means the slice gate (oli-execute 4g/4b) likely batched RED+GREEN into one commit. Not a fabrication, but it defeats independent git-history proof of test-first. Recommend separate RED and GREEN commits for future scheduling slices.

## Unauditable Items
| Item | Reason | Manual Check Needed |
|------|--------|-------------------|
| Generated zod validator length/enum enforcement (notes max:500, visitType) | Generated layer not read in this slice | Confirm `CreateAppointmentBody` validator bounds (compliance V-SCH-105/107) |
| Frontend scheduling component tests | Out of confidence scope this pass; route map is config-based (empty in graph) | Check apps/dentalemon scheduling route/component test coverage |
| Real pg-boss event consumer | No consumer registered (events are audit-markers per ADR-006) | N/A unless a bus is introduced |

## Prioritized Action Plan

### P0 — Fix Now
None. No security/data-integrity coverage gaps. All auth gates have deny+allow tests; all FSM guards tested; no fabrication.

### P1 — Fix Before Major New Work
1. **Replace `setTimeout(10ms)` waits in domain-events.test.ts** (lines 189/207/233/283/299/324) with deterministic flushing (await the emit promise or use a resolved-deferred) to remove the only flake vector. P1 (test-stability).

### P2 — Fix When Touching Module
2. Add a list-envelope coverage test once V-SCH-102 is reconciled (`{data,meta}` vs bare array) so Layer 1 reaches 10.
3. Replace ID-existence `toBeTruthy()` asserts with shape/value checks where feasible (e.g., assert UUID format) — cosmetic assertion-strength bump.
4. Future scheduling slices: commit RED (test) and GREEN (impl) separately so git-history TDD proof is independently verifiable (addresses the 3 UNVERIFIED slices).

### P3 — Track
5. Add §17 INFO observable assertions (booked/checked-in/cancelled log lines) if observability is prioritized (compliance V-SCH-109).
6. Release infra (L4): wire real changelog generation in release.yml (currently a placeholder) — module-agnostic, but it caps Ship-Readiness at 7.

## What's Next
- Module is in strong shape (Test-Confidence 9/10). No P0/P1 confidence blockers beyond the flake-vector cleanup.
- Run `/oli-check --confidence --module dental-scheduling --layer 3` after the setTimeout fix to confirm L3 → 10.
- Release-Readiness (7) is bounded by repo-wide infra (changelog placeholder), not by scheduling tests.
