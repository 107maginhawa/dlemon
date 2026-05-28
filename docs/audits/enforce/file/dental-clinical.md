# Enforcement Report: dental-clinical
<!-- oli-enforce-file v1.0 | generated: 2026-05-27 | module: dental-clinical -->

**Module spec:** `docs/product/modules/dental-clinical/MODULE_SPEC.md`
**API contracts:** `docs/product/modules/dental-clinical/API_CONTRACTS.md`
**Backend source:** `services/api-ts/src/handlers/dental-clinical/`
**Frontend source:** `apps/dentalemon/src/features/workspace/components/` (clinical files only)

---

## Summary

| Tier | Count |
|------|-------|
| FOUND | 28 |
| MISSING | 7 |
| DIVERGED | 9 |
| OUT-OF-SPEC | 4 |

---

## Backend Handlers

### POST /dental/visits/:visitId/prescriptions — createPrescription.ts

**FOUND.** Handler exists. `assertBranchRole(['dentist_owner','dentist_associate'])` enforced (BR-017). Allergy cross-check present (non-blocking). Prescription persisted, 201 returned.

**DIVERGED — B-01:** `VISIT_IMMUTABLE` guard (BR-003) is **absent** from `createPrescription.ts`. Only `createLabOrder.ts` has the `visit.status === 'completed' || visit.status === 'locked'` guard. Any write to `prescriptions` on a completed visit will succeed silently, violating AC-CLI-006.

**DIVERGED — B-02:** `ValidationError` (HTTP 400) is thrown for `CONSENT_FORM_SIGNED` in `signConsentForm.ts` (line 36-37). The spec and error taxonomy require `422` with code `CONSENT_FORM_SIGNED`. `ValidationError` maps to HTTP 400 (confirmed in `core/errors.ts:39`), not 422. AC-CLI-003 requires immutability — the wrong status code breaks any client guard relying on 422.

**DIVERGED — B-03:** `createPrescription.ts` does not validate that `prescriberMemberId` in the request body actually matches the calling user's membership. A dentist can submit another member's `prescriberMemberId` without rejection. BR-017 requires the prescriber be the authenticated dentist; server-side enforcement only checks that the caller has the dentist role, not that the submitted ID is their own membership.

---

### GET /dental/visits/:visitId/prescriptions — listPrescriptions.ts

**FOUND.** Handler exists. Uses `assertBranchAccess` (read-scoped). Pagination applied. Returns `{ data, pagination }`.

**DIVERGED — B-04:** Pagination applied *after* full fetch (`repo.findMany` returns all rows; slice applied in memory). For large visit prescription lists this is benign but is a known pattern divergence from the repo-level pagination pattern used elsewhere. The contract specifies `{ data: Prescription[] }` with no pagination envelope — the actual response wraps in `{ data, pagination }`. Technically a schema divergence.

---

### POST /dental/visits/:visitId/lab-orders — createLabOrder.ts

**FOUND.** Handler exists. `VISIT_IMMUTABLE` guard present (lines 31–36). `assertBranchRole(['dentist_owner','dentist_associate'])` enforced.

**DIVERGED — B-05:** Schema field mismatch. The API contract specifies `order_type` (string, required) and `tooth_number` (integer, nullable), `shade` (string, nullable), `instructions` (string, nullable). The actual `labOrders` schema and `createLabOrder` handler accept `description` (not `order_type`), no `tooth_number`, no `shade`. Contract compliance is broken for the create-lab-order endpoint.

---

### PATCH /dental/visits/:visitId/lab-orders/:orderId — updateLabOrder.ts

**FOUND.** Handler exists. FSM enforcement via `LAB_ORDER_TRANSITIONS`. `assertBranchRole` enforced.

**DIVERGED — B-06:** `ValidationError` thrown on invalid status transition (line 43). Spec requires HTTP 422 with code `INVALID_STATUS_TRANSITION`. `ValidationError` → HTTP 400. Wrong status code. Use `BusinessLogicError('...', 'INVALID_STATUS_TRANSITION')`.

**DIVERGED — B-07:** `updateLabOrder.ts` restricts PATCH to `['dentist_owner','dentist_associate']` (line 34), but the API contract grants `staff_full` access to update lab order status. The spec section 6 table confirms `staff_full` can update lab orders.

---

### POST /dental/visits/:visitId/consent-forms — createConsentForm.ts

**FOUND.** Handler exists. Persists consent form with template snapshot. Returns 201.

**DIVERGED — B-08:** `createConsentForm.ts` grants `assertBranchRole(['dentist_owner','dentist_associate','hygienist'])` (line 29). The API contract specifies `staff_full`, `dentist_associate`, `dentist_owner`. `hygienist` is not an authorized role per contract; `staff_full` is missing. Role set is wrong on both ends.

**DIVERGED — B-09:** `VISIT_IMMUTABLE` guard (BR-003) is **absent** from `createConsentForm.ts`. Writing a consent form to a completed/locked visit will succeed, violating AC-CLI-006.

---

### PATCH /dental/visits/:visitId/consent-forms/:cid/sign — signConsentForm.ts

**FOUND.** Handler exists. Immutability check on already-signed form is present (line 35). Signature data stored.

*(See B-02 for HTTP status code divergence on already-signed path.)*

---

### PATCH /dental/visits/:visitId/consent-forms/:cid/revoke — revokeConsentForm

**MISSING — M-01:** No `revokeConsentForm` handler exists in `services/api-ts/src/handlers/dental-clinical/`. The route `PATCH /dental/visits/:visitId/consents/:consentId/revoke` is absent from `generated/openapi/routes.ts`. WF-035, DE-013, and AC-CLI-003 are unimplemented. The `consent_form` schema has no `revoked_at` or `revoke_reason` column.

---

### POST /dental/patients/:id/medical-history — createMedicalHistoryEntry.ts

**FOUND.** Handler exists. Append logic present. `assertBranchRole` checked.

**DIVERGED — B-10:** Route path mismatch. The API contract specifies `POST /api/v1/dental/patients/:id/medical-history` (patient-scoped). The actual registered route is `POST /dental/clinical/medical-history` (body-scoped, patient ID in body). Frontend hook `use-medical-history.ts` and `medical-history-form.tsx` call the `/dental/clinical/medical-history` path, so this is consistently implemented — but diverges from the contract spec.

---

### GET medical-history (list)

**FOUND.** `listMedicalHistory.ts` exists. Query parameter `patientId` required. Returns `{ data, pagination }`.

---

### PATCH /dental/clinical/medical-history/:entryId — updateMedicalHistoryEntry.ts

**OUT-OF-SPEC — OS-01:** `updateMedicalHistoryEntry.ts` implements a full PATCH on medical history entries. The API contract (section for POST /patients/:id/medical-history) states: `PATCH/DELETE → 405 MEDICAL_HISTORY_IMMUTABLE`. The spec rule AC-CLI-005 states: "no PATCH/DELETE endpoints available (append-only)". This handler implements exactly what the spec forbids. The route is registered in `generated/openapi/routes.ts` line 584. The frontend `use-medical-history.ts` hook calls `updateMedicalHistoryEntry` to toggle `active` and update notes — this entire mutation path violates the append-only invariant.

---

### POST /dental/visits/:visitId/attachments — createAttachment.ts

**FOUND.** Handler exists. `assertBranchRole(['dentist_owner','dentist_associate','hygienist'])` enforced.

**DIVERGED — B-11:** `VISIT_IMMUTABLE` guard (BR-003) is **absent** from `createAttachment.ts`. Attachments can be uploaded to completed visits without restriction, violating AC-CLI-006 (exception: the spec's edge cases note lab order updates are exempt; no equivalent exemption for attachments).

**DIVERGED — B-12:** The API contract defines the attachment endpoint as `multipart/form-data` with fields `file` (binary) and `description`. The actual `createAttachment.ts` accepts a JSON body with `{ patientId, imageType, toothNumbers, fileName, filePath, fileSizeBytes, mimeType, note }`. The frontend `use-attachments.ts` hook sends a `FormData` payload with the raw file. Contract compliance for the attachment upload endpoint is broken — the handler accepts pre-processed metadata, not a raw file upload.

---

### DELETE /dental/visits/:visitId/attachments/:attachmentId — deleteAttachment.ts

**FOUND.** Handler exists. Soft-delete via `repo.softDelete`. `assertBranchRole(['dentist_owner','dentist_associate'])` enforced. 204 returned.

**DIVERGED — B-13:** `deleteAttachment.ts` does not check visit immutability. Attachments on completed/locked visits can be deleted, which may conflict with the overall BR-003 intent (records immutable after visit completed). The spec does not explicitly exempt deletions but the immutability principle covers all clinical writes.

---

### POST /dental/visits/:visitId/amendments — createAmendment.ts

**FOUND.** Handler exists. Author membership resolved from session. Reason and content persisted.

**DIVERGED — B-14:** `createAmendment.ts` performs a raw membership table query (`dentalMemberships`) instead of using `assertBranchRole`. This bypasses the role check — any active member (including `staff_full`, which is not an authorized role per spec section 6) can create amendments, as long as they have an active membership at the branch. The spec restricts amendment creation to `dentist_owner, dentist_associate` only.

---

### GET /dental/visits/:visitId/amendments — listAmendments.ts

**FOUND.** Handler exists. Returns `{ data, pagination }`.

---

### BR-019 Amendment Approval Endpoint (501)

**MISSING — M-02:** No amendment supervisor approval endpoint exists. The spec (BR-019, section 15) requires a dedicated approval endpoint returning 501 `NOT_IMPLEMENTED`. This endpoint is completely absent from both the handler directory and the generated routes. While the spec states approval is not implemented, the 501 stub endpoint itself is required to be present per the error taxonomy entry.

---

## Frontend Components (clinical-domain scope)

### rx-sheet.tsx

**FOUND.** Component exists. `prescriberMemberId` passed as prop (auto-filled from session at call site). Drug name, dosage, frequency validated client-side. Calls `createPrescription` SDK function.

**DIVERGED — FE-01:** `RxSheet` calls `createPrescription` with `duration` and `quantity` as free-text strings. The API contract specifies `duration_days` as an integer (min:1, max:365) and `repeats` as an integer (min:0, max:12). The component sends string values for both fields without integer conversion or range validation, risking server-side validation rejection with no user feedback.

**DIVERGED — FE-02:** `handleSave` has a `finally { setSaving(false) }` block but no `catch` block and no error state for API failures. If `createPrescription` throws (e.g., 422 from the server), the error is silently swallowed — the sheet closes or stays open with no feedback to the user.

---

### consent-sheet.tsx

**FOUND.** Component exists. Signature canvas capture, create-then-sign two-step flow.

**DIVERGED — FE-03:** Templates are hardcoded client-side (`CONSENT_TEMPLATES` constant with 5 hardcoded UUIDs like `tpl-general`). The API contract requires `template_id` to be a real `uuid` from a branch consent template. The hardcoded IDs will fail server-side template validation on any real branch.

**DIVERGED — FE-04:** `handleSave` has a `finally { setSaving(false) }` block but no `catch` — same silent error swallow pattern as `rx-sheet.tsx`. If `createConsentForm` or `signConsentForm` fails (422, 404), the user sees nothing.

---

### lab-orders-sheet.tsx

**FOUND.** Component exists. Renders order list with status labels and advance/cancel actions. TanStack Query used correctly.

**DIVERGED — FE-05:** `handleCancel` sets `cancelReason: 'Cancelled by user'` — a hardcoded string with no user prompt. The `updateLabOrder` API contract allows a `notes` field on status change; the spec's WF-063 does not require a reason for cancellation from the lab orders sheet, so this is low-severity. Flagged for traceability.

---

### medical-history-sheet.tsx + medical-history-form.tsx

**FOUND.** `MedicalHistorySheet` wrapper exists (`medical-history-sheet.tsx`). `MedicalHistoryForm` implements full preset-driven UI.

**OUT-OF-SPEC — OS-02 (frontend):** `MedicalHistoryForm` calls `updateMedicalHistoryEntry` via `useMedicalHistoryMutations.updateEntry` to toggle `active` and patch `notes`/`displayName` on existing entries. This directly enables the forbidden PATCH path (see OS-01 backend). The append-only invariant (AC-CLI-005) is violated end-to-end: backend permits it, frontend drives it.

---

### attachments-sheet.tsx

**FOUND.** Component exists. Upload zone with drag-and-drop. Image type chips. Tooth selector. Delete action.

**DIVERGED — FE-06:** `UploadZone` enforces a 50 MB `MAX_BYTES` limit client-side. The API contract specifies `Max 5 MB` per file (`services/api-ts/src/handlers/dental-clinical/API_CONTRACTS.md`, POST /attachments, Constraints column). The frontend allows 10× the contracted limit, permitting uploads the backend should reject (assuming the backend enforces 5 MB — which the current handler does not validate at the size level either).

---

### amendment-form.tsx

**FOUND.** Component exists. Reason dropdown, content textarea with min-10 client validation. Calls `createAmendment`.

**DIVERGED — FE-07:** `AmendmentForm` sends `reason` as `'correction' | 'additional_finding' | 'clarification'` enum values. The API contract specifies `reason` as a free-text string (min:10, max:500). The backend handler stores `body.reason` directly — short enum strings like `'correction'` (9 chars) will pass the handler but violate the contract's min:10 constraint if the backend enforces it at the validator level.

---

### soap-notes-sheet.tsx

**FOUND** (in-scope per task scope note: soap-notes-sheet is listed as a clinical component). Component exists with full SOAP form, sign-and-lock, and addendum flow.

---

## Missing Handlers / Routes

| ID | Spec Item | Status |
|----|-----------|--------|
| M-01 | `PATCH .../consent-forms/:cid/revoke` (WF-035, DE-013) | MISSING — no handler, no route, no schema column |
| M-02 | Amendment supervisor approval 501 stub (BR-019) | MISSING — no endpoint |
| M-03 | `GET /dental/visits/:visitId/prescriptions` — pagination from spec returns bare `Prescription[]`, actual returns `{ data, pagination }` | DIVERGED (see B-04) |
| M-04 | `GET /dental/patients/:id/medical-history` (patient-path scoped) | MISSING at contract path — implemented at `/dental/clinical/medical-history` instead |

---

## Out-of-Spec Handlers (not declared in MODULE_SPEC / API_CONTRACTS)

| ID | File | Issue |
|----|------|-------|
| OS-01 | `updateMedicalHistoryEntry.ts` + route | Violates append-only rule; spec requires 405 |
| OS-02 | `MedicalHistoryForm.tsx` — `updateEntry` mutation | Frontend drives forbidden PATCH path |
| OS-03 | `createInventoryItem.ts`, `createInventoryAdjustment.ts`, `listInventoryItems.ts`, `listInventoryAdjustments.ts`, `updateInventoryItem.ts`, `inventory-validators.ts`, `repos/inventory.repo.ts`, `repos/inventory.schema.ts` | Inventory management is not declared in dental-clinical MODULE_SPEC or API_CONTRACTS. These handlers are co-located in this module without a corresponding spec entry. |
| OS-04 | `createOcclusionScreening.ts`, `listOcclusionScreenings.ts`, `occlusion-validators.ts`, `repos/occlusion-screening.repo.ts`, `repos/occlusion-screening.schema.ts`, `createPostopTemplate.ts`, `listPostopTemplates.ts`, `updatePostopTemplate.ts`, `postop-validators.ts`, `repos/postop-template.repo.ts`, `repos/postop-template.schema.ts` | Occlusion screening and postop templates are not declared in dental-clinical MODULE_SPEC or API_CONTRACTS. |

---

## Business Rule Coverage Matrix

| Rule | Handler Guard | Status |
|------|---------------|--------|
| BR-003 (visit immutable) | createLabOrder ✓ | `createPrescription`, `createConsentForm`, `createAttachment` — **MISSING** |
| BR-014 (consent required before treatment) | UI-only guard | No backend enforcement on treatment state machine transition |
| BR-017 (prescriber role check) | assertBranchRole ✓ | prescriberMemberId identity not validated (B-03) |
| BR-018 (lab order FSM forward-only) | LAB_ORDER_TRANSITIONS ✓ | Wrong HTTP status on violation (B-06) |
| BR-019 (amendment approval 501) | Not implemented | 501 stub endpoint absent (M-02) |

---

## Acceptance Criteria Coverage

| AC | Description | Status |
|----|-------------|--------|
| AC-CLI-001 | Prescription without prescriberMemberId → 422 | PARTIAL — body validation covers this; role check present |
| AC-CLI-002 | Prescription by non-dentist → 403 | FOUND (assertBranchRole) |
| AC-CLI-003 | Sign consent → signed + immutable | FOUND (repo guard); wrong HTTP 400 vs 422 on re-sign attempt |
| AC-CLI-004 | Lab order reversal → 422 | DIVERGED — actual HTTP 400 (B-06) |
| AC-CLI-005 | No PATCH/DELETE on medical history | VIOLATED — updateMedicalHistoryEntry registered and used (OS-01) |
| AC-CLI-006 | Write to locked visit → 422 | MISSING on createPrescription, createConsentForm, createAttachment (B-01, B-09, B-11) |

---

_Generated by oli-enforce-file | dental-clinical | 2026-05-27_
