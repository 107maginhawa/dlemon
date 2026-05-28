# Role-Based Journey Mapping Audit

Use the Master Audit Rules.

Audit in read-only mode. Do not modify code.

## Goal

Map real user journeys by role across frontend routes, UI actions, backend APIs, permissions, tests, and E2E/Playwright coverage.

This audit must determine whether each role can actually complete the workflows they are supposed to complete.

The audit must also identify which journeys require E2E coverage because they involve real navigation, role-based access, frontend/backend integration, form submission, workflow state changes, or cross-module movement.

---

# Scope

Run this audit for the current module/area assigned by the orchestrator.

Do not audit the whole app globally unless the orchestrator explicitly assigned this as a global/shared area.

If this module/area is part of a cross-module workflow, document the external modules it depends on, but do not fully audit those external modules unless the orchestrator has assigned them.

If a journey crosses module boundaries, mark it as:

`[CROSS-MODULE JOURNEY]`

and carry it forward to the global stabilization plan.

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
- `[CROSS-MODULE JOURNEY]`
- `[E2E REQUIRED]`
- `[E2E GAP]`

Do not assume current behavior is correct product truth.

---

# Tasks

## 1. Identify Roles Involved

Identify all roles that interact with this module/area.

Sources to inspect:

- auth schema
- role constants/enums
- route guards
- middleware
- UI conditionals
- backend permission checks
- tests
- E2E tests
- seed data
- documentation/specs if available

For each role, identify:

- routes accessible
- actions visible
- actions allowed
- actions denied
- backend/API permissions
- tests found
- E2E tests found
- unclear or inferred permissions

Output:

| Role | Source | Routes | Actions | Backend Permissions | Tests Found | E2E Tests Found | Notes |
|---|---|---|---|---|---|---|---|

---

## 2. Identify Key Journeys

For each role, identify key journeys in this module/area.

Include journeys such as:

- login/access if relevant
- dashboard landing
- search/list
- create record
- view record
- edit record
- delete/archive/cancel
- submit/approve/finalize
- export/print/download
- settings/configuration
- role-specific workflows
- navigation from another module into this module
- navigation from this module into another module
- cross-module handoffs
- backend-driven state changes visible in the UI

For each journey, determine:

- role
- starting route
- ending route/final state
- preconditions
- required data
- step-by-step path
- routes involved
- buttons/links/forms used
- modals used
- table/list actions used
- APIs used
- data created/updated/deleted
- expected final UI state
- expected backend/data state
- error/edge cases
- permission checks
- current tests
- existing E2E tests
- missing tests
- missing E2E coverage

Output:

| Journey | Role | Start Route | End State | Preconditions | Routes | UI Actions | APIs | Existing Tests | Existing E2E | Criticality |
|---|---|---|---|---|---|---|---|---|---|---|

---

## 3. Map Journey Steps

For each journey, map the actual step-by-step path.

Use this format:

| Step | Route/Page | UI Action | Component/File | API/Backend Call | Expected Result | Evidence | Status |
|---|---|---|---|---|---|---|---|

Status must be one of:

- WORKING
- LIKELY WORKING BUT UNTESTED
- BROKEN
- INCOMPLETE
- UNCLEAR
- NOT IMPLEMENTED
- NEEDS PRODUCT DECISION

Each step should identify whether it is covered by:

- unit test
- component test
- API/integration test
- E2E test
- no test

---

## 4. Identify Broken Journeys

Identify journeys that cannot be completed or are risky.

Examples:

- cannot start journey
- blocked by broken link
- route missing
- route parameter missing or undefined
- button does nothing
- placeholder handler
- wrong role visibility
- correct role blocked
- API fails
- missing API
- frontend/backend mismatch
- missing data state
- no success confirmation
- no error handling
- no loading state
- no permission denial state
- journey only works with mock data
- no test coverage
- no E2E coverage for a critical journey

Output:

| ID | Journey | Role | Broken Step | Evidence | Severity | Recommended Fix | Recommended Test Type |
|---|---|---|---|---|---|---|---|

---

## 5. Classify Journey Criticality

Classify each journey as:

- CRITICAL — core workflow, security, data integrity, revenue, operational, or release-blocking
- IMPORTANT — important workflow but not immediately blocking
- SECONDARY — useful but not core
- ADMIN/CONFIG — setup or management workflow
- UNCLEAR — needs product decision

Output:

| Journey | Role | Criticality | Reason | Required Test Level | E2E Required? |
|---|---|---|---|---|---|

---

# E2E / Playwright Journey Requirement

For each role-based journey, decide whether it requires E2E coverage.

A journey requires E2E coverage if it includes:

- multiple routes
- role-based access
- frontend/backend interaction
- form submission
- modal confirmation
- table/list workflow
- workflow state change
- cross-module navigation
- critical business outcome
- common user path likely to break through routing/link changes
- backend state change that must be reflected in the UI

For each journey, document:

| Journey | Role | Requires E2E? | Reason | Suggested E2E Test | Setup Data Needed | Expected Final UI State | Expected Backend/Data State |
|---|---|---|---|---|---|---|---|

Classify existing E2E coverage:

- STRONG = covers real role-specific journey with navigation, user action, backend/API result, and expected final state
- WEAK = only checks page load, text existence, or superficial navigation
- NONE = no E2E coverage found

Critical journeys with no E2E coverage must be marked at least P1.

Critical role-access journeys with no E2E or integration/API allow/deny coverage must be marked P0 or P1 depending on risk.

---

# E2E / Playwright Inspection

Check whether the project has an E2E framework such as Playwright, Cypress, WebdriverIO, Selenium, or equivalent.

Inspect:

- `playwright.config.*`
- `cypress.config.*`
- `e2e/`
- `tests/e2e/`
- `*.e2e.*`
- `*.spec.*` used for E2E
- package.json E2E scripts
- CI workflow E2E commands
- test fixtures for logged-in users
- test seed/setup for E2E
- test database strategy for E2E

For this module/area, identify:

1. Existing E2E tests
2. Critical journeys without E2E coverage
3. Navigation paths without smoke tests
4. Role-based route access not tested
5. Broken-link detection coverage
6. Form submission journeys not tested
7. Modal confirmation journeys not tested
8. Table/list workflows not tested
9. Cross-module workflows not tested
10. Whether E2E is included in CI

Output:

| Module/Area | E2E Framework Found? | Existing E2E Tests | Critical Journeys Needing E2E | Navigation Smoke Coverage | Role Access E2E Coverage | Gap Severity |
|---|---|---|---|---|---|---|

---

# Navigation Smoke Requirement

For this module/area, identify navigation paths that should have smoke coverage.

Include:

- sidebar links
- topbar links
- breadcrumbs
- dashboard cards
- quick action buttons
- table row links
- detail page links
- back/cancel links
- cross-module links
- role-specific menu links

For each path, recommend whether it needs E2E coverage.

Output:

| Nav Path | Source Route | Target Route | Role | Existing Test | Existing E2E | Needs E2E Smoke? | Severity |
|---|---|---|---|---|---|---|---|

---

# Role Access Journey Requirement

For every role-restricted route or journey, check whether there is test coverage for:

- allowed role
- denied role
- unauthenticated user
- ownership restriction if applicable
- direct URL access
- UI visibility
- backend/API enforcement
- E2E route-access coverage if the route is critical

Output:

| Route/Journey | Role | Should Allow? | Frontend Test | API/Integration Test | E2E Test | Gap | Severity |
|---|---|---|---|---|---|---|---|

---

# Test Mapping

For each journey, identify existing tests and missing tests.

Test types:

- unit
- component
- integration/API
- E2E
- permission/security
- accessibility

Output:

| Journey | Unit Tests Needed | Component Tests Needed | API/Integration Tests Needed | E2E Tests Needed | Priority |
|---|---|---|---|---|---|

Do not recommend E2E for every small behavior.

Use E2E for:

- critical workflows
- multi-route flows
- role-based route access
- broken link/navigation detection
- frontend/backend integrated flows
- cross-module workflows
- critical form submission journeys
- important modal confirmation journeys

Use component tests for:

- small button behavior
- modal open/close
- field validation
- disabled states
- local UI state
- UI accessibility

Use API/integration tests for:

- backend permissions
- request/response contracts
- validation
- data persistence
- state transitions
- error responses

---

# Required Output

Create the following sections.

## 1. Role Journey Summary

| Role | Journeys Found | Critical Journeys | Broken Journeys | E2E Gaps |
|---|---|---|---|---|

## 2. Journey Registry

| Journey | Role | Start Route | End State | Routes | UI Actions | APIs | Existing Tests | Existing E2E | Criticality |
|---|---|---|---|---|---|---|---|---|---|

## 3. Step-by-Step Journey Maps

Use one table per journey.

Each table must include:

| Step | Route/Page | UI Action | Component/File | API/Backend Call | Expected Result | Evidence | Status |
|---|---|---|---|---|---|---|---|

## 4. Broken Journey Report

| ID | Journey | Role | Broken Step | Evidence | Severity | Recommended Fix | Recommended Test Type |
|---|---|---|---|---|---|---|---|

## 5. E2E Journey Coverage Matrix

| Journey | Role | Requires E2E? | Existing E2E Test | Coverage Quality | Missing Assertions | Severity |
|---|---|---|---|---|---|---|

## 6. Navigation Smoke Coverage Matrix

| Nav Path | Source Route | Target Route | Role | Existing Test | Existing E2E | Needs E2E Smoke? | Severity |
|---|---|---|---|---|---|---|---|

## 7. Role Access Coverage Matrix

| Route/Journey | Role | Should Allow? | Frontend Test | API/Integration Test | E2E Test | Gap | Severity |
|---|---|---|---|---|---|---|---|

## 8. Journey Test Matrix

| Journey | Unit Tests Needed | Component Tests Needed | API/Integration Tests Needed | E2E Tests Needed | Priority |
|---|---|---|---|---|---|

## 9. Product Decisions Needed

| Question | Journey | Role | Affected Route/API/Component | Why Needed |
|---|---|---|---|---|

## 10. Gate 7 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|---|---|---|---|---|
| Gate 7 | [Module/Area] | PASS / BLOCKED | [evidence] | [missing items] |

Gate 7 may only PASS if:

- journeys are mapped by role
- starting routes are identified
- journey steps are listed
- UI actions are linked
- APIs are linked
- expected final states are defined
- broken steps are identified
- missing tests are listed
- E2E-required journeys are identified
- existing E2E coverage is classified
- journey criticality is assigned

Do not fix anything.
