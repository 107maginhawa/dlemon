# Confidence Stack Report

**Date:** 2026-06-02
**HEAD:** c26d37bd
**Team size:** small
**Mode:** `--auto` (full suite RE-RUN this pass — api-ts 2977/0, FE 1491/1/5skip)
**Layers audited:** 1-4 (static analysis) + live suite execution
**Map provenance:** producer=engine, v5, FRESH (git_sha `c26d37bd` == HEAD), `fields_unavailable: []`, confidence_threshold MEDIUM
**Engine scope:** `apps/dentalemon/src` only (frontend). Backend (`services/api-ts`) test/source signals read **directly from files → HIGH confidence, not graph-anchored, never routed to `unverified`** (R1 §6.1–6.5 source-read exemption).

## Suite Execution (this pass)

| Suite | Command | Result | Duration |
|-------|---------|--------|----------|
| api-ts backend | `DATABASE_URL=…/monobase_test bun run test` | **241 files, 2977 pass, 0 fail** | 48.8s |
| api-ts typecheck | `bun run typecheck` (`tsc --noEmit`) | **PASS (0 errors)** | — |
| frontend (dentalemon) | `bun test src/` | **1491 pass, 1 fail, 5 skip** (1497 across 127 files, 4077 expect()) | 20.7s |

> **Runner note:** the api-ts wrapped runner (`bun run test`) refuses to run when `DATABASE_URL` points at the non-test `monobase` DB (the project `.env` default). It clones per-file from the `monobase_test` template. This pass invoked it with `DATABASE_URL=…/monobase_test` — the correct, non-polluting invocation. The CRITICAL RUNNER RULE was honored: no bare `bun test <path>` against the api-ts template.

> **Frontend 1 fail is a test-isolation flake, NOT a product/component bug.** `CalibrationDialog > shows dialog when open=true` (`calibration-dialog.test.ts:36`) fails only inside the full-suite run; **in isolation all 8 tests in that file PASS** (`bun test …/calibration-dialog.test.ts` → 8 pass / 0 fail). The shipped component renders `<DialogTitle>Calibrate Measurement</DialogTitle>` correctly and the test imports the real SUT (line 10). Root cause: a Radix Dialog portal / `@testing-library` cleanup race leaking DOM between sibling files. Severity: P2 flake.

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | 9/10 | Strong — meaningful business-outcome assertions; loading-hygiene 1.0 (no cap); TDD proofs valid | No coverage artifact emitted; line-% inferred from assertion density not measured |
| 2. Behavior Traceability | 6/10 | **Capped** — inventory comprehensive & every behavior traced with real-wiring tests, BUT engine FE→BE edge density 0.111 caps L2 at 6 (§5.5). Cap is an engine SDK-resolver blind-spot, not a missing test owner | FE→BE edge density <70% (engine cannot resolve raw-`fetch` SDK pattern) |
| 3. Test Quality Hardening | 9/10 | Strong — 97% specific-value assertions, mocks minimal+appropriate (real DB clones), SUT-binding 1.0 (no cap) | 1 isolation flake; 5 deferred-with-reason skips |
| 4. Release Gate Readiness | 8/10 | Good — CI runs typecheck+lint+unit+build+security+contract+perf+real-PG journey E2E; DEEP `/readyz` | No migration rollback / dry-run gate (forward-only Drizzle) |

**Overall Test-Confidence (min L1-L3):** **6/10** — dragged solely by the §5.5 edge-density cap (an engine-resolver artifact, not a test defect). Excluding the mechanical cap, the underlying test-quality signal is **9/10**.
**Release-Readiness (L4):** 8/10
**Ship-Readiness (min L1-L4):** 6/10
**Average:** 8.0/10

> **Headline interpretation:** Tests are strong (9/9/9 on the substance). The Overall number reads 6 **only** because §5.5 mechanically caps L2 when the engine's `behavior.ts` resolver can't map this codebase's hybrid SDK pattern (43 files use `@monobase/sdk-ts` hooks → resolvable; 91 use raw `fetch(${apiBaseUrl}/dental/…)` in custom hooks → engine returns `api_calls: []`). This is the already-tracked deferred-P1 "engine SDK resolver" item, surfaced — not a behavior-traceability hole in the tests themselves.

## Scoring Rubric

| Score | Meaning |
|-------|---------|
| 0-2 | No meaningful coverage/traceability/quality |
| 3-4 | Minimal — critical gaps in high-risk areas |
| 5-6 | Partial — happy paths covered, gaps in edge/error paths |
| 7-8 | Good — most critical behaviors covered with quality assertions |
| 9-10 | Strong — comprehensive coverage, high assertion quality, minimal gaps |

## Cross-Layer Consistency
- **L1 (9) exceeds L2 (6) by 3** — at the §7 flag threshold. Cause is NOT line-coverage-without-owner; it is the §5.5 edge-density cap on L2. Flagged as awareness only; the underlying L2 traceability is 9.
- No other inconsistencies. L3 (9) within tolerance of L1 (9). L4 (8) within tolerance.

## Per-Module Breakdown

| Module | Backend tests | FE tests | L1 | L2* | L3 | Status | Priority Gaps |
|--------|--------------:|---------:|----|-----|----|--------|---------------|
| dental-org | 33 | 0 | 9 | 9 | 9 | checked-pass | row-level "own patients" scope at membership layer (documented) |
| dental-clinical | 26 | 0† | 9 | 9 | 9 | checked-pass | FE clinical tests live under workspace/imaging |
| dental-patient | 26 | 16 | 9 | 9 | 9 | checked-pass | — |
| dental-visit | 21 | 3 | 9 | 9 | 9 | checked-pass | localId persistence covered (GAP-001) |
| dental-billing | 13 | 8 | 9 | 9 | 9 | checked-pass | consent-gate (p1-001) proof valid |
| dental-scheduling | 11 | 9 | 9 | 9 | 9 | checked-pass | — |
| dental-imaging | 9 | 29 | 9 | 8 | 8 | checked-findings | imaging hooks use raw-fetch (edge-density blind); 1 FE flake (calibration) |
| dental-erasure | 6 | 0 | 9 | 9 | 9 | checked-pass | real anonymize + S3-delete lifecycle |
| dental-pmd | 6 | 4 | 9 | 9 | 9 | checked-pass | — |
| dental-audit | 5 | 0 | 9 | 9 | 9 | checked-pass | cross-tenant leak fixed (EM-AUD-002) |
| dental-perio | 3 | 0† | 9 | 9 | 9 | checked-pass | thin but real-wiring |
| dental-legalhold | 3 | 0 | 9 | 9 | 9 | checked-pass | hold/release integration covered |
| workspace (FE) | — | 35 | — | 6‡ | 8 | checked-findings | 5 deferred Swiper-capture skips (timeline-carousel) |

\* L2 per-module reflects intrinsic traceability (real test owners present); the global L2=6 cap is an engine-wide edge-density artifact, not module-specific.
† clinical/perio FE coverage is exercised through `workspace` + `imaging` feature tests (chart grid, carousel) rather than module-named folders.
‡ workspace L2 reflects the global edge-density cap; underlying traceability strong.

## Layer 1: Coverage Integrity Detail

### "Covered" semantics per rule class
| Rule Class | Meaningful Coverage Requires | Evidence |
|------------|------------------------------|----------|
| Auth/permissions (35%) | deny AND allow per gate | `rbac-http.test.ts`, `middleware/auth.test.ts` (9), `security.test.ts` (23), `cross-org-isolation.test.ts` (5); deny+allow pairs present (e.g. void-invoice owner-only, branch-role gates) |
| Business rules (30%) | assertion on business outcome | `business-rules.test.ts` (64), state-machine guards (treatment 2-step, visit completion hard-gates) asserted with specific 422s |
| State transitions (20%) | guard + happy-path | 28 FSMs; treatment/visit/invoice/imaging transitions tested both directions |
| API routes (15%) | status + shape | 145 of 241 backend test files hit a real server/`app.request` path; status-code assertions: 1917 |

- **Loading-state hygiene (§4.5, engine v5):** 119 UI components, 38 analyzed, **0 violators → coverage 1.00 (≥0.95) → no L1 cap.**
- **Assertion density (api-ts):** 6033 `expect()`; 5000 strong (`toBe/toEqual/toMatchObject/toThrow/toContain`), 166 weak (2.8%); 0 snapshot-only.
- **TDD proof influence:** 47 `TDD_PROOF.md` artifacts; sampled proofs (p1-001-consent-gate, a1-operatory) — claimed test files resolve on disk. No fabrication detected. No git-history violation surfaced (suite green, proofs corroborate). No L1 penalty.

## Layer 2: Behavior Traceability Detail

- **Inventory source:** comprehensive (NOT shallow) — `EXISTING_CODEBASE_ADOPTION_AUDIT.md` (237 endpoints, 28 state machines, 75 tables), `COMPLIANCE_REPORT.md` (PASS, ~97%), `JOURNEY_COVERAGE_REPORT.md` (PASS). **No §5.1 shallow-extraction cap applies.**
- **Behaviors traced:** treatment/consent/visit/erasure/legal-hold/retention BRs all have real-wiring test owners (COMPLIANCE sampled 8/10 enforcement). Permission gates: deny+allow pairs present. Event contracts (`EVENT_CONTRACTS.md` loaded) and API contracts covered through HTTP-level handler tests.
- **SUT-binding (§6.5):** **89/89 FE component tests import their first-party SUT → ratio 1.0 → no cap.** No `SUT_NOT_IMPORTED`.

### FE→BE Edge Density (§5.5 — engine v5 present)
- ui-typed data-hook consumers: **18** · resolved (`api_calls>0`): **2** · **fe_be_edge_density = 0.111** (<0.70) → **L2 capped at 6/10.**
- **Cause = engine SDK-resolver gap, verified:** the 16 unresolved consumers genuinely call APIs but via the raw-`fetch(${apiBaseUrl}/dental/…)` custom-hook pattern (91 files repo-wide) that the engine `behavior.ts` resolver does not map; only the 43 `@monobase/sdk-ts` hook consumers resolve. This is the tracked **deferred-P1 "engine SDK resolver"** (project memory), surfaced by the subscore — **not a missing test owner.** The tests for these hooks exist and pass (e.g. `use-imaging-findings` error-path tests).
- Top unresolved consumers: `AppSidebar`, `RootComponent`, `CephReportPage`, `OnboardingPage`, `BillingPage`, `CalendarPage`, `BillingList`, imaging-findings hooks.

## Layer 3: Test Quality Detail

- **Assertion strength:** STRONG-dominant. api-ts 5000/6033 strong (82%, weak 2.8%); FE 4077 expects with only 3 weak. Status-code + specific-value + error-message assertions throughout.
- **Mock audit:** api-ts only 5 files use `mock.module` (cron/external); DB is **real** (per-file `monobase_test` clones) — **APPROPRIATE, not over-mocked.** FE 20 files mock (`sonner`, Swiper, fetch) — appropriate for component isolation.
- **Flake (§6.3):** 0 `setTimeout`/sleep in backend tests; api-ts 2 `describe.skip` (BR-005 v1.3, BR-020 v2.0 — both deferred WITH version tags, empty bodies). FE 5 skips (`timeline-carousel.test.ts` `skipMockDependent` — Swiper prop-capture not yet wired, reasoned). **1 isolation flake** (CalibrationDialog, see above).
- **Data stability:** 122 backend files use `beforeEach`/`beforeAll`; transaction-rollback + fixtures; only 2 files with hardcoded-uuid literals in assertions (namespaced/deterministic). SEEDED-dominant.
- **Probe-skip (§6.6):** **0 occurrences** across both suites. `anti_coverage_items`: none.
- **SUT-binding cap (§6.7):** ratio 1.0 → **no L3 cap.**

## Layer 4: Release Gate Readiness Detail

### CI Pipeline (`.github/workflows/quality.yml`, `contract.yml`, `postgres-services.yml`)
| Check | Status |
|-------|--------|
| CI config found | YES (5 workflows) |
| Test step | PRESENT (FE unit + coverage; api-ts via real-PG journey E2E gate) |
| Lint step | PRESENT (FE lint + `lint:migrations`) |
| Type check step | PRESENT (FE typecheck) |
| Build step | PRESENT (Vite production build) |
| Security scan step | PRESENT (`scripts/check-audit.sh` — new advisories block merge) |
| Contract tests | PRESENT (Hurl required + Schemathesis shadow) |
| Trace/duplicate-op gates | PRESENT (`audit:trace:ci`, `check:duplicate-ops`) |

### Migration Safety
| Check | Status |
|-------|--------|
| Migration files | YES (80 SQL) |
| Rollback/down files | NO (forward-only Drizzle — migrations auto-run on boot) |
| CI dry-run / migration lint | PARTIAL (`lint:migrations` present; no dedicated rollback dry-run) |

### Version Management
| Check | Status |
|-------|--------|
| Version file | YES (`VERSION`, `package.json` 0.1.0.1) |
| CHANGELOG.md | YES |
| Release workflow | YES (`release.yml`) |

### Health Check
| Check | Status |
|-------|--------|
| Health endpoint | YES (`/livez`, `/readyz` in `core/health.ts`) |
| Dependency depth | **DEEP** (`/readyz` checks database + storage + jobs) |

## TDD Proof Verification
| Aspect | Result |
|--------|--------|
| Proof artifacts | 47 `TDD_PROOF.md` |
| Test-file existence (sampled) | Claimed files resolve on disk (one doc-path-prefix artifact, file present by basename) |
| Fabrication | **NONE detected** |
| Git-history ordering | Not contradicted (suite green, proofs corroborate); no VIOLATION surfaced |
| Score adjustment | none (between 50–80% / benefit-of-doubt; no penalty, no bonus) |

## Unverified (R1)
**Unverified node count: 0.** FRESH map, `fields_unavailable: []`. All scored signals read directly from test/source files (HIGH) or from comprehensive prior audits. The FE→BE edge-density subscore is graph-derived but its inputs were independently re-verified against source (the unresolved consumers DO import data hooks) — reported as a known engine-resolver limitation, not folded silently.

## Prioritized Action Plan

### P0 — none

### P1 — none in-scope (one tracked external/infra item)
- **TR-ENGINE-SDK-RESOLVER (deferred, tracked):** engine `behavior.ts` resolver maps `@monobase/sdk-ts` hooks but not the raw-`fetch(${apiBaseUrl}/…)` custom-hook pattern → FE→BE edge density 0.111 → mechanical L2 cap. Lift the cap by extending the engine SDK-resolver (already on the deferred-P1 backlog). Not a test-quality defect; tests for these hooks exist and pass.

### P2 — Fix When Touching Module
- **FE-FLAKE-CALIBRATION** | `apps/dentalemon/src/features/imaging/components/calibration-dialog.test.ts:36` — passes in isolation (8/8), fails in full-suite run; Radix Dialog portal / RTL cleanup leak between sibling files. Add a portal-scoped cleanup or `document.body` reset in the imaging test-setup to stabilize.
- **CI-MIGRATION-GATE** — add a migration rollback / dry-run gate to lift L4 (Ship-Readiness).
- **COVERAGE-ARTIFACT** — emit a `coverage/` artifact so L1 line-% is measured, not assertion-inferred.

### P3
- `timeline-carousel.test.ts` 5 `skipMockDependent` skips — wire the Swiper prop-capture harness to retire the skips (documented as not-yet-wired).
- `business-rules.test.ts` 2 empty `describe.skip` (BR-005, BR-020) — convert to `.todo` with a tracking link, or remove until the deferred versions land.

## What's Next
- No in-scope P0/P1 → **GATE PASS** for this dimension (the lone P1 is a tracked engine-resolver/infra item, not a product test defect; per §"Prioritized Action Plan" gate posture, engine-resolver limitations don't fail the test-confidence gate).
- Extend the engine SDK-resolver → re-run `/oli-check --confidence` to lift the L2 cap and restore the headline to 9.
- Stabilize the CalibrationDialog isolation flake before it becomes load-bearing in CI.
- `CHECK_LEARNINGS.md`: append `category: low-confidence-heuristic` for `fe_be_edge_density 0.111` (engine SDK-resolver coverage gap, not a real traceability hole).
