---
phase: dental-visit-enforce
reviewed: 2026-05-27T00:00:00Z
depth: deep
files_reviewed: 28
files_reviewed_list:
  - services/api-ts/src/handlers/dental-visit/createDentalVisit.ts
  - services/api-ts/src/handlers/dental-visit/updateDentalVisit.ts
  - services/api-ts/src/handlers/dental-visit/updateDentalTreatment.ts
  - services/api-ts/src/handlers/dental-visit/createDentalTreatment.ts
  - services/api-ts/src/handlers/dental-visit/upsertDentalChart.ts
  - services/api-ts/src/handlers/dental-visit/updateTooth.ts
  - services/api-ts/src/handlers/dental-visit/upsertVisitNotes.ts
  - services/api-ts/src/handlers/dental-visit/signVisitNotes.ts
  - services/api-ts/src/handlers/dental-visit/carryOverTreatments.ts
  - services/api-ts/src/handlers/dental-visit/initializeDentition.ts
  - services/api-ts/src/handlers/dental-visit/getTreatmentPlan.ts
  - services/api-ts/src/handlers/dental-visit/visit.service.ts
  - services/api-ts/src/handlers/dental-visit/repos/visit.repo.ts
  - services/api-ts/src/handlers/dental-visit/repos/visit.schema.ts
  - services/api-ts/src/handlers/dental-visit/repos/treatment.repo.ts
  - services/api-ts/src/handlers/dental-visit/repos/treatment.schema.ts
  - services/api-ts/src/handlers/dental-visit/repos/dental-chart.repo.ts
  - services/api-ts/src/handlers/dental-visit/repos/dental-chart.schema.ts
  - services/api-ts/src/handlers/dental-visit/repos/dental-chart-baseline.repo.ts
  - apps/dentalemon/src/routes/_workspace/$patientId.tsx
  - apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx
  - apps/dentalemon/src/features/workspace/components/treatment-table.tsx
  - apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx
  - apps/dentalemon/src/features/workspace/components/treatment-plans-sheet.tsx
  - apps/dentalemon/src/features/workspace/hooks/use-save-tooth-flow.ts
  - apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts
  - apps/dentalemon/src/features/workspace/hooks/use-mark-treatment-done.ts
  - apps/dentalemon/src/features/workspace/hooks/use-update-treatment.ts
findings:
  critical: 5
  warning: 6
  info: 3
  total: 14
status: issues_found
---

# dental-visit Module: Enforcement Review Report

**Reviewed:** 2026-05-27
**Depth:** deep
**Files Reviewed:** 28
**Status:** issues_found

## Summary

The dental-visit module has correct skeletons for its state machines and a reasonable
repository layer. However, five blockers were found: two are security/authorization gaps
(IDOR on dismissed-treatment restore, conditional branch auth in updateDentalTreatment),
two are spec-violating BR gaps (BR-003 not enforced in upsertDentalChart/updateTooth,
chart upsert returns 201 unconditionally), and one is an undeclared blocker on visit
completion (VISIT_HAS_OPEN_TREATMENTS) that contradicts the MODULE_SPEC and API_CONTRACTS
and will prevent dentists from completing routine visits that include carry-over or
insurance-pending treatments.

---

## Critical Issues

### CR-01: IDOR on dismissed-treatment restore in carryOverTreatments

**File:** `services/api-ts/src/handlers/dental-visit/carryOverTreatments.ts:104-112`

**Issue:** The `restoreDismissedIds` path queries `dentalTreatments` by ID and status
only — it does NOT filter by `patientId`. An attacker who knows any dismissed treatment
UUID belonging to a different patient can pass it in `restoreDismissedIds` and clone
that treatment into the current patient's visit. The restored copy inherits
`patientId: currentVisit.patientId` (line 117) so the cross-patient source is silently
laundered into a new legitimate-looking treatment row.

```typescript
// CURRENT — no patient filter on dismissed treatments
const dismissedTreatments = await db
  .select()
  .from(dentalTreatments)
  .where(
    and(
      inArray(dentalTreatments.id, body.restoreDismissedIds),
      eq(dentalTreatments.status, 'dismissed')
      // MISSING: eq(dentalTreatments.patientId, currentVisit.patientId)
    )
  );

// FIX
const dismissedTreatments = await db
  .select()
  .from(dentalTreatments)
  .where(
    and(
      inArray(dentalTreatments.id, body.restoreDismissedIds),
      eq(dentalTreatments.status, 'dismissed'),
      eq(dentalTreatments.patientId, currentVisit.patientId)  // add this
    )
  );
```

---

### CR-02: BR-003 not enforced in upsertDentalChart and updateTooth

**File:** `services/api-ts/src/handlers/dental-visit/upsertDentalChart.ts:18-49`,
`services/api-ts/src/handlers/dental-visit/updateTooth.ts:16-53`

**Issue:** BR-003 states all write operations to a completed or locked visit must return
422 VISIT_IMMUTABLE. `upsertDentalChart` and `updateTooth` both fetch the visit and call
`assertBranchRole`, but neither checks `visit.status` before writing. A dentist can
modify the dental chart of a completed or locked visit without restriction. This allows
retroactive chart modification of locked clinical records.

`createDentalTreatment.ts:36` shows the correct pattern:
```typescript
if (visit.status === 'completed' || visit.status === 'locked') {
  throw new BusinessLogicError(`Cannot add treatments to a ${visit.status} visit`, 'VISIT_IMMUTABLE');
}
```

**Fix:** Add the same guard to both handlers immediately after the visit lookup (after
line 31 in upsertDentalChart, after line 36 in updateTooth):
```typescript
if (visit.status === 'completed' || visit.status === 'locked') {
  throw new BusinessLogicError(
    `Cannot modify chart of a ${visit.status} visit`,
    'VISIT_IMMUTABLE'
  );
}
```

---

### CR-03: Conditional branch authorization in updateDentalTreatment is an auth bypass

**File:** `services/api-ts/src/handlers/dental-visit/updateDentalTreatment.ts:38-39`

**Issue:** Branch role assertion is conditional on the visit being found:
```typescript
const visit = await visitRepo.findOneById(treatment.visitId);
if (visit) await assertBranchRole(db, user.id, visit.branchId, [...]);
```
If `findOneById` returns null (orphaned treatment from cascade failure, direct DB
manipulation, or race condition), `assertBranchRole` is skipped entirely. The handler
proceeds to read and mutate the treatment with no authorization check. This is an auth
bypass for any treatment whose parent visit has been deleted.

**Fix:** Fail closed, not open:
```typescript
const visit = await visitRepo.findOneById(treatment.visitId);
if (!visit) throw new NotFoundError('Parent dental visit');
await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);
```

---

### CR-04: BR-007 immutability only guards `verified` status — `performed` fields are mutable

**File:** `services/api-ts/src/handlers/dental-visit/updateDentalTreatment.ts:41-45`

**Issue:** BR-007 states "Completed treatment immutable (code, tooth, surface, price)".
In the module's treatment FSM, `performed` is the primary completed state (it unlocks
billing in dental-billing). The immutability guard only activates at `verified`. A
`performed` treatment's `cdtCode`, `toothNumber`, `surfaces`, and `description` can be
overwritten through the patch path (lines 91-95). This allows retroactive falsification
of a billed treatment record — a clinical and billing integrity violation.

```typescript
// CURRENT — only blocks verified
if (treatment.status === 'verified') { ... }

// FIX — also block performed
if (treatment.status === 'performed' || treatment.status === 'verified') {
  const fieldEdit = body.cdtCode || body.toothNumber !== undefined
    || body.surfaces || body.description || body.conditionCode;
  if (fieldEdit) throw new BusinessLogicError(
    `${treatment.status} treatment fields are immutable`,
    'TREATMENT_IMMUTABLE'
  );
}
```

---

### CR-05: VISIT_HAS_OPEN_TREATMENTS blocks completion but is undeclared in spec — breaks standard dental workflows

**File:** `services/api-ts/src/handlers/dental-visit/updateDentalVisit.ts:111-113`

**Issue:** The handler throws `VISIT_HAS_OPEN_TREATMENTS (422)` when any treatment has
status `diagnosed` or `planned` at completion time. This rule does not appear in:
- MODULE_SPEC §5 Business Rules (BR-001 through BR-008)
- API_CONTRACTS.md PATCH /dental/visits/:id error list
- WF-012 Complete Visit steps
- AC-VIS-001..005 acceptance criteria

It breaks standard clinical workflows: a dentist may examine and diagnose future work
during a checkup visit, then complete the visit. Diagnosed treatments become the
carry-over / treatment plan. BR-008 carry-over treatments arrive in `diagnosed` or
`planned` status and would also block completion. The MODULE_SPEC explicitly says "Visit
completed with no treatments (allowed — dentist may only do exam)" (§13), confirming
that non-performed treatments should not block completion.

**Fix:** Remove the guard to align with spec:
```typescript
// REMOVE lines 111-113:
if (treatments.some(t => t.status === 'diagnosed' || t.status === 'planned')) {
  throw new BusinessLogicError('Visit has incomplete treatments', 'VISIT_HAS_OPEN_TREATMENTS');
}
```
If this gate is intentionally added as new product behaviour, it must be spec'd as a
BR, added to API_CONTRACTS error list, and documented before enforcement.

---

## Warnings

### WR-01: BR-001 (no concurrent active visit) relies solely on DB unique index — no application-level 409

**File:** `services/api-ts/src/handlers/dental-visit/createDentalVisit.ts:29-36`

**Issue:** `createDentalVisit` does not call `findActiveByPatient` before inserting.
BR-001 is enforced only by a partial unique index. When the constraint fires, Postgres
throws a generic constraint violation — not `ACTIVE_VISIT_EXISTS(409)`. The API contract
specifies `ACTIVE_VISIT_EXISTS(409)`. Callers receive a 500 or untyped DB error.

**Fix:**
```typescript
const existing = await repo.findActiveByPatient(body.patientId);
if (existing) {
  throw new BusinessLogicError('Active visit already exists for patient', 'ACTIVE_VISIT_EXISTS', 409);
}
```

---

### WR-02: upsertVisitNotes does not block writes on `completed` visit (only `locked`)

**File:** `services/api-ts/src/handlers/dental-visit/upsertVisitNotes.ts:35-37`

**Issue:** BR-003 requires all writes to be blocked on `completed` AND `locked` visits.
`upsertVisitNotes` checks only `visit.status === 'locked'` and allows SOAP note edits
on a completed visit. `createDentalTreatment.ts:36` checks both correctly; this handler
does not.

**Fix:**
```typescript
if (visit.status === 'completed' || visit.status === 'locked') {
  throw new BusinessLogicError('Visit is immutable', 'VISIT_IMMUTABLE');
}
```

---

### WR-03: carryOverTreatments auto-discovers up to 5 previous visits — contradicts API contract source_visit_id

**File:** `services/api-ts/src/handlers/dental-visit/carryOverTreatments.ts:53-78`

**Issue:** The handler queries `.limit(5)` previous visits and carries over treatments
from all of them. API_CONTRACTS.md §POST carry-over specifies a `source_visit_id`
(singular) field in the request body. The handler ignores that field entirely in favour
of auto-discovery. MODULE_SPEC BR-008 says "Carry-over creates rows with
`sourceVisitId=<prior visit id>`" — singular. Multi-visit carry-over can create
duplicate treatments if the same unperformed item exists in multiple prior visits.

**Fix:** Honour `source_visit_id` from request body, or explicitly spec and document
the multi-visit auto-carry behaviour in MODULE_SPEC and API_CONTRACTS.

---

### WR-04: initializeDentition does not throw DENTITION_ALREADY_INITIALIZED(409) as declared in API_CONTRACTS

**File:** `services/api-ts/src/handlers/dental-visit/initializeDentition.ts:106-118`

**Issue:** MODULE_SPEC §13 states dentition init must be idempotent (no duplicates).
API_CONTRACTS.md lists `DENTITION_ALREADY_INITIALIZED(409)` as a possible error, but
the handler always calls `repo.upsert(...)` and always returns 201. No 409 is ever
thrown. A second call with a different `dateOfBirth` silently overwrites the tooth set.

**Fix:**
```typescript
const existingChart = await repo.findByVisit(body.visitId);
if (existingChart) {
  throw new BusinessLogicError(
    'Dentition already initialized for this visit',
    'DENTITION_ALREADY_INITIALIZED',
    409
  );
}
```

---

### WR-05: Inline price editor renders for performed/verified treatments — EC4 not enforced in UI

**File:** `apps/dentalemon/src/features/workspace/components/treatment-table.tsx:377-418`

**Issue:** The inline price edit cell renders an editable input for all treatment rows
regardless of status. A dentist can click the price cell on a `performed` treatment and
submit a new price. EC4 (price locked at creation) should block this in UI. The backend
`update` repo also accepts `priceCents` in its type signature and the handler comment
says "EC4: priceCents is locked at creation — updates are ignored" (line 87) but the
`patch` object is built from `body.*` fields and nothing strips `priceCents` from the
final `repo.update(treatmentId, patch)` call if it arrives.

**Fix (UI):**
```tsx
disabled={readOnly || t.status === 'performed' || t.status === 'verified'}
```
**Fix (backend):** Explicitly exclude `priceCents` from the patch Partial type in the
update handler to make the comment a compile-time guarantee.

---

### WR-06: window.confirm used for irreversible visit-lock action

**File:** `apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx:94-99`

**Issue:** `window.confirm()` is used to confirm locking a visit (irreversible). This
call is blocked in many browser contexts (iframes, Electron, some mobile WebViews) and
is not testable with Playwright. The product is iPad-first; `window.confirm` is
unreliable on Safari iOS in standalone PWA mode where it is silently suppressed.

**Fix:** Replace with a Radix `AlertDialog` confirmation, consistent with Shadcn UI
patterns used elsewhere in the codebase.

---

## Info

### IN-01: TRANSITION_LABELS dead entries in TreatmentPlansSheet

**File:** `apps/dentalemon/src/features/workspace/components/treatment-plans-sheet.tsx:38-45`

**Issue:** `TRANSITION_LABELS` contains entries for `draft`, `completed`, and
`cancelled` as destination state labels — none of which are ever reached as targets in
the FSM. No runtime bug (FSM never produces `draft` as a next state), but the dead
entries create confusion when reading the label map.

---

### IN-02: useSaveToothFlow silently drops treatment-save failure with no user feedback

**File:** `apps/dentalemon/src/features/workspace/hooks/use-save-tooth-flow.ts:88-93`

**Issue:** When chart save succeeds but subsequent treatment save fails, the error is
logged to `console.error` only. No toast is shown. The chart and treatment are now out
of sync (tooth entry exists in chart, no treatment row). The `use-save-treatment` hook
already has its own `onError` toast (line 55) so the toast should fire, but the outer
`console.error` creates a misleading double-path that could suppress the inner hook's
error handling depending on how `throwOnError` is configured.

---

### IN-03: getTreatmentPlan includes `declined` treatments in totalEstimateCents

**File:** `services/api-ts/src/handlers/dental-visit/getTreatmentPlan.ts:53-64`

**Issue:** The plan query includes `declined` status in `pendingTreatments` and sums
them into `totalEstimateCents`. Declined treatments (patient informed refusal) inflate
the estimate shown to the patient. API_CONTRACTS.md lists `?status=diagnosed|planned|performed`
as valid filter values; `declined` is not included. Declined rows should appear as
informational context but not contribute to the financial estimate.

**Fix:**
```typescript
const totalEstimateCents = pendingTreatments
  .filter(t => t.status !== 'declined')
  .reduce((sum, t) => sum + t.priceCents, 0);
```

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (gsd-code-reviewer / oli-enforce-module)_
_Depth: deep_
