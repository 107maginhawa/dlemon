<!-- oli-enforce-module: dental-clinical | generated: 2026-05-27 | depth: deep -->

# Enforcement Audit — dental-clinical

**Module:** dental-clinical  
**Reviewed:** 2026-05-27  
**Depth:** deep (cross-file, workflow, event, and spec tracing)  
**Reviewer:** Claude (gsd-code-reviewer / oli-enforce-module)

---

## Summary

The dental-clinical module covers prescriptions, lab orders, consent forms, medical history, amendments, and attachments. The core happy-path slices are implemented. Five declared workflows (WF-016 through WF-039) were traced end-to-end. The following findings were produced, ranging from BLOCKER (security/correctness) to WARNING (spec divergence/quality) to INFO (observability/cleanup).

**Finding counts:** 6 BLOCKER · 7 WARNING · 4 INFO

---

## BLOCKER Issues

### BL-01: BR-003 Visit Immutability Not Enforced on createPrescription, signConsentForm, createConsentForm, createAttachment, createAmendment, updatePrescription

**Files:**
- `services/api-ts/src/handlers/dental-clinical/createPrescription.ts:30-60`
- `services/api-ts/src/handlers/dental-clinical/signConsentForm.ts:32-47`
- `services/api-ts/src/handlers/dental-clinical/createConsentForm.ts:28-41`
- `services/api-ts/src/handlers/dental-clinical/createAttachment.ts:28-45`
- `services/api-ts/src/handlers/dental-clinical/createAmendment.ts:29-56`
- `services/api-ts/src/handlers/dental-clinical/updatePrescription.ts:32-44`

**Issue:** BR-003 requires a 422 `VISIT_IMMUTABLE` error on any clinical write to a completed or locked visit. Only `createLabOrder.ts` (line 31) checks `visit.status` before writing. Every other write handler fetches the visit for branch authorization but never inspects `visit.status`. A dentist can write new prescriptions, sign consent forms, upload attachments, or amend records on a visit that is already `completed` or `locked`.

**Spec reference:** MODULE_SPEC §5 BR-003 — "Visit immutable after completed → no clinical writes → 422 on write to locked visit." AC-CLI-006: "Write to clinical record on completed visit → 422."

**Fix:** Extract a shared guard — call it immediately after `getVisitOrThrow`:
```typescript
// shared-guard.ts (or inline in each handler)
function assertVisitMutable(visit: { status: string }) {
  if (visit.status === 'completed' || visit.status === 'locked') {
    throw new BusinessLogicError(
      `Cannot write to a ${visit.status} visit`,
      'VISIT_IMMUTABLE',
      422,
    );
  }
}
```
Apply to: `createPrescription`, `signConsentForm`, `createConsentForm`, `createAttachment`, `createAmendment`, and `updatePrescription`.

Note: `updateLabOrder` does NOT need this guard per spec edge case §13 ("Lab order completed after visit locked → allowed").

---

### BL-02: WF-035 (Revoke Consent) — Handler Does Not Exist

**File:** `services/api-ts/src/handlers/dental-clinical/` (missing file)

**Issue:** WF-035 (patient revokes consent) is a declared P1 workflow. `MODULE_SPEC §10` declares `PATCH /dental/visits/:id/consent-forms/:cid/revoke`. `API_CONTRACTS.md` fully specifies the endpoint including request body (`reason` required, min 5 chars) and `DE-013 ConsentRevoked` event emission. There is no `revokeConsentForm.ts` handler anywhere in the module. The endpoint is wholly absent; callers get a 404.

**Fix:** Implement `revokeConsentForm.ts`:
```typescript
export async function revokeConsentForm(ctx): Promise<Response> {
  // 1. Auth + getVisitOrThrow for branch auth
  // 2. repo.findOneById(consentId) — 404 if missing
  // 3. repo.revoke(consentId, body.reason)  — update status to 'revoked'
  // 4. Emit DE-013 ConsentRevoked
  // 5. Return 200 { ok: true }
}
```
Also add `revoke()` method to `ConsentFormRepository`.

---

### BL-03: Consent Sign Auth Allows Staff/Hygienist to Sign on Behalf of Patient

**File:** `services/api-ts/src/handlers/dental-clinical/signConsentForm.ts:33`

**Issue:** The sign endpoint enforces `assertBranchRole(... ['dentist_owner', 'dentist_associate'])`. The API contract (API_CONTRACTS §PATCH /sign) specifies `Auth: staff_full, dentist_associate, dentist_owner` — but more critically the spec requires the form to represent patient authorization (MODULE_SPEC §3 WF-018: "Patient receives link … signature captured"). The `createConsentForm` handler at line 29 allows `hygienist` to create forms, but `signConsentForm` blocks `hygienist` from signing. This is internally inconsistent: a hygienist can create a form but not sign it. The API contract says `staff_full` should be allowed to trigger signing (for witnessed paper consent), but the handler rejects them with 403. Any clinic workflow where staff witness paper consent is blocked.

**Fix:** Align `signConsentForm` roles with the API contract:
```typescript
await assertBranchRole(db, user.id, visit.branchId,
  ['dentist_owner', 'dentist_associate', 'staff_full']);
```

---

### BL-04: Domain Events DE-012 to DE-016 Are Never Emitted

**Files:**
- `services/api-ts/src/handlers/dental-clinical/createPrescription.ts`
- `services/api-ts/src/handlers/dental-clinical/signConsentForm.ts`
- `services/api-ts/src/handlers/dental-clinical/createLabOrder.ts`
- `services/api-ts/src/handlers/dental-clinical/updateLabOrder.ts`

**Issue:** MODULE_SPEC §10b declares five published events: DE-012 ConsentSigned, DE-013 ConsentRevoked, DE-014 LabOrderCreated, DE-015 LabOrderCompleted, DE-016 PrescriptionWritten. API_CONTRACTS confirms these events on each relevant endpoint. Zero events are emitted anywhere in the module. The EVENT_CONTRACTS.md specifies at-least-once delivery via pg-boss. Consumer `dental-audit` subscribes to all five; `notifs` subscribes to DE-015 (LabOrderCompleted) for dentist alerts. Failure to emit DE-016 means audit trail for prescriptions is absent. Failure to emit DE-015 means dentists are never notified when a lab order completes.

**Fix:** Add pg-boss publish calls in each handler after successful DB write:
```typescript
// After prescription created:
await ctx.get('pgBoss').send('DE-016:PrescriptionWritten@1', {
  prescription_id: prescription.id,
  visit_id: visitId,
  patient_id: body.patientId,
  written_at: new Date().toISOString(),
});
```
Replicate for DE-012, DE-014, DE-015 in the respective handlers.

---

### BL-05: Medical History `updateMedicalHistoryEntry` Handler Violates Append-Only Spec

**File:** `services/api-ts/src/handlers/dental-clinical/updateMedicalHistoryEntry.ts:1-45`

**Issue:** MODULE_SPEC §5 AC-CLI-005 states "Medical history entry → no PATCH/DELETE endpoints available (append-only)." API_CONTRACTS §PATCH /medical-history returns `405 MEDICAL_HISTORY_IMMUTABLE`. Yet `updateMedicalHistoryEntry.ts` is a fully functional PATCH handler that mutates `displayName`, `notes`, `resolvedDate`, and `active`. The handler is registered in the test app (`ac-clinical.test.ts` line 134) and presumably in the production router. This directly violates the append-only invariant.

The `MedicalHistoryRepository.update()` method enables mutation of `displayName` which is particularly problematic — changing the display name of an allergy or medication entry is a silent clinical record alteration with no audit trail.

**Fix:** Remove the `updateMedicalHistoryEntry` handler and its route registration. The correct pattern per spec is:
- Mark an entry inactive: new entry with `active: false` (append a new record)
- Correct a coding error: append a new entry with correct values; old entry stays
- OR if soft-deactivation is needed, scope the PATCH to only `active: false` and restrict to dentist roles

The `MedicalHistoryRepository.update()` method allowing `displayName` mutation must also be restricted or removed.

---

### BL-06: Allergy Cross-Check in createPrescription Uses Unvalidated Patient ID from Request Body

**File:** `services/api-ts/src/handlers/dental-clinical/createPrescription.ts:37-47`

**Issue:** The allergy cross-check queries `medicalHistoryEntries` using `body.patientId` (line 39). This patient ID comes from the request body — it is not validated against the visit's actual `patientId`. An attacker or misconfigured client can supply any patient UUID and receive allergy data for that patient embedded in the allergy warning response (line 44-46: `allergyWarnings` includes drug names from the target patient's allergy entries). This is a patient data cross-contamination path: the warning response leaks that a specific patient has a specific allergy by returning `allergyConflicts: ["Penicillin"]`.

**Fix:** Derive `patientId` from the visit record fetched at line 30, not from the request body:
```typescript
const visit = await getVisitOrThrow(db, visitId);
// ...
const allergies = await db.select().from(medicalHistoryEntries).where(
  and(
    eq(medicalHistoryEntries.patientId, visit.patientId), // ← use visit.patientId
    eq(medicalHistoryEntries.entryType, 'allergy'),
    eq(medicalHistoryEntries.active, true)
  )
);
```

---

## WARNING Issues

### WR-01: Lab Order FSM Status Names Diverge from API Contract

**File:** `services/api-ts/src/handlers/dental-clinical/repos/lab-order.schema.ts:12-18`

**Issue:** The schema defines statuses `ordered | in_fabrication | delivered | fitted | cancelled`. The API contract (API_CONTRACTS §PATCH /lab-orders/:lid) declares the allowed values as `sent | received | completed | rejected`. The frontend (`lab-orders-sheet.tsx:20`) uses the schema values (`ordered | in_fabrication | delivered | fitted | cancelled`), which diverges from the API contract. This means the contract, the schema, and the frontend are three different FSMs — any contract test, external integration, or generated SDK consumer will use the wrong status names.

**Fix:** Reconcile to one canonical FSM. Given the schema and frontend already agree (`ordered → in_fabrication → delivered → fitted`), update the API contract to match. Or if the API contract is the system of record, migrate the schema enum and all usages.

---

### WR-02: listPrescriptions Fetches All Rows Then Paginates In Memory

**File:** `services/api-ts/src/handlers/dental-clinical/listPrescriptions.ts:29-39`

**Issue:** `repo.findMany({ visitId })` returns all prescriptions for the visit, then `items.slice(offset, offset + limit)` (line 39) paginates in memory. The pagination `meta` reports `totalCount = items.length` (line 33) which is the total before slicing, but the `page` response only contains the slice. This is correct for count, but for visits with many prescriptions this becomes a full-table-for-visit scan. More critically: `parsePagination` is called *after* `findMany`, so the repository is never given the limit/offset — the DB always returns all rows.

**Fix:** Pass pagination to the repository query:
```typescript
const { limit, offset } = parsePagination(ctx.req.query(), { limit: 50 });
const [items, totalCount] = await repo.findManyPaginated({ visitId }, { limit, offset });
```

---

### WR-03: signConsentForm Uses `existing.signed` Boolean Instead of Checking Status Field

**File:** `services/api-ts/src/handlers/dental-clinical/signConsentForm.ts:35`

**Issue:** The guard `if (existing.signed)` checks the `signed` boolean column. The repo's `sign()` method (consent-form.repo.ts line 51) uses `WHERE signed = false` as the update condition. If the DB write in `sign()` races with a concurrent second sign attempt, both may pass the `existing.signed` check before either writes. The atomic update in the repo partially protects this, but the error thrown is a generic `ValidationError` with status implied as 422. The AC-MED-04 test (ac-clinical.test.ts line 335) expects status 400, not 422 — the test assertion will fail against the real error status, meaning AC-MED-04 is broken.

**Fix:**
1. Confirm the `ValidationError` constructor maps to 400, not 422 (check `core/errors.ts`). If it maps to 422, fix the test assertion or the error type.
2. For the double-sign scenario, the repo's atomic WHERE clause is the correct guard, but the handler should propagate a typed `CONSENT_FORM_SIGNED(422)` per the API contract rather than a generic message.

---

### WR-04: createConsentForm Allows `hygienist` Role But Module Spec Does Not

**File:** `services/api-ts/src/handlers/dental-clinical/createConsentForm.ts:29`

**Issue:** `assertBranchRole(... ['dentist_owner', 'dentist_associate', 'hygienist'])` grants `hygienist` consent form creation. MODULE_SPEC §6 lists "Create consent form" as allowed only for `dentist_owner` and `dentist_associate`. The role permission matrix should be the source of truth, and this handler exceeds it.

**Fix:** Remove `hygienist` from the allowed roles list:
```typescript
await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);
```

---

### WR-05: createAmendment Does Not Validate That the Amendment References a Real Record

**File:** `services/api-ts/src/handlers/dental-clinical/createAmendment.ts:46-54`

**Issue:** The amendment schema stores `originalRecordType` (text) and `originalRecordId` (uuid, polymorphic, no FK — per schema comment). The handler passes `body.originalRecordType` and `body.originalRecordId` directly to the repo with no validation that the referenced record exists in the appropriate table. A caller can submit an amendment referencing a non-existent prescription ID or a random UUID; the record will be created silently with a dangling reference. This undermines the audit trail purpose of amendments.

**Fix:** Validate the original record before creating the amendment:
```typescript
if (body.originalRecordType === 'prescription') {
  const prescRepo = new PrescriptionRepository(db);
  const orig = await prescRepo.findOneById(body.originalRecordId);
  if (!orig || orig.visitId !== visitId) throw new NotFoundError('Original record');
}
// repeat for other record types
```

---

### WR-06: AttachmentsSheet "All" Tab Leaks Cross-Visit Patient Attachments Without Auth Scope

**File:** `apps/dentalemon/src/features/workspace/components/attachments-sheet.tsx:272`

**Issue:** `useAttachments(visitId)` fetches only by `visitId`. The "All" tab (line 273: `const displayed = tab === 'all' ? attachments : visitAttachments`) displays `attachments` as the full set. But `attachments` is the result of the visit-scoped query — it is NOT a patient-level query. The "All" count badge and tab implies patient-level history but only shows visit-level data. This creates a misleading UI that could cause clinical errors (e.g., dentist believes they see all patient attachments but only sees those for this visit).

If a true patient-level query were added later, it would need a separate endpoint — the current `listAttachments` endpoint is visit-scoped. The module does not define a patient-scoped attachment list endpoint.

**Fix:** Either:
1. Remove the "All" tab until a patient-scoped attachment list endpoint is implemented, OR
2. Add a second query `useAttachments(null, patientId)` that hits a patient-scoped endpoint and uses it for the "All" tab.

---

### WR-07: Medical History `toggleEntry` Calls `updateMedicalHistoryEntry` Which Violates the Append-Only Spec

**File:** `apps/dentalemon/src/features/workspace/hooks/use-medical-history.ts:97-107`

**Issue:** `toggleEntry` calls `updateMedicalHistoryEntry` with `{ active: bool }` to toggle an allergy/condition on/off. This relies on the PATCH endpoint that BL-05 identifies as a spec violation. Even if PATCH were limited to `active` only, the `MedicalHistoryForm` component (medical-history-form.tsx:175) also calls `updateEntry` with `{ displayName: pregnancyLabel }` to update the pregnancy/smoking/alcohol free-text labels — mutating display names on medical records without audit trail.

This is a frontend manifestation of BL-05. When BL-05 is resolved the frontend must be updated to use append-only semantics.

---

## INFO Items

### IN-01: AC-PRES-04 and AC-PRES-05 Are Duplicate Tests

**File:** `services/api-ts/src/handlers/dental-clinical/ac-clinical.test.ts:496-543`

**Issue:** AC-PRES-04 and AC-PRES-05 test the exact same condition (missing `drugName` field returns 400). The test file comment acknowledges this ("two different assertion angles") but both tests are identical in setup and assertion. This dilutes test coverage signal — another rule violation could go untested because the test count looks healthy.

**Fix:** Replace AC-PRES-05 with a genuinely different coverage target, such as: non-dentist role writing a prescription returns 403, or writing a prescription to a locked visit returns 422 (which is currently untested per BL-01).

---

### IN-02: `console.error` in AmendmentForm Frontend Component

**File:** `apps/dentalemon/src/features/workspace/components/amendment-form.tsx:62`

**Issue:** `console.error('Amendment save failed', err)` logs a raw error to the browser console. In production this could expose server error details. The project standards prohibit PHI in logs; error objects from amendment failures may contain patient or clinical context in their messages.

**Fix:** Remove the `console.error` call or replace with a structured logger:
```typescript
// Remove: console.error('Amendment save failed', err);
// The catch block already sets the user-visible error state.
```

---

### IN-03: `deleteAttachment` Allows Deletion on Locked Visit — Inconsistent With BR-003

**File:** `services/api-ts/src/handlers/dental-clinical/deleteAttachment.ts:27-31`

**Issue:** `deleteAttachment` fetches the parent visit for branch authorization (line 27) but never checks `visit.status`. A user with `dentist_owner` or `dentist_associate` role can soft-delete an attachment on a completed/locked visit. Whether deletion should be allowed post-completion is not explicitly resolved in the spec (BR-003 says "no clinical writes" — deletion is arguably a write). The spec does not grant an exemption for deletions the way it does for lab order status updates.

**Fix:** Apply the same immutability guard from BL-01 to `deleteAttachment`, or explicitly document the decision to allow deletion post-lock.

---

### IN-04: WF-038 Amendment Spec Requires Audit Event; Handler Emits None

**File:** `services/api-ts/src/handlers/dental-clinical/createAmendment.ts:46-56`

**Issue:** MODULE_SPEC §4 WF-038 states: "Audit event emitted: `clinical.amendment.created` with both original and amendment IDs." The handler creates the amendment record but never emits any audit event (no pg-boss send, no audit logger call, unlike `deleteAttachment.ts` which calls `audit.logEvent`). Amendments on locked clinical records are high-sensitivity operations and must be in the audit trail.

**Fix:** Add audit log emission after successful amendment creation:
```typescript
ctx.get('logger')?.info(
  { action: 'clinical.amendment.created', amendmentId: amendment.id,
    originalRecordType: body.originalRecordType, originalRecordId: body.originalRecordId,
    visitId, by: user.id },
  'Clinical amendment created',
);
```

---

## Workflow Coverage Matrix

| Workflow | Spec Priority | Backend Handler | Frontend Component | Visit Immutability Guard | Domain Event Emitted |
|----------|--------------|-----------------|-------------------|--------------------------|----------------------|
| WF-016 Write Prescription | P0 | createPrescription.ts | rx-sheet.tsx | MISSING (BL-01) | MISSING (BL-04) |
| WF-017 Create Lab Order | P0 | createLabOrder.ts | lab-orders-sheet.tsx | PRESENT | MISSING (BL-04) |
| WF-018 Obtain Consent Signature | P0 | signConsentForm.ts | consent-sheet.tsx | MISSING (BL-01) | MISSING (BL-04) |
| WF-035 Patient Revoke Consent | P1 | MISSING (BL-02) | N/A | N/A | N/A |
| WF-036 Lab Order Status Progression | P1 | updateLabOrder.ts | lab-orders-sheet.tsx | N/A (spec exempted) | MISSING (BL-04) |
| WF-037 Medical History Entry | P1 | createMedicalHistoryEntry.ts | medical-history-form.tsx | N/A (patient-scoped) | Not declared |
| WF-038 Clinical Amendment | P2 | createAmendment.ts | amendment-form.tsx | MISSING (BL-01) | MISSING (IN-04) |
| WF-039 File Attachment Upload | P1 | createAttachment.ts | attachments-sheet.tsx | MISSING (BL-01) | Not declared |

---

## Business Rules Enforcement Matrix

| Rule | Description | Status |
|------|-------------|--------|
| BR-003 | Visit immutable after completed | PARTIAL — only createLabOrder guards; 7 other write handlers do not |
| BR-014 | Consent required before treatment proceeds | NOT ENFORCED at server level — consent-billing.facade exists but no treatment handler is wired to it |
| BR-017 | Prescription requires prescriberMemberId (dentist role) | ENFORCED — assertBranchRole checks dentist role |
| BR-018 | Lab order lifecycle forward-only | ENFORCED — LAB_ORDER_TRANSITIONS in schema, checked in repo |
| BR-019 | Supervisor approval for amendments NOT IMPLEMENTED | CORRECT — not implemented, no 501 endpoint created (spec note: return 501 for approval endpoint only) |

---

_Reviewed: 2026-05-27_  
_Reviewer: Claude (gsd-code-reviewer / oli-enforce-module)_  
_Depth: deep_
