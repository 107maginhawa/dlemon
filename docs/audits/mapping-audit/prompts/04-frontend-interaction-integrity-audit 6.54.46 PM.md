# Frontend Interaction Integrity Audit

Use the Master Audit Rules.

Audit in read-only mode. Do not modify code.

## Goal

Find every meaningful clickable/actionable UI element in the current module/area and verify whether it has:

- a clear purpose
- a correct handler
- correct role behavior
- correct route/navigation behavior
- backend/API support where needed
- proper UI states
- accessibility basics
- meaningful test coverage
- E2E/Playwright coverage where the interaction is part of a critical journey or navigation path

This audit must catch broken buttons, broken links, placeholder actions, missing handlers, role mismatches, frontend/backend mismatches, and untested user interactions.

---

# Scope

Run this audit for the current module/area assigned by the orchestrator.

Do not audit the whole app globally unless the orchestrator explicitly assigned this as a global/shared area.

If this module/area has no frontend interaction surface, do not skip silently.

Mark the section as:

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
- `[CROSS-MODULE JOURNEY]`
- `[E2E REQUIRED]`
- `[E2E GAP]`
- `[WEAK TEST]`
- `[NO TEST FOUND]`

---

# Interaction Scope

Audit all meaningful actionable UI elements, including:

- buttons
- icon buttons
- links
- dropdown menu actions
- card actions
- table row actions
- bulk actions
- tabs
- accordions
- stepper controls
- modals
- confirmation actions
- save/cancel/delete/submit buttons
- import/export buttons
- settings actions
- empty-state CTAs
- dashboard CTAs
- row click actions
- keyboard-triggered actions
- command palette actions if present
- navigation buttons
- destructive actions
- role-specific actions

---

# Tasks

## 1. Scan Frontend Files for Actionable Elements

Scan frontend files in scope for:

- `<button>`
- Button components
- icon button components
- links
- anchor tags
- router navigation
- `router.push`
- `router.replace`
- `navigate`
- redirect calls
- `onClick` handlers
- `onSubmit` handlers
- menu item handlers
- command/action arrays
- table action definitions
- modal trigger actions
- confirmation handlers
- form action buttons
- dropdown actions
- row action renderers
- keyboard event handlers
- custom clickable div/span elements

Output:

| Source File | Route/Page | Component | Action Label | Element Type | Handler/Target | Evidence |
|---|---|---|---|---|---|---|

---

## 2. Build the Interaction Registry

For each action, determine:

- unique interaction ID
- label
- component/page
- route
- source file
- affected role/s
- visible condition
- enabled/disabled condition
- handler/function
- navigation target if applicable
- backend/API dependency if any
- expected result
- expected UI state change
- expected backend/data state change if any
- loading state
- error state
- success state
- current test coverage
- current E2E coverage if applicable

Output:

| ID | Route/Page | Component | Action Label | Element Type | Role | Handler | Target/API | Expected Result | Status | Existing Test | Existing E2E |
|---|---|---|---|---|---|---|---|---|---|---|---|

---

## 3. Validate Each Interaction

For each interaction, check whether:

- action has a real handler or target
- handler exists
- handler is wired correctly
- handler is not placeholder-only
- handler is not console.log-only
- handler is not TODO/FIXME-only
- handler does not silently fail
- link target exists
- route params are provided
- dynamic params cannot be undefined
- API call exists if needed
- API payload matches backend expectation
- response handling exists
- error handling exists
- loading state exists where needed
- success confirmation exists where needed
- UI updates after success
- destructive action has confirmation
- double submit is prevented where relevant
- disabled state has clear logic
- role visibility matches permission rules
- backend/API enforces the same permission
- test coverage exists
- E2E coverage exists if interaction is journey-critical

Output:

| ID | Check Area | Result | Evidence | Gap | Severity |
|---|---|---|---|---|---|

Result must be one of:

- PASS
- FAIL
- PARTIAL
- UNCLEAR
- NOT APPLICABLE

---

## 4. Flag Broken or Risky Interactions

Flag issues such as:

- button has no handler
- link has no target
- link points to missing route
- route params may be undefined
- placeholder handler
- console.log-only handler
- TODO/FIXME handler
- disabled forever
- hidden from allowed role
- visible to wrong role
- role can click but backend blocks unexpectedly
- role cannot see but backend allows
- action calls missing API
- action sends wrong payload
- action expects wrong response shape
- action has no loading state
- action has no error state
- action has no success confirmation
- action does not update UI after success
- action can double-submit
- destructive action has no confirmation
- action relies on mock data
- icon button has no accessible name
- custom interactive element lacks keyboard support
- action is untested
- critical journey action has no E2E coverage

Output:

| ID | Issue | File | Route/Page | Component | Role | Evidence | Severity | Recommended Test |
|---|---|---|---|---|---|---|---|---|

---

## 5. Classify Each Interaction

Classify each interaction as:

- WORKING
- LIKELY WORKING BUT UNTESTED
- INCOMPLETE
- BROKEN
- UNCLEAR
- NEEDS PRODUCT DECISION
- NOT APPLICABLE

Output:

| Interaction ID | Classification | Reason | Evidence | Required Follow-up |
|---|---|---|---|---|

---

# Role-Aware Interaction Requirement

For every interaction, determine role behavior.

Check:

- who can see it
- who can use it
- who should be blocked
- whether it is hidden from restricted users
- whether backend/API also blocks restricted users
- whether allow and deny paths are tested
- whether E2E role coverage is needed

Output:

| Interaction | Role | Should See? | Should Use? | Frontend Enforcement | Backend/API Enforcement | Existing Test | Existing E2E | Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|

---

# Frontend/Backend Interaction Mapping

For every interaction that calls or depends on backend behavior, map the frontend to backend.

Output:

| Interaction | Frontend File | Handler | API Endpoint | Payload | Expected Response | Error Handling | Backend Permission | Test Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|

Flag:

- missing endpoint
- wrong endpoint
- wrong method
- wrong payload
- wrong response expectation
- missing validation handling
- missing auth handling
- missing forbidden handling
- missing error state
- frontend/backend permission mismatch

---

# E2E / Playwright Interaction Requirement

For each interaction, decide whether E2E coverage is required.

E2E is required if the interaction:

- navigates across routes
- participates in a critical journey
- submits a critical form
- confirms a destructive action
- changes backend state that must reflect in UI
- starts or completes a cross-module workflow
- controls role-based route access
- is a main dashboard/sidebar/topbar action
- is likely to break due to route mapping changes

E2E is usually not required for:

- purely local UI state
- simple toggle behavior
- isolated component display behavior
- non-critical tooltip/popover behavior

For each E2E-relevant interaction, output:

| Interaction | Role | Route/Page | Requires E2E? | Reason | Existing E2E | E2E Quality | Recommended E2E Test | Severity |
|---|---|---|---|---|---|---|---|---|

Classify E2E quality:

- STRONG = role-specific test clicks the action and verifies route/result/final UI or data state
- WEAK = page-load-only or text-exists-only
- NONE = no E2E coverage found

Critical interactions requiring E2E with no coverage must be marked at least P1.

---

# Accessibility Interaction Requirement

For interactive elements, check basic accessibility:

- accessible name
- keyboard reachable
- keyboard activatable
- visible focus state
- proper button/link semantics
- disabled state announced/clear
- modal trigger/close behavior
- destructive action confirmation clarity
- icon-only button has label

Output:

| Interaction | Accessibility Check | Status | Evidence | Severity |
|---|---|---|---|---|

Status must be:

- PASS
- FAIL
- PARTIAL
- UNCLEAR
- NOT APPLICABLE

---

# Test Recommendation Rules

Recommend the correct test type.

Use component tests for:

- button local behavior
- disabled state
- modal open/close
- dropdown open/select
- field validation
- accessibility basics
- local UI state

Use integration/page tests for:

- page-level data loading
- interaction with mocked API
- form submission with API mock
- error/loading/success states

Use API/integration tests for:

- backend permissions
- request/response contracts
- validation
- persistence
- state transitions
- error responses

Use E2E/Playwright tests for:

- critical workflows
- route navigation from interaction
- role-based route access
- broken-link-sensitive paths
- cross-module workflows
- critical form submission journeys
- destructive modal confirmation journeys
- backend state reflected in UI

Use permission/security tests for:

- allow/deny behavior
- unauthenticated access
- wrong-role access
- ownership restrictions

---

# Severity Guidance

Use the standard severity rules.

## P0

Use for:

- wrong role can trigger restricted critical action
- critical action causes data integrity risk
- destructive action unsafe
- backend allows restricted action
- frontend allows action backend should block
- core workflow blocked by broken interaction

## P1

Use for:

- important button/link/action broken
- critical action lacks meaningful test
- critical journey interaction lacks E2E coverage
- important frontend/backend mismatch
- important action missing error handling
- role visibility mismatch for important action

## P2

Use for:

- weak test
- missing loading/success/error state
- icon button missing accessible name
- custom clickable element lacks keyboard support
- non-critical action untested
- page-load-only E2E for important action

## P3

Use for:

- minor copy/label cleanup
- low-risk documentation
- optional polish
- minor consistency issue

---

# Required Output

Create the following sections.

## 1. Interaction Registry

| ID | Route/Page | Component | Action Label | Element Type | Role | Handler | Target/API | Expected Result | Status | Existing Test | Existing E2E |
|---|---|---|---|---|---|---|---|---|---|---|---|

## 2. Interaction Validation Matrix

| ID | Check Area | Result | Evidence | Gap | Severity |
|---|---|---|---|---|---|

## 3. Broken Interaction Report

| ID | Issue | File | Route/Page | Component | Role | Evidence | Severity | Recommended Test |
|---|---|---|---|---|---|---|---|---|

## 4. Role-Aware Interaction Matrix

| Interaction | Role | Should See? | Should Use? | Frontend Enforcement | Backend/API Enforcement | Existing Test | Existing E2E | Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|

## 5. Frontend/Backend Interaction Mapping

| Interaction | Frontend File | Handler | API Endpoint | Payload | Expected Response | Error Handling | Backend Permission | Test Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|

## 6. E2E Interaction Coverage Matrix

| Interaction | Role | Route/Page | Requires E2E? | Reason | Existing E2E | E2E Quality | Recommended E2E Test | Severity |
|---|---|---|---|---|---|---|---|---|

## 7. Accessibility Interaction Matrix

| Interaction | Accessibility Check | Status | Evidence | Severity |
|---|---|---|---|---|

## 8. Missing Test Matrix

| Interaction | Risk | Recommended Test Type | Suggested Assertion | Priority |
|---|---|---|---|---|

## 9. Product Decisions Needed

| Question | Interaction | Route/Page | Role | Why Needed |
|---|---|---|---|---|

## 10. Gate 4 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|---|---|---|---|---|
| Gate 4 | [Module/Area] | PASS / BLOCKED | [evidence] | [missing items] |

Gate 4 may only PASS if:

- buttons are scanned
- links are scanned
- icon buttons are scanned
- dropdown actions are scanned
- table actions are scanned
- modal triggers are scanned
- CTA actions are scanned
- missing handlers are flagged
- placeholder handlers are flagged
- role visibility issues are flagged
- frontend/backend interaction mapping is checked
- accessibility basics are checked
- interaction test gaps are listed
- E2E coverage is assessed for journey-critical interactions

Do not fix anything.
