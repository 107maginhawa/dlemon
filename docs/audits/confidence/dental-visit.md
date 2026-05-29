# Confidence Stack Report — dental-visit

---
Audit Date: 2026-05-30
Dimension: confidence (oli-check, single-module slice)
Module: dental-visit
Team size: small
Layers audited: 1-4 (static analysis) + TDD proof verification (Step 6c)
Layers deferred: 5-6 (require live CI/CD/runtime evidence)
Knowledge-graph baseline: docs/audits/codebase-map/ (.map-meta 2026-05-30)
Prior audits used: docs/audits/compliance/dental-visit.md (behavior inventory — BR/AC/permission/FSM/contract/audit)
---

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | 8/10 | Good — auth deny/allow, FSM guard+happy, contract status/error-code all asserted with meaning | AC-VIS-003 performed-field-immutability untested; GET /visits/:id detail-shape untested |
| 2. Behavior Traceability | 7/10 | Good — 7/8 BR, 4/5 AC, all FSM edges (property-tested), key audit DEs have owners | AC-VIS-003 NO owner; BR-008 carry-over `status=diagnosed` not asserted; hygienist over-grant lacks a deny test |
| 3. Test Quality Hardening | 8/10 | Good — STRONG assertions, real Postgres DB, seeded+isolated, no skips/sleeps, fast-check FSM property tests | 13 weak existence-only lines (`id).toBeTruthy()` / `toBeDefined()`); 1 placeholder no-op test |
| 4. Release Gate Readiness | 9/10 | Strong — test+typecheck+lint+build+security-audit+migration-safety+BR-traceability CI jobs, /livez+/readyz deep health, VERSION+CHANGELOG | Hurl contract + e2e are continue-on-error (non-blocking) for known pre-existing failures incl. dental-visit |

**Overall Test-Confidence (min L1-L3):** 7/10 — headline test-quality signal
**Release-Readiness (L4):** 9/10
**Ship-Readiness (min L1-L4):** 7/10
**Average Score:** 8.0/10

## Evidence Read (exhaustive on critical paths — no sampling)

Test files read IN FULL: business-rules (BR-005 flag-gated auto-discard, DB-verified), dental-visit.treatment-status-transitions (treatment+visit FSM, carry-over, tooth history, notes), treatment-fsm-http (BR-006 skip/consent/two-step), dental-visit.signed-notes (J02/J10 sign+addendum+NOTE_SIGNED), dental-visit-events (DE-003/DE-004 audit markers + negative), treatment.fsm.property + visit.fsm.property (exhaustive fast-check over state space), dental-visit.revenue-path-regression (revenue path lock), dental-visit.visit-note-persistence (J02/J10 round-trip), repos/treatment-decline (informed-refusal, tx-isolated).

Assertion counts scanned across module tests: dental-visit.test.ts 132, dental-treatment 82, treatment-templates 77, dental-chart 35, visit 28, treatment 27, treatment-plan-versioning 24, visit-note-persistence 15, surface-condition-map 9, chart-baseline 5 (+the read-in-full files above). 20 backend test files in/near module; 12+ frontend workspace tests (use-visits, use-create-visit, use-treatments, use-save-treatment, use-mark-treatment-done, use-treatment-plan, use-save-chart, use-save-tooth-flow, use-dental-chart-query, treatment-table, treatment-plan-tab, timeline-carousel).

CI workflows read IN FULL: quality.yml, postgres-services.yml, contract.yml, release.yml; openapi-drift.yml scanned.

## Layer 1 — Coverage Integrity Detail

| Rule Class | Weight | Coverage | Evidence |
|------------|--------|----------|----------|
| Auth/permissions | 35% | ~85% | upsertVisitNotes no-membership→403 + active→201; signVisitNotes 401-unauth; role-gate describe blocks in dental-treatment.test. Deny+allow pairs present for write gates. Missing: explicit deny for hygienist over-grant (compliance V-VIS-201). |
| Business rules | 30% | ~88% | BR-001/002/003/005/006 assert SPECIFIC codes (ACTIVE_VISIT_EXISTS, VISIT_IMMUTABLE, VISIT_LOCKED, TREATMENT_CONSENT_REQUIRED, NOTE_SIGNED) + DB state. BR-007 performed-immutability NOT covered; BR-008 carry-over-status assertion absent. |
| State transitions | 20% | ~100% | Property tests exhaustively cover ALL (from,to) pairs for both FSMs (terminal/no-self-loop/no-backward/table-agreement); HTTP tests cover guard (skip/backward 422) + happy (200) + terminal. |
| API routes | 15% | ~80% | Most endpoints assert status + body fields. GET /visits/:id detail-with-treatments shape untested (V-VIS-204). |

Coverage is meaningful, not line-only — assertions check specific outcomes throughout. Score 8/10. (No git-history penalty applied — see Step 6c: ≥80% test-first/no-fabrication, between-band so no adjustment.)

## Layer 2 — Behavior Traceability Detail

### BR → Test owner
| BR | Owner | Quality |
|----|-------|---------|
| BR-001 concurrent visit 409 | business-rules / dental-visit.test | STRONG |
| BR-002 visit FSM linear | visit.fsm.property + treatment-status-transitions | STRONG |
| BR-003 visit immutable completed/locked | treatment-status-transitions + signed-notes (VISIT_IMMUTABLE) | STRONG |
| BR-005 auto-discard (flag) | business-rules (flag ON+OFF+DB persistence) | STRONG |
| BR-006 treatment FSM forward-only | treatment-fsm-http + treatment.fsm.property + revenue-path-regression | STRONG |
| BR-007 performed-field immutable | NONE (only verified-field edit tested) | MISSING |
| BR-008 carry-over status=diagnosed | copy tested; status-forcing assertion MISSING | WEAK |

### AC → owner
AC-VIS-001 STRONG; AC-VIS-002 STRONG; AC-VIS-003 NONE (performed cdt edit untested; code returns 200); AC-VIS-004 STRONG; AC-VIS-005 backend flag tested.

### Domain events (audit-row markers, ADR-006 — no bus)
DE-003 VisitLocked STRONG (publisher + negative); DE-004 TreatmentDiagnosed STRONG (publisher + negative create-fail). DE-001/002/005/006 traced elsewhere (file comment). Consumer/idempotency N/A (no bus).

### Untraced behaviors
AC-VIS-003 / BR-007 performed-field immutability (also compliance P1 V-VIS-101); BR-008 carry-over status; hygienist clinical-write deny test (V-VIS-201).

Traceability ≈ 80%. Score 7/10. NOT capped at 6 — compliance/dental-visit.md is a comprehensive (non-shallow) inventory. NOT capped at 5 — TDD proofs exist for the relevant slices (Step 6c). No +1 bonus: one proof (p1-002) has no SLICE_SPEC.md, and AC-VIS-003 remains untraced.

## Layer 3 — Test Quality Detail

**Assertion strength: STRONG dominant.** Specific status codes (`toBe(422/403/201/404/401)`), specific error codes (`body.code).toBe('TREATMENT_CONSENT_REQUIRED'|'NOTE_SIGNED'|'VISIT_IMMUTABLE'|'NOTE_ALREADY_SIGNED')`), specific values (`body.status).toBe('performed')`, `versions[0].version).toBe(1)`, `toMatchObject({subjective,assessment})`). Property tests assert structural invariants over the full state space (200/100 runs).

**Mocks: APPROPRIATE.** Tests use a REAL Postgres test DB (createDatabase + DATABASE_URL), not DB mocks. Logger is a no-op stub (reasonable). treatment-decline uses tx-rollback isolation (openTestTx). No over-mocking of the data layer.

**Flake: STABLE.** No `.skip`/`.todo`/`xit`/`xdescribe`; no `setTimeout`/`sleep`. afterEach TRUNCATE / DELETE-by-fixture; per-suite UUID namespaces (a06/b400/b500/b700/f0..f5/aa/ec) prevent cross-suite collisions. CI runs each file in its own cloned DB (postgres-services.yml).

**Data: SEEDED.** Explicit seed helpers + per-suite fixture IDs + truncate teardown. Hardcoded UUIDs are deterministic fixture namespaces, not brittle assertion targets.

**WEAK findings (minor):**
- 13 existence-only assertions across the suite (`expect(x.id).toBeTruthy()`, `expect(tooth).toBeDefined()`, `body.signedAt).toBeTruthy()`). Each sits ALONGSIDE strong assertions in the same test (e.g. signed-notes asserts `signed===true` + `signedBy===TEST_USER.id` next to the `toBeTruthy()` timestamp checks), so they are weak-but-not-bare. Acceptable for small team; tighten timestamp checks to value/instanceOf where cheap.
- `repos/treatment-decline.test.ts` — NOTE: the file read shows it actually contains REAL assertions (`status).toBe('declined')`, `refusalReason).toBe(...)`, `dismissReason).toBeNull()`, terminal-state checks). The earlier "placeholder" concern is WITHDRAWN — this file is strong. (Retained as P3 only if a stray placeholder line exists elsewhere; none confirmed in scanned files.)

Score 8/10.

## Layer 4 — Release Gate Readiness Detail

| Sub-check | Status | Evidence |
|-----------|--------|----------|
| CI config | YES | 5 workflows |
| Test step | PRESENT (blocking) | postgres-services.yml: real PG, per-file DB clones, recursive discovery, .allowed-failures gate |
| Type check | PRESENT (blocking) | quality.yml typecheck + postgres-services.yml typecheck |
| Lint | PRESENT (blocking) | quality.yml lint |
| Build | PRESENT (blocking) | quality.yml Vite build; release.yml build |
| Security scan | PRESENT (blocking) | quality.yml `security` job → scripts/check-audit.sh (new advisories block merge); contract.yml `bun audit` (non-blocking shadow) |
| Migration safety | PRESENT | quality.yml `migration-safety` → lint:migrations; contract.yml schema-drift `git diff --exit-code`; auto-migrate on boot |
| BR traceability gate | PRESENT | quality.yml `traceability` → audit:trace:ci (P0 BR coverage) |
| OpenAPI drift | PRESENT | openapi-drift.yml |
| Journey/E2E | PRESENT | quality.yml journey-verification (real PG+seed+api-ts, hard-fail) + e2e (continue-on-error) |
| Version file | YES | VERSION = 0.2.0.0 |
| CHANGELOG | YES | CHANGELOG.md |
| Release workflow | YES | release.yml (tag-triggered, auto release notes) |
| Health endpoint | DEEP | /livez (liveness) + /readyz checks database+storage+jobs, returns 503 on dep failure; core/health.test.ts covers verbose per-dep statuses |

Caveat: Hurl contract scenarios + e2e are `continue-on-error: true` for a documented backlog of pre-existing failures that INCLUDES dental-visit — so contract-level regressions in this module would not currently hard-fail CI. This is the one L4 soft spot. Score 9/10.

## TDD Proof Verification (Step 6c)

TDD_PROOF.md artifacts referencing dental-visit: fix-dental-visit-lock-gates, fix-wave2-dental-visit, p1-002-chart-version-audit (plus P2-008, fix-al-patient-visit-sch-audit touch it).

| Slice | Claimed | Test files exist | Spec IDs concrete | Fabrication |
|-------|---------|------------------|-------------------|-------------|
| fix-dental-visit-lock-gates | 62 pass / 120 expect; EF-VIS-001/002/003 + EM-VIS-007 lock gates (422 VISIT_IMMUTABLE) | YES (dental-visit.test.ts — lock-gate VISIT_IMMUTABLE tests confirmed present) | YES | NO |
| fix-wave2-dental-visit | 37 pass / 74 expect; EM-VIS-002 sourceVisitId carry-over (4 new tests on existing file) | YES (dental-treatment.test.ts) | YES; commit 30242380 confirmed via git cat-file | NO |
| p1-002-chart-version-audit | AC-001/002 saveVersion sequential versions; RED="relation dental_chart_version does not exist" | YES (repos/dental-chart.test.ts) | YES (inline session spec, no SLICE_SPEC.md) | NO |

Git-history note: dental-treatment.test.ts (add 2026-05-29) and carryOverTreatments.ts (add 2026-05-12) are mature files; the wave-2 slice ADDED tests to a pre-existing file (proof states "4 NEW tests" beside 33 existing). Whole-file add-ordering is therefore not the right signal here; the proof's RED output + explicit per-test PASS table + verified commit SHA are internally consistent. No proof claims a test count exceeding the file's actual assertions; no listed test file is missing. **Fabrication detected: NO.** Score adjustments: none (git-history in the 50-80% no-adjust band given add-to-existing pattern; no +1 bonus since p1-002 lacks SLICE_SPEC and AC-VIS-003 is still untraced).

## Cross-Layer Consistency

No inconsistencies. L1(8)−L2(7)=1 (≤3). L3(8) within 1 of L1/L2. L4(9) exceeds L3 by 1 (<4 OK). Greenfield-CI-ahead flag does NOT apply (L4 high AND L1-3 high). Scores mutually coherent.

## Unauditable Items

| Item | Reason | Manual check |
|------|--------|--------------|
| Frontend visit-hook assertion depth | Not read this slice (backend-scoped) | Spot-read use-visits / use-save-treatment tests |
| Live contract-test pass rate for dental-visit | Hurl is continue-on-error; status not run here | Run `bun run test:contract` locally |
| Coverage % per handler | Coverage report generated in CI artifact, not read | Download postgres-services coverage-report artifact |

## Prioritized Action Plan

### P1 — Fix Before Major New Work
- Add a test for AC-VIS-003 / BR-007: PATCH cdtCode on a `performed` treatment → expected 422 (TREATMENT_IMMUTABLE) — once the canonical spec scope (performed vs verified) is decided. Pairs with compliance P1 V-VIS-101. (updateDentalTreatment.ts:48-51; new test beside treatment-fsm-http.test.ts)

### P2 — Fix When Touching Module
- Assert BR-008 carry-over rows start `status=diagnosed` (carryOverTreatments.ts:115; extend carry-over describe).
- Add hygienist deny test on upsertDentalChart / createVisitNoteAddendum (locks V-VIS-201 boundary by test).
- Add GET /visits/:id detail-shape test (V-VIS-204).
- Flip Hurl contract + e2e off continue-on-error for dental-visit once its pre-existing contract failures are triaged (L4 soft spot).

### P3 — Track
- Tighten 13 existence-only assertions (`toBeTruthy()`/`toBeDefined()`) to value/instanceOf checks where cheap.

## What's Next
- Resolve the AC-VIS-003 spec decision, then re-run `/oli-check --confidence --module dental-visit --layer 2`.
- Frontend hook assertion depth is out of scope here — cover in a frontend confidence pass.
