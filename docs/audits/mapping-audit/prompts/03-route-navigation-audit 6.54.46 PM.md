# Route and Navigation Audit

Use the Master Audit Rules.

Audit in read-only mode. Do not modify code.

## Goal

Map all frontend routes and navigation paths for the current module/area, then identify broken links, missing routes, bad redirects, route parameter issues, role mismatches, backend/API access mismatches, and navigation test gaps.

This audit must explicitly check whether navigation risks are covered by route tests, component tests, integration tests, and E2E/Playwright smoke tests where appropriate.

---

# Scope

Run this audit for the current module/area assigned by the orchestrator.

Do not audit the whole app globally unless the orchestrator explicitly assigned this as a global/shared area.

If this module/area has no frontend routes or navigation surface, do not skip silently.

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

## 1. Extract All Frontend Routes

Extract all frontend routes for this module/area.

Include:

- static routes
- dynamic routes
- nested routes
- index routes
- layout routes
- protected routes
- role-based routes
- tenant/org-scoped routes
- routes with search/query params
- redirects
- catch-all routes
- not-found routes
- error routes
- loading routes if framework supports them
- route groups if framework supports them

Identify:

- route path
- route type
- file path
- component/page
- layout
- params
- query params
- auth requirement
- role requirement
- data dependencies
- API dependencies
- existing tests
- existing E2E coverage

Output:

| Route | Type | Component/Page | Layout | Auth Required | Roles | Params | Query Params | Source File | API/Data Dependency | Test Coverage | E2E Coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|

---

## 2. Extract All Navigation Sources

Extract all navigation sources in this module/area.

Include:

- sidebar links
- top nav links
- breadcrumbs
- footer links
- menu items
- tabs
- stepper links
- dashboard cards
- quick action buttons
- buttons that navigate
- table row links
- table action links
- dropdown menu links
- modal links/buttons that navigate
- back/cancel links
- next/previous links
- router.push / navigate calls
- redirect calls
- hardcoded hrefs
- external links
- links inside cards/tables/dropdowns
- cross-module links

For each navigation source, identify:

- source file
- label
- source route/page
- target route
- role visibility
- condition/feature flag if any
- route params
- query params
- target exists?
- test coverage
- E2E coverage

Output:

| Source | Label | Source Route | Target Route | Role Visibility | Params | Query Params | Target Exists? | Test Coverage | E2E Coverage | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|

---

## 3. Validate Route Targets

Validate every target route.

Check:

- route exists
- target component/page exists
- target route is not removed/dead
- route params are provided
- dynamic params cannot be undefined
- query params are valid
- route pattern matches router conventions
- no links to removed routes
- no broken hardcoded URLs
- no accidental external navigation
- no typo in route segment
- no wrong tenant/org slug
- no wrong ID source
- no stale route path after refactor
- no invalid redirect target
- no route loop
- no navigation to page user cannot access
- no broken cross-module link

Output:

| Source File | Source Route | Target Route | Validation Result | Issue | Severity | Evidence |
|---|---|---|---|---|---|---|

Validation Result must be one of:

- VALID
- BROKEN
- LIKELY BROKEN
- UNCLEAR
- NEEDS PRODUCT DECISION
- NOT APPLICABLE

---

## 4. Check Role-Aware Navigation

Check whether navigation behavior is correct per role.

For each role and route/nav item, verify:

- nav item hidden/shown correctly
- route is protected correctly
- direct URL access is blocked where needed
- backend/API also blocks restricted data
- unauthorized access has proper redirect/error behavior
- forbidden access has proper redirect/error behavior
- role-based menu items match backend permissions
- role-based route access has tests
- critical role-based route access has E2E coverage if appropriate

Output:

| Route/Nav Item | Role | Should See? | Should Access? | Frontend Enforcement | Backend/API Enforcement | Existing Test | Existing E2E | Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|

---

## 5. Check Route-Level States

For each route, check route-level states.

Include:

- loading
- empty
- error
- unauthorized
- forbidden
- not found
- validation error
- API error
- success/content state

For each state, identify:

- implemented?
- component/file
- trigger condition
- tested?
- E2E needed?

Output:

| Route | State | Implemented? | Source File | Trigger | Existing Test | E2E Needed? | Gap | Severity |
|---|---|---|---|---|---|---|---|---|

---

# E2E / Playwright Navigation Requirement

Explicitly check whether navigation paths that can break user journeys have E2E/Playwright/Cypress coverage.

E2E or equivalent smoke coverage is recommended for:

- sidebar navigation
- topbar navigation
- main dashboard cards
- role-based routes
- protected routes
- cross-module links
- critical detail page links
- table row links
- action buttons that navigate
- multi-step journeys
- broken-link-sensitive areas
- routes with dynamic params
- tenant/org-scoped routes

Do not recommend E2E for every tiny link.

Use E2E for meaningful user paths and navigation smoke coverage.

Use component tests for small local UI behavior.

Use route/integration tests for route guards if available.

For each navigation path, classify E2E coverage:

- STRONG = covers real role, source route, click/navigation, target route, and expected loaded state
- WEAK = only checks page loads or text exists
- NONE = no E2E coverage found

Output:

| Nav Path | Role | Source Route | Target Route | Dynamic Params? | Existing E2E | E2E Quality | Needs E2E? | Severity |
|---|---|---|---|---|---|---|---|---|

---

# Broken Link / Mapping Detection

Identify possible broken mappings.

Check for:

- links to non-existing files/routes
- route constants that point to missing paths
- hardcoded routes that differ from router definitions
- stale links after route renames
- missing route params
- undefined IDs/slugs
- incorrect parent route
- wrong relative route
- broken back/cancel target
- button navigation with no target
- redirect to inaccessible route
- role menu link that target role cannot access
- API-backed route with missing data dependency

Output:

| ID | Broken Mapping | Source File | Source Route | Target | Evidence | Severity | Recommended Test |
|---|---|---|---|---|---|---|---|

---

## 6. Check Existing Tests

Check existing tests for route and navigation behavior.

Include:

- route render tests
- nav link tests
- role-based nav tests
- protected route tests
- not-found tests
- redirect tests
- dynamic param tests
- route guard tests
- cross-module navigation tests
- E2E smoke navigation tests
- broken link tests
- unauthorized/forbidden navigation tests

Classify coverage:

- STRONG = asserts route, role, navigation action, and expected loaded/blocked state
- WEAK = page loads or text exists only
- NONE = no test found

Output:

| Route/Nav Path | Existing Test | Test Type | Coverage Quality | Missing Assertion | Recommended Test Type | Severity |
|---|---|---|---|---|---|---|

---

# Severity Guidance

Use the standard severity rules.

## P0

Use for:

- role can access restricted route
- protected route has no backend/API enforcement
- critical route is unreachable
- critical journey blocked by broken navigation
- direct URL bypass of role restriction
- broken redirect creates auth/security issue

## P1

Use for:

- important route/link broken
- critical navigation path lacks E2E/smoke coverage
- dynamic route can receive undefined ID/slug
- role-based navigation mismatch
- backend/API route dependency mismatch
- important redirect missing test

## P2

Use for:

- non-critical route lacks loading/error/empty state
- weak route/nav test
- page-load-only E2E for important nav path
- missing breadcrumb/back link test
- minor nav inconsistency

## P3

Use for:

- low-risk cleanup
- naming consistency
- documentation
- optional nav polish

---

# Required Output

Create the following sections.

## 1. Route Registry

| Route | Type | Component/Page | Layout | Auth Required | Roles | Params | Query Params | Source File | API/Data Dependency | Test Coverage | E2E Coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|

## 2. Navigation Registry

| Source | Label | Source Route | Target Route | Role Visibility | Params | Query Params | Target Exists? | Test Coverage | E2E Coverage | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|

## 3. Route Target Validation

| Source File | Source Route | Target Route | Validation Result | Issue | Severity | Evidence |
|---|---|---|---|---|---|---|

## 4. Role-Aware Navigation Matrix

| Route/Nav Item | Role | Should See? | Should Access? | Frontend Enforcement | Backend/API Enforcement | Existing Test | Existing E2E | Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|

## 5. Route-Level State Matrix

| Route | State | Implemented? | Source File | Trigger | Existing Test | E2E Needed? | Gap | Severity |
|---|---|---|---|---|---|---|---|---|

## 6. Broken Navigation Report

| ID | Issue | Source File | Target | Affected Role | Severity | Recommended Fix | Recommended Test |
|---|---|---|---|---|---|---|---|

## 7. Broken Link / Mapping Report

| ID | Broken Mapping | Source File | Source Route | Target | Evidence | Severity | Recommended Test |
|---|---|---|---|---|---|---|---|

## 8. E2E Navigation Smoke Coverage Matrix

| Nav Path | Role | Source Route | Target Route | Dynamic Params? | Existing E2E | E2E Quality | Needs E2E? | Severity |
|---|---|---|---|---|---|---|---|---|

## 9. Route Test Gap Matrix

| Route/Nav Path | Existing Test | Test Type | Coverage Quality | Missing Assertion | Recommended Test Type | Priority |
|---|---|---|---|---|---|---|

## 10. Product Decisions Needed

| Question | Route/Nav Path | Affected Role | Why Needed |
|---|---|---|---|

## 11. Gate 3 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|---|---|---|---|---|
| Gate 3 | [Module/Area] | PASS / BLOCKED | [evidence] | [missing items] |

Gate 3 may only PASS if:

- all routes in scope are catalogued or marked not applicable with evidence
- dynamic params are checked
- navigation sources are checked
- route targets are validated
- broken/missing routes are listed
- protected route behavior is checked
- role-aware navigation is checked
- route-level state gaps are listed
- route/nav test gaps are listed
- E2E navigation smoke coverage is checked
- broken-link/mapping coverage is checked

Do not fix anything.
