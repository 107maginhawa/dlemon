# Role and Permission Map Audit

Use the Master Audit Rules.

Audit in read-only mode. Do not modify code.

## Goal

Map all user roles for the current module/area and determine whether frontend permissions, backend permissions, API enforcement, route access, UI visibility, and tests are aligned.

This audit must identify:

- all roles
- role definitions
- role usage
- protected routes
- protected actions
- frontend/backend permission mismatches
- role-based journey risks
- allow/deny test gaps
- E2E/Playwright route-access gaps where appropriate

Do not fix anything.

---

# Scope

Run this audit for the current module/area assigned by the orchestrator.

Do not audit the whole app globally unless the orchestrator explicitly assigned this as a global/shared area.

If this module/area has no role or permission surface, do not skip silently.

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

## 1. Find All Role Definitions

Find all role definitions in scope.

Inspect:

- auth schema
- database schema
- constants/enums
- middleware
- route guards
- frontend conditionals
- backend guards
- permission helpers
- policy files
- access control utilities
- seed data
- tests
- E2E tests
- documentation/specs if available

For each role, identify:

- role name
- source file
- inferred purpose
- frontend usage
- backend usage
- API usage
- route usage
- test usage
- E2E usage
- unclear/mismatched definitions

Output:

| Role | Source | Inferred Purpose | Frontend Usage | Backend Usage | API/Route Usage | Tests Found | E2E Tests Found | Notes |
|---|---|---|---|---|---|---|---|---|

---

## 2. Identify Permission Model

Identify the permission model used by the codebase.

Check whether permissions are based on:

- roles
- permissions/abilities
- ownership
- tenant/org membership
- feature flags
- subscription/plans
- record status/state
- team/group membership
- hardcoded conditionals
- middleware
- policy functions
- frontend-only visibility rules
- backend-only guards

Output:

| Permission Pattern | Source File | Used By | Risk | Notes |
|---|---|---|---|---|

---

## 3. Create Role Inventory

Create a role inventory for this module/area.

For each role, identify:

- allowed routes
- denied routes
- allowed actions
- denied actions
- backend/API permissions
- ownership constraints
- tenant/org constraints
- unclear permissions
- test coverage
- E2E coverage if relevant

Output:

| Role | Allowed Routes | Denied Routes | Allowed Actions | Denied Actions | Backend/API Permissions | Ownership/Tenant Rules | Test Coverage | E2E Coverage |
|---|---|---|---|---|---|---|---|---|

---

## 4. Identify Protected Routes

Identify all protected routes in scope.

Include:

- public routes
- authenticated routes
- role-restricted routes
- ownership-restricted routes
- tenant/org-restricted routes
- ambiguous routes
- redirect-only routes
- admin/config routes
- direct URL access risks

For each route, identify:

- route path
- source file
- route guard
- allowed roles
- denied roles
- unauthenticated behavior
- forbidden behavior
- backend/API dependency
- tests
- E2E coverage if critical

Output:

| Route | Source File | Protection Type | Allowed Roles | Denied Roles | Direct URL Behavior | Backend/API Enforcement | Existing Test | Existing E2E | Severity |
|---|---|---|---|---|---|---|---|---|---|

---

## 5. Identify Protected Actions

Identify all protected actions in scope.

Include:

- create
- view
- edit
- delete
- archive
- restore
- approve
- reject
- cancel
- submit
- finalize
- export
- import
- print/download
- invite
- manage settings
- assign role
- change status
- bulk action
- destructive action
- role-specific actions

For each action, identify:

- action label
- component/file
- route/page
- allowed roles
- denied roles
- UI visibility rule
- backend/API guard
- ownership/tenant rule
- tests
- E2E coverage if critical

Output:

| Action | Route/Page | Component/File | Allowed Roles | Denied Roles | Frontend Rule | Backend/API Rule | Ownership/Tenant Rule | Existing Test | Existing E2E | Severity |
|---|---|---|---|---|---|---|---|---|---|---|

---

# Frontend vs Backend Permission Alignment

Compare frontend and backend enforcement.

Flag issues such as:

- hidden in UI but not blocked in backend
- blocked in backend but visible/clickable in UI
- route guarded but action not guarded
- action guarded but API not guarded
- role exists in UI but not backend
- role exists in backend but not UI
- frontend role names differ from backend role names
- frontend uses stale role enum
- backend accepts action from role frontend hides
- UI allows action backend rejects
- missing ownership check
- missing tenant/org boundary check
- frontend-only permission logic
- backend-only permission logic with bad UX
- direct URL access bypasses UI restriction
- API can be called directly despite hidden UI

Output:

| ID | Mismatch | Role | Route/API/Component | Frontend Behavior | Backend Behavior | Evidence | Severity | Recommended Test |
|---|---|---|---|---|---|---|---|---|

---

# Ownership and Tenant Boundary Check

If the app uses ownership, organizations, clinics, tenants, workspaces, teams, branches, facilities, or similar boundaries, check access boundaries.

Verify:

- user can access own records
- user cannot access another user's restricted records
- user can access records in own org/tenant
- user cannot access records across org/tenant
- frontend filters data correctly
- backend enforces boundary
- tests exist
- E2E coverage exists if route/journey is critical

Output:

| Boundary | Route/API/Action | Role | Expected Rule | Frontend Enforcement | Backend Enforcement | Existing Test | Existing E2E | Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|

---

# Role-Based Journey Requirement

Identify role-based journeys affected by this module/area.

Examples:

- guest → login
- user → dashboard
- staff → create record
- manager → approve record
- admin → manage settings
- wrong role → forbidden
- unauthenticated user → redirect
- direct URL access → blocked

For each role-based journey, identify whether it needs E2E coverage.

Output:

| Journey | Role | Route(s) | Action(s) | Permission Rule | Existing Test | Existing E2E | E2E Required? | Severity |
|---|---|---|---|---|---|---|---|---|

E2E is required when:

- route access is critical
- role-based navigation is critical
- action changes backend state
- workflow crosses routes/modules
- permission failure must be visible to user
- direct URL behavior matters

---

# Test Coverage Check

Check permission test coverage.

For each permission rule, check:

- allow test exists
- deny test exists
- unauthenticated test exists
- wrong-role test exists
- ownership test exists if applicable
- tenant/org boundary test exists if applicable
- frontend visibility test exists if applicable
- backend/API enforcement test exists
- E2E route-access test exists if critical

Classify test quality:

- STRONG = asserts exact allow/deny result, status, redirect, forbidden state, or backend rejection
- WEAK = only checks render, text exists, truthy, or generic access
- NONE = no test found

Output:

| Permission Rule | Existing Test | Test Type | Coverage Quality | Missing Test | Recommended Test Type | Severity |
|---|---|---|---|---|---|---|

---

# E2E / Playwright Role Access Requirement

Explicitly check whether role-based access has E2E/Playwright/Cypress coverage.

Inspect:

- `playwright.config.*`
- `cypress.config.*`
- `e2e/`
- `tests/e2e/`
- `*.e2e.*`
- `*.spec.*` used as E2E
- package.json E2E scripts
- CI workflow E2E commands
- login/session fixtures
- seeded test users by role

For each critical role-based route or journey, identify:

- existing E2E test
- role used
- start route
- expected allow/deny behavior
- expected redirect/forbidden state
- final UI state
- coverage quality

Output:

| Route/Journey | Role | Expected Access | Existing E2E | E2E Quality | Missing Assertion | Recommended E2E Test | Severity |
|---|---|---|---|---|---|---|---|

Classify E2E quality:

- STRONG = logs in or uses valid role state, navigates to route/action, verifies allow/deny/final state
- WEAK = page-load-only, text-exists-only, or not role-specific
- NONE = no E2E coverage found

Critical role access with no API/integration allow/deny coverage and no E2E coverage should be P0 or P1 depending on risk.

---

# Severity Guidance

Use the standard severity rules.

## P0

Use for:

- wrong role can access restricted route/action/API
- unauthenticated user can access protected data/action
- missing backend enforcement for critical permission
- missing ownership/tenant boundary on sensitive data
- destructive action not protected
- direct URL bypasses restriction
- critical permission rule has no allow/deny test

## P1

Use for:

- UI shows action backend blocks for important workflow
- UI hides action backend allows for important workflow
- important permission rule lacks tests
- role mismatch between frontend and backend
- critical route access lacks E2E coverage
- missing unauthenticated/wrong-role test for important route

## P2

Use for:

- weak permission test
- frontend-only UX mismatch on non-critical action
- backend-only blocking with poor UX
- missing ownership test for low-risk data
- page-load-only E2E for role route

## P3

Use for:

- documentation cleanup
- naming cleanup
- low-risk permission consistency issue
- optional test organization improvement

---

# Required Output

Create the following sections.

## 1. Role Inventory

| Role | Source | Inferred Purpose | Frontend Usage | Backend Usage | API/Route Usage | Tests Found | E2E Tests Found | Notes |
|---|---|---|---|---|---|---|---|---|

## 2. Permission Model Summary

| Permission Pattern | Source File | Used By | Risk | Notes |
|---|---|---|---|---|

## 3. Role Access Matrix

| Role | Allowed Routes | Denied Routes | Allowed Actions | Denied Actions | Backend/API Permissions | Ownership/Tenant Rules | Test Coverage | E2E Coverage |
|---|---|---|---|---|---|---|---|---|

## 4. Protected Route Matrix

| Route | Source File | Protection Type | Allowed Roles | Denied Roles | Direct URL Behavior | Backend/API Enforcement | Existing Test | Existing E2E | Severity |
|---|---|---|---|---|---|---|---|---|---|

## 5. Protected Action Matrix

| Action | Route/Page | Component/File | Allowed Roles | Denied Roles | Frontend Rule | Backend/API Rule | Ownership/Tenant Rule | Existing Test | Existing E2E | Severity |
|---|---|---|---|---|---|---|---|---|---|---|

## 6. Frontend/Backend Permission Mismatch Report

| ID | Mismatch | Role | Route/API/Component | Frontend Behavior | Backend Behavior | Evidence | Severity | Recommended Test |
|---|---|---|---|---|---|---|---|---|

## 7. Ownership / Tenant Boundary Matrix

| Boundary | Route/API/Action | Role | Expected Rule | Frontend Enforcement | Backend Enforcement | Existing Test | Existing E2E | Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|

## 8. Role-Based Journey Permission Matrix

| Journey | Role | Route(s) | Action(s) | Permission Rule | Existing Test | Existing E2E | E2E Required? | Severity |
|---|---|---|---|---|---|---|---|---|

## 9. Permission Test Coverage Matrix

| Permission Rule | Existing Test | Test Type | Coverage Quality | Missing Test | Recommended Test Type | Severity |
|---|---|---|---|---|---|---|

## 10. E2E Role Access Coverage Matrix

| Route/Journey | Role | Expected Access | Existing E2E | E2E Quality | Missing Assertion | Recommended E2E Test | Severity |
|---|---|---|---|---|---|---|---|

## 11. Product Decisions Needed

| Question | Affected Role/Route/API/Action | Why Needed | Blocks Implementation? |
|---|---|---|---|

## 12. Gate 2 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|---|---|---|---|---|
| Gate 2 | [Module/Area] | PASS / BLOCKED | [evidence] | [missing items] |

Gate 2 may only PASS if:

- roles are identified or marked not applicable with evidence
- permission model is summarized
- protected routes are listed
- protected actions are listed
- frontend/backend permission mismatches are listed
- ownership/tenant boundaries are checked if applicable
- missing allow/deny tests are listed
- role-based E2E coverage is checked where applicable
- unclear role behavior is marked as `[NEEDS PRODUCT DECISION]`

Do not fix anything.
