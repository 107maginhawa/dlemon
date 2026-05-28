# Dental Perio — Periodontal Chart Module Audit

**Module:** dental-perio (Module 9 of 18)
**Audit Date:** 2026-05-26
**Auditor:** Senior Code Reviewer (automated, read-only)
**Branch audited:** main (HEAD ~41d0899)

## Scope

Backend handlers: `services/api-ts/src/handlers/dental-perio/`
Frontend: `apps/dentalemon/src/` (exhaustive search — 0 perio components found)
TypeSpec: `specs/api/src/modules/dental-perio.tsp`
OpenAPI: `specs/api/dist/openapi/openapi.json`
Tests: `dental-perio-coverage.test.ts`, `perio-chart.repo.test.ts`, `ipad-perio-charting.spec.ts`, `03-perio-charting.journey.spec.ts`

---

## Findings Summary

| ID | Severity | Gate | Title | Status |
|----|----------|------|-------|--------|
| F1 | P0-CRITICAL | G3/G4 | Frontend entirely missing — no perio route, tab, or component exists | CONFIRMED |
| F2 | P0-CRITICAL | G3 | Backend routes NOT wired in `app.ts` — coverage test uses inline registration | CONFIRMED |
| F3 | P1 | G2 | `staff_full` excluded from write endpoints — inconsistent with PRD role spec | CONFIRMED |
| F4 | P1 | G7 | Journey J03 pre-declared BROKEN — workspace has no `data-testid="perio-tab-btn"` | CONFIRMED |
| F5 | P1 | G5 | No perio chart form, input grid, or probing-depth capture UI exists anywhere in frontend | CONFIRMED |
| F6 | P1 | G8 | `dental-perio-coverage.test.ts` uses inline Hono app, NOT the real `app.ts` — misses route-wiring bugs | CONFIRMED |
| F7 | P2 | G6 | `getVisitPerioChart` and `getPerioChart` allow `staff_scheduling` to read perio data — inconsistent with write-only dentist gate | CONFIRMED |
| F8 | P2 | G8 | `ipad-perio-charting.spec.ts` HIG cell-height test auto-skips via `test.skip` because `[data-testid="tooth-cell"]` never exists | CONFIRMED |
| F9 | P2 | G6 | `hygienist` role allowed on `getPerioChart` but not on `getVisitPerioChart` — asymmetric read access | CONFIRMED |
| F10 | P3 | G8 | No E2E test covers the full perio workflow (create → readings → complete → verify stats) | CONFIRMED |
| F11 | P3 | G6 | `dental_perio_chart` schema has no `lockedAt` timestamp — status enum includes `locked` but transition is unimplemented | CONFIRMED |

---

## Gate-by-Gate Analysis

### Gate 2 — Role and Permission Map

**Evidence files:**
- `services/api-ts/src/handlers/dental-perio/createPerioChart.ts` line 43
- `services/api-ts/src/handlers/dental-perio/upsertToothReading.ts` line 54
- `services/api-ts/src/handlers/dental-perio/completePerioChart.ts` line 46
- `services/api-ts/src/handlers/dental-perio/getVisitPerioChart.ts` lines 17–22
- `services/api-ts/src/handlers/dental-perio/getPerioChart.ts` lines 16–22

| Endpoint | HTTP Method | RBAC Roles Allowed | Enforcement |
|----------|-------------|-------------------|-------------|
| `POST /dental/perio-charts` (createPerioChart) | POST | `dentist_owner`, `dentist_associate` | `assertBranchRole` |
| `PUT /dental/perio-charts/{chartId}/readings/{toothNumber}` (upsertToothReading) | PUT | `dentist_owner`, `dentist_associate` | `assertBranchRole` |
| `POST /dental/perio-charts/{chartId}/complete` (completePerioChart) | POST | `dentist_owner`, `dentist_associate` | `assertBranchRole` |
| `GET /dental/perio-charts/{chartId}` (getPerioChart) | GET | `dentist_owner`, `dentist_associate`, `hygienist`, `staff_full`, `staff_scheduling` | `assertBranchRole` |
| `GET /dental/visits/{visitId}/perio-chart` (getVisitPerioChart) | GET | `dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling` | `assertBranchRole` |

**Finding F3 (P1):** The PRD role spec defines `staff_full` as "front-desk/office manager with billing and patient admin access; no clinical write access." Excluding `staff_full` from write endpoints is consistent with that definition. However the module spec header in `CLAUDE.md` lists `staff_full` as a role for this module alongside dentists. This is ambiguous. The current behavior (staff_full blocked from writing perio charts) is clinically defensible but needs explicit documentation as an intentional decision, not a silent omission. Compare: `createMedicalHistoryEntry` grants `staff_full` write access.

**Finding F9 (P2):** `getPerioChart` grants `hygienist` role read access. `getVisitPerioChart` does not include `hygienist`. A hygienist can read a chart by chartId but cannot query it by visitId — the lookup path a hygienist would actually use. This asymmetry is likely a defect.

**Frontend RBAC gate:** None. No frontend perio component exists. Moot until F1 is resolved.

---

### Gate 3 — Route and Navigation

**Evidence:**
- `apps/dentalemon/src/routes/` — full file listing examined
- `apps/dentalemon/src/routes/_workspace/$patientId.tsx` — imports examined

**Routes that exist:**
```
/_workspace/$patientId     — clinical workspace (carousel + treatment table)
/_workspace/queue-board    — queue board
/_dashboard/patients_/$patientId.tsx — patient profile page
```

**Route `/patients/:patientId/visits/:visitId/perio` does NOT exist in the router.**

The `ipad-perio-charting.spec.ts` navigates to:
```
http://localhost:3003/patients/${ctx.patientId}/visits/${ctx.visitId}/perio
```
This URL has no matching TanStack Router route file. When navigated to, the app will render the root not-found fallback or redirect to dashboard. No 404 page is confirmed to show "perio" content.

**Finding F1 (P0-CRITICAL):** There is no `/perio` route, no workspace tab slot for perio, and no navigation affordance. The workspace route `_workspace/$patientId.tsx` comment header explicitly lists: `Sheets: Notes, TreatmentPlan, Rx, Consent, Lab, PMD, Attachments, Payment` — perio is absent from this list. The workspace carousel section renders `TimelineCarousel` followed by `TreatmentTable`. There is no `data-testid="perio-tab-btn"` anywhere in the frontend codebase.

---

### Gate 4 — Frontend Interaction Integrity

**Search scope:** All `.ts` and `.tsx` files under `apps/dentalemon/src/` — approximately 200+ files (count confirmed: file listing examined).

**Exhaustive search results for term `perio` (case-insensitive):**

| Match | File | Context | Relevant to module? |
|-------|------|---------|---------------------|
| `'Perio'` label | `features/workspace/components/cdt-code-browser.tsx` line 46 | CDT code specialty filter — string label only, not a component | No |
| `'Perio'` string | `features/workspace/components/cdt-code-browser.test.ts` line 98 | Test data for specialty filter | No |
| `'D4341: Periodontal Scaling'` | `features/settings/components/fee-schedule.tsx` line 26 | Fee schedule seed data — CDT code description | No |
| `'Periodic Exam'` | `features/settings/components/fee-schedule.tsx` line 12 | CDT D0120 description | No |
| `'Periodic oral...'` | `features/workspace/hooks/use-treatments.test.ts` line 36 | Test fixture procedure name | No |
| `'period'` (lowercase) | `features/scheduling/components/calendar-week.tsx` | AM/PM period variable — not related | No |

**Zero matches found for:** `PerioChart`, `PerioTab`, `usePerioChart`, `periodontal` (as component), `perio-chart`, `perio-grid`, `probing`, `bop`, `BOP`, `ToothReading`, `upsertToothReading`, `createPerioChart`, `completePerioChart`, `getVisitPerioChart`.

**Finding F1 confirmed:** The frontend is entirely missing. There is no perio component, hook, form, sheet, tab trigger, or route in `apps/dentalemon/src/`. The backend is fully implemented; the frontend has zero surface area.

**Features directory listing:**
```
apps/dentalemon/src/features/
  billing/
  dashboard/
  imaging/         ← has full workspace integration
  patients/
  scheduling/
  settings/
  workspace/
  pmd/             ← has full workspace sheet integration
```
There is no `perio/` directory under `features/`.

---

### Gate 5 — Forms, Modals, Tables

| UI Element | Expected | Exists? | Evidence |
|------------|----------|---------|---------|
| Perio chart entry form (probing depths 6-site grid) | Yes — core charting workflow | No | Zero frontend files |
| BOP boolean toggles per site | Yes | No | — |
| Recession/mobility/furcation inputs | Yes | No | — |
| "Complete chart" confirmation modal | Yes | No | — |
| Summary stats display (BOP%, mean depth, deep pocket count) | Yes | No | — |
| Historical perio chart comparison (trend view) | Phase 2 feature | No | Not implemented in backend either |
| Print layout for perio chart | PRD requirement | No | — |

**Finding F5 (P1):** No perio form exists anywhere. This is a complete absence, not partial implementation. The backend supports all clinical fields (6-site probing depths, BOP, recession, mobility, furcation, plaque, suppuration per tooth). The gap is entirely on the frontend.

---

### Gate 6 — Backend/API Contract Alignment

**OpenAPI spec paths (confirmed from `specs/api/dist/openapi/openapi.json`, 170 total paths):**
```
/dental/perio-charts                                    — createPerioChart
/dental/perio-charts/{chartId}                          — getPerioChart
/dental/perio-charts/{chartId}/complete                 — completePerioChart
/dental/perio-charts/{chartId}/readings/{toothNumber}   — upsertToothReading
/dental/visits/{visitId}/perio-chart                    — getVisitPerioChart
```

**TypeSpec source:** `specs/api/src/modules/dental-perio.tsp` and `specs/api/src/healthcare/ancillary/periodontal.tsp` — both present and describe full model (PerioSite, PerioExam with 6-site probing depths, BOP, recession, mobility, furcation).

**Handler–spec alignment:**

| Spec endpoint | Handler file | Registered in registry.ts | Registered in app.ts |
|--------------|--------------|--------------------------|---------------------|
| `POST /dental/perio-charts` | `createPerioChart.ts` | Yes (line 154, 413) | NO — not found |
| `GET /dental/perio-charts/{chartId}` | `getPerioChart.ts` | Yes (line 155, 414) | NO — not found |
| `POST /dental/perio-charts/{chartId}/complete` | `completePerioChart.ts` | Yes (line 156, 415) | NO — not found |
| `PUT /dental/perio-charts/{chartId}/readings/{toothNumber}` | `upsertToothReading.ts` | Yes (line 157) | NO — not found |
| `GET /dental/visits/{visitId}/perio-chart` | `getVisitPerioChart.ts` | Yes (line 158) | NO — not found |

**Finding F2 (P0-CRITICAL):** `grep 'perio' services/api-ts/src/app.ts` returns zero results. The perio handlers are imported in `generated/openapi/registry.ts` (the generated route registration file), but this file is not wired into `app.ts`. The coverage test explicitly acknowledges this on line 12: `"Routes registered inline — not yet wired in app.ts."` This means the perio API is not available on the running server. All five endpoints return 404 in production.

**Frontend API hooks:** Zero. No `use-perio-chart.ts`, no SDK calls to any perio endpoint exist in `apps/dentalemon/src/`.

**Schema details (`dental_perio_chart`):**
- Status enum: `draft`, `completed`, `locked`
- Summary fields: `summaryBopPercent` (numeric 5,2), `summaryMeanDepth` (numeric 5,2), `summaryDeepPocketCount` (integer)
- Unique constraint: one chart per `visitId`
- Migration: `0038_perio_charts.sql` — applied

**Schema details (`dental_perio_tooth_reading`):**
- 6 depth sites: `depthBM`, `depthBC`, `depthBD`, `depthLM`, `depthLC`, `depthLD` (smallint)
- 6 BOP booleans: `bopBM`, `bopBC`, `bopBD`, `bopLM`, `bopLC`, `bopLD`
- Additional: `recession` (smallint), `mobility` (smallint, default 0), `furcation` (smallint, default 0), `plaque` (boolean, default false), `suppuration` (boolean, default false), `notes` (text)
- Unique constraint: `(chartId, toothNumber)` — upsert target

**Finding F11 (P3):** The schema declares a `locked` status in the enum but no `lockedAt` timestamp column exists. The `completePerioChart` handler only transitions `draft → completed` and does not implement a `locked` transition. The `locked` status appears to be a placeholder for a future "visit locked" cascade that is not yet implemented.

---

### Gate 7 — Role-Based Journey Map

**Journey J03 — Periodontal charting linked to odontogram:**

File: `apps/dentalemon/tests/e2e/journeys/03-perio-charting.journey.spec.ts`

```
id: 'J03'
name: 'Periodontal charting linked to odontogram'
set: 'A'
expectedVerdict: 'BROKEN'
rubricIds: ['Q11', 'Q12', 'Q13', 'Q14', 'Q16']
P0 ref: Gap #7 (perio decoupled / probing missing teeth)
```

**J03 execution path:**
1. `pinAuth(page, 'dentist')` → authenticates as dentist
2. `openWorkspace(page, patientId)` → opens `/_workspace/$patientId`
3. Looks for `getByRole('button', { name: /perio|periodontal|probing/i })` or `getByTestId('perio-tab-btn')`
4. If not found (which is guaranteed given F1): calls `expectJourneyBroken(...)` with message "No dedicated periodontal capture surface found"
5. Journey terminates with `actualVerdict: BROKEN` — confirmed

The J03 harness is correctly pre-declared `BROKEN` and will produce the right verdict when run. This is not a test defect — it is an accurate attestation of the missing frontend.

**Journey coverage for perio:**

| Journey | ID | Expected Verdict | Frontend Needed | Status |
|---------|----|-----------------|----------------|--------|
| Perio charting linked to odontogram | J03 | BROKEN | Yes (missing) | Correctly breaks |
| iPad perio chart layout | `ipad-perio-charting.spec.ts` | Pass/Skip | Yes (missing) | Auto-skips on missing route |

---

### Gate 8 — Test Confidence Gap

#### Backend repo tests (`perio-chart.repo.test.ts`)

**Test coverage:**
- `chart create` — creates chart in draft status
- `chart complete` — sets status to `completed`, populates `completedAt`, `summaryBopPercent`, `summaryMeanDepth`, `summaryDeepPocketCount`
- `reading upsert (insert path)` — confirmed
- `reading upsert (update path)` — confirmed
- `countByChart` for BR-P07 (minimum readings gate)

Uses `openTestTx` (rollback isolation) and `seedClinicalChain` fixture. These are real database tests.

**Repo test confidence: 7/10** — solid coverage of CRUD and state transition. No test for the `locked` status transition, no test for concurrent upserts.

#### Handler coverage tests (`dental-perio-coverage.test.ts`)

**Test coverage:**
- `createPerioChart` — 201 (draft), 422 (duplicate visit), 403 (no membership)
- `upsertToothReading` — 200 (insert), 200 (update/upsert), 403 (staff_scheduling role)
- `completePerioChart` — 422 (fewer than 16 readings), 200 (with summary stats after 16+ readings), 422 (already completed)
- `getVisitPerioChart` — 200 (with readings), 204 (no chart), 403 (unauthenticated)

**Critical caveat confirmed:** Line 12 of `dental-perio-coverage.test.ts`:
> `Routes registered inline — not yet wired in app.ts.`

The coverage test builds its own mini-Hono app with routes registered inline, not using the production `app.ts`. This means:
- The tests pass even though the routes are not reachable on the real server
- Route middleware, error handler, auth middleware, and request parsing are not tested in the production configuration
- A passing coverage suite provides false confidence about production reachability

**Finding F6 (P1):** The coverage test passes but does not prove the API is live. An integration test hitting the real `app.ts` server at `localhost:7213` would immediately reveal the 404s.

**Handler coverage test confidence: 5/10** — logic is correct, but registration gap means no real server coverage.

#### E2E tests

| Spec file | Tests | Status |
|-----------|-------|--------|
| `ipad-perio-charting.spec.ts` | 2 tests: "perio chart grid visible at portrait" + "tooth cell HIG height" | Test 1 passes trivially (falls back to `main` visible). Test 2 auto-skips via `test.skip` because `[data-testid="tooth-cell"]` never exists. |
| `03-perio-charting.journey.spec.ts` | 1 test (J03) | Pre-declared BROKEN. Will confirm break immediately at Step 1. |

**E2E confidence: 1/10** — spec files exist but provide no signal on perio functionality. J03 correctly documents the gap but cannot test the workflow.

**Overall confidence by layer:**

| Layer | Confidence | Notes |
|-------|-----------|-------|
| Schema (Drizzle) | 8/10 | Well-defined, migration applied, constraints correct |
| Repository | 7/10 | Solid CRUD + state, minor gaps (locked transition, concurrency) |
| Handler logic | 7/10 | All 5 handlers implemented, RBAC enforced |
| Route registration | 0/10 | Not wired in `app.ts` — all endpoints 404 on live server |
| Frontend | 0/10 | Entirely absent — no component, hook, route, or form |
| E2E | 1/10 | Specs exist; both auto-skip or confirm broken state |

---

## Critical Issues Detail

### F1 — Frontend Entirely Missing (P0-CRITICAL)

**Evidence:**
- `grep -rn -i 'perio' apps/dentalemon/src/` → 6 matches, all irrelevant (CDT label string, AM/PM variable, test fixture)
- `find apps/dentalemon/src/ -iname '*perio*'` → 0 files
- `apps/dentalemon/src/features/` → no `perio/` directory
- `apps/dentalemon/src/routes/` → no `perio` route file
- `_workspace/$patientId.tsx` imports: SoapNotesSheet, RxSheet, ConsentSheet, LabOrdersSheet, AttachmentsSheet, PMDViewerSheet, TreatmentPlanTab, TreatmentTable, ImagingWorkspace — no perio import
- `_workspace/$patientId.tsx` comment: `Sheets: Notes, TreatmentPlan, Rx, Consent, Lab, PMD, Attachments, Payment` — perio absent
- Workspace footer tab buttons: `imaging-tab-btn`, `recalls-tab-btn`, `treatment-plans-tab-btn` — no `perio-tab-btn`

**Impact:** Dentists cannot enter probing depths, BOP, recession, mobility, or furcation for any patient. The periodontal charting workflow is completely inaccessible from the product UI. The backend is ready; the frontend does not exist.

**What must be built to fix:**
1. `apps/dentalemon/src/features/perio/` directory with components and hooks
2. `use-perio-chart.ts` hook — `GET /dental/visits/{visitId}/perio-chart` + `POST /dental/perio-charts`
3. `use-tooth-reading.ts` hook — `PUT /dental/perio-charts/{chartId}/readings/{toothNumber}`
4. `PerioChartGrid` component — 32-tooth grid with 6 input sites per tooth
5. `PerioSheet` or `PerioTab` — workspace integration point
6. `data-testid="perio-tab-btn"` trigger in workspace footer or carousel area
7. `PerioCompleteModal` — summary stats display and "Complete chart" confirmation
8. TanStack Router route for perio view (or embed as workspace sheet)

---

### F2 — Backend Routes Not Wired in `app.ts` (P0-CRITICAL)

**Evidence:**
- `grep 'perio' services/api-ts/src/app.ts` → zero results
- `dental-perio-coverage.test.ts` line 12: `Routes registered inline — not yet wired in app.ts.`
- `generated/openapi/registry.ts` lines 154–158, 412–415: handlers imported and listed in registry array

**Impact:** Sending `POST /dental/perio-charts` to `localhost:7213` returns 404. The backend handler logic is implemented and tested in isolation but is not reachable from the running server. Even if a frontend were built, every API call would fail.

**Fix:** Add perio route group to `services/api-ts/src/app.ts`. The registry.ts already imports the handlers — they need to be mounted in the app router, likely alongside the existing dental module route groups.

**Note:** The comment in the coverage test ("Routes registered inline — not yet wired in app.ts") is an honest disclosure of this gap, but the test passing may give false confidence in CI that the perio backend is live.

---

### F3 — staff_full Excluded from Write Endpoints (P1)

**Evidence:**
- `createPerioChart.ts` line 43: `assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate'])`
- `upsertToothReading.ts` line 54: same two roles
- `completePerioChart.ts` line 46: same two roles
- `createMedicalHistoryEntry.ts` line 31: `['dentist_owner', 'dentist_associate', 'staff_full']` — writes medical history

**Current behavior:** A `staff_full` user attempting to create a perio chart gets 403.

**Intended behavior:** Unclear. The module scope comment says roles involved are `dentist_owner`, `dentist_associate`, `staff_full` (NOT `staff_scheduling`). If hygienists or clinical support staff are expected to perform perio charting (as happens in real dental practices), the current restriction blocks a clinical workflow. If the intent is dentists-only, that must be documented as a business rule (e.g., BR-P02).

**Recommended action:** Clarify whether this is intentional. If staff_full should be allowed to enter readings (common in hygiene workflows), add to the role list. If dentist-only is a business rule, document it as `BR-P02` and add a handler-level comment.

---

### F4 — Journey J03 Pre-Declared BROKEN (P1)

**Evidence:**
- `03-perio-charting.journey.spec.ts` line: `expectedVerdict: 'BROKEN'`
- `P0 ref: Gap #7 (perio decoupled / probing missing teeth)`
- Journey step 1 searches for `getByRole('button', { name: /perio|periodontal|probing/i })` or `getByTestId('perio-tab-btn')` — neither exists → immediate `expectJourneyBroken` call

**Impact:** J03 will never produce a GREEN verdict until F1 and F2 are resolved. This is a known, correctly documented break. The harness correctly records it as `actualVerdict: BROKEN` which counts as a passing spec in CI (expected = actual). However it means the rubric items Q11–Q14, Q16 are permanently untested until the frontend is built.

---

## Recommended Fix Priority

| Priority | Fix | Effort | Unblocks |
|----------|-----|--------|---------|
| 1 (P0) | Wire perio routes in `app.ts` | XS — add route group | All API functionality |
| 2 (P0) | Build `features/perio/` with grid component and hooks | L | J03, ipad-perio-charting |
| 3 (P0) | Add `data-testid="perio-tab-btn"` to workspace + route | S | J03 step 1 |
| 4 (P1) | Clarify `staff_full` write access as intentional or bug | XS | Documentation, F3 |
| 5 (P1) | Rewrite coverage test to use real `app.ts` server | S | True route-registration confidence |
| 6 (P2) | Fix `hygienist` role asymmetry between `getPerioChart` and `getVisitPerioChart` | XS | F9 |
| 7 (P3) | Implement `locked` status transition and add `lockedAt` column | M | F11 |
| 8 (P3) | Add E2E test for full perio workflow after frontend exists | M | F10 |

---

## Overall Confidence Score

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Schema correctness | 8/10 | Well-modelled, migrated, constraints enforced |
| Backend handler correctness | 7/10 | Logic solid; RBAC enforced; locked transition missing |
| Route registration (production) | 0/10 | Not in `app.ts` — 404 on live server |
| Frontend completeness | 0/10 | Entirely absent |
| Test coverage (backend) | 5/10 | Good logic tests; false confidence on route registration |
| Test coverage (E2E) | 1/10 | Spec files exist; both trivially skip or confirm broken |
| Journey harness integrity | 8/10 | J03 correctly pre-declared BROKEN; harness logic is sound |
| **Overall module readiness** | **2/10** | Backend logic is done; everything else is missing |

The dental-perio module is a backend island: fully implemented in TypeSpec, schema, and handler logic, with zero frontend surface area and unregistered routes. It cannot be used by any user in any role. The backend work is complete and correct; the product delivery gap is the frontend.
