# oli-enforce-file: dental-clinical
**Run ID:** run-6-strict-2026-05-29
**Module:** dental-clinical
**Handler path:** services/api-ts/src/handlers/dental-clinical/
**Total files in module:** 68 (27 handler files, 15 test files, 29 repos/utils/schema)
**Finding prefix:** EF-CLI-NNN

---

## Summary

| Metric | Value |
|--------|-------|
| Handler files checked | 27 |
| Files with assertBranchAccess/Role | 17 |
| Files missing branch auth | **10** |
| PHI in logs | 0 |
| Append-only violation | **YES** |
| Service layer (class) | 0/27 (all use direct repo) |
| Consent revoke handler | **MISSING** |
| P0 findings | **11** |
| P1 findings | 2 |
| P2 findings | 1 |
| P3 findings | 1 |

---

## P0 Findings — Critical / Must Fix Before Ship

### EF-CLI-001 — `updateMedicalHistoryEntry` violates append-only constraint
**File:** `medical-history/updateMedicalHistoryEntry.ts`
**Severity:** P0
**Rule:** AC-CLI-005 — no PATCH/DELETE endpoints for `medical_history_entry` (append-only).
**Finding:** Handler exists and implements full PATCH with field mutations (`displayName`, `notes`, `resolvedDate`, `active`). This allows retroactive modification of allergy/condition/medication records — a clinical safety and compliance violation.
**Fix:** Remove endpoint. Medical history corrections must go through `amendments/` (WF-038). Delete handler file and deregister route.

---

### EF-CLI-002 — All `inventory/*` handlers missing `assertBranchAccess` / `assertBranchRole`
**Files (5):**
- `inventory/createInventoryAdjustment.ts`
- `inventory/createInventoryItem.ts`
- `inventory/listInventoryAdjustments.ts`
- `inventory/listInventoryItems.ts`
- `inventory/updateInventoryItem.ts`

**Severity:** P0 (clinical data, branch isolation required)
**Finding:** All five inventory handlers authenticate the user (`if (!user)`) but perform **no branch-level authorization**. They verify only that the branch record exists in the DB — any authenticated user from any branch can read/write inventory of any branch. `assertBranchAccess` / `assertBranchRole` calls are entirely absent.
**Fix:** Add `await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'staff_full'])` before any inventory mutation; `assertBranchAccess` before reads.

---

### EF-CLI-003 — All `occlusion/*` handlers missing branch auth
**Files (2):**
- `occlusion/createOcclusionScreening.ts`
- `occlusion/listOcclusionScreenings.ts`

**Severity:** P0
**Finding:** Handlers verify patient exists via `getPatientForClinical` but do not call `assertBranchAccess` on `patient.preferredBranchId`. Any authenticated user can read/write occlusion screenings for any patient across any branch.
**Fix:** After `getPatientForClinical`, add:
```typescript
if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
await assertBranchAccess(db, user.id, patient.preferredBranchId);
```

---

### EF-CLI-004 — All `postop/*` handlers missing branch auth
**Files (3):**
- `postop/createPostopTemplate.ts`
- `postop/listPostopTemplates.ts`
- `postop/updatePostopTemplate.ts`

**Severity:** P0
**Finding:** Handlers verify branch exists in DB but do not call `assertBranchAccess` or `assertBranchRole`. Any authenticated user can create/update post-op templates for any branch.
**Fix:** Add `await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'staff_full'])` for mutations; `assertBranchAccess` for reads.

---

## P1 Findings — High Priority

### EF-CLI-005 — `revokeConsentForm` handler missing (WF-035)
**Severity:** P1
**Finding:** `consent/` directory contains only `createConsentForm.ts`, `listConsentForms.ts`, `signConsentForm.ts`. No `revokeConsentForm.ts` exists. The spec defines WF-035 (Patient revokes consent → status `revoked`; dentist alerted; treatment blocked) as P1. The MODULE_SPEC API Expectations lists `PATCH /dental/visits/:id/consent-forms/:cid/revoke`. No `revoke` string appears anywhere in the module. Revocation is currently impossible at runtime.
**Fix:** Implement `consent/revokeConsentForm.ts`. Status transition: `pending|signed` → `revoked` (one-way, permanent). Block re-signing after revoke (return 422). Fire `dental-clinical.consent.revoked` audit event.

---

### EF-CLI-006 — No service class in any handler (all use direct repo)
**Severity:** P1
**Finding:** All 27 handler files instantiate `*Repository` directly (`new PrescriptionRepository(db)`, etc.). Zero use a service class. Run-5 flagged this as "PARTIAL" — run-6 confirms it is **NOT STARTED**: no service class exists anywhere in the module. This blocks DI, testability improvements, and the service-layer boundary required by the architecture.
**Fix:** Per run-5 plan — create `ClinicalService` (or per-subdomain services) wrapping repo logic; inject via constructor default. Not blocking ship for P0 fixes but should be tracked.

---

## P2 Findings

### EF-CLI-007 — `createAmendment` uses `getActiveMembershipId` instead of `assertBranchAccess/Role`
**File:** `amendments/createAmendment.ts`
**Severity:** P2
**Finding:** Instead of calling `assertBranchRole`, the handler calls `getActiveMembershipId(db, user.id, visit.branchId)` and throws `ForbiddenError` if null. This is functionally equivalent for branch membership check but bypasses the standardized `assertBranchRole` contract. Inconsistency makes auditing harder and may miss role-level restrictions (any member role passes, not role-filtered).
**Fix:** Replace with `await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate'])` to align with module pattern and enforce dentist-only amendment creation.

---

## P3 Findings

### EF-CLI-008 — `inventory/*`, `occlusion/*`, `postop/*` use untyped `ctx: any`
**Severity:** P3
**Finding:** All 10 no-auth handlers declare `ctx: any` instead of `ValidatedContext<Body, Query, Params>`. This disables TypeScript validation of request/response shapes and was likely done to skip validator setup. Remaining 17 handlers use proper typed contexts.
**Fix:** Migrate to `ValidatedContext` with proper generated types from `@/generated/openapi/validators`.

---

## Auth Coverage Map

| Subdirectory | Files | Auth present | Auth type |
|---|---|---|---|
| amendments | 2 | 2/2 | `getActiveMembershipId` (weaker, see EF-CLI-007) |
| attachments | 3 | 3/3 | `assertBranchRole` / `assertBranchAccess` |
| consent | 3 | 3/3 | `assertBranchRole` / `assertBranchAccess` |
| inventory | 5 | **0/5** | none — P0 |
| lab-orders | 3 | 3/3 | `assertBranchRole` / `assertBranchAccess` |
| medical-history | 3 | 3/3 | `assertBranchRole` / `assertBranchAccess` |
| occlusion | 2 | **0/2** | none — P0 |
| postop | 3 | **0/3** | none — P0 |
| prescriptions | 3 | 3/3 | `assertBranchRole` / `assertBranchAccess` |

---

## PHI Safety

**Status: PASS**

All log calls inspected. The `createPrescription` handler logs only:
```
{ requestId, action: 'dental_prescription_create', prescriptionId, visitId, prescriberMemberId, by: user.id }
```
No `drug_name`, `dosage`, `patientName`, `diagnosis`, `condition`, or `signatureData` appear in any log statement across all 27 handler files. MODULE_SPEC §17 requirement ("No PHI in log fields") is satisfied.

---

## Append-Only Constraint

**Status: VIOLATED — P0**

`medical-history/updateMedicalHistoryEntry.ts` implements `PATCH /dental/clinical/medical-history/:entryId` with mutations on `displayName`, `notes`, `resolvedDate`, `active`. This directly contradicts:
- AC-CLI-005: "no PATCH/DELETE endpoints available (append-only)"
- MODULE_SPEC §7: `medical_history_entry` schema marked append-only
- MODULE_SPEC §9 UI: "no edit/delete controls shown"

The handler is fully wired with `assertBranchRole` — it is a real, callable endpoint, not a stub.

---

## Consent Revocation

**Status: NOT IMPLEMENTED — P1**

WF-035 (consent revocation) has no handler. The sign flow (`signConsentForm.ts`) correctly blocks re-signing of already-signed forms but has no revocation path. No `revoke` token appears in any file in the module. The `consent_form.status` field supports `revoked` per schema but the transition is unreachable via API.

---

## Service Layer (DI Baseline)

**Status: NOT STARTED**

Run-5 baseline: "PARTIAL". Run-6 finding: 0/27 handlers use a service class. All handlers instantiate `*Repository` directly. No `*Service` class exists anywhere in `dental-clinical/`. This is a P1 architectural gap carried from run-5.

---

## Test Coverage

**Handler-level tests:** 9 test files covering all 9 subdirectories.

| Subdirectory | Test file(s) |
|---|---|
| prescriptions | `acceptance.clinical-workflows.test.ts`, `clinical-prescription-history.test.ts`, `dental-clinical.prescription-allergy-check.test.ts`, `prescription.fsm.property.test.ts` |
| amendments | `clinical-attachment-amendment.test.ts` |
| attachments | `clinical-attachment-amendment.test.ts` |
| consent | `acceptance.clinical-workflows.test.ts`, `clinical-consent-lab.test.ts`, `clinical-prescription-history.test.ts` |
| inventory | `dental-clinical-inventory.test.ts` |
| lab-orders | `acceptance.clinical-workflows.test.ts`, `clinical-consent-lab.test.ts` |
| medical-history | `acceptance.clinical-workflows.test.ts`, `clinical-prescription-history.test.ts` |
| occlusion | `dental-clinical-occlusion.test.ts` |
| postop | `dental-clinical-postop.test.ts` |

**Repo-level tests:** 6 files (amendment, attachment, consent-form, lab-order, medical-history, prescription).

**Gap:** No test validates the append-only constraint is enforced (because the implementation violates it). Inventory/occlusion/postop tests likely do not cover branch-auth paths since no auth is present in those handlers.

---

## Finding Register

| ID | Severity | File(s) | Description |
|----|----------|---------|-------------|
| EF-CLI-001 | P0 | `medical-history/updateMedicalHistoryEntry.ts` | PATCH endpoint violates append-only medical history |
| EF-CLI-002 | P0 | `inventory/*.ts` (5 files) | No branch auth on any inventory handler |
| EF-CLI-003 | P0 | `occlusion/*.ts` (2 files) | No branch auth on occlusion handlers |
| EF-CLI-004 | P0 | `postop/*.ts` (3 files) | No branch auth on postop handlers |
| EF-CLI-005 | P1 | (missing) | `revokeConsentForm.ts` not implemented (WF-035) |
| EF-CLI-006 | P1 | all 27 handlers | No service class — all direct repo instantiation |
| EF-CLI-007 | P2 | `amendments/createAmendment.ts` | Uses `getActiveMembershipId` instead of `assertBranchRole` |
| EF-CLI-008 | P3 | inventory/occlusion/postop (10 files) | `ctx: any` untyped context |

---

## JSON Summary

```json
{"module":"dental-clinical","files_checked":27,"auth_missing":10,"phi_risk":0,"append_only_violation":true,"p0":11,"p1":2,"p2":1,"p3":1}
```
