# TDD Execution Gate Prompt

Use the Master Audit Rules.

Now implementation is allowed, but only within the selected slice.

Follow `/oli-execution-gate` principles.

Implementation must be strict, scoped, test-first, and proof-driven.

Do not use this prompt unless:

1. `09-prioritized-stabilization-plan.md` has passed Gate 9.
2. A specific stabilization slice has been selected.
3. The selected slice has acceptance criteria, affected files, required tests, and E2E requirements if applicable.
4. The user has explicitly approved implementation.

---

# Selected Slice

[PASTE SELECTED SLICE HERE]

---

# Goal

Implement the selected stabilization slice using strict TDD.

The goal is not only to fix code.

The goal is to prove that the selected slice is now protected by meaningful tests across the correct layers:

- unit tests
- component tests
- integration/API tests
- permission/security tests
- E2E/Playwright tests where required
- regression checks
- proof documentation

---

# Scope Control

You may only modify files required for the selected slice.

Do not modify unrelated files.

Do not fix unrelated issues.

Do not refactor unrelated code.

Do not introduce new architecture unless the selected slice explicitly requires it.

If you discover an unrelated issue, document it in `Remaining Gaps` or `Follow-up Findings`, but do not fix it.

If the selected slice scope is unclear, stop and mark the slice:

`BLOCKED — missing spec/product decision`

---

# Rules

1. Do not modify unrelated files.
2. Do not fix unrelated issues.
3. Do not implement without a test.
4. Write the failing test first.
5. Confirm the test fails for the correct reason.
6. Implement the smallest code change needed to pass.
7. Refactor only after tests pass.
8. Run regression tests.
9. Update or create proof documentation.
10. Do not mark complete if any acceptance criteria, business rule, permission rule, or journey step has zero test coverage.
11. If E2E is required for the slice, do not mark complete without adding/updating and running the E2E test.
12. If Playwright/Cypress/E2E infrastructure is missing but required, stop and mark the slice blocked or create a separate E2E infrastructure slice if already approved.
13. Do not treat render-only, snapshot-only, or page-load-only tests as sufficient proof.
14. Do not treat frontend-only role hiding as permission proof.
15. Do not treat backend-only permission blocking as UX proof.
16. Do not change intended product behavior without marking a product decision.
17. Do not mark PASS if any P0/P1 issue in the selected slice remains unresolved or untested.

---

# Required Inputs

Before coding, identify:

- selected slice name
- affected module/area
- affected role/s
- affected route/s
- affected component/s
- affected backend/API endpoint/s
- affected UI actions
- affected forms/modals/tables
- expected behavior
- acceptance criteria
- business rules
- permission rules
- journey steps
- E2E requirement
- required test types
- test files to add/update
- source files to add/update
- commands to run
- known pre-existing failures
- product decisions or assumptions

Output:

| Input | Value |
|---|---|
| Slice | |
| Module/Area | |
| Roles | |
| Routes | |
| Components | |
| APIs | |
| UI Actions | |
| Forms/Modals/Tables | |
| Expected Behavior | |
| Acceptance Criteria | |
| Business Rules | |
| Permission Rules | |
| Journey Steps | |
| E2E Required? | YES / NO |
| Required Test Types | |
| Test Files | |
| Source Files | |
| Commands | |
| Known Pre-existing Failures | |
| Product Decisions / Assumptions | |

---

# Slice Readiness Gate

Before writing any test or code, verify that the selected slice is ready.

The slice is READY only if:

- scope is clear
- affected files are identified or discoverable
- expected behavior is clear
- acceptance criteria exist
- required tests are listed
- E2E requirement is known
- product decisions are not blocking
- there is a way to run relevant tests

Output:

| Readiness Item | Status | Evidence | Notes |
|---|---|---|---|
| Scope clear | PASS / BLOCKED | | |
| Expected behavior clear | PASS / BLOCKED | | |
| Acceptance criteria available | PASS / BLOCKED | | |
| Required tests identified | PASS / BLOCKED | | |
| E2E requirement known | PASS / BLOCKED | | |
| Product decisions resolved | PASS / BLOCKED | | |
| Test commands available | PASS / BLOCKED | | |

If any readiness item is BLOCKED, stop.

Do not write tests.

Do not modify code.

---

# Execution Process

## Phase 1 — Preflight

1. Read the selected slice.
2. Inspect affected files.
3. List existing tests.
4. Detect relevant test framework/s.
5. Detect E2E framework if required.
6. Confirm test commands.
7. Run relevant baseline tests.
8. Record current failures if any.
9. Do not confuse pre-existing failures with new failures.

Output:

## Preflight Summary

| Item | Result | Evidence |
|---|---|---|
| Affected files inspected | | |
| Existing tests listed | | |
| Test framework detected | | |
| E2E framework detected if required | | |
| Baseline test command | | |
| Baseline result | PASS / FAIL | |
| Pre-existing failures | | |

If baseline tests fail before changes, record them.

You may continue only if the failure is clearly pre-existing and not blocking the selected slice.

If baseline failure prevents meaningful slice testing, stop and mark:

`BLOCKED — pre-existing test failure blocks slice execution`

---

## Phase 2 — Test Plan

Create a test checklist before writing tests.

Output:

| Test ID | Behavior | Test Type | File | Expected RED Failure | Required For |
|---|---|---|---|---|---|

Include applicable tests:

- happy path
- error path
- role allow
- role deny
- unauthenticated access
- ownership rule if applicable
- frontend interaction
- form validation
- modal confirmation
- table/list action
- backend/API behavior
- frontend/backend integration
- journey-level proof
- E2E/Playwright proof if required
- regression guard for the original bug

Use the correct test type:

| Behavior | Preferred Test Type |
|---|---|
| Pure logic | Unit |
| UI component behavior | Component |
| Form validation | Component or integration |
| API endpoint behavior | Integration/API |
| Role permission enforcement | API/integration plus frontend role test |
| Full user workflow | E2E |
| Navigation smoke | E2E or route integration |
| Broken link detection | E2E / Playwright |
| Frontend/backend contract | Integration/contract |
| Accessibility of controls | Component/accessibility test |
| Cross-module workflow | E2E |
| Critical backend state reflected in UI | E2E plus API/integration |

Do not make everything E2E.

Do not rely only on E2E if a lower-level test is needed.

Do not rely only on unit/component tests if the slice requires full journey proof.

---

## Phase 3 — RED

For each test:

1. Write one failing test.
2. Label the test with the related AC/BR/Journey/Finding ID.
3. Run the test.
4. Confirm it fails for the expected reason.
5. Record the RED output.
6. Do not write implementation before RED is confirmed.

Expected labels:

- `AC-[ID]`
- `BR-[ID]`
- `JOURNEY-[ID]`
- `FINDING-[ID]`
- `PERMISSION-[ID]`
- `E2E-[ID]`

Output:

| Test ID | Test File | Related ID | RED Command | Expected Failure | Actual Failure | RED Valid? |
|---|---|---|---|---|---|---|

If the test passes before implementation, it is not a valid RED test.

If the test fails for syntax/import/setup reasons unrelated to the behavior, fix the test setup until the failure proves the intended missing behavior.

If a valid RED failure cannot be produced, stop and explain why.

---

## Phase 4 — GREEN

For each valid RED test:

1. Implement the minimum code needed.
2. Run the test again.
3. Confirm it passes.
4. Do not add extra features.
5. Do not broaden scope.

Output:

| Test ID | Implementation Files | GREEN Command | GREEN Result | Notes |
|---|---|---|---|---|

If implementation requires changing behavior beyond the selected slice, stop and mark:

`BLOCKED — implementation scope exceeds selected slice`

---

## Phase 5 — REFACTOR

Refactor only if needed.

Rules:

1. Clean up only within selected slice scope.
2. Keep behavior unchanged.
3. Rerun relevant tests.
4. Do not refactor unrelated code.

Output:

| Refactor | Files | Reason | Tests Re-run | Result |
|---|---|---|---|---|

If no refactor is needed, state:

`No refactor needed.`

---

## Phase 6 — E2E / Playwright Execution

Run this phase if the selected slice requires E2E.

If E2E is required, identify or create the E2E test that proves the journey.

The E2E test must cover:

- correct role/login state
- start route
- navigation or user action
- expected UI result
- backend/API result if observable
- final route or final state
- failure/permission behavior if required

Output:

| E2E Test ID | Journey | Role | Test File | Start Route | Steps | Expected Final State | Command | Result |
|---|---|---|---|---|---|---|---|---|

E2E coverage quality must be STRONG.

Page-load-only or text-exists-only tests are not enough for critical journeys.

If E2E is required but no E2E framework exists, stop and mark:

`BLOCKED — E2E infrastructure required before slice completion`

Unless the selected slice is specifically the E2E infrastructure setup slice.

---

## Phase 7 — REGRESSION

Run regression checks.

Run all that apply:

- affected unit tests
- affected component tests
- affected API/integration tests
- affected E2E tests if applicable
- related permission tests
- related journey tests
- lint
- typecheck
- build
- full test suite if practical

Output:

| Command | Scope | Result | Notes |
|---|---|---|---|

If a regression is introduced, fix it before proceeding.

If a pre-existing unrelated failure remains, document it clearly and do not claim full suite pass.

---

## Phase 8 — Proof

Create or update:

`docs/execution/slices/[slice-name]/TDD_PROOF.md`

If the project uses the mapping-audit structure, also place or mirror proof under:

`/doc/audits/mapping-audit/results/slices/[slice-name]/TDD_PROOF.md`

Include all sections below.

---

# TDD_PROOF.md Required Content

## Slice Summary

| Field | Value |
|---|---|
| Slice | |
| Module/Area | |
| Roles | |
| Routes | |
| APIs | |
| Components | |
| E2E Required? | YES / NO |

## Scope

| Included | Excluded |
|---|---|

## Spec/Journey/Finding Items Covered

| ID | Description | Test File | Test Type | Status |
|---|---|---|---|

## Test Plan

| Test ID | Behavior | Test Type | File | Required For |
|---|---|---|---|---|

## RED-GREEN Proof

| Test ID | RED Result | GREEN Result | Notes |
|---|---|---|---|

## E2E Proof

| E2E Test ID | Required? | Test File | Command | Result | Coverage Quality |
|---|---|---|---|---|---|

## Regression Results

| Command | Result | Notes |
|---|---|---|

## Files Changed

| File | Reason |
|---|---|

## Remaining Gaps

| Gap | Severity | Reason Not Fixed | Follow-up Needed |
|---|---|---|---|

## Product Decisions / Assumptions

| Item | Decision / Assumption | Risk |
|---|---|---|

## Completion Decision

State one:

- PASS — slice completed with required test proof
- BLOCKED — missing spec/product decision
- BLOCKED — failing tests remain
- BLOCKED — uncovered P0/P1 item remains
- BLOCKED — E2E required but missing
- BLOCKED — regression introduced
- BLOCKED — scope exceeded

---

# Completion Gate

Before marking the slice complete, verify:

| Completion Requirement | Result | Evidence |
|---|---|---|
| All selected AC items covered | PASS / BLOCKED | |
| All selected BR items covered | PASS / BLOCKED | |
| All selected permission rules covered | PASS / BLOCKED | |
| All selected journey steps covered | PASS / BLOCKED | |
| Required unit/component/API tests pass | PASS / BLOCKED | |
| Required E2E tests pass if applicable | PASS / BLOCKED | |
| Regression checks pass or pre-existing failures documented | PASS / BLOCKED | |
| TDD proof created/updated | PASS / BLOCKED | |
| No unrelated files modified | PASS / BLOCKED | |
| No P0/P1 item remains unresolved or untested | PASS / BLOCKED | |

If any item is BLOCKED, the slice is not complete.

---

# Final Output

After execution, output:

## Execution Summary

| Item | Result |
|---|---|
| Slice | |
| Completion Decision | PASS / BLOCKED |
| Tests Added/Updated | |
| Source Files Changed | |
| E2E Added/Updated | |
| Regression Result | |
| Proof File | |

## Commands Run

| Command | Result |
|---|---|

## Remaining Gaps

| Gap | Severity | Follow-up |
|---|---|---|

## Next Recommended Action

State one:

- proceed to next stabilization slice
- rerun failed tests
- resolve product decision
- create E2E infrastructure slice
- rerun audit for affected module
- stop due to blocker

---

# Final Rule

If any P0/P1 issue in the selected slice remains untested or unresolved, do not mark the slice complete.

If E2E is required for the selected slice and no passing E2E proof exists, do not mark the slice complete.

If the implementation changed behavior outside the selected slice, do not mark the slice complete.

If the RED-GREEN proof is missing, do not mark the slice complete.
