# Clinical Workspace Module Audit

**Date:** 2026-05-26
**Auditor:** Read-only automated audit
**Prior global score:** ~70%

---

## Scope

The Clinical Workspace covers the full-screen patient visit workspace (`/_workspace/$patientId`). It includes:

- SOAP Notes (sign/addendum/history)
- Consent Forms (create/sign — immutable after signing)
- Prescriptions (create/list/update, allergy cross-check)
- Lab Orders (state machine: ordered → in_fabrication → delivered → fitted)
- Attachments (create/list/delete)
- Amendments (append-only corrections to clinical records)
- Medical History (conditions, medications, allergies, procedures)
- Dental Chart / Odontogram (interactive FDI SVG chart)
- Treatment Table (status management, carry-over)
- Occlusion Screenings and Post-op Templates (auxiliary clinical)

**Known pre-existing findings (not re-reported here):**
- CF-03: Treatment plans URL mismatch (`/treatment-plans` vs `/treatment-plan`)
- CF-07: Workspace top bar shows Rx/Consent/Lab buttons to all roles (no UI gate)
- CF-11: Consent signing no confirmation before irreversible sign
- CF-15: SOAP notes no role gate
- CF-17: Void/amend signed entry flow broken (J10)

---

## Findings Summary

| # | Severity | Gate | Finding | File |
|---|----------|------|---------|------|
| CLINICAL-F1 | P1 | G2 | `createOcclusionScreening` and `createPostopTemplate` skip `assertBranchRole` entirely — any authenticated user can write clinical screening and template data | `createOcclusionScreening.ts`, `createPostopTemplate.ts` |
| CLINICAL-F2 | P1 | G2 | Role asymmetry on Consent: `createConsentForm` allows `hygienist`; `signConsentForm` restricts to `dentist_owner`/`dentist_associate` only. A hygienist can create but never sign — form is created and then stranded. | `createConsentForm.ts`, `signConsentForm.ts` |
| CLINICAL-F3 | P1 | G2 | Role asymmetry on Attachments: `createAttachment` allows `hygienist`; `deleteAttachment` restricts to `dentist_owner`/`dentist_associate`. Hygienist can upload but cannot delete their own upload. | `createAttachment.ts`, `deleteAttachment.ts` |
| CLINICAL-F4 | P1 | G6 | No `DELETE /dental/visits/{visitId}/prescriptions/{prescriptionId}` endpoint exists in OpenAPI or any handler. Prescriptions cannot be voided or removed — only amended. This is undocumented (not listed as intentional append-only in TypeSpec). | `dental-clinical.tsp`, OpenAPI spec |
| CLINICAL-F5 | P1 | G5 | `ConsentSheet` hard-codes `templateId` and `templateName` as free-text inputs. There is no integration with the branch consent-template management endpoints (`GET /dental/branches/{branchId}/consent-templates`). Templates are not validated against the branch's actual configured templates. | `consent-sheet.tsx` |
| CLINICAL-F6 | P1 | G7 | `createMedicalHistoryEntry` uses `patient.preferredBranchId` for authorization. If a patient has no preferred branch, the handler throws `ForbiddenError` (403), not `BadRequest` (400). This silently blocks the clinical journey for patients without a branch assignment. | `createMedicalHistoryEntry.ts` |
| CLINICAL-F7 | P1 | G8 | Workspace route test (`$patientId.test.ts`) is a source-text regex scan — it tests that string literals appear in the file, not that the component mounts or renders correctly. Provides false confidence of front-end coverage. | `$patientId.test.ts` |
| CLINICAL-F8 | P2 | G2 | TypeSpec declares all clinical endpoints with `@extension("x-security-required-roles", #["user"])` — a generic `"user"` marker that does not distinguish between role tiers. The real role enforcement happens in handler code only, with no contract-level documentation of which roles apply to which operations. | `dental-clinical.tsp` |
| CLINICAL-F9 | P2 | G4 | `SoapNotesSheet` "Sign & Lock" does a save-then-sign in two sequential mutations with no loading guard between them. If `save` succeeds but `sign` fails (network error), notes are saved unsigned with no user feedback and no retry path visible in UI. | `soap-notes-sheet.tsx` |
| CLINICAL-F10 | P2 | G5 | `RxSheet` (`rx-sheet.tsx`) has no client-side allergy cross-check warning before submission. The backend returns `warnings.allergyConflicts` in the 201 response, but the frontend does not display this warning to the clinician — the allergy alert is silently discarded. | `rx-sheet.tsx`, `createPrescription.ts` |
| CLINICAL-F11 | P2 | G5 | `LabOrdersSheet` "Cancel" action calls `updateLabOrder` with `status: 'cancelled'`, but the lab order state machine contract (`ordered → in_fabrication → delivered → fitted`) does not define a transition back from any state to `cancelled`. Backend `updateLabOrder` likely accepts it without state-machine validation. | `lab-orders-sheet.tsx`, `updateLabOrder.ts` |
| CLINICAL-F12 | P2 | G8 | No unit test for `RxSheet` allergy-conflict warning display path. Backend allergy cross-check (module9.test.ts) is tested, but the frontend handling of `warnings.allergyConflicts` in the response is untested. | `rx-sheet.tsx` |
| CLINICAL-F13 | P2 | G8 | E2E test for consent signing (`consent-signing.spec.ts`) uses `page.evaluate` with raw `fetch()` to create and sign consent forms directly against the API, bypassing the `ConsentSheet` UI component entirely. The actual signature canvas draw flow is tested in one test but the full end-to-end form → sign → close → list flow is not validated via UI interaction. | `consent-signing.spec.ts` |
| CLINICAL-F14 | P3 | G6 | `deleteAttachment` uses `ctx.get('audit') as any` inline — bypasses the typed audit service interface. `createAttachment` has no audit logging at all. Audit coverage for attachment lifecycle is inconsistent. | `createAttachment.ts`, `deleteAttachment.ts` |
| CLINICAL-F15 | P3 | G6 | `listPrescriptions` handler uses `assertBranchAccess` (any branch member can read) while `createPrescription` uses `assertBranchRole(['dentist_owner', 'dentist_associate'])`. The role asymmetry between read and write is intentional but undocumented in spec or TypeSpec. | `listPrescriptions.ts`, `createPrescription.ts` |
| CLINICAL-F16 | P3 | G8 | `dental-clinical.hurl` contract file exists and covers prescriptions, consent, attachments, lab orders, medical history, amendments, treatment templates, and visit notes (38 scenarios). However it does not cover: occlusion screening, post-op template CRUD, carry-over treatments, or the prescription allergy cross-check (non-blocking warning path). | `dental-clinical.hurl` |

---

## Gate-by-Gate Analysis

### Gate 2 — Roles and Permissions

**Summary of role gates found across clinical handlers:**

| Handler | Allowed Roles | Auth Method |
|---------|--------------|-------------|
| `createPrescription` | `dentist_owner`, `dentist_associate` | `assertBranchRole` via visit |
| `listPrescriptions` | Any branch member | `assertBranchAccess` |
| `updatePrescription` | `dentist_owner`, `dentist_associate` | `assertBranchRole` via visit |
| `createConsentForm` | `dentist_owner`, `dentist_associate`, `hygienist` | `assertBranchRole` via visit |
| `signConsentForm` | `dentist_owner`, `dentist_associate` | `assertBranchRole` via consent's visit |
| `listConsentForms` | (not audited — assumed `assertBranchAccess`) | |
| `createAttachment` | `dentist_owner`, `dentist_associate`, `hygienist` | `assertBranchRole` via visit |
| `deleteAttachment` | `dentist_owner`, `dentist_associate` | `assertBranchRole` via attachment's visit |
| `createMedicalHistoryEntry` | `dentist_owner`, `dentist_associate`, `hygienist`, `staff_full` | `assertBranchRole` via patient's `preferredBranchId` |
| `createAmendment` | Any authenticated user (no role check found) | Authenticated only |
| `createOcclusionScreening` | Any authenticated user | `assertBranchRole` MISSING — only checks user exists |
| `createPostopTemplate` | Any authenticated user | Only checks branch exists, no role check |

**CLINICAL-F1 (P1):** `createOcclusionScreening` checks `if (!user)` but never calls `assertBranchRole`. Any authenticated session — including `readonly` or `staff_scheduling` — can create occlusion screening records. `createPostopTemplate` similarly checks only that the branch exists.

**CLINICAL-F2 (P1):** `hygienist` can call `createConsentForm` (201) but will get 403 on `signConsentForm`. Consent forms created by hygienists are permanently unsigned orphans. No frontend guard prevents this.

**CLINICAL-F3 (P1):** `hygienist` can call `createAttachment` (201) but will get 403 on `deleteAttachment`. No cleanup path for hygienist-created attachments.

**Previously known:** CF-07 (top bar shows Rx/Consent/Lab/Notes/Attachments to all roles without UI gating) and CF-15 (SOAP notes no role gate) remain in scope but are not re-reported here.

---

### Gate 3 — Routes and Navigation

- Workspace route is at `/_workspace/$patientId` (file: `apps/dentalemon/src/routes/_workspace/$patientId.tsx`). Route file exists and is correctly structured.
- All clinical sheets (SOAP, Rx, Consent, Lab, Attachments) are launched from `WorkspaceTopBar` action buttons. Navigation is state-driven (sheet open/close flags), not URL-based — deep-linking to a specific sheet is not possible.
- No `404` or error route for invalid `patientId` was found in the workspace layout — `useDentalChart` and `useVisits` hook failures would need to propagate silently or via loading states.
- Imaging overlay (`imagingOpen`) is launched via a separate button in the year-filter zone, not via the top bar. This is a functional asymmetry from the other sheets — imaging is visually deprioritized.

---

### Gate 4 — Frontend Interaction Integrity

- **SOAP Notes:** Three-state sheet (unsigned/signed/addendum) implemented correctly. Sign-and-lock is a two-step mutation (save then sign). Gap: if save succeeds but sign fails, state is inconsistent with no user feedback (CLINICAL-F9).
- **Consent Sheet:** Canvas-based signature drawing with `PointerEvent` capture. Template selection is free-text (CLINICAL-F5). No pre-sign confirmation dialog (known CF-11).
- **Rx Sheet:** Complete form with drug name, RxNorm, dosage, frequency, duration, quantity, instructions, dispense-as-written. Missing: allergy conflict warning display on submission (CLINICAL-F10).
- **Lab Orders:** State-machine advancement implemented with `NEXT_STATUS` map. Cancel transitions not validated against state machine (CLINICAL-F11).
- **Dental Chart:** Interactive SVG FDI chart. Supports permanent (32-tooth) and pediatric (20-tooth primary) dentition. Filter by state. `data-testid` attributes on each tooth for test targeting.
- **Attachments Sheet:** Not audited in full — E2E tests cover the API-level flow.
- **Top Bar:** All 7 action buttons present (Rx, Consent, Notes, Attachments, Treatment Plan, Complete Visit, Fullscreen). No role-based hiding (known CF-07).

---

### Gate 5 — Forms, Modals, and Table Actions

**Prescription (RxSheet):**
- Required: `drugName`, `dosage`, `frequency`
- Optional: `rxNormCode`, `duration`, `quantity`, `instructions`, `dispenseAsWritten`
- Client-side validation: drug name and dosage required before submit
- Gap: Allergy conflict response (`warnings.allergyConflicts`) from 201 is not displayed (CLINICAL-F10)

**Consent (ConsentSheet):**
- Required: `templateId` (validated), `signatureData` (required to submit sign)
- Template source: free-text `<select>` with hardcoded options — not fetched from `GET /dental/branches/{branchId}/consent-templates` (CLINICAL-F5)
- Immutability: `signed=true` blocks form (correct per BR-014)

**Lab Orders (LabOrdersSheet):**
- Create: `labName` (required), `description` (required), `expectedDeliveryDate` (optional)
- Advance-status: no guard for invalid transitions — relies on backend
- Cancel: calls `updateLabOrder` with `status: 'cancelled'` without state-machine validation (CLINICAL-F11)

**Medical History:**
- Managed inside SOAP Notes "View Medical History" link → opens PMDImport flow (non-obvious routing per source code)

**Amendment Form (`amendment-form.tsx`):**
- Fields: `reason` (select), `content` (min 10 chars)
- Targets visit-level clinical note correction (not PMD supersession — covered in CF-17/PMD audit)

---

### Gate 6 — Backend API Contract Alignment

**OpenAPI endpoints present for Clinical module (`/dental/visits/{visitId}/...`):**

| Endpoint | Status |
|----------|--------|
| POST `/dental/visits/{visitId}/prescriptions` | Present |
| GET `/dental/visits/{visitId}/prescriptions` | Present |
| PATCH `/dental/visits/{visitId}/prescriptions/{prescriptionId}` | Present |
| DELETE `/dental/visits/{visitId}/prescriptions/{prescriptionId}` | **Missing** (CLINICAL-F4) |
| POST `/dental/visits/{visitId}/consents` | Present |
| GET `/dental/visits/{visitId}/consents` | Present |
| POST `/dental/visits/{visitId}/consents/{consentId}/sign` | Present |
| POST `/dental/visits/{visitId}/attachments` | Present |
| GET `/dental/visits/{visitId}/attachments` | Present |
| DELETE `/dental/visits/{visitId}/attachments/{attachmentId}` | Present |
| POST `/dental/visits/{visitId}/amendments` | Present |
| GET `/dental/visits/{visitId}/amendments` | Present |
| POST `/dental/visits/{visitId}/lab-orders` | Present |
| GET `/dental/visits/{visitId}/lab-orders` | Present |
| PATCH `/dental/visits/{visitId}/lab-orders/{orderId}` | Present |
| POST `/dental/clinical/medical-history` | Present |
| GET `/dental/clinical/medical-history` | Present |
| PATCH `/dental/clinical/medical-history/{entryId}` | Present |

**CLINICAL-F4 (P1):** No `DELETE` or `PATCH`-to-void exists for prescriptions. Whether this is intentional (append-only) is not documented in TypeSpec — the spec only shows create/list/update.

**CLINICAL-F8 (P2):** TypeSpec uses `@extension("x-security-required-roles", #["user"])` uniformly. The actual per-operation role requirements (e.g., `dentist_*` only for prescriptions, `hygienist` allowed for attachments) are not reflected in the contract.

**CLINICAL-F14 (P3):** `deleteAttachment` uses `ctx.get('audit') as any` — typed audit service bypass. `createAttachment` has no audit event at all.

**CLINICAL-F15 (P3):** `listPrescriptions` uses `assertBranchAccess` (read allowed by any branch member) while create/update requires dentist role. Intentional but undocumented.

---

### Gate 7 — Role-Based Journey Map

**Journey: J1 — Dentist creates visit and records SOAP notes**
- Works for `dentist_owner`/`dentist_associate`. No frontend role gate on Notes button (CF-15). Backend visit note endpoints not audited for role gate, but sign endpoint requires dentist.

**Journey: J2 — Dentist writes prescription with allergy check**
- Backend: prescription created with `warnings.allergyConflicts` if allergy match found. Frontend: warning is silently discarded — clinician never sees the alert (CLINICAL-F10). This is a patient safety gap.

**Journey: J3 — Staff or hygienist creates consent form**
- `hygienist` can create a consent form (201), but cannot sign it (403). Form is stranded. `staff_scheduling` cannot create (403 — correct). No frontend guard distinguishes these roles (CLINICAL-F2).

**Journey: J4 — Hygienist uploads attachment**
- `hygienist` can upload (201). Cannot delete (403). No workaround. Dentist must clean up (CLINICAL-F3).

**Journey: J5 — Any role accesses occlusion screening**
- Any authenticated user can create an occlusion screening. No role gate. `staff_scheduling` or `readonly` roles can write clinical screening data (CLINICAL-F1).

**Journey: J6 — Clinician records medical history for patient without a branch**
- `createMedicalHistoryEntry` throws `ForbiddenError` if patient has no `preferredBranchId`. Clinician sees 403 with message "Patient has no assigned branch" — not actionable from the clinical workspace. No frontend handling for this error state (CLINICAL-F6).

**Journey: J7 — Lab order lifecycle**
- Advance-status flow (`ordered → in_fabrication → delivered → fitted`) works via frontend `NEXT_STATUS` map. Contract tests (dental-clinical.hurl steps 13–18) validate this. Cancel path uses `updateLabOrder` with `status: 'cancelled'` — valid if backend accepts it, but state-machine transition is undocumented (CLINICAL-F11).

**Journey: J8 — Amendment for clinical record correction**
- Append-only amendment system is in place. Multiple amendments on same record accumulate correctly (tested). No amendment can modify the original record (BR-019 validated).

**Journey: J9 — Void/Amend signed clinical note (J10 from CF-17)**
- Known broken. Not re-reported here.

---

### Gate 8 — Test Confidence Gaps

**Backend unit tests (handler-level):**

| Test File | Coverage |
|-----------|---------|
| `ac-clinical.test.ts` | Prescription CRUD, medical history CRUD, consent create/sign, lab order state machine |
| `clinical-consent-lab.test.ts` | Consent + lab order handlers, role gates |
| `clinical-prescription-history.test.ts` | Prescription CRUD, role gates (staff_full → 403, staff_scheduling → 403, dentist_owner → pass) |
| `clinical-attachment-amendment.test.ts` | Attachment create/delete/list, amendment create/list, BR-019 |
| `dental-clinical-module9.test.ts` | Allergy cross-check (6 cases) |
| `dental-clinical-occlusion.test.ts` | Occlusion screening |
| `dental-clinical-postop.test.ts` | Post-op template CRUD |
| `dental-clinical-inventory.test.ts` | Inventory |

**Role gate test coverage (createPrescription):** Explicitly tested — `staff_full → 403`, `staff_scheduling → 403`, `dentist_owner → pass`. Good.

**E2E test coverage:**

| Test File | What it covers |
|-----------|---------------|
| `consent-signing.spec.ts` | Create via API + canvas sign via UI (one test), immutability via API (one test) |
| `prescribe-medication.spec.ts` | Full prescription create flow via UI |
| `attachments.spec.ts` | Attachment create + list via API (not via UI component) |

**Gaps (CLINICAL-F7, CLINICAL-F12, CLINICAL-F13):**

- **CLINICAL-F7 (P1):** `$patientId.test.ts` tests file content as a string, not component behavior. Zero render-cycle coverage for the workspace route.
- **CLINICAL-F12 (P2):** No test validates that the frontend displays `warnings.allergyConflicts` from the prescription response.
- **CLINICAL-F13 (P2):** `consent-signing.spec.ts` bypasses `ConsentSheet` UI for create/sign steps in all but one test. The canvas draw flow is tested in isolation; the full form → draw signature → submit → confirm close → list journey is not covered as a continuous UI flow.
- No E2E test for: SOAP notes sign + addendum flow, lab order cancellation, amendment form submission via UI, or medical history entry via workspace.
- No test for `createOcclusionScreening` or `createPostopTemplate` role gate bypass (CLINICAL-F1).

**Contract test coverage (`dental-clinical.hurl`):** 38 scenarios, strong coverage of the primary CRUD and state-machine paths. Missing: occlusion screening, post-op templates, allergy cross-check warning path, carry-over treatments.

---

## Critical Issues Detail

### CLINICAL-F1 — Missing Role Gate on Occlusion + Post-op (P1)

**File:** `services/api-ts/src/handlers/dental-clinical/createOcclusionScreening.ts`

```typescript
// Only authentication check — no assertBranchRole call
const user = ctx.get('user');
if (!user) throw new UnauthorizedError('Authentication required');
// ... proceeds directly to create
```

`createPostopTemplate.ts` similarly only validates that the branch exists. Any authenticated session writes clinical data.

**Impact:** `staff_scheduling`, `readonly`, or any branch member can insert occlusion and post-op records. Clinical record integrity compromised.

---

### CLINICAL-F2 — Hygienist Consent Create/Sign Asymmetry (P1)

**Files:** `createConsentForm.ts` (allows `hygienist`), `signConsentForm.ts` (denies `hygienist`)

A hygienist creates a consent form (201). Form enters the database unsigned. When hygienist attempts to sign: 403. When dentist attempts to sign a form they did not create: works, but creates an audit trail that the signer is different from the creator. No workflow guidance exists for this scenario.

---

### CLINICAL-F4 — No Prescription Void/Delete Endpoint (P1)

The OpenAPI spec and TypeSpec define only `createPrescription` (POST), `listPrescriptions` (GET), and `updatePrescription` (PATCH). No DELETE or void endpoint exists. If a prescription is entered in error, the only correction path is creating an amendment record on the original record — the prescription itself cannot be removed or voided. This is not documented as intentional append-only design.

---

### CLINICAL-F10 — Allergy Conflict Warning Not Displayed (P2, Patient Safety)

`createPrescription` returns `{ ...prescription, warnings: { allergyConflicts: string[] } }` when the drug name matches an active allergy. `RxSheet` calls the mutation and closes on success but does not read or display `warnings` from the response. A clinician prescribing a contraindicated drug receives no alert in the UI.

---

## Overall Confidence Score: 5.5/10

**Rationale:**

Strengths:
- Backend unit test coverage is broad with explicit role-gate tests for prescriptions
- Contract test suite (38 Hurl scenarios) covers all primary CRUD paths
- Consent immutability (BR-014) is correctly implemented and tested at both backend and E2E layers
- Amendment append-only (BR-019) is correctly implemented and tested
- Prescription allergy cross-check backend logic is tested in six scenarios

Weaknesses:
- Two handlers (`createOcclusionScreening`, `createPostopTemplate`) have no role gate — P1 security gap
- Role asymmetries for `hygienist` (consent, attachments) create stranded-record scenarios with no recovery path
- Missing prescription delete/void endpoint is undocumented — creates clinical record management gap
- The allergy conflict warning discarded silently in the frontend is a patient safety concern
- Workspace route test is a false-confidence source-text scan, not a real render test
- E2E tests bypass the UI component for the majority of consent and attachment flows
- TypeSpec `x-security-required-roles` always says `"user"` — no role enforcement visible in the contract
