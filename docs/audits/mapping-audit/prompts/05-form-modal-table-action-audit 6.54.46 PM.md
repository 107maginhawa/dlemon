# Form, Modal, and Table Action Audit

Use the Master Audit Rules.

Audit in read-only mode. Do not modify code.

## Goal

Deeply audit forms, modals, and table/list actions for the current module/area because these are common sources of broken frontend journeys.

This audit must verify whether each form, modal, and table/list action has:

- clear purpose
- correct role access
- correct validation
- correct handlers
- correct backend/API alignment
- correct loading/error/success states
- duplicate-action protection where needed
- meaningful tests
- E2E/Playwright coverage where the flow is journey-critical

Do not fix anything.

---

# Scope

Run this audit for the current module/area assigned by the orchestrator.

Do not audit the whole app globally unless the orchestrator explicitly assigned this as a global/shared area.

If this module/area has no forms, modals, tables, or list actions, do not skip silently.

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

# Tasks

## 1. Identify All Forms

Identify all forms in the module/area.

Include:

- create forms
- edit forms
- search/filter forms
- login/signup forms
- settings forms
- upload/import forms
- checkout/payment forms if any
- domain-specific workflow forms
- inline edit forms
- modal forms
- multi-step forms
- wizard/stepper forms
- bulk action forms
- confirmation forms
- hidden/system-generated forms if relevant

For each form, identify:

- form name
- route/page
- component/file
- role/s
- purpose
- fields
- submit handler
- API/backend endpoint
- test coverage
- E2E coverage if relevant

Output:

| Form | Route/Page | Component/File | Role | Purpose | Fields | Submit Handler | API | Existing Tests | Existing E2E | Status |
|---|---|---|---|---|---|---|---|---|---|---|

---

## 2. Inspect Each Form

For each form, inspect:

- fields
- required fields
- optional fields
- default values
- derived/computed values
- field-level validation
- form-level validation
- frontend validation schema
- backend validation schema
- submit handler
- cancel handler
- reset behavior
- dirty state
- touched state
- loading state
- validation error state
- API error state
- forbidden/unauthorized state
- success state
- duplicate submission protection
- post-submit navigation
- role access
- disabled fields
- conditional fields
- hidden fields
- file upload behavior if applicable
- optimistic update behavior if applicable
- tests
- E2E coverage if critical

Output:

| Form | Check Area | Status | Evidence | Gap | Severity |
|---|---|---|---|---|---|

Status must be one of:

- PASS
- FAIL
- PARTIAL
- UNCLEAR
- NOT APPLICABLE

---

## 3. Compare Frontend Validation vs Backend Validation

Compare frontend validation against backend/API validation.

Check:

- missing frontend validation
- missing backend validation
- different required fields
- different optional fields
- different field names
- different types
- different allowed values
- different min/max rules
- different date/range rules
- different enum/status values
- different duplicate/conflict handling
- different error handling
- different error messages
- frontend allows invalid payload
- backend rejects payload frontend says is valid
- backend accepts payload frontend blocks
- frontend uses mock schema not aligned with backend

Output:

| Form | Field/Rule | Frontend Says | Backend/API Says | Match? | Severity | Recommended Test |
|---|---|---|---|---|---|---|

---

## 4. Identify All Modals/Dialog Flows

Identify all modals/dialogs in the module/area.

Include:

- create/edit modals
- confirmation dialogs
- delete dialogs
- archive/cancel dialogs
- approval dialogs
- import/export dialogs
- settings dialogs
- detail preview modals
- wizard/stepper modals
- alert dialogs
- drawer panels used as modals

For each modal/dialog, inspect:

- open trigger
- close/cancel behavior
- confirm behavior
- escape key behavior
- outside click behavior
- focus trap
- focus return
- accessible title
- accessible description
- destructive action confirmation
- loading state
- error state
- success state
- backend/API dependency
- role access
- tests
- E2E coverage if journey-critical

Output:

| Modal/Dialog | Route/Page | Component/File | Trigger | Confirm Action | Cancel/Close | Backend/API | Role | Accessibility | Existing Tests | Existing E2E | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|

---

## 5. Inspect Modal/Dialog Behavior

For each modal/dialog, check:

- trigger exists
- trigger is wired
- modal opens
- modal closes
- cancel works
- confirm works
- confirm calls correct handler/API
- destructive confirm is clear
- loading state exists if API-backed
- error state exists if API-backed
- success state exists if API-backed
- modal cannot double-submit destructive action
- escape behavior is correct
- outside click behavior is intentional
- focus trap exists where appropriate
- accessible name/description exists
- role restrictions are correct
- tests exist
- E2E exists if journey-critical

Output:

| Modal/Dialog | Check Area | Status | Evidence | Gap | Severity |
|---|---|---|---|---|---|

---

## 6. Identify All Table/List Actions

Identify all tables, lists, data grids, cards, and collections with actions.

Include:

- row click
- row view
- row edit
- row delete
- row archive
- row approve
- row cancel
- row restore
- row export/download
- row duplicate/copy
- bulk select
- bulk action
- pagination
- sorting
- filtering
- search
- column controls
- empty state CTA
- loading state
- error state
- row-level role restrictions
- table-level role restrictions

For each table/list, identify:

- table/list name
- route/page
- component/file
- data source/API
- row actions
- bulk actions
- role restrictions
- state updates
- tests
- E2E coverage if relevant

Output:

| Table/List | Route/Page | Component/File | Data Source/API | Action | Role | Handler/API | State Updates | Existing Tests | Existing E2E | Status |
|---|---|---|---|---|---|---|---|---|---|---|

---

## 7. Inspect Table/List Behavior

For each table/list action, check:

- data loads
- loading state exists
- empty state exists
- error state exists
- pagination works
- sorting works
- filtering works
- search works
- row click works
- row actions are wired
- bulk select works
- bulk action works
- action calls correct handler/API
- state updates after action
- destructive action confirms
- role restrictions are correct
- row-level permissions are correct
- disabled actions explain why
- tests exist
- E2E exists if action is journey-critical

Output:

| Table/List | Action/State | Status | Evidence | Gap | Severity |
|---|---|---|---|---|---|

---

# Role-Aware Form/Modal/Table Requirement

For every form, modal, and table/list action, determine role behavior.

Check:

- who can see it
- who can use it
- who can submit/confirm/action it
- who should be blocked
- whether frontend hides/disables correctly
- whether backend/API blocks correctly
- whether allow/deny tests exist
- whether E2E role coverage is needed

Output:

| Item | Type | Role | Should See? | Should Use? | Frontend Enforcement | Backend/API Enforcement | Existing Test | Existing E2E | Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|---|

---

# Frontend/Backend Alignment Requirement

For every API-backed form/modal/table action, map frontend behavior to backend/API behavior.

Output:

| Item | Type | Frontend File | Handler | API Endpoint | Payload | Expected Response | Error Handling | Backend Permission | Validation Match? | Test Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|---|---|

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
- frontend/backend validation mismatch

---

# E2E / Playwright Requirement

For each form, modal, and table/list action, decide whether E2E coverage is required.

E2E is required if the item:

- is part of a critical user journey
- submits important data
- changes backend state that must reflect in UI
- confirms a destructive action
- controls role-based route or action access
- moves user across routes
- completes a cross-module workflow
- is a main table/list workflow users rely on
- is likely to break due to route/API/data mapping changes

E2E is usually not required for:

- simple local field display
- isolated validation utility
- non-critical filter behavior
- purely visual modal open/close
- simple component-only state

For each E2E-relevant item, output:

| Item | Type | Role | Route/Page | Requires E2E? | Reason | Existing E2E | E2E Quality | Recommended E2E Test | Severity |
|---|---|---|---|---|---|---|---|---|---|

Classify E2E quality:

- STRONG = role-specific test performs the action and verifies route/result/final UI or data state
- WEAK = page-load-only or text-exists-only
- NONE = no E2E coverage found

Critical form/modal/table flows requiring E2E with no coverage must be marked at least P1.

---

# Accessibility Requirement

Check accessibility basics for forms, modals, and table/list actions.

For forms:

- label association
- error message association
- required field indication
- keyboard navigation
- submit button accessible name
- validation feedback accessible
- disabled state clear

For modals:

- accessible title
- accessible description
- focus trap
- focus return
- escape key behavior
- keyboard close/confirm
- destructive action clarity

For tables/lists:

- row actions have accessible names
- icon buttons labeled
- keyboard reachable actions
- selected state announced if bulk action
- pagination controls labeled

Output:

| Item | Type | Accessibility Check | Status | Evidence | Severity |
|---|---|---|---|---|---|

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

- field validation
- disabled state
- form error messages
- modal open/close
- confirmation button behavior
- table action rendering
- accessibility basics
- local UI state

Use integration/page tests for:

- form submission with mocked API
- loading/error/success states
- table data loading with API mock
- modal API failure/success state

Use API/integration tests for:

- backend permissions
- request/response contracts
- validation
- persistence
- state transitions
- error responses
- duplicate/conflict handling

Use E2E/Playwright tests for:

- critical form submission journeys
- destructive modal confirmation journeys
- cross-route form flows
- table/list workflows that change backend state
- role-based action availability
- cross-module workflows
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

- wrong role can submit restricted critical form
- backend allows restricted destructive action
- destructive modal action unsafe
- critical form can corrupt data
- core workflow blocked by form/modal/table failure
- frontend allows action backend should block
- backend allows action frontend hides for safety

## P1

Use for:

- important form submission broken
- critical form/modal/table flow lacks meaningful test
- critical form/modal/table flow lacks required E2E coverage
- important frontend/backend validation mismatch
- important modal confirm action broken
- important table action broken
- important action missing error handling

## P2

Use for:

- weak test
- missing loading/success/error state
- missing empty state
- accessibility issue
- non-critical action untested
- page-load-only E2E for important form/table page

## P3

Use for:

- minor copy/label cleanup
- low-risk documentation
- optional polish
- minor consistency issue

---

# Required Output

Create the following sections.

## 1. Form Registry

| Form | Route/Page | Component/File | Role | Purpose | Fields | Submit Handler | API | Existing Tests | Existing E2E | Status |
|---|---|---|---|---|---|---|---|---|---|---|

## 2. Form Behavior Matrix

| Form | Check Area | Status | Evidence | Gap | Severity |
|---|---|---|---|---|---|

## 3. Frontend vs Backend Validation Matrix

| Form | Field/Rule | Frontend Says | Backend/API Says | Match? | Severity | Recommended Test |
|---|---|---|---|---|---|---|

## 4. Modal Registry

| Modal/Dialog | Route/Page | Component/File | Trigger | Confirm Action | Cancel/Close | Backend/API | Role | Accessibility | Existing Tests | Existing E2E | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|

## 5. Modal Behavior Matrix

| Modal/Dialog | Check Area | Status | Evidence | Gap | Severity |
|---|---|---|---|---|---|

## 6. Table/List Action Registry

| Table/List | Route/Page | Component/File | Data Source/API | Action | Role | Handler/API | State Updates | Existing Tests | Existing E2E | Status |
|---|---|---|---|---|---|---|---|---|---|---|

## 7. Table/List Behavior Matrix

| Table/List | Action/State | Status | Evidence | Gap | Severity |
|---|---|---|---|---|---|

## 8. Role-Aware Form/Modal/Table Matrix

| Item | Type | Role | Should See? | Should Use? | Frontend Enforcement | Backend/API Enforcement | Existing Test | Existing E2E | Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|---|

## 9. Frontend/Backend Alignment Matrix

| Item | Type | Frontend File | Handler | API Endpoint | Payload | Expected Response | Error Handling | Backend Permission | Validation Match? | Test Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|---|---|

## 10. E2E Form/Modal/Table Coverage Matrix

| Item | Type | Role | Route/Page | Requires E2E? | Reason | Existing E2E | E2E Quality | Recommended E2E Test | Severity |
|---|---|---|---|---|---|---|---|---|---|

## 11. Accessibility Matrix

| Item | Type | Accessibility Check | Status | Evidence | Severity |
|---|---|---|---|---|---|

## 12. Form/Modal/Table Gap Report

| ID | Issue | File | Component | Role | Backend/API Link | Severity | Recommended Test |
|---|---|---|---|---|---|---|---|

## 13. Product Decisions Needed

| Question | Item | Type | Route/Page | Role | Why Needed |
|---|---|---|---|---|---|

## 14. Gate 5 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|---|---|---|---|---|
| Gate 5 | [Module/Area] | PASS / BLOCKED | [evidence] | [missing items] |

Gate 5 may only PASS if:

- all forms in scope are listed or marked not applicable with evidence
- fields and validation are mapped
- submit/cancel/reset behavior is checked
- frontend/backend validation alignment is checked
- API linkage is checked
- success/error/loading states are checked
- modals and dialogs are audited
- modal open/confirm/cancel behavior is checked
- table/list actions are checked
- role restrictions are checked
- test gaps are listed
- E2E coverage is assessed for critical form/modal/table workflows
- accessibility basics are checked

Do not fix anything.
