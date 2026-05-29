# Confidence Stack Report — Suite (Merged)

**Date:** 2026-05-30
**Team size:** small
**Scope:** all (12 module slices aggregated)
**Layers audited:** 1-4 (static analysis)
**Layers deferred:** 5-6 (require CI/CD/runtime evidence)
**Aggregation source:** `docs/audits/confidence/*.md` (12 per-module confidence slices)
**Method:** This report aggregates the per-module confidence slices only. Per-module
scores, findings, and rationales were authored in the individual slices; this document
rolls them up into suite-wide gauges and a prioritized action plan. No re-scoring was
performed here.

## Score Summary (suite-wide)

Suite layer scores are the **min across implemented modules** (conservative — the suite
is only as confident as its weakest module). `external-records-import` is SKIP
(future-phase, no code/tests) and is excluded from min/avg math.

| Layer | Suite Score (min) | Suite Avg | Meaning | Top Gaps |
|-------|-------------------|-----------|---------|----------|
| 1. Coverage Integrity | 7/10 | ~7.9/10 | Good — every implemented module's critical BR/AC/permission/FSM paths have meaningful (assertion-bearing) coverage; weakest are audit/pmd/emr | emr PHI audit-logging line-only (no audit-row assertion); audit consumer write path; pmd test-after penalty |
| 2. Behavior Traceability | 7/10 | ~7.7/10 | Good — comprehensive compliance inventories present (no shallow caps); most behaviors have named STRONG test owners | emr 6 PHI audit-ops + admin grants untraced; patient V-PAT-002 create-deny; visit AC-VIS-003 |
| 3. Test Quality Hardening | 8/10 | ~8.6/10 | Good→Strong — real-DB integration over mocks, seeded fixtures, strong assertions, FSM property tests across the suite | emr tautological FSM property test; residual weak existence-only assertions; scheduling setTimeout flake vector |
| 4. Release Gate Readiness | 6/10 | ~7.5/10 | Partial→Good — full CI (test/lint/typecheck/build/security/migration-lint/traceability/journey) repo-wide; per-module gaps in build stub, contract continue-on-error, shallow health | audit build step is a stub + no security scan; emr no security scan + shallow health; migrations forward-only (no down files) suite-wide |

### Three Headline Gauges (suite-wide, min across implemented modules)

- **Overall Test-Confidence (min L1-L3): 7/10** — headline test-quality signal. Gated by
  dental-audit, dental-patient, dental-pmd, dental-visit, and emr-consultation (all 7).
  The remaining seven implemented modules sit at 8-9.
- **Release-Readiness (L4): 6/10** — separate release-infra gauge. Gated by dental-audit
  (build stub + no security scan) and emr-consultation (no security scan + 0/2 migration
  safety + shallow health). Repo-wide CI is otherwise comprehensive (median L4 = 8).
- **Ship-Readiness (min L1-L4): 6/10** — conservative combined gate (weakest link). Gated
  by the same dental-audit / emr-consultation L4 floor.

**Suite Average Score:** ~7.9/10 (across the 11 implemented modules)

> **Read:** Test quality is strong suite-wide (L3 floor 8, median 9); the suite-wide
> Test-Confidence floor of 7 is a behavior-traceability/coverage gap in five modules, not
> a test-quality defect. The Ship-Readiness floor of 6 is **release infrastructure**
> (dental-audit CI build stub + emr-consultation missing security scan/migration safety),
> not the tests. Fix the one P0 (emr PHI audit assertions) and the two L4 floors to lift
> both Test-Confidence and Ship-Readiness to 7-8 quickly.

## Scoring Rubric

| Score | Meaning |
|-------|---------|
| 0-2 | No meaningful coverage/traceability/quality in this layer |
| 3-4 | Minimal — critical gaps in high-risk areas |
| 5-6 | Partial — happy paths covered, gaps in edge cases and error paths |
| 7-8 | Good — most critical behaviors covered with quality assertions |
| 9-10 | Strong — comprehensive coverage, high assertion quality, minimal gaps |

## Per-Module Breakdown

| Module | L1 | L2 | L3 | L4 | Test-Conf (min L1-3) | Rel-Rdy (L4) | Ship (min L1-4) | Verdict | Priority Gaps |
|--------|----|----|----|----|----------------------|--------------|-----------------|---------|---------------|
| dental-audit | 7 | 7 | 8 | 6 | **7** | 6 | **6** | WARN | Consumer PHI write path untested; pagination/count determinism; CI build stub |
| dental-billing | 8 | 8 | 9 | 8.75 | **8** | 8.75 | **8** | WARN | V-BIL-105 draft-payment FSM edge untested |
| dental-clinical | 8 | 8 | 9 | 9 | **8** | 9 | **8** | PASS | 5 cross-module facades only covered transitively |
| dental-imaging | 9 | 9 | 9 | 8 | **9** | 8 | **8** | PASS | FE error-surfacing (V-IMG-004); cascade-hide (V-IMG-003) |
| dental-org | 8 | 8 | 9 | 8 | **8** | 8 | **8** | WARN | Membership state-machine guard+test; 3 un-audited mutations |
| dental-patient | 8 | 7 | 9 | 7 | **7** | 7 | **7** | WARN | V-PAT-002 create-role deny test; READ deny/allow pairs |
| dental-perio | 8 | 8 | 9 | 8 | **8** | 8 | **8** | PASS | INVALID_DEPTH / INVALID_TOOTH_NUMBER rejection assertions |
| dental-pmd | 7 | 8 | 8 | 7 | **7** | 7 | **7** | WARN | AC-PMD-004 immutability-after-edit test; test-after process flag |
| dental-scheduling | 9 | 9 | 9 | 7 | **9** | 7 | **7** | WARN | setTimeout flake vector; list-envelope coverage |
| dental-visit | 8 | 7 | 8 | 9 | **7** | 9 | **7** | WARN | AC-VIS-003 performed-field immutability untraced |
| emr-consultation | 7 | 7 | 8 | 6 | **7** | 6 | **6** | WARN (P0) | **PHI audit-row assertions (P0)**; tautological FSM test; admin grants |
| external-records-import | — | — | — | — | SKIP | SKIP | SKIP | SKIP | Future-phase (Phase 3+); no code/tests by design |
| **SUITE (min impl.)** | **7** | **7** | **8** | **6** | **7** | **6** | **6** | **WARN** | emr P0 PHI audit; audit + emr L4 infra |

**Counts (aggregated across all slices):** P0 = 1, P1 = 13, P2 = 24, P3 = 13.

## Cross-Layer Consistency (suite-wide)

No suite-wide inconsistencies. Within every implemented module the slices report L1≈L2
(no line-coverage inflation), L3 within 1-2 of L1/L2 (quality not running ahead of
breadth), and L4 within band. The suite-wide pattern that L4 (6) trails Test-Confidence
(7) is the expected and correct signal: tests are trustworthy; release-gate infrastructure
in two modules (dental-audit, emr-consultation) is the comparatively weaker link, which
correctly pulls Ship-Readiness down without dragging the test-quality headline.

## TDD Proof Verification (aggregated)

- **No fabrication detected in any module.** Every TDD_PROOF.md referenced test file
  exists on disk and contains real assertions; no claimed pass-count exceeds actual.
- **Score adjustments applied per slice:** dental-patient L1 +1 (100% test-first across 7
  sub-feature slices); dental-org L2 +1 (proofs valid); dental-pmd L1 −1 (core impl
  committed before tests — process-discipline flag, not a coverage hole).
- **Test-after / squashed-commit flags (no penalty, in 50-80% or UNVERIFIED band):**
  dental-clinical (2 EM-* guard tests back-filled), dental-imaging (squashed test+impl
  commits), dental-perio (foundational handlers test-after), dental-scheduling (3 slices
  same-commit/shared-impl), dental-visit (add-to-existing-file pattern).
- **Modules with no proof artifacts (proof step skipped, no adjustment):** dental-audit,
  dental-billing, emr-consultation.

## Prioritized Action Plan (merged across modules)

### P0 — Fix Now (security / data-integrity gaps)
- **CONF-EMRC-001 (emr-consultation):** Add audit-row assertions for all 6 EMR PHI
  operations (create/read/update/finalize/list/listEMRPatients). Assert (a) an audit row
  with the expected `action` exists, (b) `tenant_id === EMR_AUDIT_TENANT_SENTINEL` (NOT the
  patient UUID — locks the V-EMR-005 fix), (c) update logs field NAMES only. The module's
  signature compliance guarantee currently has ZERO asserting coverage; a regression
  reintroducing the patient UUID into the tenant slot would pass the suite green. New
  `emr-audit.test.ts`; subjects `createConsultation.ts:110`, `getConsultation.ts:90`,
  `updateConsultation.ts:99`, `finalizeConsultation.ts:93`, `listConsultations.ts:131`,
  `listEMRPatients.ts:99`.

### P1 — Fix Before Major New Work
- **CONF-EMRC-002 (emr):** Rewrite `consultation-note.fsm.property.test.ts` — it is a
  99-LOC tautology asserting a local copy of the legacy transition map against itself and
  documenting bug V-EMR-C-001 as correct. Import the real `validateStatusTransition` and
  assert `finalized`/`amended` are terminal.
- **CONF-EMRC-003 (emr):** Update `emr-coverage.test.ts:580-605` FSM-chain test to assert
  `finalized→amended` is rejected once the spec-terminal machine is enforced.
- **CONF-EMRC-004 (emr):** Add admin permission tests (admin read-one + admin
  `listEMRPatients`); the latter is RED-by-design until the handler gains an admin branch.
- **CONF-AUD-001 (dental-audit):** pg-boss consumer write path
  (`consumers/domain-events.consumer.ts:36-46`) has NO test and bypasses PHI sanitization;
  move the recursive PHI sanitizer into `AuditLogRepository.insert` and add a consumer test.
- **CONF-DP-001 (dental-patient):** Add a test asserting `staff_scheduling` (wrong-role
  member) gets 403 on `POST /dental/patients` (V-PAT-002 create-role gap; `createDentalPatient.ts:45`).
- **CONF-DP-002 (dental-patient):** Add wrong-role 403 deny tests for sub-feature READ
  endpoints (contacts/recalls/tasks/alerts/insurance GET — only 401 tested today).
- **V-ORG-001 (dental-org):** Membership state-machine guard + tests
  (`repos/membership.repo.ts:99-106`) — add `transitionStatus(from,to)`, 422 on illegal
  transition, reconcile stray `revoked` enum.
- **V-ORG-002 (dental-org):** Audit-trace tests for the three un-audited mutations
  (fee-schedule, branch-settings, consent-templates) — add `logAuditEvent` + assert a
  `dental_audit_log` row.
- **CONF-PMD-01 (dental-pmd):** AC-PMD-004 immutability-after-edit test — generate PMD,
  mutate source visit/treatments, re-fetch, assert byte-identical content+checksum.
- **V-BIL-105 (dental-billing):** Negative test — payment on a `draft` invoice must be
  rejected (`INVALID_STATUS_TRANSITION`); the FSM edge is untested AND unenforced.
- **AC-VIS-003 / BR-007 (dental-visit):** Test PATCH cdtCode on a `performed` treatment →
  422 (once the performed-vs-verified spec scope is decided; `updateDentalTreatment.ts:48-51`).
- **dental-scheduling L3:** Replace the 6 `setTimeout(10ms)` waits in
  `domain-events.test.ts` with deterministic flushing (sole flake vector).
- **dental-imaging V-IMG-004:** FE test + error UI asserting ceph/findings mutation errors
  are surfaced (currently console.error only).

### P2 — Fix When Touching Module
- **dental-audit:** Consumer silent-drop observability test (CONF-AUD-002); pagination
  determinism tie-break (CONF-AUD-003); SQL `count(*)` + scale test (CONF-AUD-004).
- **dental-billing:** Upgrade existence-only assertions to value/shape; replace wall-clock
  `Date.now()` offsets with an injected clock in overdue/plan tests.
- **dental-clinical:** Direct unit tests for the 5 cross-module facades (CONF-CLI-001);
  tidy ~16 residual weak assertions (CONF-CLI-002).
- **dental-patient:** DE-008 `has_active_payment_plan` consumer-path test (CONF-DP-003);
  trim low-value `toBeDefined()` checks in records test (CONF-DP-004).
- **dental-perio:** Add AC-P04 INVALID_DEPTH + AC-P05 INVALID_TOOTH_NUMBER rejection
  assertions (CONF-PER-001 — lifts L1→9, L2→9; rules are enforced but unasserted).
- **dental-pmd:** Import deny-403 test (CONF-PMD-03); fix V-PMD-201 + un-gate Hurl contract
  (CONF-PMD-04).
- **dental-scheduling:** List-envelope coverage test; ID-existence asserts → shape checks;
  separate RED/GREEN commits on future slices.
- **dental-visit:** BR-008 carry-over `status=diagnosed` assertion; hygienist deny test;
  GET /visits/:id detail-shape test; flip Hurl/e2e off continue-on-error.
- **dental-org:** Typed BR-SCH-004 working-hours contract test (V-ORG-003); make contract
  Hurl tests blocking once backlog clears.
- **emr-consultation:** Add a patient-side `patient-emr.facade` test (CONF-EMRC-005).

### P3 — Track
- **Release infra (suite-wide):** Replace dental-audit CI build stub with real
  `bun run build` + add dependency-audit; add VERSION file for dental-imaging; deep health
  check + migration dry-run + security scan for emr-consultation; reconcile dental-org
  VERSION (0.2.0.0) vs package.json (0.1.0.1); wire real changelog generation in
  release.yml (dental-scheduling note).
- **Assertion hygiene:** Tighten residual existence-only assertions across visit (13),
  perio (BR-P06 idempotency, GET shape, deep-pocket metric), and patient.
- **TDD discipline:** dental-pmd core was implemented before its tests — future work on
  that module (and remediation slices generally) must write failing tests first per
  VERTICAL_TDD.md.

## What's Next
- Land the single P0 (CONF-EMRC-001 PHI audit assertions) first → re-run
  `/oli-check --confidence --module emr-consultation --layer 2`.
- Close the two L4 floors (dental-audit build stub + emr-consultation security scan/health)
  to lift suite Release-Readiness and Ship-Readiness off 6.
- Fix the five Test-Confidence-gating modules (audit, patient, pmd, visit, emr) to raise
  the suite Overall Test-Confidence floor from 7 toward the 8-9 the other seven modules hold.
- Run `/oli-check --traceability` for the full intent→spec→code→test chain.
- Re-run `/oli-check --confidence --module external-records-import` once that module is
  scheduled and built.
