# Role-Based Journey Map Audit
**Date**: 2026-05-26  
**Auditor**: Journey Test Audit Orchestrator — Pass 07  
**Scope**: apps/dentalemon — primary dental app  
**Mode**: Read-only. No code modified.

---

## 1. Role Summary

| Role | Access Matrix | Source | Frontend Guard | Backend Enforcement |
|---|---|---|---|---|
| `dentist_owner` | All modules | `rbac.ts` ACCESS_MATRIX | `canAccess(role, module)` | `assertBranchRole` — full |
| `dentist_associate` | Dashboard, workspace, patients, calendar, billing (own) | `rbac.ts` | `canAccess` | `assertBranchRole` |
| `staff_full` | Dashboard, workspace, patients, calendar | `rbac.ts` | `canAccess` | `assertBranchAccess` (any member) |
| `staff_scheduling` | Patients (read), calendar | `rbac.ts` | `canAccess` — no dashboard/workspace | `assertBranchAccess` |
| `hygienist` | **Undocumented in frontend** | DB schema only | No `canAccess` entry | `assertBranchRole` for attachments |
| `dental_assistant`, `front_desk`, `billing_staff`, `read_only` | **Undocumented in frontend** | DB schema only | No `canAccess` entry | No specific backend gates found |

---

## 2. Journey Registry

### dentist_owner journeys

| Journey | Start Route | End State | Routes | UI Actions | APIs | Existing Tests | Criticality |
|---|---|---|---|---|---|---|---|
| J-DO-01: Login → Dashboard | `/auth/sign-in` | Dashboard visible with owner CTAs | `/auth/$authView` → `/_dashboard/dashboard` | Sign in form, email/password submit | `POST /api/auth/sign-in` | `auth-gates.spec.ts`, `onboarding.spec.ts` | Critical |
| J-DO-02: Register new patient | `/_dashboard/patients` | Patient appears in list | `/_dashboard/patients` | "+" button → PatientRegistrationModal → submit | `POST /dental/patients` | `patient-registration.spec.ts` | Critical |
| J-DO-03: Open patient workspace | `/_dashboard/patients` | Workspace loaded for patient | `/_dashboard/patients` → [BROKEN] `/$patientId` or `/_workspace/$patientId` | Click patient card | None (navigation) | `returning-patient-visit.spec.ts` | Critical |
| J-DO-04: Chart treatment on tooth | `/_workspace/$patientId` | Treatment in diagnosed state | `/_workspace/$patientId` | Click tooth → ToothSlideout → add CDT code → save | `POST /dental/visits/{id}/treatments` | `01-new-patient-exam.journey.spec.ts` (BROKEN) | Critical |
| J-DO-05: Mark treatment done | `/_workspace/$patientId` | Treatment → performed state | `/_workspace/$patientId` | Check ✓ in treatment table (fires two PATCHes) | `PATCH /dental/visits/{id}/treatments/{id}` × 2 | `04-revenue-chain.journey.spec.ts` (PASS) | Critical |
| J-DO-06: Write SOAP notes + sign | `/_workspace/$patientId` | Notes signed/locked | `/_workspace/$patientId` | Notes icon → SoapNotesSheet → fill fields → Sign & Lock | `PATCH /dental/visits/{id}/notes`, `POST /dental/visits/{id}/notes/sign` | None confirmed | Critical |
| J-DO-07: Collect consent form | `/_workspace/$patientId` | Consent signed/immutable | `/_workspace/$patientId` | Consent icon → ConsentSheet → select template → draw signature → submit | `POST /dental/visits/{id}/consents`, `POST .../sign` | `consent-signing.spec.ts` | Critical |
| J-DO-08: Create invoice | `/_workspace/$patientId` or `/_dashboard/billing` | Invoice in draft state | `/_workspace/$patientId` (payment modal) | Payment icon → WorkspacePaymentModal → "Create Invoice & Pay" | `POST /dental/billing/invoices` | `04-revenue-chain.journey.spec.ts`, `billing.spec.ts` | Critical |
| J-DO-09: Issue + void invoice | `/_dashboard/billing` | Invoice issued/voided | `/_dashboard/billing` | Click invoice row → InvoiceDetail → Issue / Void | `POST /dental/billing/invoices/{id}/issue`, `.../void` | `billing.spec.ts` | Critical |
| J-DO-10: Add staff member | `/_dashboard/staff` | New staff member in list | `/_dashboard/staff` | "Add Staff" → StaffCreateModal → fill fields → submit | `POST /dental/org/members` | `add-staff.spec.ts` | Important |
| J-DO-11: Complete visit | `/_workspace/$patientId` | Visit status = locked | `/_workspace/$patientId` | "Complete Visit" icon → PreCompletionChecklist → confirm | `PATCH /dental/visits/{id}` (status complete) | `pmd-generation.spec.ts` | Important |
| J-DO-12: View reports | `/_dashboard/reports` | Revenue/treatment report rendered | `/_dashboard/reports` | Date range inputs → rendered table + CSV export | `GET /dental/billing/invoices`, `GET /dental/patients/{id}/treatments` | `reporting.spec.ts` | Secondary |
| J-DO-13: Configure fee schedule | `/_dashboard/settings` | Fee schedule saved | `/_dashboard/settings` | Fee Schedule tab → edit prices → Save | `PATCH /dental/branches/{id}/settings` | None confirmed | Admin/Config |
| J-DO-14: Prescribe medication | `/_workspace/$patientId` | Prescription created | `/_workspace/$patientId` | Rx icon → RxSheet → fill → submit | `POST /dental/visits/{id}/prescriptions` | `prescribe-medication.spec.ts` | Important |
| J-DO-15: Order lab work | `/_workspace/$patientId` | Lab order created | `/_workspace/$patientId` | Lab icon → LabOrdersSheet → fill → submit | `POST /dental/visits/{id}/lab-orders` | `lab-order-tracking.spec.ts` | Important |

### dentist_associate journeys

| Journey | Start Route | End State | Routes | UI Actions | APIs | Existing Tests | Criticality |
|---|---|---|---|---|---|---|---|
| J-DA-01: Login → Dashboard | `/auth/sign-in` | Dashboard visible (same as owner) | `/auth/$authView` → `/_dashboard/dashboard` | Sign in, PIN entry | Auth APIs | `auth-gates.spec.ts` | Critical |
| J-DA-02: Clinical workflow (chart → treat → SOAP) | `/_workspace/$patientId` | Treatment performed, notes signed | `/_workspace/$patientId` | Same as J-DO-04 through J-DO-07 | Clinical APIs | `returning-patient-visit.spec.ts` | Critical |
| J-DA-03: Prescribe (own patients) | `/_workspace/$patientId` | Prescription created | `/_workspace/$patientId` | Rx → submit | `POST /dental/visits/{id}/prescriptions` | `prescribe-medication.spec.ts` | Important |
| J-DA-04: No staff management | `/_dashboard/staff` | Should be blocked | N/A | Staff nav link should be hidden | N/A | None for associate+staff combo | Important |
| J-DA-05: No settings access | `/_dashboard/settings` | Should be blocked | N/A | Settings nav link should be hidden | N/A | None | Secondary |

### staff_full journeys

| Journey | Start Route | End State | Routes | UI Actions | APIs | Existing Tests | Criticality |
|---|---|---|---|---|---|---|---|
| J-SF-01: Login → Dashboard (simplified) | `/auth/sign-in` | Dashboard visible, no financial CTAs | `/auth/$authView` → `/_dashboard/dashboard` | Sign in | Auth APIs | `auth-gates.spec.ts` | Critical |
| J-SF-02: Patient list + search | `/_dashboard/patients` | Patient list rendered, searchable | `/_dashboard/patients` | Search input, filter tabs | `GET /dental/patients` | `patient-list.spec.ts` (inferred) | Critical |
| J-SF-03: Open workspace | `/_dashboard/patients` → `/_workspace/$patientId` | Workspace loaded | `/_dashboard/patients` → [BROKEN] → `/_workspace/$patientId` | Click patient card | Navigation | `workspace-readonly.spec.ts` | Critical |
| J-SF-04: View calendar | `/_dashboard/calendar` | Calendar rendered with appointments | `/_dashboard/calendar` | View appointments, navigate dates | `GET /dental/appointments` | `calendar.spec.ts` | Important |
| J-SF-05: Blocked from billing | `/_dashboard/billing` | Redirected/blocked | N/A | Navigation to billing should fail | N/A | None confirmed | Important |
| J-SF-06: Blocked from staff mgmt | `/_dashboard/staff` | Redirected/blocked | N/A | Staff link hidden or guarded | N/A | None confirmed | Important |

### staff_scheduling journeys

| Journey | Start Route | End State | Routes | UI Actions | APIs | Existing Tests | Criticality |
|---|---|---|---|---|---|---|---|
| J-SS-01: PIN login → Calendar | `/auth/pin-select` → `/auth/pin-entry.$memberId` | Calendar visible | `/auth/pin-select` → `/auth/pin-entry.$memberId` → `/_dashboard/calendar` | Select staff member → 6-digit PIN | `POST /dental/org/members/:id/verify-pin` | `auth-pin.spec.ts` | Critical |
| J-SS-02: Create appointment | `/_dashboard/calendar` | Appointment created | `/_dashboard/calendar` | "+" → AppointmentModal → fill → save | `POST /dental/appointments` | `role-gates-scheduling.spec.ts` | Critical |
| J-SS-03: Patient check-in | `/_dashboard/calendar` | Appointment checked-in | `/_dashboard/calendar` | Appointment card → check-in action | `POST /dental/appointments/{id}/check-in` | `patient-checkin.spec.ts` | Important |
| J-SS-04: Walk-in patient | `/_dashboard/calendar` | Walk-in appointment created | `/_dashboard/calendar` | Walk-in toggle in AppointmentModal | `POST /dental/appointments` (walkIn: true) | `walk-in.spec.ts` | Important |
| J-SS-05: Blocked from workspace | `/_workspace/$patientId` | Redirected | N/A | Direct URL entry → redirected to calendar | N/A | `role-gates-scheduling.spec.ts` | Critical |
| J-SS-06: Blocked from dashboard | `/_dashboard/dashboard` | Redirected | N/A | Dashboard nav → redirected | N/A | `role-gates-scheduling.spec.ts` | Critical |

---

## 3. Broken Journey Report

| ID | Journey | Role | Broken Step | Evidence | Severity | Recommended Fix | Recommended Test |
|---|---|---|---|---|---|---|---|
| BJ-01 | J-DO-03: Open patient workspace | All | Click patient card → wrong route `/$patientId` | `navigate({ to: '/$patientId' })` — route doesn't exist; code uses `as any` to suppress TS error | P0 | Change navigate target to `/_workspace/$patientId` | E2E: click patient card → URL is `/_workspace/{id}`, workspace loads |
| BJ-02 | J-DO-03 (profile path): Patient profile button | All | Profile button → wrong route `/patients/$patientId` | `navigate({ to: '/patients/$patientId' } as any)` — route file is `_dashboard/patients_/$patientId` | P0 | Fix navigate target | E2E: click profile → lands on `/_dashboard/patients/$patientId` |
| BJ-03 | J-DO-04: Chart existing tooth condition | dentist_owner/associate | No "Existing" vs "Existing-Other" status control in ToothSlideout | J01 journey spec explicitly documents this as a known gap; expectedVerdict: PASS but journey marked BROKEN | P1 | [NEEDS PRODUCT DECISION] Add Existing status to ToothSlideout | E2E J01: chart Existing condition → verified via API read |
| BJ-04 | J-DO-06: SOAP notes sign + addendum | Any member (no gate) | Frontend allows all roles to save/sign clinical notes; staff_scheduling hitting 403 would silently fail | No CLINICAL_WRITE gate in SoapNotesSheet | P1 | Add role check: disable Save/Sign for staff_scheduling | Component: staff_scheduling → Save/Sign disabled |
| BJ-05 | J-DO-07: Consent signing — no pre-sign confirmation | Any member (no gate) | "Sign & Submit" fires immediately; immutable action without user confirmation | FM-13 from Gate 5 | P1 | Add confirmation dialog before signing | E2E: draw signature → Submit → confirmation dialog appears |
| BJ-06 | J-DO-08: Create invoice without performed treatments | dentist_owner | `createDentalInvoice` does not enforce BR-011 (consent gate); invoice creation allowed without signed consent | `billing-gate-http.test.ts` stop-condition note | P1 | Backend: enforce BR-011 check in `createDentalInvoice` | Backend integration: create invoice without consent → 422 |
| BJ-07 | J-DO-09: Void invoice without confirmation | dentist_owner | `handleVoid()` fires immediately; no confirmation dialog; financial-irreversible action | FM-03 from Gate 5; `invoice-detail.tsx` code | P1 | Add confirmation modal before void | E2E: click Void → confirmation dialog; confirm → voided |
| BJ-08 | Recall management workflow | Any role | Recalls endpoints `GET/POST/PATCH /dental/patients/{id}/recalls` not in OpenAPI spec | AD-02 from Gate 6 | P0 | Verify backend handler exists; add to OpenAPI spec; add contract tests | Integration: GET/POST/PATCH recalls → 200/201 |
| BJ-09 | Treatment plan workflow | Any role | Frontend calls `/dental/patients/{id}/treatment-plans` (plural) but spec has `/treatment-plan` (singular) → 404 | AD-01 from Gate 6 | P0 | Align URL: either rename frontend call to singular or update spec | Integration: GET treatment-plans → 200 (not 404) |
| BJ-10 | Queue board workflow (J-SS-04/walk-in via queue) | staff_scheduling, staff_full | `/dental/branches/{id}/queue-board` and `/dental/queue-items/{id}/status` not in OpenAPI | AD-03/04 from Gate 6 | P1 | Add to OpenAPI spec; add contract tests; verify backend handler | Integration: GET queue-board → 200; PATCH status → 200 |
| BJ-11 | Appointment edit | Any role | `AppointmentModal` accepts `appointmentId` prop (edit mode) but only calls `createAppointment`; no update path | FM-01 from Gate 5; `appointment-modal.tsx` code | P1 | Implement edit mode: load existing appointment, call updateAppointment | E2E: click appointment → edit modal pre-filled |
| BJ-12 | staff_scheduling → workspace access | staff_scheduling | `canAccess('staff_scheduling', 'workspace') = false` but sidebar/workspace top bar buttons visible after navigation entry point fixed | ACCESS_MATRIX from Gate 2; BI-03 from Gate 4 | P1 | Fix navigation + hide clinical buttons from staff_scheduling | E2E: staff_scheduling URL → `/_workspace` → redirected to calendar |
| BJ-13 | Dashboard role default fallback | Any user without orgContext | Dashboard renders owner-level CTAs when `orgContextStore.role` is null | `dashboard.tsx: ?? 'dentist_owner'` | P1 | Return safe fallback or redirect to org selection | Component: no orgContext → owner CTAs NOT shown |
| BJ-14 | J-DO-10: Staff member form — `hygienist` role | dentist_owner | StaffCreateModal only offers 4 role options; `hygienist` not in dropdown; hygienist members can't be created via UI | FM-05 from Gate 5; only 4 roles in ROLE_OPTIONS | P2 | Add hygienist to ROLE_OPTIONS with canAccess entry | Component: open StaffCreateModal → hygienist option exists |
| BJ-15 | J-DO-13: Fee schedule save | dentist_owner | Fee schedule `handleSave()` API endpoint not confirmed; could be a no-op | SET-02, FM-12 | P2 | Verify/confirm save API call; add test | E2E: change fee → save → reload → fee persists |
| BJ-16 | PMD export/import | Any clinical role | PMD workflow partially implemented; J10 (void-amend-audit) and PMD-related journeys partially covered | `pmd-generation.spec.ts` exists | P2 | Verify PMD chain end-to-end | E2E: generate PMD → export PDF → verify content |
| BJ-17 | Imaging ceph workflow | dentist_owner | Ceph report route `imaging-ceph-report.$imageId.tsx` has no auth guard | BN-10 from Gate 3 | P1 | Add `requireAuth` guard to ceph report route | E2E: unauthenticated → `imaging-ceph-report/*` → redirected to login |

---

## 4. Journey Test Matrix

| Journey | Unit Tests | Component Tests | API/Integration Tests | E2E Tests | Priority |
|---|---|---|---|---|---|
| J-DO-03: Patient card → workspace navigation | None | `patient-folder-card.test.ts` (add route assertion) | None | `returning-patient-visit.spec.ts` (add URL assertion) | P0 — broken navigation |
| J-DO-06: SOAP notes save + sign | None | SoapNotes: test role gate, dirty state warning | None | None — add E2E for sign + addendum | P1 |
| J-DO-07: Consent e-sign with confirmation | None | ConsentSheet: pre-sign confirmation dialog | `consent-sheet.test.ts` (expand) | `consent-signing.spec.ts` (add confirmation assert) | P1 |
| J-DO-08/09: Invoice create/void | `use-invoices.test.ts` | InvoiceDetail: void confirmation dialog | `billing-gate-http.test.ts` (role forbidden) | `billing.spec.ts` (add void confirmation) | P1 |
| J-DO-10: Staff create (all 9 roles) | `validateStaffForm` (✅) | StaffCreateModal: Esc key, focus trap, hygienist option | `add-staff.spec.ts` (expand) | `add-staff.spec.ts` | P1 |
| J-DA-04/05: Associate role blocks | None | Dashboard: associate sees no staff/settings nav | `assertBranchRole` forbidden test | `role-gates-scheduling.spec.ts` (expand) | P1 |
| J-SF-05/06: staff_full blocks billing/staff | None | Component: billing nav hidden | None | `role-gates-scheduling.spec.ts` (expand) | P1 |
| J-SS-01: PIN login → calendar | `pin-entry.test.ts` (✅) | PinEntry: lockout display | `verifyPin` backend integration | `auth-pin.spec.ts` (✅) | P1 |
| J-SS-05/06: staff_scheduling blocked | None | None | None | `role-gates-scheduling.spec.ts` (✅) | P1 |
| J-BJ-08: Recalls workflow | None | RecallsSheet: basic render | **P0**: Integration GET/POST/PATCH recalls | None | P0 — no tests, endpoint unconfirmed |
| J-BJ-09: Treatment plans URL | None | None | **P0**: Integration GET treatment-plans → 200 | None | P0 — URL mismatch |
| J-BJ-10: Queue board workflow | None | QueueBoard: render + status update | **P1**: Integration GET queue-board, PATCH status | `walk-in.spec.ts`, `patient-checkin.spec.ts` | P1 |
| J-BJ-11: Appointment edit | `validateAppointmentForm` (✅) | AppointmentModal: pre-filled when editing | None | `calendar.spec.ts` (add edit flow) | P1 |
| J-BJ-13: Dashboard role default | `morning-briefing.test.ts` | DashboardPage: no orgContext → no owner CTAs | None | None | P1 |
| J-04: Revenue chain (PASS) | `treatment-table.test.ts` | None needed | `billing-gate-http.test.ts` (✅) | `04-revenue-chain.journey.spec.ts` (✅) | ✅ Covered |
| J-01: New patient exam (BROKEN) | None | None | None | `01-new-patient-exam.journey.spec.ts` (BROKEN — status collapse) | P1 — product decision needed |

---

## 5. Gate 7 Verdict

**GATE 7: PASS (with critical broken journeys requiring stabilization)**

16 structured journey specs exist in `tests/e2e/journeys/` plus 43 additional E2E specs covering specific flows. Journey coverage is strong for clinical and billing paths. Broken journeys requiring immediate attention:

- **BJ-01/02 (P0)**: Patient card navigation to workspace uses wrong route — breaks the most fundamental clinical workflow
- **BJ-08/09 (P0)**: Recalls and treatment-plans endpoints have URL mismatches or spec gaps — features may 404 silently  
- **BJ-03 (P1)**: ToothSlideout "Existing" status not implementable — J01 journey permanently broken until product decision
- **BJ-04 through BJ-07 (P1)**: SOAP sign, consent sign, invoice void, BR-011 all lack required guards/confirmations
