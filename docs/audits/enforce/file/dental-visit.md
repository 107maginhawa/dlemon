# oli-enforce-file — dental-visit

**Run ID:** run-6-strict-2026-05-29
**Module:** dental-visit
**Handler root:** `services/api-ts/src/handlers/dental-visit/`
**Files checked:** 61
**Spec:** `docs/product/modules/dental-visit/MODULE_SPEC.md`

---

## Executive Summary

| Check | Result |
|-------|--------|
| Service layer used | ❌ NO — `utils/visit.service.ts` exists but 0 handlers import it |
| Treatment 2-step enforced | ✅ YES — `TREATMENT_TRANSITIONS` map blocks `diagnosed→performed` |
| Lock gate present (all write handlers) | ❌ NO — 3 write handlers missing visit lock check |
| Signed notes immutable | ✅ YES — repo-level `NOTE_SIGNED` guard in `VisitNotesRepository.upsert()` |
| Domain events emitted | ❌ NO — zero `emit`/`publishEvent` calls anywhere |

**P0:** 3 | **P1:** 2 | **P2:** 2 | **P3:** 0

---

## Findings

### EF-VIS-001 — P0 — Missing lock gate: `updateDentalTreatment`

**File:** `services/api-ts/src/handlers/dental-visit/treatments/updateDentalTreatment.ts`

`updateDentalTreatment` fetches the visit to get `branchId` for auth, but never checks `visit.status`. A `PATCH /dental/visits/{visitId}/treatments/{treatmentId}` against a `completed` or `locked` visit succeeds (treatment status transitions and field edits are not blocked by visit state).

**Required fix:** After fetching visit, add:
```typescript
if (visit.status === 'completed' || visit.status === 'locked') {
  throw new BusinessLogicError('Cannot modify treatments on a completed/locked visit', 'VISIT_IMMUTABLE');
}
```

**Spec reference:** BR-003, AC-VIS-002

---

### EF-VIS-002 — P0 — Missing lock gate: `updateTooth`

**File:** `services/api-ts/src/handlers/dental-visit/chart/updateTooth.ts`

`updateTooth` calls `assertBranchRole` correctly but never checks `visit.status`. Chart tooth mutations (`PATCH /dental/visits/{visitId}/chart/teeth/{toothNumber}`) are permitted on completed and locked visits.

**Required fix:**
```typescript
if (visit.status === 'completed' || visit.status === 'locked') {
  throw new BusinessLogicError('Cannot modify chart on a completed/locked visit', 'VISIT_IMMUTABLE');
}
```

**Spec reference:** BR-003

---

### EF-VIS-003 — P0 — Missing lock gate: `upsertDentalChart`

**File:** `services/api-ts/src/handlers/dental-visit/chart/upsertDentalChart.ts`

`upsertDentalChart` calls `assertBranchRole` correctly but never checks `visit.status`. Full chart upsert (`POST /dental/visits/{visitId}/chart`) is permitted on completed and locked visits, including writing to the cumulative baseline.

**Required fix:**
```typescript
if (visit.status === 'completed' || visit.status === 'locked') {
  throw new BusinessLogicError('Cannot modify chart on a completed/locked visit', 'VISIT_IMMUTABLE');
}
```

**Spec reference:** BR-003

---

### EF-VIS-004 — P2 — Domain event DE-002 not emitted on visit complete

**File:** `services/api-ts/src/handlers/dental-visit/visits/updateDentalVisit.ts` (lines ~121–134)

`updateDentalVisit` completes the visit and logs an audit event, but emits no domain event. Downstream consumers (dental-billing, dental-pmd) depend on DE-002 `VisitCompleted` to unlock invoice creation and PMD generation eligibility.

**Required fix:** After `repo.complete(visitId)`, emit DE-002 via the project's domain event bus.

**Spec reference:** MODULE_SPEC §10b — DE-002 VisitCompleted; WF-012 step 5

---

### EF-VIS-005 — P2 — Domain event DE-003 not emitted on visit lock

**File:** `services/api-ts/src/handlers/dental-visit/visits/updateDentalVisit.ts` (lines ~138–142)

`updateDentalVisit` locks the visit but emits no domain event. MODULE_SPEC §10b specifies DE-003 `VisitLocked` dispatched via pg-boss. MODULE_SPEC §14 lists pg-boss as a dependency specifically for this event.

**Required fix:** After `repo.lock(visitId)`, enqueue DE-003 via pg-boss.

**Spec reference:** MODULE_SPEC §10b — DE-003 VisitLocked; §14 Dependencies

---

### EF-VIS-006 — P1 — Service layer entirely bypassed

**File:** `services/api-ts/src/handlers/dental-visit/utils/visit.service.ts`

`visit.service.ts` exists with `getVisitOrThrow`, `findVisits`, `findInProgressVisitByPatient`, `createVisit` helpers, but zero production handlers import it. All handlers call `VisitRepository` directly. This is the service-layer DI gap identified in run-5 as P1 for the whole project.

**Affected handlers (14):**
- `visits/createDentalVisit.ts`, `updateDentalVisit.ts`, `getDentalVisit.ts`, `listDentalVisits.ts`
- `treatments/createDentalTreatment.ts`, `updateDentalTreatment.ts`, `listDentalTreatments.ts`, `acceptTreatmentPlan.ts`, `carryOverTreatments.ts`
- `notes/upsertVisitNotes.ts`, `signVisitNotes.ts`, `getVisitNotes.ts`, `createVisitNoteAddendum.ts`, `getVisitNoteHistory.ts`

**Required fix:** Migrate `findOneById` + auth pattern to `getVisitOrThrow` from service layer; wire `createVisit` through `visit.service.ts`.

---

### EF-VIS-007 — P1 — `updateDentalVisit`: completed-visit immutability guard is partial

**File:** `services/api-ts/src/handlers/dental-visit/visits/updateDentalVisit.ts` (lines 39–56)

`updateDentalVisit` explicitly checks `locked` (throws `VISIT_LOCKED`) but for `completed` visits only blocks `chiefComplaint` edits when no `status` is provided. Status mutations on a completed visit are rejected via `VISIT_TRANSITIONS` map (indirect), but the error code is `VISIT_TRANSITION_INVALID` rather than `VISIT_IMMUTABLE` per spec (BR-003). The explicit guard is missing; the existing behavior is accidentally correct but fragile.

**Required fix:** Add explicit check before transition validation to align with BR-003:
```typescript
if (visit.status === 'completed' && body.status !== 'locked') {
  throw new BusinessLogicError('Completed visit is read-only', 'VISIT_IMMUTABLE');
}
```

**Spec reference:** BR-003, AC-VIS-002

---

## Handler Coverage Matrix

| Handler | assertBranchRole | Lock Gate (completed/locked) | Service Layer | Notes |
|---------|-----------------|------------------------------|---------------|-------|
| `createDentalVisit` | ✅ | N/A (creates new) | ❌ | |
| `getDentalVisit` | ✅ | N/A (read) | ❌ | |
| `listDentalVisits` | ✅ | N/A (read) | ❌ | |
| `updateDentalVisit` | ✅ | ✅ locked / ⚠️ completed partial | ❌ | EF-VIS-007 |
| `createDentalTreatment` | ✅ | ✅ | ❌ | |
| `updateDentalTreatment` | ✅ | ❌ MISSING | ❌ | EF-VIS-001 P0 |
| `listDentalTreatments` | ✅ | N/A (read) | ❌ | |
| `acceptTreatmentPlan` | ✅ | — | ❌ | |
| `carryOverTreatments` | ✅ | ✅ | ❌ | |
| `upsertVisitNotes` | ✅ | ✅ locked only | ❌ | No `completed` check |
| `signVisitNotes` | ✅ | N/A | ❌ | |
| `getVisitNotes` | ✅ | N/A (read) | ❌ | |
| `createVisitNoteAddendum` | ✅ | — | ❌ | |
| `getVisitNoteHistory` | ✅ | N/A (read) | ❌ | |
| `getDentalChart` | ✅ | N/A (read) | ❌ | |
| `getToothHistory` | ✅ | N/A (read) | ❌ | |
| `upsertDentalChart` | ✅ | ❌ MISSING | ❌ | EF-VIS-003 P0 |
| `updateTooth` | ✅ | ❌ MISSING | ❌ | EF-VIS-002 P0 |
| `initializeDentition` | ✅ | — | ❌ | |

---

## Treatment State Machine Verification

`TREATMENT_TRANSITIONS` in `repos/treatment.schema.ts`:
```
diagnosed: ['planned', 'dismissed', 'declined']   ← diagnosed→performed BLOCKED ✅
planned:   ['performed', 'dismissed', 'declined']  ← two-step enforced ✅
performed: ['verified', 'dismissed']
verified:  ['dismissed']
dismissed: []
declined:  []
```

Direct jump `diagnosed→performed` is not in the allowed set. Handler throws `BusinessLogicError` with invalid transition message → 422. ✅

---

## Signed Notes Immutability Verification

- `signVisitNotes`: checks `note.signed` → throws `NOTE_ALREADY_SIGNED` (422) on re-sign. ✅
- `upsertVisitNotes`: delegates to `VisitNotesRepository.upsert()` which checks `existing.signed` → throws `NOTE_SIGNED` (422). ✅ (guard at repo layer, functionally correct)
- Post-sign corrections route through `createVisitNoteAddendum` (addendum-only, append-only). ✅

---

## Scope Note

`completeVisit` and `lockVisit` are not standalone handler files — both are status transitions inside `updateDentalVisit.ts` (`PATCH /dental/visits/{visitId}` with `body.status = 'completed'|'locked'`).

---

*Generated by oli-enforce-file --strict | Run ID: run-6-strict-2026-05-29*
