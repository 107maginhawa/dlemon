<!--
oli: oli-enforce-module v1.0 | run: 7 | generated: 2026-05-29 | module: dental-perio
wave3-sprint-claimed: all 56 P0 regressions fixed
-->

# Enforcement Report: dental-perio

**Run:** 7 | **Date:** 2026-05-29 | **Module:** `dental-perio`

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Compliance Score | 72 / 100 |
| v1 Status | PARTIAL |
| Service Layer | ABSENT |
| Total Findings | 9 |
| P0 | 2 |
| P1 | 3 |
| P2 | 2 |
| P3 | 2 |

---

## Dimension Results

| Dimension | Score | Notes |
|-----------|-------|-------|
| Public API Completeness | 9/10 | All 5 declared endpoints present and wired; all have authMiddleware |
| Workflow Implementation | 6/10 | WF-P01–P04 implemented; perio.chart.locked cascade absent (WF-P03 step 4) |
| Domain Term Consistency | 9/10 | Terms consistent; `hygienist` role used in code without spec declaration |
| State Machine Enforcement | 6/10 | draft→completed guarded; completed→locked auto-cascade NOT implemented |
| Event Publishing | 5/10 | Events only logged (structured log); no publishAuditEvent calls; perio.chart.locked never emitted |

> P0 cap applied: two P0s each cap score by 10 points.

---

## Findings

---

### EM-PER-001 — P0: BR-P01 duplicate chart returns 422 instead of spec-required 409

**Severity:** P0
**Confidence:** HIGH

**Description:** The spec (§5 BR-P01, §15 Error Handling, AC-P02) explicitly requires HTTP 409 with error code `CHART_EXISTS` when a second perio chart is created for the same visit. The implementation throws `BusinessLogicError('...', 'PERIO_CHART_DUPLICATE')` which maps to HTTP 422. The test suite encodes this deviation — `expect(res.status).toBe(422)` — embedding the wrong status code as validated behavior.

**Spec Reference:** §5 BR-P01: "409 CHART_EXISTS if chart already exists for visitId"; §15 Error Handling table: `CHART_EXISTS | 409`; AC-P02: "Duplicate chart creation for same visit returns 409"

**Files:**
- `services/api-ts/src/handlers/dental-perio/createPerioChart.ts:53` — throws `BusinessLogicError` (422)
- `services/api-ts/src/handlers/dental-perio/dental-perio-coverage.test.ts:195,203` — test accepts 422

**Fix:** Replace `BusinessLogicError` at line 53 with `ConflictError('...', 'CHART_EXISTS')` (HTTP 409). Update test to expect 409.

---

### EM-PER-002 — P0: INVALID_DEPTH and INVALID_TOOTH_NUMBER return 400 instead of spec-required 422

**Severity:** P0
**Confidence:** HIGH

**Description:** The spec (§5 BR-P03, BR-P04, §15, AC-P04, AC-P05) mandates HTTP 422 for probing depth out-of-range and invalid FDI tooth number errors. The implementation uses `ValidationError` which maps to HTTP 400 (`core/errors.ts:39`: `super(message, 'VALIDATION_ERROR', 400)`). Additionally, the error codes (`VALIDATION_ERROR` generic) do not match spec-declared codes `INVALID_DEPTH` and `INVALID_TOOTH_NUMBER`. Test coverage for AC-P04 and AC-P05 is entirely absent from the test suite.

**Spec Reference:** §5 BR-P03: "422 INVALID_DEPTH"; §5 BR-P04: "422 INVALID_TOOTH_NUMBER"; §15: both listed as 422; AC-P04, AC-P05

**Files:**
- `services/api-ts/src/handlers/dental-perio/utils/perio-validation.ts:24` — throws `ValidationError` (→ 400, code: VALIDATION_ERROR)
- `services/api-ts/src/handlers/dental-perio/utils/perio-validation.ts:35` — throws `ValidationError` (→ 400, code: VALIDATION_ERROR)
- `services/api-ts/src/handlers/dental-perio/dental-perio-coverage.test.ts` — no AC-P04/AC-P05 tests

**Fix:** In `perio-validation.ts`, throw `BusinessLogicError('...', 'INVALID_TOOTH_NUMBER')` and `BusinessLogicError('...', 'INVALID_DEPTH')` (HTTP 422). Add tests for AC-P04 (depth > 20 → 422) and AC-P05 (tooth 99 → 422).

---

### EM-PER-003 — P1: summaryDeepPocketCount threshold is 5mm in code but spec mandates >=6mm

**Severity:** P1
**Confidence:** HIGH

**Description:** The spec defines `summaryDeepPocketCount` as "Teeth with max depth ≥6 mm" (§7, WF-P04, §9 color coding). The implementation uses `DEEP_POCKET_THRESHOLD_MM = 5` (line 25), counting any site ≥5 mm as a deep pocket. This produces over-inflated deep pocket counts in clinical summary statistics — a patient safety data accuracy concern.

**Spec Reference:** §7 PerioChart: "summaryDeepPocketCount | Teeth with max depth ≥6 mm"; WF-P04: "teeth with deep pockets (≥6 mm)"; §9: "≥6 mm = red"

**File:** `services/api-ts/src/handlers/dental-perio/completePerioChart.ts:25`

**Fix:** Change `const DEEP_POCKET_THRESHOLD_MM = 5` to `const DEEP_POCKET_THRESHOLD_MM = 6`.

---

### EM-PER-004 — P1: perio.chart.locked auto-cascade from visit lock not implemented

**Severity:** P1
**Confidence:** HIGH

**Description:** The spec §8 State Transitions declares `completed → locked` with annotation "auto-locked when parent visit locked". WF-P03 step 4 states: "Chart locked automatically when parent visit is locked (visit lifecycle BR-003)". No code in the visit lock paths (`visit.repo.ts:lock()`, `visit.repo.ts:autoLockCompletedVisits()`) updates perio chart status to `locked`. The `locked` enum value exists in the schema but is set by zero code paths. Domain event `perio.chart.locked` is never emitted.

**Spec Reference:** §8 State Transitions: `completed → locked (auto-locked when parent visit locked)`; WF-P03 step 4; §10b Domain Events: `perio.chart.locked`

**Files:**
- `services/api-ts/src/handlers/dental-visit/repos/visit.repo.ts:95-102` — lock() does not cascade to perio charts
- `services/api-ts/src/handlers/dental-visit/repos/visit.repo.ts:154-163` — autoLockCompletedVisits() does not cascade
- `services/api-ts/src/handlers/dental-perio/repos/perio-chart.schema.ts:15-17` — `locked` enum defined, never used

**Fix:** Add a `lockPerioChart(visitId)` call inside visit lock paths (or a DB-level cascade update), plus emit `perio.chart.locked` audit event.

---

### EM-PER-005 — P1: No Hurl contract tests for any dental-perio endpoint

**Severity:** P1
**Confidence:** HIGH

**Description:** The spec §12 Test Expectations explicitly requires "Contract tests: Hurl scenarios for all 5 endpoints (happy path + error paths)". No `dental-perio.hurl` file exists in `specs/api/tests/contract/`. All other active modules have Hurl suites. The vertical TDD protocol (§19, step 5) requires contract tests before a module is marked complete.

**Spec Reference:** §12 Test Expectations; §19 Vertical Slice Plan Step 5

**File:** `specs/api/tests/contract/` — `dental-perio.hurl` absent

**Fix:** Create `specs/api/tests/contract/dental-perio.hurl` covering all 5 endpoints with at minimum: 201 create, 409 duplicate, 200 upsert reading, 422 depth out of range, 200 complete, 422 insufficient readings, 403 non-dentist.

---

### EM-PER-006 — P2: hygienist role granted access without spec declaration

**Severity:** P2
**Confidence:** HIGH

**Description:** All five handlers grant `hygienist` role access. The MODULE_SPEC §6 Permission table has four columns only: `dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling` — no `hygienist` column. BR-P05 also states "dentist_owner or dentist_associate" only for create/complete. The `hygienist` role does exist in the membership schema and may be clinically appropriate, but it is undeclared in the governing spec.

**Spec Reference:** §6 Permissions table (no hygienist column); §5 BR-P05

**Files:**
- `services/api-ts/src/handlers/dental-perio/createPerioChart.ts:42`
- `services/api-ts/src/handlers/dental-perio/upsertToothReading.ts:63`
- `services/api-ts/src/handlers/dental-perio/completePerioChart.ts:46`
- `services/api-ts/src/handlers/dental-perio/getPerioChart.ts:31-35`
- `services/api-ts/src/handlers/dental-perio/getVisitPerioChart.ts:30-34`

**Fix:** Update MODULE_SPEC §6 to add `hygienist` column (preferred — clinically correct). Or remove `hygienist` from assertBranchRole calls to strictly match spec.

---

### EM-PER-007 — P2: Domain events declared in spec are only logged, not published to event queue

**Severity:** P2
**Confidence:** HIGH

**Description:** The spec §10b declares three domain events (`perio.chart.created`, `perio.chart.completed`, `perio.chart.locked`). Both implemented handlers use `ctx.get('logger')?.info(...)` for structured logging only — no call to `publishAuditEvent()` from the dental-audit consumer is made. The `perio.chart.locked` event has no emission point at all (also blocked by EM-PER-004).

**Spec Reference:** §10b Domain Events; §17 Observability Hooks

**Files:**
- `services/api-ts/src/handlers/dental-perio/createPerioChart.ts:67-76` — log only
- `services/api-ts/src/handlers/dental-perio/completePerioChart.ts:95-107` — log only

**Fix:** Import and call `publishAuditEvent(scheduler, { action: 'perio.chart.created', ... })` in `createPerioChart` and `completePerioChart`. Add `perio.chart.locked` emission in visit-lock cascade.

---

### EM-PER-008 — P3: Extracted tooth (missing:true) flag absent from schema and validation

**Severity:** P3
**Confidence:** HIGH

**Description:** The spec §13 Edge Cases specifies: "Tooth missing (extracted) — Reading with `missing: true` flag skips validation". The `dental_perio_tooth_reading` schema has no `missing` boolean column. Validation functions in `perio-validation.ts` have no bypass for extracted teeth.

**Spec Reference:** §13 Edge Cases: "Tooth missing (extracted) | Reading with `missing: true` flag skips validation"

**Files:**
- `services/api-ts/src/handlers/dental-perio/repos/perio-reading.schema.ts` — no `missing` column
- `services/api-ts/src/handlers/dental-perio/utils/perio-validation.ts` — no missing-tooth bypass

**Fix:** Add `missing: boolean('missing').notNull().default(false)` to schema; add bypass logic in `assertValidDepths`/`assertValidToothNumber` when `body.missing === true`.

---

### EM-PER-009 — P3: Primary dentition minimum-readings threshold (8/20) not implemented

**Severity:** P3
**Confidence:** MEDIUM

**Description:** The spec §13 Edge Cases specifies: "Primary dentition (tooth 51-85) — Accepted; 20 teeth, min 8/20 for completion". The implementation uses a single `MIN_READINGS_FOR_COMPLETE = 16` for all cases. For primary dentition patients, the correct threshold is 8, not 16.

**Spec Reference:** §13 Edge Cases: "Primary dentition (tooth 51-85) | Accepted; 20 teeth, min 8/20 for completion"

**File:** `services/api-ts/src/handlers/dental-perio/completePerioChart.ts:24`

**Fix:** After loading readings, detect dentition type. If all tooth numbers are in primary range (51-85), use minimum 8. Otherwise use 16.

---

## API Completeness Checklist (§10 declared endpoints)

| Method | Path | Declared | Implemented | Auth | File |
|--------|------|----------|-------------|------|------|
| POST | /dental/perio-charts | YES | YES | authMiddleware(user) | createPerioChart.ts |
| GET | /dental/perio-charts/:id | YES | YES | authMiddleware(user) | getPerioChart.ts |
| GET | /dental/visits/:visitId/perio-chart | YES | YES | authMiddleware(user) | getVisitPerioChart.ts |
| PUT | /dental/perio-charts/:chartId/readings/:toothNumber | YES | YES | authMiddleware(user) | upsertToothReading.ts |
| POST | /dental/perio-charts/:id/complete | YES | YES | authMiddleware(user) | completePerioChart.ts |

**Route discovery:** 5 routes found in `generated/openapi/routes.ts` lines 1020–1044, 1300–1303. All registered with `authMiddleware({ roles: ["user"] })`. All wired to correct handler via `generated/openapi/registry.ts:412-417`.

---

## Workflow Coverage

| Workflow | Actor | Status | Notes |
|----------|-------|--------|-------|
| WF-P01 — Create Perio Chart | Dentist | IMPLEMENTED | createPerioChart.ts |
| WF-P02 — Record Tooth Readings | Dentist | IMPLEMENTED | upsertToothReading.ts |
| WF-P03 — Complete Perio Chart | Dentist | PARTIAL | completePerioChart.ts present; auto-lock cascade (step 4) absent |
| WF-P04 — View Historical Perio Chart | Dentist, Staff Full | IMPLEMENTED | getPerioChart.ts + getVisitPerioChart.ts |
| WF-P05 — Print Perio Chart | Dentist, Staff Full | CLIENT-SIDE DEFERRED | Spec allows @media print CSS; no backend endpoint needed |

---

## State Machine Verification (§8)

| Transition | Guarded | Location | Notes |
|------------|---------|----------|-------|
| draft → completed | YES | completePerioChart.ts:42 | Guards already-completed/locked |
| completed → locked (auto) | NO | — | No cascade; locked state never set by any code path |
| Any write blocked on non-draft chart | YES | upsertToothReading.ts:50 | PERIO_CHART_LOCKED |
| Any write blocked on locked/completed visit | YES | upsertToothReading.ts:58-60 | VISIT_IMMUTABLE |

---

## Service Layer Assessment

**Status: ABSENT**

No `PerioChartService` class exists. Business logic (BR-P01 duplicate check, BR-P07 minimum readings, summary computation) lives in handler functions directly. Repository classes provide data access. This deviates from the platform-level `BaseService` singleton pattern but is internally consistent within the dental-perio module.

---

## Stabilization Plan

| Priority | Finding | Action | Effort |
|----------|---------|--------|--------|
| Fix now (P0) | EM-PER-001 | ConflictError → 409 CHART_EXISTS; update test | 30 min |
| Fix now (P0) | EM-PER-002 | BusinessLogicError → 422 INVALID_DEPTH/INVALID_TOOTH_NUMBER; add AC-P04/P05 tests | 1h |
| Fix before new work (P1) | EM-PER-003 | DEEP_POCKET_THRESHOLD_MM 5→6 | 5 min |
| Fix before new work (P1) | EM-PER-004 | Visit-lock cascade → perio chart locked + perio.chart.locked event | 2h |
| Fix before new work (P1) | EM-PER-005 | Create dental-perio.hurl contract suite | 2h |
| Fix when touching (P2) | EM-PER-006 | Update MODULE_SPEC §6 to declare hygienist access | 30 min |
| Fix when touching (P2) | EM-PER-007 | publishAuditEvent calls in create/complete handlers | 1h |
| Track (P3) | EM-PER-008 | Add missing tooth flag to schema + validation bypass | 1h |
| Track (P3) | EM-PER-009 | Primary dentition threshold (8/20 vs 16/32) | 1h |

---

## What's Next

1. **Immediately (P0):** Fix EM-PER-001 (return 409 for CHART_EXISTS) and EM-PER-002 (return 422 for INVALID_DEPTH/INVALID_TOOTH_NUMBER with correct error codes). Both are breaking spec compliance for AC-P02, AC-P04, AC-P05.
2. **Critical data accuracy (P1):** Fix EM-PER-003 (5mm vs 6mm threshold — clinical data error).
3. **Complete vertical slice:** EM-PER-005 (Hurl contract tests — required for step 5 of vertical TDD).
4. **State machine completion:** EM-PER-004 (locked state is declared but unreachable — spec compliance gap).
5. **Spec housekeeping (P2):** Update MODULE_SPEC §6 to declare hygienist access (EM-PER-006).
