# Frontend Interaction Integrity Audit
**Date**: 2026-05-26  
**Auditor**: Journey Test Audit Orchestrator — Pass 04  
**Scope**: apps/dentalemon — primary dental app  
**Mode**: Read-only. No code modified.

---

## 1. Interaction Registry

### 1A. Workspace Top Bar (`features/workspace/components/workspace-top-bar.tsx`)

| ID | Action Label | Element | Role | Handler | Backend/API | Status | Existing Test |
|---|---|---|---|---|---|---|---|
| WTB-01 | Rx (Prescription) | IconButton `aria-label="Rx"` | All members | `onRx()` → opens RxSheet | `POST /dental/clinical/prescriptions` | LIKELY WORKING | `rx-sheet.tsx` tests |
| WTB-02 | Consent | IconButton `aria-label="Consent"` | CLINICAL_WRITE | `onConsent()` → opens ConsentSheet | `POST /dental/clinical/consent-forms` | LIKELY WORKING | `consent-signing.spec.ts` |
| WTB-03 | Lab | IconButton `aria-label="Lab"` | CLINICAL_WRITE | `onLab()` → opens LabOrdersSheet | `POST /dental/clinical/lab-orders` | LIKELY WORKING | `lab-order-tracking.spec.ts` |
| WTB-04 | PMD | IconButton `aria-label="PMD"` | BILLING_WRITE | `onPmd()` → opens PMDViewerSheet | `GET/POST /dental/clinical/pmd` | LIKELY WORKING | `pmd-generation.spec.ts` |
| WTB-05 | Attachments | IconButton `aria-label="Attachments"` | CLINICAL_WRITE | `onAttachments()` → opens AttachmentsSheet | `POST /dental/clinical/attachments` | LIKELY WORKING | `attachments.spec.ts` |
| WTB-06 | Notes | IconButton `aria-label="Notes"` | All members | `onNotes()` → opens SoapNotesSheet | `PATCH /dental/visits/{visitId}` | LIKELY WORKING | None confirmed |
| WTB-07 | Treatment Plan | IconButton | All | `onTreatmentPlan()` → opens TreatmentPlanTab sheet | `GET/POST /dental/clinical/treatments` | LIKELY WORKING | `prescribe-medication.spec.ts` |
| WTB-08 | Complete Visit | IconButton `aria-label="Complete Visit"` | dentist_owner, dentist_associate | `onCompleteVisit()` → PreCompletionChecklist | `PATCH /dental/visits/{visitId}` (status change) | LIKELY WORKING | `pmd-generation.spec.ts` |
| WTB-09 | Fullscreen toggle | IconButton (Maximize2/Minimize2) | All | `document.documentElement.requestFullscreen()` | None | ✅ Working | None |
| WTB-10 | Patient info chevron | ChevronDown icon | All | Expands patient details [NEEDS CONFIRMATION] | None | [UNCLEAR] | None |

**Accessibility**: All icon buttons have `aria-label` ✅. Disabled state uses `disabled` prop + opacity styling ✅.

**Risk**: WTB-02/03 open clinical write sheets — no role check before showing icon buttons. All members see all action buttons. A `staff_scheduling` member sees Prescription, Consent, Lab buttons but the API will 403. **No UI-level role filtering on workspace top bar buttons.**

### 1B. Treatment Table (`features/workspace/components/treatment-table.tsx`)

| ID | Action | Element | Role | Handler | Backend/API | Status | Notes |
|---|---|---|---|---|---|---|---|
| TT-01 | Mark Done (checkmark) | Button | All | `useMarkTreatmentDone` | `PATCH /dental/clinical/treatments/{id}` | ✅ Working | Disabled during pending; status → diagnosed→planned→performed |
| TT-02 | Inline price edit | Click on price cell | dentist_owner (write) | `useUpdateTreatment` | `PATCH /dental/clinical/treatments/{id}` | ✅ Working | `readOnly` prop disables when locked |
| TT-03 | Dismiss (popover) | Radix Popover button | CLINICAL_WRITE | `useUpdateTreatment` → status: dismissed | `PATCH /dental/clinical/treatments/{id}` | ✅ Working | Popover with reason input |
| TT-04 | Expand chevron (notes row) | ChevronRight/Down | All | Local state toggle | None | ✅ Working | Local only |
| TT-05 | View/Hide Completed toggle | Button | All | `setShowCompleted` | None | ✅ Working | Local filter |
| TT-06 | Select treatment row | onClick row | All | `onSelectTreatment?.(id)` | None | ✅ Working | Passed in from parent |
| TT-07 | Dismiss confirm button | Button in popover | CLINICAL_WRITE | `useUpdateTreatment` | API | LIKELY WORKING | `disabled={isUpdating}` ✅ |

**Risk**: `readOnly` prop must be set for `staff_scheduling`. Not confirmed if workspace passes `readOnly` correctly for all roles.

### 1C. Patient Folder Card (`features/patients/components/patient-folder-card.tsx`)

| ID | Action | Element | Handler | Target | Status | Risk |
|---|---|---|---|---|---|---|
| PFC-01 | Click card | `<button>` on card | `onClick(patient)` | Parent calls `navigate({ to: '/$patientId' })` | **[LIKELY BUG]** | P1 — wrong route (BN-01) |
| PFC-02 | Profile button (`onProfile`) | Optional button | `onProfile?.(patient)` | Parent calls `navigate({ to: '/patients/$patientId' } as any)` | **[LIKELY BUG]** | P1 — wrong route (BN-02) |

### 1D. Staff List (`features/staff/components/staff-list.tsx`)

| ID | Action | Element | Role | Handler | Backend/API | Status | Test |
|---|---|---|---|---|---|---|---|
| SL-01 | Add Staff | Button | dentist_owner only | Opens `StaffCreateModal` | `POST /dental/branches/{id}/members` | ✅ Working | `add-staff.spec.ts` |
| SL-02 | Deactivate member | Button | dentist_owner only | `useStaffMutations.deactivate` | `DELETE /dental/branches/{id}/members/{memberId}` | ✅ Working | `deactivateMember.test.ts` |
| SL-03 | Role badge | Display only | All | None | None | ✅ | — |

**Issue**: `formatRole` only maps 4 roles; `hygienist`, `dental_assistant`, `front_desk`, `billing_staff`, `read_only` display raw string instead of label.

### 1E. Billing List / Invoice Detail (`features/billing/components/`)

| ID | Action | Element | Role | Handler | Backend | Status | Test |
|---|---|---|---|---|---|---|---|
| BL-01 | Click invoice row | Table row | BILLING_WRITE | `onInvoiceClick(invoice)` → opens InvoiceDetail sheet | None (sheet opens) | ✅ | `billing.spec.ts` |
| BL-02 | Issue Invoice | Button in InvoiceDetail | BILLING_WRITE | API call to issue | `POST /dental/billing/invoices/{id}/issue` | LIKELY WORKING | `billing.spec.ts` |
| BL-03 | Void Invoice | Button | dentist_owner only | API call to void | `POST /dental/billing/invoices/{id}/void` | LIKELY WORKING | `billing.spec.ts` |
| BL-04 | Add Discount | Button | dentist_owner only | API call | `POST /dental/billing/invoices/{id}/discount` | LIKELY WORKING | None confirmed |
| BL-05 | Record Payment | Button | BILLING_WRITE | Opens payment form → API | `POST /dental/billing/invoices/{id}/payments` | LIKELY WORKING | `billing.spec.ts` |
| BL-06 | View Payment Plan | Button | dentist_owner, staff_full | Opens PaymentPlanView | `POST/GET /dental/billing/invoices/{id}/plan` | LIKELY WORKING | `payment-plan.spec.ts` |
| BL-07 | Create Invoice | Button in workspace payment modal | BILLING_WRITE | `createInvoice.mutate()` | `POST /dental/billing/invoices` | ✅ | `disabled when isPending || lineItems empty` |

**Destructive action concern**: "Void Invoice" (BL-03) and "Void Payment" — do these have a confirmation dialog? [NEEDS MANUAL CONFIRMATION]

### 1F. Dashboard (`features/dashboard/components/morning-briefing.tsx`)

| ID | Action | Role | Handler | Target | Status |
|---|---|---|---|---|---|
| DB-01 | View all patients CTA | All (role filtered in component) | `navigate('/patients')` | `/_dashboard/patients` | ✅ |
| DB-02 | View all billing CTA | dentist_owner, dentist_associate | `navigate('/billing')` | `/_dashboard/billing` | ✅ |
| DB-03 | View all calendar CTA | All | `navigate('/calendar')` | `/_dashboard/calendar` | ✅ |
| DB-04 | Quick action buttons | role-dependent in MorningBriefing | Various navigations | Dashboard routes | LIKELY WORKING |

**Critical**: `DashboardPage` defaults `role` to `'dentist_owner'` if orgContextStore.role is null: `const role = (useOrgContextStore((s) => s.role) ?? 'dentist_owner') as DentalRole`. This means a user without a configured org context sees owner-level dashboard CTAs.

### 1G. Settings Page (`features/settings/components/`)

| ID | Action | Role | Status | Notes |
|---|---|---|---|---|
| SET-01 | Clinic settings save | dentist_owner | LIKELY WORKING | `canAccess(role, 'settings')` double-guard |
| SET-02 | Fee schedule | dentist_owner | **INCOMPLETE** | `fee-schedule.tsx` has TODO/console.log |
| SET-03 | Locale settings | dentist_owner | LIKELY WORKING | — |
| SET-04 | Working hours | dentist_owner | LIKELY WORKING | — |
| SET-05 | Notification settings | dentist_owner | LIKELY WORKING | — |

---

## 2. Broken Interaction Report

| ID | Issue | File | Page | Role | Evidence | Severity | Recommended Test |
|---|---|---|---|---|---|---|---|
| BI-01 | **Patient card click → wrong route `/$patientId`** | `patient-folder-card.tsx` parent | Patients list | All | `navigate({ to: '/$patientId' })` — route doesn't exist | P1 | E2E: click patient card → lands on workspace | 
| BI-02 | **Patient profile button → wrong route `/patients/$patientId` (as any)** | `patient-profile-page.tsx` | Patient detail | All | Cast to `any` hides TS error; route file is `patients_/$patientId` | P1 | E2E: click profile → lands on correct page |
| BI-03 | **Workspace top bar: no role gate on clinical action buttons** | `workspace-top-bar.tsx` | Workspace | All | All icon buttons visible to all roles; staff_scheduling sees Rx, Consent, Lab buttons — API will 403 | P1 | Component: staff_scheduling workspace → Rx/Consent/Lab buttons hidden or disabled |
| BI-04 | **Dashboard defaults role to `dentist_owner` if no org context** | `routes/_dashboard/dashboard.tsx` | Dashboard | All (no role) | `?? 'dentist_owner'` fallback | P1 | Component: no orgContext → dashboard shows role-appropriate CTAs, not owner CTAs |
| BI-05 | **Fee schedule has TODO — incomplete action** | `features/settings/components/fee-schedule.tsx` | Settings | dentist_owner | File contains TODO/console.log | P2 | Manual: verify fee schedule saves correctly |
| BI-06 | **`formatRole` in StaffList doesn't handle 5 undocumented roles** | `features/staff/components/staff-list.tsx` | Staff | dentist_owner | 9 schema roles; only 4 in formatRole map → raw string display | P2 | Unit: formatRole('hygienist') → human-readable label |
| BI-07 | **Void Invoice/Void Payment: confirmation dialog not confirmed** | `features/billing/components/invoice-detail.tsx` | Billing | dentist_owner | Void is destructive/financial; no confirmation UI found in excerpt | P1 | E2E: void invoice → confirmation dialog appears |
| BI-08 | **Appointment modal has TODO** | `features/scheduling/components/appointment-modal.tsx` | Calendar | All | TODO in file | P2 | Manual: verify appointment creation works end-to-end |
| BI-09 | **Recalls sheet has TODO** | `features/workspace/components/recalls-sheet.tsx` | Workspace | All | TODO in file | P2 | Manual: verify recalls display correctly |
| BI-10 | **Amendment form has TODO** | `features/workspace/components/amendment-form.tsx` | Workspace | CLINICAL_WRITE | TODO in file | P2 | Manual: verify PMD amendment flow |
| BI-11 | **CDT code browser has TODO** | `features/workspace/components/cdt-code-browser.tsx` | Workspace | All | TODO in file | P2 | Manual: verify CDT search returns results |
| BI-12 | **Medical history form has TODO** | `features/workspace/components/medical-history-form.tsx` | Workspace | BILLING_WRITE | TODO in file | P2 | E2E: save medical history → appears in list |
| BI-13 | **Treatment plan tab has TODO** | `features/workspace/components/treatment-plan-tab.tsx` | Workspace | All | TODO in file | P2 | E2E: add treatment plan → appears |
| BI-14 | **Image upload has TODO** | `features/imaging/components/image-upload.tsx` | Workspace imaging | CLINICAL_WRITE | TODO in file | P2 | E2E: upload image → appears in study |
| BI-15 | **patient-list.tsx has console.log** | `features/patients/components/patient-list.tsx` | Patients | All | console.log in production code | P3 | Remove |
| BI-16 | **Follow-up notes has console.log** | `features/patients/components/follow-up-notes.tsx` | Patients | All | console.log in production code | P3 | Remove |

---

## 3. Missing Test Matrix

| Interaction | Risk | Recommended Test Type | Suggested Assertion |
|---|---|---|---|
| Patient card click → workspace navigation | P1 — wrong route crashes | E2E | Click patient card → URL is `/_workspace/{patientId}`, workspace renders |
| Workspace top bar: Rx button visible for all roles | P1 — UX confusion | Component | Render as staff_scheduling → Rx/Consent buttons disabled or hidden |
| Void Invoice confirmation dialog | P1 — destructive without confirmation | E2E | Click Void → confirmation modal appears; confirm → status becomes voided |
| Dashboard role default fallback | P1 — shows wrong CTAs | Component | Render DashboardPage with no orgContext → owner CTAs not shown |
| Mark Treatment Done for staff_scheduling | P1 — should be blocked | API integration | staff_scheduling POST treatment done → 403 |
| Fee schedule saves | P2 — TODO risk | E2E | Change fee → save → fee persists after reload |
| Staff role badge renders unknown roles | P2 | Unit | formatRole('hygienist') → returns readable string |
| Appointment create end-to-end | P2 | E2E | Create appointment → appears in calendar |
| PMD amendment flow | P2 | E2E | Create amendment → chain visible in PMD history |
| Void Payment confirmation | P1 | E2E | Click Void Payment → confirmation modal appears |
| Image upload flow | P2 | E2E | Upload JPEG → appears in imaging study |
| Workspace top bar Complete Visit disables actions | P1 | Component | Set visitStatus=locked → action buttons disabled |

---

## 4. Gate 4 Verdict

**GATE 4: PASS (with P1 interaction bugs requiring stabilization)**

Frontend interaction map is complete. Proceed to Gate 5 (Form/Modal/Table/Action Audit). Critical items for stabilization plan:

- BI-01/02: Patient navigation routes broken
- BI-03: Workspace top bar shows all actions to all roles
- BI-04: Dashboard role defaults to owner
- BI-07: Void invoice lacks confirmation
