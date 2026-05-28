<!--
oli: oli-enforce-file v1.0 | generated: 2026-05-27 | module: dental-perio
-->

# Enforcement Report: dental-perio

**Module:** `dental-perio` — Periodontal Charting  
**Generated:** 2026-05-27  
**Spec:** `docs/product/modules/dental-perio/MODULE_SPEC.md`  
**API Contracts:** `docs/product/modules/dental-perio/API_CONTRACTS.md`  
**Backend source:** `services/api-ts/src/handlers/dental-perio/`  
**Frontend:** UI prototype documented only (`docs/product/modules/dental-perio/ui-prototype/`). Not yet implemented in production app.

---

## Summary

| Category | Declared | Found | Missing | Deviated |
|----------|----------|-------|---------|----------|
| Endpoints | 5 | 5 | 0 | 3 |
| Business Rules | 7 | 7 | 0 | 3 |
| Schema Tables | 2 | 2 | 0 | 0 |
| Schema Fields | 31 (chart 11, reading 20) | 31 | 0 | 0 |
| Permissions | 5 actions | 5 | 0 | 2 |
| Error Codes | 6 | 6 | 0 | 3 |
| Workflows | 5 | 3 | 2 | 0 |
| Domain Events | 3 | 2 | 1 | 0 |
| Tests (handler) | 5 endpoints | 4 | 1 | 0 |
| Tests (repo) | CRUD + upsert + complete | 3 | 0 | 0 |

**Overall status: PARTIAL — all spec items have a handler, but 3 deviations are spec violations.**

---

## Endpoints

### POST /dental/perio-charts
**File:** `createPerioChart.ts`  
**Status:** FOUND — 201, draft chart, `readings: []` inline.  
**Deviations:**
- DEVIATION-01: `assertBranchRole` allows `hygienist` role (line 43). Spec §6 and API_CONTRACTS POST auth say dentist_owner | dentist_associate only. `hygienist` is not a spec-declared role for create.
- DEVIATION-02: Error code for duplicate chart is `PERIO_CHART_DUPLICATE` (line 58). Spec §15 and AC-P02 declare the code `CHART_EXISTS`. Mismatch breaks client error-code contracts.
- DEVIATION-03: Membership lookup uses `personId = user.id` with no `branchId` filter (lines 48–49). If a user has memberships in multiple branches, the first matching row is returned regardless of branch. `examinerMemberId` may reference the wrong branch's membership.

### GET /dental/perio-charts/:id
**File:** `getPerioChart.ts`  
**Status:** FOUND — 200 with readings.  
**Deviations:**
- DEVIATION-04: `assertBranchRole` allows `staff_scheduling` (line 32–36). Spec §6 View action grants staff_full but NOT staff_scheduling. Over-permissive.

### GET /dental/visits/:visitId/perio-chart
**File:** `getVisitPerioChart.ts`  
**Status:** FOUND — 200 / 204 correctly handled.  
**Deviations:**
- DEVIATION-05: Same as DEVIATION-04 — `staff_scheduling` allowed at line 30–34. Spec denies staff_scheduling view access.

### PUT /dental/perio-charts/:chartId/readings/:toothNumber
**File:** `upsertToothReading.ts`  
**Status:** FOUND — upsert, depth validation, FDI validation, role check.  
**Deviations:**
- DEVIATION-06: Error code when chart is not draft is `PERIO_CHART_LOCKED` (line 50). API_CONTRACTS declares the code `CHART_COMPLETED` for this condition. Wrong code shipped.
- DEVIATION-07: `assertBranchRole` allows `hygienist` (line 54). Spec §6 Record readings: dentist_owner | dentist_associate only.
- NOTE: Spec §13 edge case "partial reading upsert — only provided sites stored" is NOT implemented. The upsert `set` block explicitly overwrites all fields with `value ?? null` / `value ?? 0`, wiping existing depth values when a partial body omits them (perio-reading.repo.ts lines 53–73). A partial update with `{ depthBM: 6 }` will null out all other depth columns. This violates the spec's explicit partial-upsert contract and AC-P03 semantics.

### POST /dental/perio-charts/:id/complete
**File:** `completePerioChart.ts`  
**Status:** FOUND — 200, summary stats.  
**Deviations:**
- DEVIATION-08: `DEEP_POCKET_THRESHOLD_MM = 5` (line 25). Spec §2 defines "deep pocket" as ≥6 mm (Probing Depth: Normal ≤3 mm; color coding ≥6 mm = red). WF-P03 summary says "teeth with furcation involvement" and separately "deep pockets (≥6 mm)". Using 5 mm threshold will over-count `summaryDeepPocketCount`.
- DEVIATION-09: `deepPocketCount` counts individual sites ≥ threshold (line 72), not teeth. A single tooth with all 6 sites ≥5 mm increments the count by 6. Spec says "teeth with max depth ≥6 mm" (WF-P04) — the count should be per-tooth (distinct tooth with any site ≥6 mm), not per-site.
- DEVIATION-10: Error code for already-completed is `PERIO_CHART_ALREADY_COMPLETE`. API_CONTRACTS §POST complete declares `CHART_COMPLETED` (409). Code mismatch.
- DEVIATION-11: `assertBranchRole` allows `hygienist` (line 46). Spec §6 Complete chart: dentist_owner | dentist_associate only.

---

## Business Rules

| Rule | Status | Notes |
|------|--------|-------|
| BR-P01 — one chart per visit | FOUND | `findByVisitId` pre-check + DB unique index. Error code deviated (DEVIATION-02). |
| BR-P02 — chart immutable after visit locked | FOUND (partial) | `createPerioChart` checks visit status; `upsertToothReading` checks chart.status !== 'draft'. No explicit visit-lock re-check in upsert — relies on chart status being promoted to locked via visit lifecycle. |
| BR-P03 — depths 0–20 mm | FOUND | `assertValidDepths` in perio-validation.ts. |
| BR-P04 — FDI tooth numbers | FOUND | `assertValidToothNumber` in perio-validation.ts. |
| BR-P05 — dentist role required for write | FOUND (deviated) | All three write handlers add `hygienist` — not in spec. See DEVIATION-01, -07, -11. |
| BR-P06 — upsert idempotent | FOUND (deviated) | Unique-on-conflict upsert exists, but NOT idempotent for partial updates — omitted fields are reset to null/default. See DEVIATION-07 note. |
| BR-P07 — min 16 readings for complete | FOUND | `readings.length < 16` check. Spec §13 edge case for primary dentition (min 8/20) is not handled. |

---

## Schema Tables

### dental_perio_chart
**File:** `repos/perio-chart.schema.ts`  
**Status:** FOUND — all 11 spec fields present.

| Spec Field | Found | Notes |
|-----------|-------|-------|
| id (UUID PK) | ✅ | via baseEntityFields |
| visitId | ✅ | FK → dental_visits, CASCADE |
| patientId | ✅ | FK → patients |
| branchId | ✅ | FK → dental_branches |
| examinerMemberId | ✅ | UUID only, no FK (correct per spec §7b) |
| status enum draft/completed/locked | ✅ | pgEnum |
| completedAt | ✅ | timestamp nullable |
| notes | ✅ | text nullable |
| summaryBopPercent | ✅ | numeric(5,2) |
| summaryMeanDepth | ✅ | numeric(5,2) |
| summaryDeepPocketCount | ✅ | integer nullable |

### dental_perio_tooth_reading
**File:** `repos/perio-reading.schema.ts`  
**Status:** FOUND — all spec fields present.

| Spec Field | Found | Notes |
|-----------|-------|-------|
| id (UUID PK) | ✅ | via baseEntityFields |
| chartId | ✅ | FK → dental_perio_charts, CASCADE |
| toothNumber | ✅ | smallint |
| depthBM/BC/BD | ✅ | smallint nullable |
| depthLM/LC/LD | ✅ | smallint nullable |
| bopBM/BC/BD | ✅ | boolean nullable |
| bopLM/LC/LD | ✅ | boolean nullable |
| recession | ✅ | smallint nullable |
| mobility | ✅ | smallint default 0 |
| furcation | ✅ | smallint default 0 |
| plaque | ✅ | boolean default false |
| suppuration | ✅ | boolean default false |
| notes | ✅ | text nullable |

**Note:** Spec §13 edge case mentions `missing: true` flag for extracted teeth. This field is absent from the schema. Not a blocking omission (spec lists it as an edge case without a formal field definition) but a gap.

---

## Permissions

| Spec Action | Allowed Roles (Spec) | Allowed Roles (Impl) | Status |
|-------------|----------------------|----------------------|--------|
| Create chart | dentist_owner, dentist_associate | dentist_owner, dentist_associate, **hygienist** | DEVIATED |
| Record readings | dentist_owner, dentist_associate | dentist_owner, dentist_associate, **hygienist** | DEVIATED |
| Complete chart | dentist_owner, dentist_associate | dentist_owner, dentist_associate, **hygienist** | DEVIATED |
| View chart | dentist_owner, dentist_associate, staff_full | all above + **staff_scheduling** | DEVIATED |
| Print chart | dentist_owner, dentist_associate, staff_full | N/A — no print endpoint implemented | N/A |

---

## Error Codes

| Spec Code | HTTP | Handler Code | HTTP | Status |
|-----------|------|-------------|------|--------|
| CHART_EXISTS | 409 | PERIO_CHART_DUPLICATE | 422 | DEVIATED (code + HTTP) |
| VISIT_LOCKED | 422 | PERIO_VISIT_LOCKED | 422 | DEVIATED (code name) |
| INVALID_DEPTH | 422 | ValidationError (no code field) | 422 | DEVIATED (no structured code) |
| INVALID_TOOTH_NUMBER | 422 | ValidationError (no code field) | 422 | DEVIATED (no structured code) |
| INSUFFICIENT_READINGS | 422 | PERIO_INSUFFICIENT_READINGS | 422 | DEVIATED (code name) |
| FORBIDDEN | 403 | AuthorizationError/UnauthorizedError | 403 | FOUND |

---

## Workflows

| Workflow | Status | Notes |
|----------|--------|-------|
| WF-P01 — Create chart | FOUND | `createPerioChart.ts` |
| WF-P02 — Record readings | FOUND | `upsertToothReading.ts` |
| WF-P03 — Complete chart | FOUND | `completePerioChart.ts` |
| WF-P04 — View historical chart | FOUND | `getPerioChart.ts` + `getVisitPerioChart.ts` |
| WF-P05 — Print chart | MISSING | No print/PDF endpoint. Spec says client-side `@media print` is acceptable; no backend PDF endpoint is strictly required for phase. Low risk. |

---

## Domain Events

| Event | Trigger | Status |
|-------|---------|--------|
| `perio.chart.created` | WF-P01 | FOUND — structured log in createPerioChart.ts:72 (action: `dental_perio_chart_create`) |
| `perio.chart.completed` | WF-P03 | FOUND — structured log in completePerioChart.ts:95 with summary stats |
| `perio.chart.locked` | Visit lock cascade | MISSING — no handler locks perio charts when parent visit locks. Lock propagation not implemented. |

---

## Tests

### Handler coverage test (`dental-perio-coverage.test.ts`)

| AC | Endpoint | Test Status |
|----|----------|-------------|
| AC-P01 POST creates 201 | createPerioChart | FOUND |
| AC-P02 Duplicate → 409 | createPerioChart | FOUND (but expects 422 — test matches impl deviation, not spec) |
| AC-P03 PUT upsert → 200 | upsertToothReading | FOUND |
| AC-P04 Depth out of range → 422 | upsertToothReading | MISSING — no test for invalid depth |
| AC-P05 Invalid FDI → 422 | upsertToothReading | MISSING — no test for invalid tooth number |
| AC-P06 < 16 readings → 422 | completePerioChart | FOUND |
| AC-P07 ≥ 16 readings → 200 | completePerioChart | FOUND |
| AC-P08 Write on locked visit → 422 | any write | MISSING — no locked-visit test |
| AC-P09 staff_scheduling → 403 on create | createPerioChart | PARTIAL (tests no-membership → 403, not staff_scheduling role specifically) |
| AC-P10 GET returns readings array | getVisitPerioChart | FOUND |

**getPerioChart (GET /dental/perio-charts/:id) has zero test coverage** — not registered in `buildApp` and no test describe block.

### Repo tests (`perio-chart.repo.test.ts`)

| Test | Status |
|------|--------|
| chart create + findByVisitId | FOUND |
| unique constraint blocks duplicate | FOUND |
| reading upsert insert path | FOUND |
| reading upsert update path | FOUND |
| countByChart | FOUND |
| chart complete + summary | FOUND |

---

## Findings Summary

### BLOCKER

**B-01: Partial upsert destroys existing field values**  
`perio-reading.repo.ts` lines 53–73. `onConflictDoUpdate.set` replaces all fields with `value ?? null`, so a partial body `{ depthBM: 6 }` nullifies all other depth, BOP, recession fields. Spec §13 explicitly requires partial updates to preserve un-sent fields.  
Fix: use `sql\`EXCLUDED.field\`` only for explicitly provided fields, or perform a SELECT-then-merge before upsert.

**B-02: deepPocketCount counts sites, not teeth**  
`completePerioChart.ts` line 72. Counter increments per-site when any site depth ≥ threshold. Spec and WF-P04 define `summaryDeepPocketCount` as count of teeth with max depth ≥6 mm.  
Fix: group by tooth; count only when any site on that tooth ≥6 mm.

**B-03: DEEP_POCKET_THRESHOLD_MM = 5 contradicts spec**  
`completePerioChart.ts` line 25. Spec defines deep pockets as ≥6 mm throughout (WF-P02 color coding, WF-P04 list). Threshold should be 6.

**B-04: Error codes diverge from API_CONTRACTS**  
`CHART_EXISTS` → emits `PERIO_CHART_DUPLICATE`; `CHART_COMPLETED` → emits `PERIO_CHART_ALREADY_COMPLETE`; `VISIT_LOCKED` → emits `PERIO_VISIT_LOCKED`. Clients implementing against API_CONTRACTS.md will get unrecognized codes.  
Fix: align code strings to spec values or formally update API_CONTRACTS.

**B-05: examinerMemberId resolved without branchId filter**  
`createPerioChart.ts` lines 48–49. First membership row by `personId` used regardless of branch. Multi-branch users will have wrong `examinerMemberId` on the chart.  
Fix: add `.where(and(eq(dentalMemberships.personId, user.id), eq(dentalMemberships.branchId, visit.branchId)))`.

### WARNING

**W-01: `hygienist` role added to write endpoints — not in spec**  
`createPerioChart.ts:43`, `upsertToothReading.ts:54`, `completePerioChart.ts:46`. Spec §6 permission table has no hygienist row.

**W-02: `staff_scheduling` allowed to read charts**  
`getPerioChart.ts:32–36`, `getVisitPerioChart.ts:30–34`. Spec §6: staff_scheduling has no view access.

**W-03: `perio.chart.locked` event not implemented**  
Spec §10b. Visit-lock cascade to perio chart status not wired anywhere.

**W-04: Primary dentition min-readings threshold not handled**  
`completePerioChart.ts` always uses 16. Spec §13 requires 8/20 for primary dentition. No detection of dentition type.

**W-05: `getPerioChart` has no test coverage**  
Handler file exists, endpoint not registered in coverage test app, zero assertions.

**W-06: AC-P04, AC-P05, AC-P08 have no test coverage**  
Invalid depth, invalid tooth number, write-on-locked-visit — all acceptance criteria without tests.

**W-07: `missing: true` flag for extracted teeth absent from schema**  
Spec §13 edge case. Without it, extracted-tooth readings still require all validation and are counted in BR-P07 minimums.

---

## Frontend

UI prototype documented in `docs/product/modules/dental-perio/ui-prototype/` (components.md, screens.md, interaction-states.md, microcopy.md, data-table-contracts.md, form-contracts.md, mock-data.md).  
**Not yet implemented in production app (`apps/dentalemon/`).** No frontend source files exist for this module. This is expected per module status = PLANNED.

---

_Enforced by: oli-enforce-file v1.0 | 2026-05-27_
