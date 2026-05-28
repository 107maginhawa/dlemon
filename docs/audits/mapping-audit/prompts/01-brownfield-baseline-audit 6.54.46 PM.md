# Brownfield Baseline Audit

Use the Master Audit Rules.

Audit the existing codebase in read-only mode. Do not modify code.

## Goal

Create a baseline understanding of the current codebase before deeper frontend journey, backend/API alignment, E2E/Playwright assessment, and TDD work.

This audit is the global discovery pass.

It must identify:

- project structure
- modules/features
- shared/global areas
- roles
- frontend surface
- backend/API surface
- test structure
- E2E/Playwright/Cypress setup
- existing documentation/spec artifacts
- initial risks
- Module Audit Queue for the next audits

Do not fix anything.

---

# Scope

Run this audit globally across the codebase.

This is the only audit that should run globally before the module-by-module sequence.

After this audit, create the Module Audit Queue.

Audits `02` through `08` should run per module/area based on the queue created here.

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

---

# Tasks

## 1. Detect Project Structure

Detect the project structure.

Identify:

- frontend framework
- backend framework
- package manager
- monorepo/workspace structure if any
- source directories
- app directories
- package directories
- routing structure
- API/backend structure
- database/ORM if present
- auth system if visible
- state management/data fetching tools if visible
- build tooling
- lint/typecheck tooling
- test framework
- E2E framework if present
- CI/release workflow if present

Inspect common files and folders:

- `package.json`
- workspace config files
- `src/`
- `app/`
- `pages/`
- `routes/`
- `server/`
- `api/`
- `backend/`
- `packages/`
- `apps/`
- `lib/`
- `components/`
- `features/`
- `modules/`
- `services/`
- `hooks/`
- `composables/`
- `tests/`
- `test/`
- `__tests__/`
- `e2e/`
- `tests/e2e/`
- `playwright.config.*`
- `cypress.config.*`
- `.github/workflows/`
- database/ORM config
- migration folders

Output:

| Area | Detected Item | Evidence/File Path | Notes |
|---|---|---|---|

---

## 2. Detect Tech Stack

Identify the technical stack.

Include:

- frontend framework
- backend framework
- UI library/component system
- routing library/framework
- API style
- auth library/system
- ORM/database
- validation library
- test framework
- component test framework
- API/integration test framework
- E2E framework
- package manager
- CI provider

Output:

| Stack Area | Tool/Framework | Evidence | Confidence |
|---|---|---|---|

Confidence must be:

- HIGH
- MEDIUM
- LOW
- NEEDS MANUAL CONFIRMATION

---

## 3. Identify Logical Modules / Features

Identify logical modules/features.

For each module/feature, identify:

- module name
- purpose
- type
- source paths
- primary entities
- related frontend routes
- related backend APIs
- related components
- related tests
- related E2E tests if any
- related roles
- whether it appears business-critical

Module/Area Type must be one of:

- Business Module
- Shared Frontend
- Shared Backend
- Auth/Permission
- App Shell
- Infrastructure/Test
- E2E Infrastructure
- Cross-Module Workflow

Output:

| Module/Area | Type | Purpose | Source Paths | Primary Entities | Routes | APIs | Tests | E2E Tests | Roles | Priority |
|---|---|---|---|---|---|---|---|---|---|---|

Do not invent modules.

If a module is inferred from folder names or route patterns, mark it `[INFERRED]`.

---

## 4. Identify Shared / Global Areas

Identify shared/global areas that should be audited as their own module/area.

Include:

- Auth / Login / Session
- App Shell / Layout
- Sidebar / Navigation
- Dashboard
- Shared Components
- Design System
- API Client / SDK / Data Fetching Layer
- Permission Middleware
- Backend Middleware
- Error Handling
- CI / Test Setup
- E2E / Playwright Infrastructure
- Cross-Module Workflows

Output:

| Shared/Global Area | Type | Source Paths | Why It Needs Audit | Priority |
|---|---|---|---|---|

---

## 5. Identify Existing Documentation / Spec Artifacts

Identify existing documentation/spec artifacts.

Look for:

- PRD
- master PRD
- module specs
- API contracts
- role/permission matrix
- workflow maps
- UI blueprints
- domain model
- domain glossary
- error taxonomy
- event contracts
- test coverage reports
- TDD proof files
- OLI audit artifacts
- confidence reports
- prior audit outputs
- architecture docs
- README files

Output:

| Artifact | Path | Type | Related Module/Area | Useful For | Notes |
|---|---|---|---|---|---|

If important specs are missing, mark them as spec gaps but do not block the baseline unless source code cannot be audited.

---

## 6. Extract Current Roles

Extract current roles from:

- auth code
- auth schema
- role constants/enums
- middleware
- route guards
- backend permission checks
- frontend UI conditionals
- tests
- E2E tests
- seed data
- documentation/specs if available

For each role, identify:

- role name
- source
- frontend usage
- backend usage
- route usage
- test usage
- E2E usage
- unclear/mismatched role definitions

Output:

| Role | Source | Frontend Usage | Backend Usage | Route Usage | Tests Found | E2E Tests Found | Notes |
|---|---|---|---|---|---|---|---|

Flag mismatches:

| Issue | Role | Source A | Source B | Risk | Severity |
|---|---|---|---|---|---|

---

## 7. Extract Current Frontend Surface

Extract the current frontend surface.

Include:

- routes/pages
- layouts
- app shell
- sidebar
- topbar
- breadcrumbs
- dashboards
- main screens
- forms
- tables/lists
- modals/dialogs
- dropdown menus
- buttons/actions
- links/navigation paths
- role-based UI areas
- loading states
- empty states
- error states
- unauthorized/forbidden states

Output:

| Frontend Surface | Type | Route/Page | Source Path | Related Module/Area | Roles | Notes |
|---|---|---|---|---|---|---|

Also identify likely high-risk frontend areas:

| Area | Risk | Evidence | Suggested Follow-up Audit |
|---|---|---|---|

---

## 8. Extract Current Backend/API Surface

Extract the current backend/API surface.

Include:

- API endpoints
- route handlers/controllers
- services
- repositories/data access
- auth middleware
- role guards
- ownership checks
- tenant/org checks if applicable
- validation
- error handling
- database side effects
- state transitions
- event emission if visible

Output:

| Method | Path | Handler/Source | Module/Area | Auth | Roles | Validation | Side Effects | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|

Also identify likely high-risk backend/API areas:

| Area/API | Risk | Evidence | Suggested Follow-up Audit |
|---|---|---|---|

---

## 9. Extract Current Test Structure

Extract the current test structure.

Include:

- unit tests
- component tests
- integration/API tests
- E2E tests
- Playwright/Cypress tests if present
- skipped tests
- weak tests
- snapshot tests
- test utilities
- test fixtures
- mock setup
- test database setup
- coverage reports
- CI test commands
- test framework gaps

Output:

| Test Type | Framework/Tool | Location | Count/Approx | Related Module/Area | CI Coverage | Notes |
|---|---|---|---|---|---|---|

Classify visible test quality at a high level:

| Test Area | Quality Signal | Risk | Evidence |
|---|---|---|---|

---

## 10. Detect E2E / Playwright / Cypress Setup

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
- `*.spec.*` used as E2E
- package.json E2E scripts
- CI workflow E2E commands
- login/session fixtures
- seeded test users
- test database strategy
- stable selectors/test IDs
- screenshot/video/trace config if present

If no E2E framework exists, flag this as a test infrastructure gap.

Output:

| E2E Area | Status | Evidence | Gap | Severity |
|---|---|---|---|---|

Also identify likely E2E-required areas:

| Candidate E2E Area | Why E2E Is Needed | Related Module/Area | Priority |
|---|---|---|---|

---

## 11. Identify Initial Cross-Module Workflows

Identify visible cross-module workflows.

Examples:

- login → dashboard → module
- list → detail → edit → save
- create record → view record
- search → open result
- table action → modal confirmation → API update
- form submission → backend state → redirected detail page
- admin approval → state change → user-visible result
- billing/payment/checkout flows
- import/export flows
- role-specific approval/review flows

Output:

| Workflow | Modules Involved | Roles | Routes | APIs | Likely Criticality | Evidence |
|---|---|---|---|---|---|---|

Mark these as `[CROSS-MODULE JOURNEY]` if applicable.

---

## 12. Identify Initial Risks

Identify initial high-level risks.

Include:

- broken route/navigation risk
- broken button/action risk
- frontend/backend mismatch risk
- permission mismatch risk
- missing backend validation risk
- missing tests risk
- weak tests risk
- missing E2E risk
- missing CI/release gate risk
- unclear product behavior risk
- missing specs risk

Output:

| Risk ID | Risk | Area | Evidence | Severity | Follow-up Audit |
|---|---|---|---|---|---|

---

# Module Audit Queue

After completing the baseline, create the Module Audit Queue.

This is required.

The queue must include:

- business modules/features
- shared frontend areas
- shared backend areas
- auth/permission areas
- app shell/navigation areas
- infrastructure/test areas
- E2E infrastructure
- cross-module workflows

Use actual detected modules and areas.

Do not invent modules.

Output:

| Order | Module/Area | Type | Source Paths | Frontend Routes | Backend APIs | Roles Involved | Tests Found | E2E Tests Found | Priority |
|---|---|---|---|---|---|---|---|---|---|

Priority must be:

- P0 First
- P1 High
- P2 Normal
- P3 Later

Prioritize based on:

- critical user journeys
- auth/permission risk
- data integrity risk
- broken frontend/backend alignment
- missing tests
- missing E2E coverage
- centrality of module
- cross-module dependencies

---

# Severity Guidance

Use the standard severity rules.

## P0

Use for:

- no source code found
- app cannot be structurally audited
- auth/permission area exists but cannot be mapped
- critical frontend/backend structure cannot be located
- test framework absent where project claims tested readiness
- critical E2E-required journeys visible but no E2E gap is recorded

## P1

Use for:

- major module boundary unclear
- major role mismatch detected
- likely broken critical module
- E2E framework missing for app with critical frontend journeys
- no CI test gate visible
- no clear module audit queue

## P2

Use for:

- incomplete documentation
- unclear source ownership
- weak test organization
- missing coverage reports
- partial E2E setup

## P3

Use for:

- minor docs cleanup
- naming consistency
- low-risk organization issues

---

# Required Output

Create a report with these sections.

## 1. Project Structure Summary

| Area | Detected Item | Evidence/File Path | Notes |
|---|---|---|---|

## 2. Tech Stack Summary

| Stack Area | Tool/Framework | Evidence | Confidence |
|---|---|---|---|

## 3. Module Map

| Module/Area | Type | Purpose | Source Paths | Primary Entities | Routes | APIs | Tests | E2E Tests | Roles | Priority |
|---|---|---|---|---|---|---|---|---|---|---|

## 4. Shared / Global Areas

| Shared/Global Area | Type | Source Paths | Why It Needs Audit | Priority |
|---|---|---|---|---|

## 5. Existing Specs/Docs Found

| Artifact | Path | Type | Related Module/Area | Useful For | Notes |
|---|---|---|---|---|---|

## 6. Role Inventory

| Role | Source | Frontend Usage | Backend Usage | Route Usage | Tests Found | E2E Tests Found | Notes |
|---|---|---|---|---|---|---|---|

## 7. Role Mismatch / Unclear Role Report

| Issue | Role | Source A | Source B | Risk | Severity |
|---|---|---|---|---|---|

## 8. Frontend Surface Summary

| Frontend Surface | Type | Route/Page | Source Path | Related Module/Area | Roles | Notes |
|---|---|---|---|---|---|---|

## 9. Backend/API Surface Summary

| Method | Path | Handler/Source | Module/Area | Auth | Roles | Validation | Side Effects | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|

## 10. Test Structure Summary

| Test Type | Framework/Tool | Location | Count/Approx | Related Module/Area | CI Coverage | Notes |
|---|---|---|---|---|---|---|

## 11. E2E / Playwright Setup Summary

| E2E Area | Status | Evidence | Gap | Severity |
|---|---|---|---|---|

## 12. Initial Cross-Module Workflows

| Workflow | Modules Involved | Roles | Routes | APIs | Likely Criticality | Evidence |
|---|---|---|---|---|---|---|

## 13. Key Risks

| Risk ID | Risk | Area | Evidence | Severity | Follow-up Audit |
|---|---|---|---|---|---|

## 14. Module Audit Queue

| Order | Module/Area | Type | Source Paths | Frontend Routes | Backend APIs | Roles Involved | Tests Found | E2E Tests Found | Priority |
|---|---|---|---|---|---|---|---|---|---|

## 15. Recommended Next Audit Prompt

State the next allowed prompt:

```txt
/doc/audits/mapping-audit/prompts/02-role-permission-map-audit.md
