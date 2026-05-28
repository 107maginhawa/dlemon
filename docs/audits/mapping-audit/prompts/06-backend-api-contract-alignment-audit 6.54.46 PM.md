# Backend/API Contract Alignment Audit

Use the Master Audit Rules.

Audit in read-only mode. Do not modify code.

## Goal

Verify that frontend journeys, UI interactions, forms, modals, table/list actions, and role-based workflows are supported by correct backend/API behavior.

This audit must identify frontend/backend contract drift, permission mismatches, validation mismatches, missing API tests, weak API tests, and E2E/Playwright coverage gaps where frontend/backend integration must be proven through a real user journey.

Do not fix anything.

---

# Scope

Run this audit for the current module/area assigned by the orchestrator.

Do not audit the whole app globally unless the orchestrator explicitly assigned this as a global/shared area.

If this module/area has no backend/API surface, do not skip silently.

Mark the section as:

`NOT APPLICABLE — with evidence`

If the frontend depends on a backend/API outside this module, document the dependency and mark it as:

`[CROSS-MODULE DEPENDENCY]`

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
- `[CROSS-MODULE DEPENDENCY]`
- `[CROSS-MODULE JOURNEY]`
- `[E2E REQUIRED]`
- `[E2E GAP]`
- `[WEAK TEST]`
- `[NO TEST FOUND]`

---

# Tasks

## 1. Catalogue Backend Endpoints

Catalogue all backend endpoints in scope.

Include:

- method
- path
- handler
- controller
- service
- repository/data access layer if visible
- request schema
- response schema
- validation
- auth requirements
- role requirements
- ownership checks
- tenant/org checks if applicable
- state transition rules
- error responses
- database side effects
- emitted events if any
- tests
- E2E coverage if endpoint supports a critical journey

Output:

| Method | Path | Handler | Service | Auth | Roles | Ownership/Tenant Check | Request | Response | Errors | DB Side Effect | Tests | E2E Coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

---

## 2. Catalogue Frontend API Calls

Catalogue all frontend API calls in scope.

Inspect:

- components
- pages
- hooks
- composables
- services
- API clients
- SDK wrappers
- form submit handlers
- modal confirm handlers
- table/list action handlers
- route loaders/actions if applicable
- server actions if applicable
- query/mutation hooks

For each frontend API call, identify:

- source component/page/hook
- action using it
- endpoint called
- method
- payload
- expected response
- loading handling
- error handling
- success handling
- permission failure handling
- retry behavior if any
- optimistic update behavior if any
- cache invalidation/refetch behavior if any
- tests
- E2E coverage if part of journey

Output:

| Frontend Source | Action | API Called | Method | Payload | Expected Response | Loading Handling | Error Handling | Success Handling | Test Coverage | E2E Coverage |
|---|---|---|---|---|---|---|---|---|---|---|

---

## 3. Compare Frontend vs Backend Contracts

Compare frontend API usage against backend/API implementation.

Check:

- endpoint missing
- wrong method
- wrong path
- wrong payload field
- missing required field
- extra field
- wrong field type
- wrong enum/status value
- wrong response shape
- frontend assumes data not returned by backend
- backend returns fields frontend does not use
- backend error shape not handled by frontend
- frontend expects different error shape
- missing error handling
- missing loading handling
- missing success handling
- backend requires auth but frontend does not handle auth failure
- backend requires role but frontend shows action to wrong role
- backend allows action that UI hides
- UI allows action that backend blocks
- backend lacks validation
- frontend-only validation without backend enforcement
- frontend and backend validation differ
- frontend cache is not updated after mutation
- optimistic update can create incorrect UI state
- route navigation after success depends on missing backend data

Output:

| ID | Issue | Frontend File | Backend File/API | Contract Area | Evidence | Severity | Recommended Test |
|---|---|---|---|---|---|---|---|

---

## 4. Check Auth, Role, Ownership, and Tenant Enforcement

For every backend endpoint and frontend action, check access enforcement.

Verify:

- unauthenticated access blocked
- wrong-role access blocked
- allowed role works
- ownership checks exist if applicable
- tenant/org boundary checks exist if applicable
- frontend visibility matches backend permission
- backend permission does not rely only on frontend hiding
- permission errors are handled by frontend
- allow/deny tests exist
- E2E role-access test exists if journey-critical

Output:

| Route/API/Action | Role | Expected Access | Frontend Enforcement | Backend Enforcement | Ownership/Tenant Check | Existing Test | Existing E2E | Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|

---

## 5. Check Backend Validation and Business Rules

For every endpoint, check validation and business rule enforcement.

Include:

- required fields
- optional fields
- field types
- enum/status values
- date/range rules
- duplicate/conflict checks
- state transition rules
- data integrity rules
- permission-dependent validation
- tenant/org-specific validation
- backend validation schema
- frontend validation alignment
- tests

Output:

| API | Rule/Field | Backend Validation | Frontend Validation | Match? | Existing Test | Gap | Severity |
|---|---|---|---|---|---|---|---|

---

## 6. Check Error Contracts

Check whether backend/API errors are consistent and handled by frontend.

Inspect:

- validation errors
- auth errors
- forbidden errors
- not found errors
- conflict/duplicate errors
- state transition errors
- server errors
- network errors
- error response shape
- error code taxonomy if available
- frontend display handling
- tests

Output:

| API | Error Case | Backend Error | Frontend Handling | Existing Test | Gap | Severity |
|---|---|---|---|---|---|---|

---

## 7. Check Backend Tests

Check backend/API tests for:

- API happy path
- validation failure
- unauthorized
- forbidden/wrong role
- ownership failure if applicable
- tenant/org boundary failure if applicable
- not found
- conflict/duplicate
- state transition failure
- database side effect
- error response shape
- response schema
- event emission if applicable

Classify test quality:

- STRONG = asserts exact status, response, permission result, state change, or DB side effect
- WEAK = only checks success/truthy/defined/generic response
- NONE = no test found

Output:

| API | Existing Tests | Coverage Quality | Missing Tests | Recommended Test Type | Severity |
|---|---|---|---|---|---|

---

## 8. Check Frontend Integration Tests

Check frontend integration/page tests for API behavior.

Verify:

- mocked API matches real backend contract
- success path tested
- validation error tested
- API error path tested
- loading state tested
- success state tested
- permission failure tested
- forbidden state tested
- cache invalidation/refetch tested if applicable
- optimistic update rollback tested if applicable

Output:

| Frontend Source | API | Existing Test | Mock Matches Backend? | Missing Path | Severity |
|---|---|---|---|---|---|

---

# E2E / Playwright Backend Alignment Requirement

For every frontend/backend journey, decide whether E2E coverage is required.

E2E is required if the API supports:

- critical user journey
- role-based route/action access
- form submission journey
- modal confirmation journey
- table/list workflow
- cross-module workflow
- backend state change that must be reflected in UI
- navigation after API success
- permission failure shown to user

For each E2E-relevant API-backed journey, output:

| Journey/Action | Role | Frontend Source | API | Requires E2E? | Reason | Existing E2E | E2E Quality | Recommended E2E Test | Severity |
|---|---|---|---|---|---|---|---|---|---|

Classify E2E quality:

- STRONG = role-specific test performs the UI action, calls real or realistic backend path, and verifies final UI/backend-visible state
- WEAK = page-load-only, text-exists-only, or mocked path only
- NONE = no E2E coverage found

Critical API-backed journeys requiring E2E with no coverage must be marked at least P1.

---

# Frontend/Backend Drift Types

Classify drift using these categories:

- MISSING_ENDPOINT
- WRONG_METHOD
- WRONG_PATH
- PAYLOAD_MISMATCH
- RESPONSE_MISMATCH
- ERROR_SHAPE_MISMATCH
- AUTH_MISMATCH
- ROLE_MISMATCH
- OWNERSHIP_MISMATCH
- TENANT_BOUNDARY_MISMATCH
- VALIDATION_MISMATCH
- STATE_TRANSITION_MISMATCH
- CACHE_UPDATE_MISMATCH
- MOCK_CONTRACT_MISMATCH
- MISSING_TEST
- WEAK_TEST
- E2E_GAP

Output drift type in the drift report.

---

# Severity Guidance

Use the standard severity rules.

## P0

Use for:

- backend allows restricted critical action
- frontend allows restricted action and backend does not block
- missing auth on protected endpoint
- missing ownership/tenant boundary on sensitive endpoint
- data integrity rule missing
- destructive endpoint unsafe
- critical API-backed journey impossible to complete

## P1

Use for:

- frontend/backend mismatch breaks important workflow
- important API missing validation/error tests
- important API-backed journey lacks E2E coverage
- frontend cannot handle important API error
- role mismatch creates broken UX or denied workflow
- response shape mismatch affects important journey

## P2

Use for:

- weak API test
- weak frontend integration test
- optional field mismatch
- non-critical error path untested
- missing loading/success/error state for non-critical call
- page-load-only E2E for API-backed page

## P3

Use for:

- unused backend fields
- minor naming mismatch
- documentation cleanup
- low-risk consistency issue

---

# Required Output

Create the following sections.

## 1. API Catalogue

| Method | Path | Handler | Service | Auth | Roles | Ownership/Tenant Check | Request | Response | Errors | DB Side Effect | Tests | E2E Coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

## 2. Frontend API Usage Matrix

| Frontend Source | Action | API Called | Method | Payload | Expected Response | Loading Handling | Error Handling | Success Handling | Test Coverage | E2E Coverage |
|---|---|---|---|---|---|---|---|---|---|---|

## 3. Frontend/Backend Drift Report

| ID | Drift Type | Issue | Frontend File | Backend File/API | Evidence | Severity | Recommended Test |
|---|---|---|---|---|---|---|---|

## 4. Auth / Role / Ownership / Tenant Matrix

| Route/API/Action | Role | Expected Access | Frontend Enforcement | Backend Enforcement | Ownership/Tenant Check | Existing Test | Existing E2E | Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|

## 5. Validation Alignment Matrix

| API | Rule/Field | Backend Validation | Frontend Validation | Match? | Existing Test | Gap | Severity |
|---|---|---|---|---|---|---|---|

## 6. Error Contract Matrix

| API | Error Case | Backend Error | Frontend Handling | Existing Test | Gap | Severity |
|---|---|---|---|---|---|---|

## 7. API Test Gap Matrix

| API | Existing Tests | Coverage Quality | Missing Tests | Recommended Test Type | Priority |
|---|---|---|---|---|---|

## 8. Frontend Integration Test Matrix

| Frontend Source | API | Existing Test | Mock Matches Backend? | Missing Path | Severity |
|---|---|---|---|---|---|

## 9. E2E API-Backed Journey Matrix

| Journey/Action | Role | Frontend Source | API | Requires E2E? | Reason | Existing E2E | E2E Quality | Recommended E2E Test | Severity |
|---|---|---|---|---|---|---|---|---|---|

## 10. Product Decisions Needed

| Question | Affected API/Frontend Source | Why Needed | Blocks Implementation? |
|---|---|---|---|

## 11. Gate 6 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|---|---|---|---|---|
| Gate 6 | [Module/Area] | PASS / BLOCKED | [evidence] | [missing items] |

Gate 6 may only PASS if:

- backend endpoints are catalogued or marked not applicable with evidence
- frontend API calls are catalogued
- request/response mismatch is checked
- auth/role mismatch is checked
- ownership/tenant boundary checks are reviewed where applicable
- validation mismatch is checked
- error handling mismatch is checked
- API tests are checked
- frontend integration tests are checked
- E2E coverage is assessed for critical API-backed journeys
- unresolved product decisions are listed

Do not fix anything.
