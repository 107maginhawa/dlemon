<!-- oli-version: 1.1 | generated: 2026-05-29 | skill: oli-enforce-module | run: 7 -->
<!-- module: dental-visit | spec: docs/product/modules/dental-visit/MODULE_SPEC.md -->

# Enforcement Report — dental-visit

**Run:** 7 | **Date:** 2026-05-29 | **Skill:** oli-enforce-module v1.1
**Spec Version:** 1.0 | **Last Updated:** 2026-05-24
**Compliance Score:** 72 / 100 | **Status:** PARTIAL | **Service Layer:** PRESENT

---

## Executive Summary

The dental-visit module has a robust structural foundation: all declared handlers exist, the treatment FSM (`TREATMENT_TRANSITIONS`) is correctly defined and enforced, the visit state machine is guarded across write handlers, SOAP notes versioning is implemented, carry-over is correct, and treatment templates are wired. The service layer (`visit.service.ts`) is present and used by cross-module consumers.

However, **six domain events (DE-001 through DE-006) are declared but never emitted** — `domain-events.ts` is not imported by any production handler. **BR-001** (concurrent active visit 409 guard) is absent in `createDentalVisit.ts` itself (enforced only inside `checkInAppointment.ts`, leaving direct API calls unprotected). **BR-007** immutability covers `verified` but AC-VIS-003 explicitly requires it on `performed` treatments. **WF-046** (pg-boss auto-lock cron) is implemented in the repo but never registered. And `getTreatmentPlan` has an optional branch auth guard that is bypassable without a `branchId` query param.

---

## Dimension Results

| Dimension | Score | Notes |
|-----------|------:|-------|
| Public API completeness | 10/10 | All 24 declared endpoints have handlers registered |
| Workflow implementation | 7/10 | WF-007–011, WF-032–034, WF-045 implemented; WF-046 not wired; WF-047 deferred (correct) |
| Domain term consistency | 10/10 | Terms (Visit, Treatment, SOAP Notes, Carry-over, Baseline, Declined) all used correctly |
| State machine enforcement | 8/10 | Visit FSM and Treatment FSM both enforced; BR-003 has minor edge case gap |
| Event publishing | 0/10 | All 6 events declared, none emitted — domain-events.ts never imported |
| Auth / permission enforcement | 7/10 | P0 gap in getTreatmentPlan; hygienist over-permission in 3 handlers |

**P0 cap applied** (getTreatmentPlan optional auth, all domain events missing): score capped at 72.

---

## Findings

### EM-VIS-001 — P0 — getTreatmentPlan branchId guard is optional (bypassable)

**Severity:** P0
**File:** `services/api-ts/src/handlers/dental-visit/treatment-plans/getTreatmentPlan.ts:25-28`
**Spec Section:** §6 Permissions — "Read workspace | all dental roles"
**Confidence:** HIGH

**Description:**
`getTreatmentPlan` accepts an optional `branchId` query param and only calls `assertBranchAccess` when the param is present:
```typescript
const branchId = ctx.req.query('branchId');
if (branchId) await assertBranchAccess(db, user.id, branchId);
```
Any authenticated user (including those with no branch membership) can `GET /dental/patients/:patientId/treatment-plan` without supplying `branchId` and receive the complete pending treatment plan for any patient. This is a data isolation leak — patient treatment data can be accessed cross-branch without membership validation.

**Expected:** `branchId` must be required, or the handler must resolve the patient's branch from context and always enforce `assertBranchAccess`.

---

### EM-VIS-002 — P1 — BR-001 concurrent active visit guard absent in createDentalVisit

**Severity:** P1
**File:** `services/api-ts/src/handlers/dental-visit/visits/createDentalVisit.ts` (entire handler)
**Spec Section:** §5 BR-001, §11 AC-VIS-001, §15 Error Handling (409 ACTIVE_VISIT_EXISTS)
**Confidence:** HIGH

**Description:**
`createDentalVisit` does not check for an existing active or in-progress visit for the patient before creating a new one. The DB unique index (`dental_visit_active_patient_unique`) only covers `status='active'`, and the error handler does NOT map PG unique violation code `23505` to a 409 — it would produce a 500. Additionally, the DB index does not guard `draft` state, so a patient can accumulate multiple draft visits.

`checkInAppointment.ts` correctly calls `findInProgressVisitByPatient` and throws `ConflictError(409)`, but direct `POST /dental/visits` bypasses this entirely.

**AC-VIS-001 explicitly requires:** "Given active visit exists for patient P, When new check-in attempted for P at same branch, Then 409 returned."

**Fix:** Add to `createDentalVisit`:
```typescript
const inProgress = await repo.findInProgressByPatient(body.patientId);
if (inProgress) throw new ConflictError('ACTIVE_VISIT_EXISTS: patient already has an active or draft visit');
```

---

### EM-VIS-003 — P1 — BR-007 immutability guards verified but AC-VIS-003 requires performed

**Severity:** P1
**File:** `services/api-ts/src/handlers/dental-visit/treatments/updateDentalTreatment.ts:47-51`
**Spec Section:** §5 BR-007, §11 AC-VIS-003
**Confidence:** HIGH

**Description:**
The code guards field immutability only on `verified` treatments:
```typescript
if (treatment.status === 'verified') {
  const fieldEdit = body.cdtCode || body.toothNumber !== undefined || body.surfaces || ...
  if (fieldEdit) throw new BusinessLogicError('Verified treatment is immutable', 'TREATMENT_IMMUTABLE');
}
```

AC-VIS-003 explicitly states: "Given treatment.status = performed, When PATCH to change cdt_code attempted, Then 422 returned (BR-007)."

A `performed` treatment can currently have `cdtCode`, `toothNumber`, `surfaces`, `description`, and `conditionCode` changed freely — only `priceCents` is locked at creation time (EC4). This violates the spec's intent that a performed/completed procedure is clinically immutable.

**Fix:** Extend the guard to `performed` status:
```typescript
if (treatment.status === 'verified' || treatment.status === 'performed') {
  // field immutability guard
}
```

---

### EM-VIS-004 — P1 — All domain events DE-001 through DE-006 declared but never emitted

**Severity:** P1
**File:** `services/api-ts/src/handlers/dental-visit/domain-events.ts` (declared); 0 handler files import it
**Spec Section:** §10b Domain Events (DE-001 through DE-006)
**Confidence:** HIGH

**Description:**
`domain-events.ts` declares and exports 6 emit functions:
- `emitVisitCheckedIn` (DE-001)
- `emitVisitCompleted` (DE-002)
- `emitVisitLocked` (DE-003)
- `emitTreatmentDiagnosed` (DE-004)
- `emitTreatmentPerformed` (DE-005)
- `emitTreatmentDismissed` (DE-006)

No handler file imports `domain-events.ts`. Confirmed via full codebase grep — `from.*domain-events` in dental-visit context returns zero production hits. All events are dead code.

Downstream consumers (dental-audit `domain-events.consumer.ts`) expect these events for compliance audit trails. WF-012 postcondition specifies "DE-002 VisitCompleted published."

**Fix:** Wire the emit calls into the appropriate handlers:
- `updateDentalVisit`: DE-001 on `active`, DE-002 on `completed`, DE-003 on `locked`
- `createDentalTreatment`: DE-004 on creation
- `updateDentalTreatment`: DE-005 on `performed`, DE-006 on `dismissed`

---

### EM-VIS-005 — P1 — WF-046 auto-lock job implemented but not registered

**Severity:** P1
**File:** `services/api-ts/src/handlers/dental-visit/repos/visit.repo.ts:154-167`; `services/api-ts/src/app.ts:537-541`
**Spec Section:** §3 WF-046, §14 Dependencies (pg-boss, DE-003)
**Confidence:** HIGH

**Description:**
`VisitRepository.autoLockCompletedVisits(cutoffHours)` is fully implemented and correctly sets visits to `locked` status with a timestamp. However, no `registerCron` call wires this job. The `initializeApp` function registers jobs for email, notifs, audit, and booking, but no dental-visit job module exists.

Compare to other modules that have `jobs/index.ts` with `registerCron`:
```
/handlers/booking/jobs/index.ts     → scheduler.registerCron('booking.slotGenerator', ...)
/handlers/notifs/jobs/index.ts      → scheduler.registerCron('notifs.processScheduled', ...)
/handlers/audit/jobs/index.ts       → scheduler.registerCron('audit.retention', ...)
```

Dental-visit has no equivalent. Completed visits are **never auto-locked** in production, DE-003 is never emitted from the job, and the 48-hour lock window from the spec is permanently breached.

**Fix:** Create `services/api-ts/src/handlers/dental-visit/jobs/index.ts` with a `registerDentalVisitJobs` function calling `scheduler.registerCron('dental-visit.autoLock', '0 */6 * * *', ...)` and register it in `app.ts`.

---

### EM-VIS-006 — P2 — hygienist role allowed in createDentalVisit, upsertDentalChart, createVisitNoteAddendum beyond spec

**Severity:** P2
**File:**
- `services/api-ts/src/handlers/dental-visit/visits/createDentalVisit.ts:27`
- `services/api-ts/src/handlers/dental-visit/chart/upsertDentalChart.ts:33`
- `services/api-ts/src/handlers/dental-visit/notes/createVisitNoteAddendum.ts:33`
**Spec Section:** §6 Permissions
**Confidence:** MEDIUM

**Description:**
Three handlers accept the `hygienist` role beyond what the MODULE_SPEC declares:

| Handler | Allowed Roles (code) | Spec Allows |
|---------|---------------------|-------------|
| createDentalVisit | dentist_owner, dentist_associate, **hygienist** | dentist_owner, dentist_associate |
| upsertDentalChart | dentist_owner, dentist_associate, **hygienist** | dentist_owner, dentist_associate |
| createVisitNoteAddendum | dentist_owner, dentist_associate, **hygienist** | dentist_owner, dentist_associate |

`hygienist` is a valid role in `membership.schema.ts` but is absent from `ROLE_PERMISSION_MATRIX.md` and from MODULE_SPEC §6. This may be intentional product expansion not yet reflected in the spec, or it may be an unauthorized role expansion. Confidence is MEDIUM because the spec may be lagging behind a product decision.

**Fix options:**
1. Remove `hygienist` from these handlers (if not a product decision), OR
2. Update MODULE_SPEC §6 and ROLE_PERMISSION_MATRIX to explicitly include `hygienist` for these operations.

---

### EM-VIS-007 — P2 — BR-003 partial: completed immutability relies on transitions rather than explicit guard

**Severity:** P2
**File:** `services/api-ts/src/handlers/dental-visit/visits/updateDentalVisit.ts:39-58`
**Spec Section:** §5 BR-003, §15 Error Handling (VISIT_IMMUTABLE)
**Confidence:** MEDIUM

**Description:**
BR-003 states "Visit immutable after completed/locked." The code blocks `completed` visit `chiefComplaint` edits when `body.status` is undefined (line 55). The guard at line 39 only explicitly throws for `locked` visits. For `completed` visits with a status change attempt, the code falls through to `VISIT_TRANSITIONS` validation which correctly rejects non-`locked` targets.

The gap: the error code returned is `VISIT_TRANSITION_INVALID` rather than the spec-mandated `VISIT_IMMUTABLE` (§15). The error response naming is inconsistent with the spec error taxonomy.

Additionally, during `completed→locked` transition with `chiefComplaint` in body: the guard at line 55 is skipped (body.status is defined), but the lock path does not update chiefComplaint — so the field is not changed in practice. However, the absence of an explicit guard makes this fragile if the repo is modified.

---

### EM-VIS-008 — P3 — Integration test spec requires DE-002 emission but event infrastructure untested

**Severity:** P3
**File:** `services/api-ts/src/handlers/dental-visit/dental-visit.test.ts`
**Spec Section:** §12 Test Expectations — "Integration: complete visit publishes DE-002"
**Confidence:** HIGH

**Description:**
MODULE_SPEC §12 requires "Integration: check-in flow creates visit; complete visit publishes DE-002." With domain events not wired (EM-VIS-004), this integration test requirement cannot pass. No test currently validates event emission (the test file covers state transitions and SOAP notes but not event publishing).

This is P3 because it's a test coverage gap dependent on the P1 fix for EM-VIS-004.

---

## Public API Completeness — Full Inventory

All declared API endpoints from MODULE_SPEC §10 verified FOUND:

| Endpoint | Handler | Found |
|----------|---------|-------|
| POST /dental/visits | createDentalVisit.ts | FOUND |
| GET /dental/visits | listDentalVisits.ts | FOUND |
| GET /dental/visits/:id | getDentalVisit.ts | FOUND |
| PATCH /dental/visits/:id | updateDentalVisit.ts | FOUND |
| POST /dental/visits/:id/treatments | createDentalTreatment.ts | FOUND |
| GET /dental/visits/:id/treatments | listDentalTreatments.ts | FOUND |
| PATCH /dental/visits/:id/treatments/:tid | updateDentalTreatment.ts | FOUND |
| POST /dental/visits/:id/chart | upsertDentalChart.ts | FOUND |
| GET /dental/visits/:id/chart | getDentalChart.ts | FOUND |
| PATCH /dental/visits/:id/chart/teeth/:n | updateTooth.ts | FOUND |
| GET /dental/visits/history/:pid/teeth/:n | getToothHistory.ts | FOUND |
| POST /dental/visits/:id/notes | upsertVisitNotes.ts | FOUND |
| GET /dental/visits/:id/notes | getVisitNotes.ts | FOUND |
| POST /dental/visits/:id/notes/sign | signVisitNotes.ts | FOUND |
| POST /dental/visits/:id/notes/addendum | createVisitNoteAddendum.ts | FOUND |
| GET /dental/visits/:id/notes/history | getVisitNoteHistory.ts | FOUND |
| POST /dental/patients/:id/dentition | initializeDentition.ts | FOUND |
| GET /dental/patients/:id/treatment-plan | getTreatmentPlan.ts | FOUND (P0 auth gap) |
| POST /dental/patients/:id/treatment-plan/accept | acceptTreatmentPlan.ts | FOUND |
| GET /dental/patients/:id/treatment-plan/versions/:vid | getTreatmentPlanVersion.ts | FOUND |
| POST /dental/visits/:id/carry-over | carryOverTreatments.ts | FOUND |
| POST /dental/templates | createTreatmentTemplate.ts | FOUND |
| GET /dental/templates | listTreatmentTemplates.ts | FOUND |
| PATCH /dental/templates/:id | updateTreatmentTemplate.ts | FOUND |
| DELETE /dental/templates/:id | deleteTreatmentTemplate.ts | FOUND |
| POST /dental/visits/:id/apply-template/:templateId | applyTemplate.ts | FOUND |

**Declared: 26 | FOUND: 26 | MISSING: 0**

---

## State Machine Verification

### Visit FSM (VISIT_TRANSITIONS in visit.schema.ts)
```
draft     → [active]
active    → [completed, discarded]
completed → [locked]
locked    → []
discarded → []
```
**Spec:** `draft→active→completed→locked (+discarded BR-005)` — MATCH

Guards verified in handlers:
- `updateDentalVisit`: explicit `VISIT_TRANSITIONS` check on every status change — FOUND
- `createDentalTreatment`: blocks completed/locked — FOUND
- `updateDentalTreatment`: blocks completed/locked — FOUND
- `upsertVisitNotes`: blocks completed/locked — FOUND
- `upsertDentalChart`: blocks completed/locked — FOUND
- `updateTooth`: blocks completed/locked — FOUND
- `carryOverTreatments`: blocks completed/locked — FOUND
- `applyTemplate`: blocks completed/locked — FOUND

### Treatment FSM (TREATMENT_TRANSITIONS in treatment.schema.ts)
```
diagnosed → [planned, dismissed, declined]
planned   → [performed, dismissed, declined]
performed → [verified, dismissed]
verified  → [dismissed]
dismissed → []
declined  → []
```
**Spec §8:** MATCH — declined terminal, reachable from diagnosed/planned only — CORRECT

`TREATMENT_TRANSITIONS` enforced in `updateDentalTreatment` via `const allowed = TREATMENT_TRANSITIONS[currentStatus]` — FOUND

---

## Domain Event Audit

| Event | Declared | Emitter Function | Called In Production | Status |
|-------|----------|-----------------|---------------------|--------|
| DE-001 VisitCheckedIn | YES | emitVisitCheckedIn | NO | MISSING |
| DE-002 VisitCompleted | YES | emitVisitCompleted | NO | MISSING |
| DE-003 VisitLocked | YES | emitVisitLocked | NO | MISSING |
| DE-004 TreatmentDiagnosed | YES | emitTreatmentDiagnosed | NO | MISSING |
| DE-005 TreatmentPerformed | YES | emitTreatmentPerformed | NO | MISSING |
| DE-006 TreatmentDismissed | YES | emitTreatmentDismissed | NO | MISSING |

**Undeclared events emitted:** None found.

---

## Workflow Implementation Status

| Workflow | Priority | Status | Evidence |
|----------|----------|--------|---------|
| WF-007 Check-in → create visit | P0 | IMPLEMENTED | checkInAppointment.ts + createDentalVisit.ts |
| WF-008 Open workspace | P0 | IMPLEMENTED | getDentalVisit.ts, listDentalVisits.ts |
| WF-009 Chart entry | P0 | IMPLEMENTED | upsertDentalChart.ts, updateTooth.ts |
| WF-010 Mark treatment performed | P0 | IMPLEMENTED | updateDentalTreatment.ts with FSM guard |
| WF-011 SOAP notes authoring | P0 | IMPLEMENTED | upsertVisitNotes.ts, signVisitNotes.ts |
| WF-012 Complete visit | P0 | PARTIAL — DE-002 not emitted | updateDentalVisit.ts completes but emitVisitCompleted not called |
| WF-032 Dentition init | P1 | IMPLEMENTED | initializeDentition.ts (age-based) |
| WF-033 Carry-over display | P1 | IMPLEMENTED | carryOverTreatments.ts |
| WF-034 Timeline carousel navigation | P1 | FRONTEND ONLY | n/a for API layer |
| WF-045 Create visit from workspace | P1 | IMPLEMENTED | createDentalVisit.ts |
| WF-046 Lock completed visits | P2 | NOT WIRED | repo method exists, no cron registered |
| WF-047 Auto-discard empty draft | P3 | DEFERRED (per spec BR-005/ADR-010) | Correctly marked NOT IMPLEMENTED |

---

## Service Layer Status

**PRESENT.** `utils/visit.service.ts` provides:
- `getVisitOrThrow(db, visitId)` — used by dental-clinical, dental-pmd, dental-perio handlers
- `findVisits(db, filters)` — used by dental-patient handlers
- `findInProgressVisitByPatient(db, patientId)` — used by dental-scheduling/checkInAppointment
- `createVisit(db, data)` — used by dental-scheduling/checkInAppointment

Facade pattern correctly implemented via:
- `repos/visit-billing.facade.ts` → dental-billing
- `repos/visit-dental-patient.facade.ts` → dental-patient
- `repos/visit-pmd.facade.ts` → dental-pmd

---

## Stabilization Plan

### Fix Now (P0)
- **EM-VIS-001:** Make `branchId` required in `getTreatmentPlan`; always enforce `assertBranchAccess`

### Fix Before New Work (P1)
- **EM-VIS-002:** Add `findInProgressByPatient` check + `ConflictError(409)` to `createDentalVisit`
- **EM-VIS-003:** Extend field immutability guard in `updateDentalTreatment` to include `performed` status
- **EM-VIS-004:** Wire all 6 emit calls from `domain-events.ts` into appropriate handlers
- **EM-VIS-005:** Create `handlers/dental-visit/jobs/index.ts` with `registerDentalVisitJobs` and register in `app.ts`

### Fix When Touching (P2)
- **EM-VIS-006:** Resolve `hygienist` role inclusion — either update spec or remove from handlers
- **EM-VIS-007:** Replace `VISIT_TRANSITION_INVALID` error code with `VISIT_IMMUTABLE` for completed→non-locked attempts

### Track (P3)
- **EM-VIS-008:** Add integration test for DE-002 emission after EM-VIS-004 is fixed

---

## What's Next

1. **P0 fix first:** Update `getTreatmentPlan` to require branchId (or derive from patient membership)
2. **P1 batch:** EM-VIS-002, EM-VIS-003, EM-VIS-004, EM-VIS-005 can be a single PR — they are independent
3. **P2 cleanup:** EM-VIS-006 requires a product decision on hygienist scope; raise with dentist workflow lead
4. **Re-run enforcement:** After P0+P1 fixes, re-run `oli-enforce-module --module=dental-visit` to confirm score reaches 90+

---

*Report generated by oli-enforce-module run-7 | 2026-05-29*
