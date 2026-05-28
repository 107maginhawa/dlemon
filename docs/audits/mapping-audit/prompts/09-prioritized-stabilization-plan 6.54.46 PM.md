# Prioritized Stabilization Plan

Use the Master Audit Rules.

Do not modify code yet.

## Goal

Consolidate all audit findings into a practical implementation roadmap.

This plan must convert the full mapping audit into prioritized, executable stabilization slices.

The goal is not just to list issues. The goal is to create a safe execution path that improves TDD confidence across:

- roles
- routes
- navigation
- buttons
- links
- forms
- modals
- table/list actions
- backend APIs
- permissions
- business rules
- role-based journeys
- E2E/Playwright coverage
- frontend/backend alignment
- CI/release gates

This plan must be global.

It must consolidate findings across all module-level audits and shared/global areas.

Do not modify code.

---

# Inputs to Use

Use the outputs from:

- Brownfield Baseline Audit
- Module Audit Queue
- Role Permission Map Audit
- Route Navigation Audit
- Frontend Interaction Integrity Audit
- Form/Modal/Table Action Audit
- Backend/API Contract Alignment Audit
- Role-Based Journey Map Audit
- Test Confidence Gap Audit
- Module Audit Summaries
- E2E / Playwright Coverage Findings
- OLI audit outputs if available:
  - `/oli-audit-codebase`
  - `/oli-audit-compliance`
  - `/oli-confidence-stack`
  - `/oli-execution-gate`

If an expected audit output is missing, do not invent findings.

Mark the missing input as:

`[MISSING AUDIT INPUT]`

and decide whether implementation readiness should be blocked.

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
- `[WEAK TEST]`
- `[NO TEST FOUND]`
- `[MISSING AUDIT INPUT]`
- `[BLOCKS IMPLEMENTATION]`

---

# Tasks

## 1. Consolidate All Findings

Consolidate all findings from all audit outputs.

Include:

- P0 findings
- P1 findings
- P2 findings
- P3 findings
- broken journeys
- broken routes
- broken links
- broken buttons
- broken forms
- broken modals
- broken table/list actions
- frontend/backend mismatches
- role permission gaps
- missing tests
- weak tests
- missing E2E tests
- weak E2E tests
- missing CI/release gates
- missing product decisions
- unclear intended behavior

Output:

| ID | Finding | Module/Area | Role | Route/API/Component | Journey | Severity | Source Audit | Evidence |
|---|---|---|---|---|---|---|---|---|

---

## 2. Deduplicate Overlapping Issues

Deduplicate issues that appear across multiple audits.

Examples:

- broken button also appears as broken journey
- missing API also appears as frontend/backend mismatch
- missing permission test also appears as test confidence gap
- missing E2E journey also appears as journey audit gap
- broken link appears in both route audit and journey audit

For each duplicate group, identify the canonical issue.

Output:

| Canonical ID | Duplicate IDs | Consolidated Finding | Primary Module | Severity | Reason |
|---|---|---|---|---|---|

---

## 3. Group Findings

Group findings by:

- module/area
- role
- journey
- route
- component
- backend/API
- permission rule
- test type
- E2E requirement
- severity
- implementation slice

Output:

| Group | Findings | Severity Range | Owner Area | Notes |
|---|---|---|---|---|

---

## 4. Classify Severity

Use this severity system:

## P0 — Critical

Use for:

- broken critical journey
- security/auth risk
- role bypass
- wrong role can access restricted action
- data integrity risk
- destructive action unsafe
- frontend allows action backend should block
- backend allows action frontend hides for safety
- core workflow impossible to complete
- critical role-based route has no backend enforcement
- critical role-based route has no allow/deny coverage
- test suite cannot run at all
- critical journey requires E2E but no E2E gap was previously captured

## P1 — Major

Use for:

- important workflow gap
- missing test for critical behavior
- missing E2E test for critical journey
- frontend/backend mismatch
- untested permission rule
- broken non-critical but important action
- missing API error handling for important flow
- weak E2E coverage for important journey
- main navigation lacks smoke coverage
- important API lacks validation/error test

## P2 — Minor

Use for:

- weak test
- render-only test
- page-load-only E2E for non-critical journey
- missing loading/error/empty state
- inconsistent naming
- incomplete but non-blocking UI behavior
- accessibility issue not blocking core use
- missing CI E2E step for non-critical journeys

## P3 — Cleanup / Documentation

Use for:

- documentation improvements
- minor refactor
- low-risk consistency issue
- naming cleanup
- optional E2E coverage for non-critical convenience journey
- test organization cleanup

Output:

| Finding ID | Severity | Reason | Release Impact | Blocks Implementation? |
|---|---|---|---|---|

---

## 5. Identify P0 Fix-First Items

Identify all P0 items that must be fixed first.

For each P0 item, define:

- why it is critical
- affected module
- affected role
- affected route/API/component
- affected journey
- required tests
- required E2E if applicable
- whether product decision is needed
- suggested stabilization slice

Output:

| ID | Issue | Why Critical | Affected Area | Required Test | E2E Required? | Product Decision Needed? | Suggested Slice |
|---|---|---|---|---|---|---|---|

---

## 6. Identify P1 Fix-Before-New-Work Items

Identify P1 items that should be fixed before major new feature work.

For each P1 item, define:

- why it matters
- affected module
- affected role
- affected route/API/component
- affected journey
- required tests
- required E2E if applicable
- suggested stabilization slice

Output:

| ID | Issue | Why Important | Affected Area | Required Test | E2E Required? | Suggested Slice |
|---|---|---|---|---|---|---|

---

## 7. Identify P2 and P3 Items

Identify P2 and P3 items that can be addressed during normal module work.

Output:

## P2 — Improve During Module Work

| ID | Issue | Required Test | Suggested Timing |
|---|---|---|---|

## P3 — Cleanup / Documentation

| ID | Issue | Recommendation |
|---|---|---|

---

# Vertical Slice Planning

## 8. Create Stabilization Slices

Create practical vertical slices that can be implemented safely using the TDD Execution Gate.

Each slice should be small enough to execute and verify.

Each slice should group related findings around a real behavior or journey, not random files.

Good slice examples:

- Fix role-based access for Patient Management routes
- Stabilize create-patient journey from list to profile
- Add navigation smoke coverage for App Shell
- Align frontend save form with backend API validation
- Add Playwright E2E for critical admin approval journey
- Fix table row actions and corresponding API tests
- Add missing allow/deny tests for restricted settings routes

Bad slice examples:

- “Fix all tests”
- “Improve frontend”
- “Clean up routes”
- “Add Playwright”
- “Fix module”

For each slice, define:

- slice name
- goal
- findings covered
- scope
- affected files if known
- affected module/area
- affected roles
- affected routes
- affected APIs
- affected UI actions
- acceptance criteria
- business rules
- permission rules
- required tests
- required E2E tests
- execution order
- risk
- dependencies
- product decisions required

Output:

| Slice | Goal | Findings Covered | Scope | Roles | Routes | APIs | Tests Required | E2E Required | Priority |
|---|---|---|---|---|---|---|---|---|---|

---

## 9. Define Slice Acceptance Criteria

For each recommended slice, define acceptance criteria.

Use clear, testable language.

Output:

| Slice | AC ID | Acceptance Criteria | Required Test Type |
|---|---|---|---|

Acceptance criteria should cover:

- happy path
- role allow
- role deny
- validation/error path
- expected final UI state
- expected backend/API state
- E2E path if required

---

## 10. Define Required Test Strategy Per Slice

For each slice, recommend the right test mix.

Test types:

- unit
- component
- integration/API
- E2E/Playwright
- permission/security
- accessibility
- CI/release gate

Output:

| Slice | Unit Tests | Component Tests | API/Integration Tests | E2E/Playwright Tests | Permission Tests | CI/Gate Updates |
|---|---|---|---|---|---|---|

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
- workflows where backend state must be reflected in the UI

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

# E2E / Playwright Stabilization Plan

## 11. Consolidate E2E Gaps

Consolidate all missing or weak E2E coverage.

Output:

| ID | Journey/Nav Path | Module/Area | Role | Current E2E Coverage | Required E2E Test | Severity | Suggested Slice |
|---|---|---|---|---|---|---|---|

## 12. Identify E2E Infrastructure Gaps

Identify whether the project has the required E2E infrastructure.

Check:

- Playwright/Cypress/equivalent installed
- config exists
- local script exists
- CI script exists
- login/session fixture exists
- seed data strategy exists
- test database strategy exists
- stable selectors/test IDs strategy exists
- screenshots/videos/traces configured if applicable

Output:

| E2E Infrastructure Item | Status | Gap | Severity | Suggested Slice |
|---|---|---|---|---|

## 13. Recommend First E2E Tests

Recommend the first E2E tests to add.

Prioritize:

1. app shell/main navigation smoke
2. auth/login/session journey
3. role-based route access
4. most critical module journey
5. most critical cross-module workflow
6. most common form submission journey

Output:

| Priority | E2E Test | Role | Start Route | Steps | Expected Final State | Why First |
|---|---|---|---|---|---|---|

---

# Product Decisions and Spec Gaps

## 14. Identify Product Decisions Needed

Identify issues that should not be fixed until intended behavior is clarified.

Examples:

- unclear role permissions
- unclear redirect behavior
- unclear button purpose
- unclear final state after save
- unclear whether route should exist
- unclear whether backend or frontend behavior is source of truth
- unclear whether journey should be supported

Output:

| Question | Affected Area | Why Needed | Suggested Owner | Blocks Which Slice? |
|---|---|---|---|---|

## 15. Identify Spec Gaps

Identify missing documentation/spec gaps that block confident implementation.

Output:

| Spec Gap | Affected Module/Journey | Risk | Suggested Spec Artifact | Blocks Implementation? |
|---|---|---|---|---|

---

# Execution Readiness

## 16. Implementation Readiness Assessment

State whether implementation can begin.

Implementation is READY only if:

- all P0/P1 findings are captured
- first stabilization slices are defined
- each first slice has scope
- each first slice has required tests
- E2E requirements are identified
- blocking product decisions are listed
- no audit gate remains blocked for the selected slice
- the next execution prompt is clear

Implementation is NOT READY if:

- module audits are incomplete
- P0/P1 findings are not consolidated
- critical journeys are not mapped
- E2E-required journeys are not identified
- product decisions block first slice
- no vertical slice is defined
- test strategy is vague
- required evidence is missing

Output:

| Readiness Item | Status | Evidence | Notes |
|---|---|---|---|

Then state:

`Implementation Readiness: READY`

or

`Implementation Readiness: NOT READY`

---

# Required Output

Create the following sections.

## 1. Executive Summary

Short summary of current health and most urgent risks.

Include:

- overall risk level
- number of P0 findings
- number of P1 findings
- number of broken critical journeys
- number of E2E-required journeys without coverage
- whether implementation is ready

## 2. Consolidated Findings

| ID | Finding | Module | Role | Route/API/Component | Journey | Severity | Source Audit | Evidence |
|---|---|---|---|---|---|---|---|---|

## 3. Deduplicated Findings

| Canonical ID | Duplicate IDs | Consolidated Finding | Primary Module | Severity | Reason |
|---|---|---|---|---|---|

## 4. P0 — Fix First

| ID | Issue | Why Critical | Affected Area | Required Test | E2E Required? | Suggested Slice |
|---|---|---|---|---|---|---|

## 5. P1 — Fix Before Major New Work

| ID | Issue | Why Important | Affected Area | Required Test | E2E Required? | Suggested Slice |
|---|---|---|---|---|---|---|

## 6. P2 — Improve During Module Work

| ID | Issue | Required Test | Suggested Timing |
|---|---|---|---|

## 7. P3 — Cleanup / Documentation

| ID | Issue | Recommendation |
|---|---|---|

## 8. Recommended Vertical Slices

| Slice | Goal | Findings Covered | Scope | Roles | Routes | APIs | Tests Required | E2E Required | Priority |
|---|---|---|---|---|---|---|---|---|---|

## 9. Slice Acceptance Criteria

| Slice | AC ID | Acceptance Criteria | Required Test Type |
|---|---|---|---|

## 10. Slice Test Strategy

| Slice | Unit Tests | Component Tests | API/Integration Tests | E2E/Playwright Tests | Permission Tests | CI/Gate Updates |
|---|---|---|---|---|---|---|

## 11. E2E / Playwright Gap Plan

| ID | Journey/Nav Path | Module/Area | Role | Current E2E Coverage | Required E2E Test | Severity | Suggested Slice |
|---|---|---|---|---|---|---|---|

## 12. E2E Infrastructure Gaps

| E2E Infrastructure Item | Status | Gap | Severity | Suggested Slice |
|---|---|---|---|---|

## 13. Recommended First E2E Tests

| Priority | E2E Test | Role | Start Route | Steps | Expected Final State | Why First |
|---|---|---|---|---|---|---|

## 14. Product Decisions Needed

| Question | Affected Area | Why Needed | Suggested Owner | Blocks Which Slice? |
|---|---|---|---|---|

## 15. Spec Gaps

| Spec Gap | Affected Module/Journey | Risk | Suggested Spec Artifact | Blocks Implementation? |
|---|---|---|---|---|

## 16. Implementation Readiness

| Readiness Item | Status | Evidence | Notes |
|---|---|---|---|

State one:

- `Implementation Readiness: READY`
- `Implementation Readiness: NOT READY`

If READY, identify the first slice to execute using the TDD Execution Gate.

If NOT READY, identify exactly what must be resolved first.

## 17. Next Allowed Prompt

State the exact next prompt to run.

If implementation is ready:

```txt
/doc/audits/mapping-audit/prompts/10-tdd-execution-gate-prompt.md
