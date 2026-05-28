# Test Confidence Gap Audit

Use the Master Audit Rules.

Audit in read-only mode. Do not modify code.

## Goal

Determine whether the existing tests actually prove the important behavior of the system.

Follow the spirit of `/oli-confidence-stack`.

This audit must explicitly evaluate whether tests provide meaningful confidence across:

- business rules
- permissions
- API contracts
- frontend interactions
- forms
- modals
- table/list actions
- role-based journeys
- route/navigation mappings
- E2E/Playwright coverage
- release gate readiness

Line coverage alone is not enough.

A test only counts as meaningful if it asserts a real behavior, outcome, state change, permission result, API response, navigation result, or final UI state.

---

# Scope

Run this audit for the current module/area assigned by the orchestrator.

Do not audit the whole app globally unless the orchestrator explicitly assigned this as a global/shared area.

If this module has no tests, do not skip it.

Mark test coverage as:

`NONE`

and identify the required tests.

If this module has no frontend, backend, or E2E surface, mark the section as:

`NOT APPLICABLE — with evidence`

Do not modify code.

---

# Required Labels

Use these labels where appropriate:

- `[CURRENT BEHAVIOR]`
- `[INTENDED BEHAVIOR]`
- `[LIKELY BUG]`
- `[UNCLEAR]`
- `[NEEDS PRODUCT DECISION]`
- `[NEEDS MANUAL CONFIRMATION]`
- `[E2E REQUIRED]`
- `[E2E GAP]`
- `[WEAK TEST]`
- `[NO TEST FOUND]`

---

# Tasks

## 1. Detect Test Framework and Test Structure

Detect the test framework and test structure for this module/area.

Inspect:

- unit test framework
- component test framework
- integration/API test framework
- E2E framework
- coverage tool
- CI test commands
- package scripts
- test data/fixtures
- mock setup
- test database setup if present

Check for files and folders such as:

- `package.json`
- `vitest.config.*`
- `jest.config.*`
- `playwright.config.*`
- `cypress.config.*`
- `tests/`
- `test/`
- `__tests__/`
- `e2e/`
- `tests/e2e/`
- `*.test.*`
- `*.spec.*`
- `*.e2e.*`
- `.github/workflows/`
- CI config files

Output:

| Test Type | Framework/Tool | Config Found | Test Location | Script | CI Coverage | Notes |
|---|---|---|---|---|---|---|

---

## 2. Detect E2E / Playwright / Cypress Setup

Explicitly check whether the project has an E2E framework such as:

- Playwright
- Cypress
- WebdriverIO
- Selenium
- another equivalent E2E framework

Inspect:

- `playwright.config.*`
- `cypress.config.*`
- `e2e/`
- `tests/e2e/`
- `*.e2e.*`
- `*.spec.*` used for E2E
- package.json E2E scripts
- CI workflow E2E commands
- login/session fixtures
- seed data setup for E2E
- test database strategy for E2E

If no E2E framework exists, flag this as a test infrastructure gap.

Output:

| E2E Tool | Config Found | Local Script | CI Script | Test Location | Status | Gap |
|---|---|---|---|---|---|---|

---

## 3. Build Behavior Inventory

Build a behavior inventory from prior audit outputs or current code.

Include:

- business rules
- permissions
- API endpoints
- state transitions
- frontend interactions
- forms
- modals
- table/list actions
- critical journeys
- role-based access rules
- navigation paths
- broken-link-sensitive paths
- cross-module flows
- E2E-required journeys

Output:

| Behavior ID | Behavior/Journey | Type | Role | Source | Criticality | E2E Required? |
|---|---|---|---|---|---|---|

Behavior Type must be one of:

- Business Rule
- Permission Rule
- API Contract
- State Transition
- UI Interaction
- Form Flow
- Modal Flow
- Table/List Action
- Navigation Path
- Role-Based Journey
- Cross-Module Journey
- E2E Journey

---

## 4. Map Behavior to Tests

For each behavior, identify:

- test owner
- test file
- test type
- assertion quality
- role coverage
- happy path coverage
- error path coverage
- E2E coverage if required

Output:

| Behavior/Journey | Role | Source | Existing Test | Test Type | Assertion Quality | Missing Coverage | Severity |
|---|---|---|---|---|---|---|---|

Assertion quality:

- STRONG = asserts specific business outcome, status, data, state, error, route, permission result, or final UI state
- WEAK = only checks render, truthy, defined, snapshot, text exists, or generic success
- NONE = no test found

---

# E2E / Playwright Coverage Audit

For each module/area, identify:

1. Existing E2E tests
2. Critical journeys without E2E coverage
3. Navigation paths without smoke tests
4. Role-based route access not tested
5. Broken-link detection coverage
6. Button/navigation mapping coverage
7. Form submission journeys not tested
8. Modal confirmation journeys not tested
9. Table/list workflows not tested
10. Cross-module workflows not tested
11. Whether E2E tests are included in CI
12. Whether E2E tests use realistic user events and routes

Classify E2E coverage:

- STRONG = role-specific journey test with navigation, user action, backend/API result, and expected final UI/data state
- WEAK = page-load-only, text-exists-only, screenshot-only, or shallow route smoke test
- NONE = no E2E coverage found

Output:

| Module/Area | Journey/Nav Path | Existing E2E Test | Coverage Quality | Missing Assertions | Recommended E2E Test | Severity |
|---|---|---|---|---|---|---|

Also check whether E2E is included in CI:

| E2E Tool | Config Found | Local Script | CI Script | Status | Gap |
|---|---|---|---|---|---|

---

# E2E Requirements by Behavior Type

Use this guide:

| Behavior Type | E2E Required? | Notes |
|---|---|---|
| Critical user journey | Yes | Must prove real workflow completion |
| Role-based route access | Usually yes | Also needs API/integration allow/deny tests |
| Sidebar/topbar navigation | Yes, smoke level | Main links should not be broken |
| Broken link detection | Yes | Playwright or equivalent preferred |
| Button navigating across routes | Yes if important | Component test if local-only |
| Form submission journey | Yes if critical | Also component/API tests |
| Modal confirmation journey | Yes if destructive or critical | Component + E2E if important |
| Table/list workflow | Yes if important | Especially row actions, bulk actions, pagination |
| Cross-module workflow | Yes | Must prove modules connect |
| Pure business logic | No | Unit test |
| API validation | No | API/integration test |
| Component state only | No | Component test |

---

## 5. Classify Assertion Quality

For all test files, classify assertion quality.

STRONG examples:

- checks exact status code
- checks exact role outcome
- checks denied access
- checks redirect
- checks database/state change
- checks final UI state
- checks error message
- checks specific response shape
- checks form validation result
- checks modal confirmation effect
- checks navigation target
- checks button action result
- checks backend state reflected in UI

WEAK examples:

- `toBeTruthy()`
- `toBeDefined()`
- render-only tests
- snapshot-only tests
- page-load-only E2E tests
- text-exists-only E2E tests
- checks component exists but not behavior
- mocked success path only
- route loads but no journey/action assertion

Output:

| Test File | Test Type | Strong Assertions | Weak Assertions | Coverage Quality | Notes |
|---|---|---|---|---|---|

---

## 6. Check Common Bad Test Patterns

Identify:

- render-only tests
- snapshot-only tests
- over-mocked tests
- no user-event/click tests
- no role denial tests
- no API error tests
- no form validation tests
- no modal confirmation tests
- no table/list action tests
- no navigation smoke tests
- no broken-link tests
- skipped tests
- flaky sleeps/timeouts
- shared mutable test data
- tests not tied to behavior
- E2E tests that only check page load
- E2E tests that only check text exists
- E2E tests not included in CI
- tests that mock the exact thing they claim to prove

Output:

| Test File | Bad Pattern | Why It Is Weak/Risky | Recommended Improvement | Severity |
|---|---|---|---|---|

---

## 7. Check Role and Permission Tests

Check whether role and permission behavior is tested.

For every role-restricted route/action/API/journey, verify:

- allow test exists
- deny test exists
- unauthenticated test exists
- wrong-role test exists
- ownership test exists if applicable
- direct URL access test exists if route-protected
- backend/API enforcement test exists
- E2E route-access test exists if the route/journey is critical

Output:

| Route/API/Journey | Role | Allow Test | Deny Test | Unauthenticated Test | Ownership Test | E2E Test | Gap | Severity |
|---|---|---|---|---|---|---|---|---|

---

## 8. Check Frontend Journey Tests

Check whether frontend journey behavior is tested.

Inspect for:

- navigation smoke tests
- critical E2E tests
- form submission tests
- broken button/link coverage
- loading states
- error states
- empty states
- success states
- forbidden/unauthorized states
- modal confirmation tests
- table/list action tests
- accessibility basics

Output:

| Journey/Interaction | Existing Test | Existing E2E | Missing State/Path | Recommended Test Type | Severity |
|---|---|---|---|---|---|

---

## 9. Check API and Backend Test Coverage

For backend/API behavior, check:

- endpoint happy path
- request validation
- response shape
- auth required
- role allowed
- role denied
- ownership check
- not found
- conflict/duplicate
- invalid state transition
- database side effect
- error response shape

Output:

| API/Backend Behavior | Existing Test | Assertion Quality | Missing Coverage | Recommended Test Type | Severity |
|---|---|---|---|---|---|

---

## 10. Check CI and Release Gate Readiness

Check whether the project has CI/release gates.

Inspect:

- `.github/workflows/`
- `.gitlab-ci.yml`
- CI config files
- package scripts
- lint command
- typecheck command
- unit test command
- component test command
- integration/API test command
- E2E test command
- build command
- coverage command

Output:

| Gate | Present? | Command/Config | Covers Module? | Gap | Severity |
|---|---|---|---|---|---|

Gates to check:

- lint
- typecheck
- unit tests
- component tests
- integration/API tests
- E2E tests
- build
- coverage report
- security/dependency check if present

---

# Confidence Scoring

Score confidence across four layers.

## Layer 1 — Coverage Integrity

Question:

Does coverage measure meaningful behavior, or only line execution?

Check:

- business rules
- permissions
- API routes
- state transitions
- UI interactions
- journeys
- E2E-required paths

Score:

| Score | Meaning |
|---|---|
| 0–2 | No meaningful coverage |
| 3–4 | Minimal coverage, major gaps |
| 5–6 | Partial coverage, happy paths only |
| 7–8 | Good coverage of most important behaviors |
| 9–10 | Strong behavior-level coverage |

## Layer 2 — Behavior Traceability

Question:

Does every critical behavior have a test owner?

Check:

- behavior-to-test mapping
- permission-to-test mapping
- journey-to-test mapping
- journey-to-E2E mapping
- API-to-test mapping

## Layer 3 — Test Quality

Question:

Are the tests strong enough to prove behavior?

Check:

- assertion quality
- weak tests
- skipped tests
- over-mocking
- flaky patterns
- test data stability

## Layer 4 — Release Gate Readiness

Question:

Would CI/release gates catch regressions?

Check:

- unit tests in CI
- component tests in CI
- API/integration tests in CI
- E2E tests in CI
- build/typecheck/lint in CI
- coverage reporting if available

Output:

| Layer | Score / 10 | Main Gap | Evidence |
|---|---|---|---|

---

# Severity Rules

Use this severity system:

## P0 — Critical

Use for:

- untested auth/permission risk
- missing deny test for critical restricted action
- missing backend enforcement test for critical permission
- critical journey has no meaningful test and no E2E coverage
- data integrity behavior has no test
- test suite cannot run at all
- E2E-required critical role-access journey has no coverage

## P1 — Major

Use for:

- important workflow has no test
- critical journey has only weak/page-load E2E
- important API has no validation/error tests
- role-based route has no allow/deny coverage
- frontend/backend mismatch has no test
- main navigation lacks smoke coverage

## P2 — Minor

Use for:

- weak assertion
- render-only test
- page-load-only E2E for non-critical journey
- missing loading/error/empty state tests
- no CI E2E step for non-critical journeys
- missing accessibility basics

## P3 — Cleanup

Use for:

- naming cleanup
- test organization
- duplicate tests
- outdated skipped tests that are not critical
- low-risk documentation gaps

---

# Required Output

Create the following sections.

## 1. Test Structure Summary

| Test Type | Location | Framework | Count | CI Coverage | Notes |
|---|---|---|---|---|---|

## 2. E2E / Playwright Setup Summary

| E2E Tool | Config Found | Local Script | CI Script | Test Location | Status | Gap |
|---|---|---|---|---|---|---|

## 3. Behavior Inventory

| Behavior ID | Behavior/Journey | Type | Role | Source | Criticality | E2E Required? |
|---|---|---|---|---|---|---|

## 4. Behavior-to-Test Matrix

| Behavior/Journey | Role | Source | Existing Test | Test Type | Assertion Quality | Missing Coverage | Severity |
|---|---|---|---|---|---|---|---|

## 5. E2E Journey Coverage Matrix

| Module/Area | Journey/Nav Path | Existing E2E Test | Coverage Quality | Missing Assertions | Recommended E2E Test | Severity |
|---|---|---|---|---|---|---|

## 6. Role and Permission Test Matrix

| Route/API/Journey | Role | Allow Test | Deny Test | Unauthenticated Test | Ownership Test | E2E Test | Gap | Severity |
|---|---|---|---|---|---|---|---|---|

## 7. Frontend Journey Test Matrix

| Journey/Interaction | Existing Test | Existing E2E | Missing State/Path | Recommended Test Type | Severity |
|---|---|---|---|---|---|

## 8. API and Backend Test Matrix

| API/Backend Behavior | Existing Test | Assertion Quality | Missing Coverage | Recommended Test Type | Severity |
|---|---|---|---|---|---|

## 9. Weak Test Report

| Test File | Weak Pattern | Why It Is Weak | Recommended Improvement | Severity |
|---|---|---|---|---|

## 10. Missing Test Report

| Item | Risk | Recommended Test Type | Suggested Assertion | Priority |
|---|---|---|---|---|

## 11. CI / Release Gate Readiness

| Gate | Present? | Command/Config | Covers Module? | Gap | Severity |
|---|---|---|---|---|---|

## 12. Confidence Score

| Layer | Score / 10 | Main Gap | Evidence |
|---|---|---|---|

## 13. Gate 8 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|---|---|---|---|---|
| Gate 8 | [Module/Area] | PASS / BLOCKED | [evidence] | [missing items] |

Gate 8 may only PASS if:

- test framework is detected or explicitly marked missing
- E2E framework is detected or explicitly marked missing
- test files are categorized
- E2E files are categorized if present
- behavior-to-test mapping is completed
- journey-to-E2E mapping is completed
- STRONG / WEAK / NONE classification is completed
- missing tests are listed
- missing E2E tests are listed
- skipped/flaky/weak tests are flagged
- CI/release gate readiness is checked if CI exists
- E2E CI readiness is checked if CI exists

Do not fix anything.
