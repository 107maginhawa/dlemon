# Form, Modal, and Table Action Audit
**Date**: 2026-05-26  
**Auditor**: Journey Test Audit Orchestrator — Pass 05  
**Scope**: apps/dentalemon — primary dental app  
**Mode**: Read-only. No code modified.

---

## 1. Form Registry

| ID | Form | Route/Page | Fields | Submit Handler | API | Role | Validation | Existing Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| F-01 | Auth Sign-In/Up/ForgotPwd | `/auth/$authView` | email, password (delegated to `better-auth-ui` `AuthView`) | Library-managed | `POST /api/auth/sign-in`, `/sign-up`, `/forgot-password` | Guest only | Library-managed | `onboarding.spec.ts` partial | LIKELY WORKING |
| F-02 | PIN Entry | `/auth/pin-entry/$memberId` | 6-digit keypad (auto-submit on digit 6) | `onSubmit(pin)` → verifyPin API | `POST /dental/org/members/{id}/verify-pin` | Authenticated session | PIN_LENGTH=6, lockout check | `pin-entry.test.ts` | LIKELY WORKING |
| F-03 | Staff Create | `/_dashboard/staff` (StaffCreateModal) | displayName*, role*, pin* (6-digit), confirmPin | `validateStaffForm` → `create({displayName, role, pin})` | `POST /dental/branches/{id}/members` | dentist_owner only | Name required, role required, PIN=6 digits, PINs must match | `add-staff.spec.ts` | ✅ Working |
| F-04 | Patient Registration | `/_dashboard/patients` (PatientRegistrationModal) | displayName*, dateOfBirth*, gender, consentGiven* | `onSubmit(data)` → parent-delegated API call | `POST /dental/org/{branchId}/patients` | CLINICAL_WRITE | Name required, DOB required, consent required | `patient-registration.spec.ts` partial | **[RISK]** onSubmit is prop — parent wiring must be verified |
| F-05 | Appointment Create | `/_dashboard/calendar` (AppointmentModal) | patientId* (raw text), dentistMemberId, branchId, date*, time*, durationMinutes, serviceType*, notes, walkIn toggle | `validateAppointmentForm` → `createAppointment(payload)` | `POST /dental/scheduling/appointments` | Any member (no role gate) | patientId, serviceType, date, time required | `appointment-modal.test.ts` | **[BUG]** Edit path not implemented — `appointmentId` prop ignored |
| F-06 | SOAP Notes | `/_workspace/$patientId` (SoapNotesSheet) | subjective, objective, assessment, plan, notes (all textarea) | `save({path: {visitId}, body})` → on success optionally `sign()` | `PATCH /dental/clinical/visits/{visitId}/notes`, `POST /dental/clinical/visits/{visitId}/notes/sign` | Any member (no role gate) | None — all fields optional | None confirmed | LIKELY WORKING |
| F-07 | SOAP Addendum | `/_workspace/$patientId` (SoapNotesSheet — addendum mode) | reason*, content* | `addendum({path: {visitId}, body})` | `POST /dental/clinical/visits/{visitId}/notes/addendum` | Any member (no role gate) | Requires signed=true state to trigger | None confirmed | LIKELY WORKING |
| F-08 | Consent Form + E-Signature | `/_workspace/$patientId` (ConsentSheet) | templateId* (select), signatureData* (canvas drawing) | `handleSave()` → createConsentForm then signConsentForm | `POST /dental/clinical/consent-forms`, `POST /dental/clinical/consent-forms/{id}/sign` | CLINICAL_WRITE (no frontend gate) | Template required, signature required, immutable after signing | `consent-signing.spec.ts` | LIKELY WORKING |
| F-09 | Image Upload | `/_workspace/$patientId` (ImageUpload) | file* (JPEG/PNG/TIFF/BMP ≤100 MB), modality (select), toothNumber (optional number 1–32) | `upload(file, {patientId, branchId, visitId, modality, toothNumbers})` | `POST /dental/imaging/studies` (multipart) | Any authenticated user (no role gate) | File type, file size, modality required | None confirmed for form | **[RISK]** No role gate — any member can upload |
| F-10 | Create Invoice (Payment) | `/_workspace/$patientId` (WorkspacePaymentModal) | No input fields — derived from lineItems prop | `createInvoice.mutateAsync({patientId, visitId})` | `POST /dental/billing/invoices` | BILLING_WRITE | Disabled when `lineItems.length === 0` or `isPending` | `workspace-payment-modal.test.ts` | ✅ Working |
| F-11 | Record Payment | `/_dashboard/billing` (InvoiceDetail) | paymentAmount*, paymentMethod* (cash default), receiptNumber | `validatePaymentForm` → `handleRecordPayment()` | `POST /dental/billing/invoices/{id}/payments` | BILLING_WRITE | Amount > 0, method required | `billing.spec.ts` | **[BUG]** `recordedByMemberId` hardcoded to `''` |
| F-12 | Onboarding Step 1 — Personal Info | `/onboarding` | firstName*, lastName*, middleName, dateOfBirth, gender, phone, avatar | react-hook-form + Zod (`personalInfoSchema`) | (held in state) | requireAuth + requireEmailVerified + requireNoPerson | Schema-driven Zod validation | `onboarding.spec.ts` | ✅ Working |
| F-13 | Onboarding Step 2 — Address | `/onboarding` | street1, street2, city, state, postalCode, country (optional unless `required=true`) | react-hook-form + Zod → `createPerson()` API call | `POST /person` | requireAuth | Schema-driven; optional unless required prop set | `onboarding.spec.ts` | ✅ Working |
| F-14 | Recall Create | `/_workspace/$patientId` (RecallsSheet) | type* (select), scheduledDate* | `createRecall(body)` hook | `POST /dental/clinical/recalls` | Any member (no role gate) | type and date required | None confirmed | LIKELY WORKING |
| F-15 | Fee Schedule Inline Edit | `/_dashboard/settings` (FeeSchedule) | cdtCode, description, priceCents per row (inline table edit) | `handleSave()` batch → API | `POST /dental/org/branches/{id}/fee-schedule` | dentist_owner only | None visible — no required validation on rows | None confirmed | **[INCOMPLETE]** — no clear save API confirmed |
| F-16 | Clinic Settings | `/_dashboard/settings` | clinicName, phone, email, address, logo | `handleSubmit()` | `PATCH /dental/org/branches/{id}` | dentist_owner only | Unknown — not inspected deeply | None confirmed | LIKELY WORKING |

---

## 2. Modal/Sheet Registry

| ID | Modal/Sheet | Trigger | Confirm Action | Cancel/Close | Accessibility | Escape Key | Outside Click | Focus Trap | Existing Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| M-01 | StaffCreateModal | "Add Staff" button in StaffList | `handleSubmit()` → create staff | `handleClose()` resets all fields | `role="dialog" aria-modal="true"` — no `aria-labelledby` | **No** — custom div, no Radix Dialog | Yes — backdrop `onClick={handleClose}` | **No** — custom div, no Radix | `add-staff.spec.ts` | **[BUG]** No escape key, no focus trap, no aria-labelledby |
| M-02 | PatientRegistrationModal | "Register Patient" button in Patients page | `handleSubmit(e)` → `onSubmit(data)` prop | `onClose()` — no field reset (stateless via controlled inputs) | `role="dialog" aria-modal="true" aria-label="Register new patient"` ✅ | **No** — custom div | **No** — no backdrop click handler | **No** | `patient-registration.spec.ts` partial | **[BUG]** No escape, no outside-click close, no field reset on close |
| M-03 | AppointmentModal | "+" button in Calendar or day click | `handleSave()` → createAppointment | `handleClose()` resets all fields | No `role="dialog"` or `aria-modal` found | **Unknown** | **Unknown** — not confirmed from excerpt | **Unknown** | `appointment-modal.test.ts` | **[BUG]** Edit mode not implemented; no confirmed accessibility attrs |
| M-04 | WorkspacePaymentModal | Payment icon in workspace | `handleCreateInvoice()` | `onClose()` via backdrop click | `role="dialog" aria-modal="true" aria-label="Payment"` ✅ | **No** — custom div | Yes — backdrop `onClick={onClose}` | **No** | `workspace-payment-modal.test.ts` | **[RISK]** No escape key, no focus trap |
| M-05 | InvoiceDetail | Invoice row click in BillingList | `handleIssue()`, `handleVoid()`, `handleRecordPayment()` | `onClose()` via close button | No `role="dialog"` found in excerpt | **No** — custom slide-up | **No** — no backdrop click | **No** | `billing.spec.ts` | **[BUG]** Void has no confirmation dialog; no accessibility role |
| M-06 | SoapNotesSheet | Notes icon in workspace top bar | `handleSave()` / `handleSignAndLock()` / `addendum()` | `onClose()` → field reset via useEffect | No Radix Sheet — custom slide-up | **No** | **No** | **No** | None confirmed | **[RISK]** No dirty state warning before close; no escape key |
| M-07 | ConsentSheet | Consent icon in workspace top bar | `handleSave()` → createConsentForm + signConsentForm | Reset via `useEffect` on `!open` | No `role` or `aria` found in excerpt | **No** — custom slide-up | **No** | **No** | `consent-sheet.test.ts` | **[RISK]** Immutable after sign, but no confirmation before signing |
| M-08 | CalibrationDialog | Draw measurement line in imaging | `handleConfirm()` → `onConfirm(mm)` | `handleCancel()` clears input | Radix Dialog ✅ `DialogTitle` + `DialogDescription` | ✅ Yes — `onOpenChange` handles close | N/A — Radix handles | ✅ Yes — Radix | `calibration-dialog.test.ts` | ✅ Fully accessible |
| M-09 | ImageCropperDialog | Avatar upload in PersonalInfoForm | Crop confirm | Cancel | Radix Dialog ✅ | ✅ Yes | ✅ Yes | ✅ Yes | `image-cropper-dialog.test.tsx` | ✅ Fully accessible |
| M-10 | RecallsSheet | Recalls icon in workspace | FSM status transitions (Mark Sent, Complete, Cancel) | `onClose()` prop | No `role` or `aria` found | **No** — custom slide-up | **No** | **No** | None confirmed | **[RISK]** No accessibility attrs |

---

## 3. Table/List Action Registry

| ID | Table/List | Action | Role | Handler/API | State | Loading | Empty | Error | Existing Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| TL-01 | PatientList | Search filter | All | Client-side filter on `displayName` | Local | N/A | "No patients found" text (inferred) | N/A | `patient-list.test.ts` | ✅ Working |
| TL-02 | PatientList | Archive patient | All (no role check) | `window.confirm()` → `onArchive(id)` prop | Parent-managed | `isActionPending` prop | N/A | Not exposed | `patient-list.test.ts` | **[BUG]** `window.confirm` not accessible/testable; no role gate |
| TL-03 | PatientList | Restore archived patient | All (no role check) | `window.confirm()` → `onRestore(id)` prop | Parent-managed | `isActionPending` prop | N/A | Not exposed | `patient-list.test.ts` | **[BUG]** `window.confirm` not accessible/testable |
| TL-04 | PatientList | Bulk archive | All (no role check) | `window.confirm()` → `onBulkArchive([ids])` | Local selectedIds | `isActionPending` | N/A | Not exposed | `patient-list.test.ts` | **[BUG]** `window.confirm` |
| TL-05 | PatientList | Export JSON | All | `onExport()` prop | `isExporting` prop | N/A | N/A | Not exposed | None confirmed | LIKELY WORKING |
| TL-06 | PatientList | Bulk select checkbox | All | `toggleSelectAll` / `toggleSelect` | Local `selectedIds` Set | N/A | N/A | N/A | `patient-list.test.ts` | ✅ Working |
| TL-07 | BillingList | Filter by tab | BILLING_WRITE | `handleTabChange(tab)` → invalidate query | `activeTab` state | Not shown | Not confirmed | Not shown | `billing-list.test.ts` | LIKELY WORKING |
| TL-08 | BillingList | Click invoice row | BILLING_WRITE | `onInvoiceClick(invoice)` → opens InvoiceDetail | Parent sheet state | Query loading | Not confirmed | Not shown | `billing.spec.ts` | ✅ Working |
| TL-09 | BillingList | Pagination | Any | None found | N/A | N/A | N/A | N/A | N/A | **[BUG]** No pagination — fetches all invoices |
| TL-10 | TreatmentTable | Mark Done (checkmark) | All | `useMarkTreatmentDone` → PATCH | `isPending` disabled | ✅ | N/A | Not shown | `treatment-table.test.ts` | ✅ Working |
| TL-11 | TreatmentTable | Inline price edit | dentist_owner (readOnly=false) | `useUpdateTreatment` → PATCH | `readOnly` prop | `isUpdating` disabled | N/A | Not shown | `treatment-table.test.ts` | ✅ Working |
| TL-12 | TreatmentTable | Dismiss (popover + reason) | CLINICAL_WRITE | `useUpdateTreatment({status: 'dismissed'})` | Popover state | `isUpdating` | N/A | Not shown | `treatment-table.test.ts` | ✅ Working |
| TL-13 | TreatmentTable | Expand notes row | All | Local state toggle | Local | N/A | N/A | N/A | `treatment-table.test.ts` | ✅ Working |
| TL-14 | TreatmentTable | View/Hide Completed toggle | All | `setShowCompleted` | Local | N/A | N/A | N/A | `treatment-table.test.ts` | ✅ Working |
| TL-15 | StaffList | Deactivate member | dentist_owner | `useStaffMutations.deactivate` | `canDeactivate` check | `isDeactivating` | N/A | Not shown | `deactivateMember.test.ts` | ✅ Working |
| TL-16 | FeeSchedule | Inline CDT/price edit + Save | dentist_owner | `handleSave()` batch | `isSaving` + `isSuccess` | `isSaving` flag | N/A | `saveError` shown | None confirmed | **[INCOMPLETE]** Save API endpoint not confirmed |
| TL-17 | RevenueReport | Date range filter | dentist_owner, dentist_associate | `setStartDate` / `setEndDate` → refetch | Local | `loading` flag | `invoices.length === 0` | `setInvoices([])` on error | `revenue-report.test.ts` | ✅ Working |
| TL-18 | RevenueReport | Export CSV | Any (no role gate) | `handleExportCSV()` client-side | N/A | N/A | N/A | N/A | None confirmed | LIKELY WORKING |
| TL-19 | TreatmentReport | Date range filter | Any (no role gate) | `setStartDate` / `setEndDate` | Local | `isLoading` | N/A | Not shown | `treatment-report.test.ts` | LIKELY WORKING |
| TL-20 | TreatmentReport | Export CSV | Any (no role gate) | `handleExportCSV()` client-side | N/A | N/A | N/A | N/A | None confirmed | LIKELY WORKING |
| TL-21 | PatientList | Sorting | N/A | None | N/A | N/A | N/A | N/A | N/A | **[MISSING]** No sort on patient list |
| TL-22 | BillingList | Sorting | N/A | None | N/A | N/A | N/A | N/A | N/A | **[MISSING]** No sort on invoice list |

---

## 4. Frontend vs Backend Validation Comparison

| Form | Frontend Validation | Backend Validation (inferred) | Gap |
|---|---|---|---|
| Staff Create | displayName non-empty, role required, PIN=6 digits exact match | `POST /members`: displayName, role, pin in body | Frontend PIN regex `/^\d{6}$/` — backend should also enforce; confirm backend rejects non-numeric PINs |
| Patient Registration | displayName, DOB, consent checkbox | `POST /patients`: displayName, dateOfBirth required | `dateOfBirth` format not validated on frontend (any string accepted) — backend may reject invalid ISO dates |
| Appointment Create | patientId, serviceType, date+time required | `POST /appointments`: full body validated | `patientId` is a raw text field (UUID) — user can enter invalid ID; no frontend UUID format check |
| SOAP Notes | None — all fields optional | `PATCH /visits/{id}/notes`: visitId required | No minimum length on subjective/assessment — empty save allowed |
| Consent | Template required, signature data required | `POST /consent-forms`, `POST /sign` | No content validation on signature canvas data quality |
| Record Payment | amount > 0, method required | `POST /payments`: amountCents, method required | `recordedByMemberId` sent as `''` — backend may reject or silently accept |
| Image Upload | File type (ALLOWED_TYPES), file size ≤100 MB | `POST /studies` multipart | Frontend rejects 4 MIME types; TIFF and BMP may behave differently across browsers |
| Create Invoice | Disabled when no lineItems | `POST /invoices` | No frontend check that treatments are in `performed` state (required by backend) — 422 possible |

---

## 5. Form/Modal/Table Gap Report

| ID | Issue | File | Component | Role | Backend/API Link | Severity | Recommended Test |
|---|---|---|---|---|---|---|---|
| FM-01 | **AppointmentModal edit path not implemented** — `appointmentId` prop accepted, `isEdit = !!appointmentId` computed, but only `createAppointment` is called; no fetch of existing appointment data, no updateAppointment call | `features/scheduling/components/appointment-modal.tsx` | AppointmentModal | Any | `GET /dental/scheduling/appointments/{id}`, `PATCH /dental/scheduling/appointments/{id}` | P1 | Component: pass appointmentId → form pre-filled with existing data |
| FM-02 | **`recordedByMemberId` hardcoded as `''` in payment recording** — backend may silently accept or reject empty memberId; payment audit trail incomplete | `features/billing/components/invoice-detail.tsx` | InvoiceDetail > handleRecordPayment | BILLING_WRITE | `POST /dental/billing/invoices/{id}/payments` | P1 | Integration: record payment → response includes correct memberId |
| FM-03 | **Void Invoice has no confirmation dialog** — `handleVoid()` fires immediately on button click with no modal/confirm | `features/billing/components/invoice-detail.tsx` | InvoiceDetail > handleVoid | dentist_owner | `POST /dental/billing/invoices/{id}/void` | P1 | Component: click Void → confirmation dialog appears before API call |
| FM-04 | **StaffCreateModal not using Radix Dialog** — uses custom `div role="dialog"`, lacks escape key support, focus trap, and `aria-labelledby` | `features/staff/components/staff-create-modal.tsx` | StaffCreateModal | dentist_owner | N/A | P1 | Component: open modal → Esc closes; first focusable element receives focus |
| FM-05 | **PatientRegistrationModal: no escape key or outside-click close** — backdrop has no onClick; modal can only be closed via Cancel/submit button | `features/patients/components/patient-registration-modal.tsx` | PatientRegistrationModal | CLINICAL_WRITE | `POST /dental/org/{branchId}/patients` | P1 | Component: open → press Esc → modal closes; click outside → modal closes |
| FM-06 | **PatientRegistrationModal: no field reset on close** — state is held in controlled `useState`; reopening modal may show stale data if parent re-opens same instance | `features/patients/components/patient-registration-modal.tsx` | PatientRegistrationModal | CLINICAL_WRITE | N/A | P2 | Component: submit → close → reopen → fields are empty |
| FM-07 | **Appointment patientId is a raw text input** — user must type UUID; no patient picker or autocomplete; easy to enter invalid ID that will 404 at API | `features/scheduling/components/appointment-modal.tsx` | AppointmentModal | Any | `POST /dental/scheduling/appointments` | P1 | E2E: Create appointment → patient lookup works without UUID knowledge |
| FM-08 | **Image upload has no role gate** — any authenticated member can upload imaging studies | `features/imaging/components/image-upload.tsx` | ImageUpload | All (no check) | `POST /dental/imaging/studies` | P2 | Component: render as staff_scheduling → upload button disabled or hidden |
| FM-09 | **SOAP notes: no dirty-state warning before close/discard** — user can accidentally lose unsaved notes without warning | `features/workspace/components/soap-notes-sheet.tsx` | SoapNotesSheet | Any | N/A | P2 | Component: type in SOAP field → click X → confirm dialog appears |
| FM-10 | **PatientList archive uses `window.confirm()`** — not accessible (screen readers), not testable in jsdom, UX inconsistent with app design | `features/patients/components/patient-list.tsx` | PatientList | All | `DELETE/PATCH /dental/org/{id}/patients/{patientId}` | P2 | Component: click archive → custom confirmation modal appears (not window.confirm) |
| FM-11 | **Onboarding step 2 has no back button to step 1** — once past personal info, user cannot return to fix name/DOB without refreshing | `routes/onboarding.tsx` | OnboardingPage | requireAuth | N/A | P2 | E2E: Step 2 → click Back → Step 1 fields preserved |
| FM-12 | **FeeSchedule save API endpoint not confirmed** — save button exists, `isSaving`/`isSuccess` states exist, but API route not confirmed from inspection | `features/settings/components/fee-schedule.tsx` | FeeSchedule | dentist_owner | `POST /dental/org/branches/{id}/fee-schedule` | P2 | E2E: Change fee → Save → reload page → fee persists |
| FM-13 | **ConsentSheet: no confirmation before signing** — "Sign & Submit" is irreversible (signed=true, immutable) but no pre-sign confirmation dialog | `features/workspace/components/consent-sheet.tsx` | ConsentSheet | CLINICAL_WRITE | `POST /dental/clinical/consent-forms/{id}/sign` | P1 | Component: draw signature → click Submit → confirmation "This action is irreversible" appears |
| FM-14 | **WorkspacePaymentModal: no escape key or focus trap** — custom div modal, not Radix Dialog | `features/workspace/components/workspace-payment-modal.tsx` | WorkspacePaymentModal | BILLING_WRITE | N/A | P2 | Component: open → press Esc → modal closes |
| FM-15 | **InvoiceDetail has no accessibility role** — custom slide-up, no `role="dialog"` or `aria-modal` found | `features/billing/components/invoice-detail.tsx` | InvoiceDetail | BILLING_WRITE | N/A | P2 | Accessibility audit: InvoiceDetail has role="dialog" aria-modal="true" |
| FM-16 | **BillingList has no pagination** — all invoices fetched in one request; performance degrades with large datasets | `features/billing/components/billing-list.tsx` | BillingList | BILLING_WRITE | `GET /dental/billing/invoices` | P2 | Performance: 500 invoices → list renders without timeout |
| FM-17 | **Appointment form role gate missing** — any authenticated user can create appointments, including `read_only` and `staff_scheduling` | `features/scheduling/components/appointment-modal.tsx` | AppointmentModal | All (no gate) | `POST /dental/scheduling/appointments` | P1 | Component: render as read_only → Create Appointment button disabled |
| FM-18 | **SOAP notes role gate missing** — all roles can save and sign clinical notes; no CLINICAL_WRITE check in component | `features/workspace/components/soap-notes-sheet.tsx` | SoapNotesSheet | All (no gate) | `PATCH /dental/clinical/visits/{id}/notes` | P1 | Component: render as staff_scheduling → Save/Sign buttons disabled |
| FM-19 | **Recall Create role gate missing** — any authenticated member can create recalls | `features/workspace/components/recalls-sheet.tsx` | RecallsSheet | All (no gate) | `POST /dental/clinical/recalls` | P2 | Component: render as staff_scheduling → Create Recall disabled |
| FM-20 | **Consent Sheet role gate missing** — any authenticated member can submit consent forms | `features/workspace/components/consent-sheet.tsx` | ConsentSheet | All (no gate) | `POST /dental/clinical/consent-forms` | P1 | Component: render as staff_scheduling → Submit disabled |
| FM-21 | **Date of birth on Patient Registration not validated for format** — `<input type="date">` accepts browser-local format; passed to API as-is; invalid ISO dates may cause 400/422 | `features/patients/components/patient-registration-modal.tsx` | PatientRegistrationModal | CLINICAL_WRITE | `POST /dental/org/{branchId}/patients` | P2 | Unit: validate('not-a-date') → returns error; validate('2000-01-01') → passes |

---

## 6. Gate 5 Verdict

**GATE 5: PASS (with critical form/modal/table gaps requiring stabilization)**

Form, modal, and table action map complete. Key items for stabilization plan:

- **FM-01**: AppointmentModal edit path is stub — always creates, never updates
- **FM-03**: Void Invoice fires without confirmation (financial risk)
- **FM-04**: StaffCreateModal lacks escape key, focus trap, aria-labelledby (accessibility P1)
- **FM-07**: Appointment requires raw UUID input for patient — serious UX gap
- **FM-13**: Consent signing is irreversible with no pre-confirmation
- **FM-17/18/20**: Appointment create, SOAP save/sign, Consent submit have no CLINICAL_WRITE role gate in frontend
