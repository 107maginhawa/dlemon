# UI Journey Enforcement
<!-- oli-ui-journey v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->
<!-- oli-ui-journey v1.0 | run: run-6-strict-2026-05-29 | 2026-05-29 -->
<!-- modules: dental-billing, dental-scheduling, dental-patient, dental-org, dental-clinical, dental-imaging, dental-visit, dental-pmd -->

## Summary

- **Modules assessed:** 8
- **Findings:** 25 (P0: 1, P1: 6, P2: 10, P3: 8)
- **Framework:** React 19 + TanStack Router (file-based) — fully supported
- **Codebase-map artifacts:** absent — full grep-based discovery performed
- **Registries activated:** R2 (route-spec alignment), R4 (auth guards), R5 (error states), R6 (SDK compliance)
- **Registries skipped:** R1 (ACTION_REGISTRY — no CODE_COMPONENT_REGISTRY), R3 (ELEMENT_ACTION_BINDING — no API_CONTRACTS.md), R7 (EXECUTIVE_SUMMARY — generated inline), R8 (SCENARIO_COVERAGE — requires R1)

---

## Findings by Module

### dental-billing

| ID | Sev | Registry | Description | File |
|----|-----|----------|-------------|------|
| UJ-BIL-a1b2c3d4 | P1 | R4 | `_dashboard/billing.tsx` uses `requireRole('billing')` but RBAC matrix grants `dentist_associate` full billing access with no "own patients only" filter enforced in UI — associate sees all branch invoices | `apps/dentalemon/src/routes/_dashboard/billing.tsx` |
| UJ-BIL-b2c3d4e5 | P2 | R5 | `BillingList` component renders invoice list; route-level has no error state — if `BillingList` internal query fails, no error surface visible at route level (error handling delegated entirely to child component, unverified) | `apps/dentalemon/src/routes/_dashboard/billing.tsx` |
| UJ-BIL-c3d4e5f6 | P2 | R5 | No "Create Invoice" button on the billing route — WF-013 (Create invoice) has no direct UI entry point on the billing list page; invoices appear to be created only from workspace payment modal | `apps/dentalemon/src/routes/_dashboard/billing.tsx` |
| UJ-BIL-d4e5f6g7 | P3 | R2 | `PaymentPlanView` modal opens from `InvoiceDetail` but no spec operation for payment plan creation confirmed in OpenAPI — WF-014 (record payment) coverage depends on undocumented downstream | `apps/dentalemon/src/routes/_dashboard/billing.tsx` |

### dental-scheduling

| ID | Sev | Registry | Description | File |
|----|-----|----------|-------------|------|
| UJ-SCH-e5f6g7h8 | P0 | R5 | Check-in `handleCheckIn` silently swallows all network errors: `catch { // Network error — ignore silently }` — WF-007 check-in failure produces no user feedback; violates WFG-002 (no recovery path) | `apps/dentalemon/src/routes/_dashboard/calendar.tsx` |
| UJ-SCH-f6g7h8i9 | P1 | R4 | `calendar.tsx` has no `beforeLoad: requireRole(...)` guard — `staff_scheduling` correctly reaches calendar, but `staff_scheduling` RBAC grants only calendar+patients access; no frontend role check prevents a `staff_scheduling` user from accidentally navigating to dashboard if they manipulate URL directly (role redirect not enforced at calendar route level) | `apps/dentalemon/src/routes/_dashboard/calendar.tsx` |
| UJ-SCH-g7h8i9j0 | P2 | R6 | `handleNewAppointment(true)` (Walk-In button) and `handleNewAppointment(false)` (New Appointment) both call the same `setModalOpen(true)` — walk-in vs scheduled distinction is lost before reaching `AppointmentModal`; `_walkIn` param discarded | `apps/dentalemon/src/routes/_dashboard/calendar.tsx` |
| UJ-SCH-h8i9j0k1 | P3 | R2 | Month view (`CalendarMonth`) is rendered but WORKFLOW_MAP has no WF-NNN for month-level calendar interactions — no spec coverage for month-view appointment click routing | `apps/dentalemon/src/routes/_dashboard/calendar.tsx` |

### dental-patient

| ID | Sev | Registry | Description | File |
|----|-----|----------|-------------|------|
| UJ-PAT-i9j0k1l2 | P1 | R6 | Patient registration `handleRegister` in `patients.tsx` calls `fetch(\`${API}/dental/patients\`, ...)` directly instead of using SDK-generated mutation hook — bypasses SDK type safety and generated error handling | `apps/dentalemon/src/routes/_dashboard/patients.tsx` |
| UJ-PAT-j0k1l2m3 | P1 | R4 | `patients.tsx` route has no `beforeLoad: requireRole(...)` guard — `staff_scheduling` (read-only per PRD) can reach patient registration flow since dashboard layout only checks auth+PIN, not module-level role | `apps/dentalemon/src/routes/_dashboard/patients.tsx` |
| UJ-PAT-k1l2m3n4 | P2 | R4 | `patients_/$patientId.tsx` (PatientProfilePage) has no role guard — any authenticated user with dashboard access can view patient profile; view-only vs write distinction not enforced at route level | `apps/dentalemon/src/routes/_dashboard/patients_/$patientId.tsx` |
| UJ-PAT-l2m3n4o5 | P3 | R2 | WF-078 (Patient portal session) — no `/portal/*` route exists; patient role (Taylor) has no UI entry point; Phase 2 scope but creates UNMAPPABLE journey | `apps/dentalemon/src/routes/` |

### dental-org

| ID | Sev | Registry | Description | File |
|----|-----|----------|-------------|------|
| UJ-ORG-m3n4o5p6 | P2 | R4 | `staff.tsx` double-guards with `beforeLoad: requireRole('staff')` AND runtime `role !== 'dentist_owner'` check — double-guard is redundant; `requireRole('staff')` already blocks non-owners, but `StaffAccessDenied` renders for non-owner roles that somehow pass `requireRole` — inconsistency between RBAC guard and runtime check logic (RBAC `staff` module only grants dentist_owner, so guard alone should suffice) | `apps/dentalemon/src/routes/_dashboard/staff.tsx` |
| UJ-ORG-n4o5p6q7 | P3 | R2 | No route exists for branch management (WF-069 create org, WF-070 create branch) outside of onboarding flow — Dentist-Owner has no post-onboarding UI to modify org/branch settings | `apps/dentalemon/src/routes/` |

### dental-clinical

| ID | Sev | Registry | Description | File |
|----|-----|----------|-------------|------|
| UJ-CLI-o5p6q7r8 | P1 | R4 | `_workspace/$patientId.tsx` (clinical workspace) uses `_workspace` layout which only calls `requireAuth` — no `requireRole('workspace')` guard; `staff_scheduling` role (RBAC: `workspace: false`) can access clinical workspace by navigating directly to `/_workspace/:patientId` | `apps/dentalemon/src/routes/_workspace/$patientId.tsx` |
| UJ-CLI-p6q7r8s9 | P2 | R5 | No error state rendered when `useVisits` or `usePatientProfile` fails — `visitsLoading` shows loading spinner but errors from `useVisits`/`useTreatments`/`usePatientProfile` are silently ignored (no `error &&` render) | `apps/dentalemon/src/routes/_workspace/$patientId.tsx` |
| UJ-CLI-q7r8s9t0 | P2 | R5 | `handleNewVisit` logs `console.error` if branchId/memberId missing but shows no user-facing error — visit creation failure is invisible to the user | `apps/dentalemon/src/routes/_workspace/$patientId.tsx` |

### dental-imaging

| ID | Sev | Registry | Description | File |
|----|-----|----------|-------------|------|
| UJ-IMG-r8s9t0u1 | P1 | R4 | `imaging-ceph-report.$imageId.tsx` has no `beforeLoad` guard — no `requireAuth`, no role check; ceph report is publicly accessible by URL without authentication | `apps/dentalemon/src/routes/imaging-ceph-report.$imageId.tsx` |
| UJ-IMG-s9t0u1v2 | P2 | R6 | `CephReportPage` uses raw `fetch(url)` instead of SDK hook — no base URL composition, no credential forwarding (`credentials: 'include'` absent), no auth token — requests will fail in production against a credentialed API | `apps/dentalemon/src/routes/imaging-ceph-report.$imageId.tsx` |
| UJ-IMG-001 | P1 | R5 | No error state in image canvas load path — `img.onload` renders the image but `img.onerror` is absent; if the blob URL or remote URL fails the canvas stays blank with no user-visible message | `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` |
| UJ-IMG-002 | P2 | R2 | WF-020 annotation save failure is silent — `createMeasurement.mutate()` fires on SVG click but no `onError` handler surfaces a toast or inline error; failed annotations disappear silently | `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` |
| UJ-IMG-003 | P2 | R2 | WF-031 landmark commit failure is silent — `commitLandmark.mutateAsync` rejection is uncaught at the call site in `CephLandmarkLayer.onPlace`; `onError` reverts cache but no user-visible error is shown | `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` |
| UJ-IMG-004 | P2 | R5 | `CephMeasurementsPanel` `isLoading` prop never passed from `CephWorkspacePanel` — panel receives `analysis={analysis ?? null}` with no `isLoading` prop; Skeleton loading state defined in the component is unreachable | `apps/dentalemon/src/features/imaging/components/CephWorkspacePanel.tsx` |
| UJ-IMG-005 | P2 | R5 | No loading indicator while radiograph loads — `imaging-workspace.tsx` starts async image load but renders a blank black canvas with no spinner or skeleton until `img.onload` fires | `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` |
| UJ-IMG-006 | P2 | R6 | Frontend `imagingTier` pre-check absent from Ceph toggle — `isCeph = modality === 'cephalometric'` shows Ceph button to all users; tier enforcement is server-only (403 → `addonRequired` banner inside the already-opened panel); non-cbct users experience open → error instead of a proactive upgrade prompt | `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` |
| UJ-IMG-007 | P2 | R6 | `AnnotationToolbar` always rendered with no role guard — WF-020 spec: only creator may edit; roles with no clinical write access (e.g. `staff_scheduling`, `front_desk`) see active annotation tools with no disabled/hidden state | `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` |
| UJ-IMG-008 | P2 | R4 | `NOT_CALIBRATED` (422) error not surfaced as actionable UI — `CephMeasurementsPanel` shows `'calibrate for mm'` inline but provides no call-to-action to open the calibration dialog; user has no path to resolve the gap | `apps/dentalemon/src/features/imaging/components/CephMeasurementsPanel.tsx` |
| UJ-IMG-009 | P3 | R2 | WF-019 upload success has no confirmation message — `onSuccess` closes the Sheet immediately; no toast or success state shown to confirm the study was saved | `apps/dentalemon/src/features/imaging/components/image-upload.tsx` |

<!-- run-6-strict-2026-05-29 | dental-imaging | Registries 2, 4, 5, 6 | 9 new findings: P1×1, P2×7, P3×1 -->

### dental-visit

| ID | Sev | Registry | Description | File |
|----|-----|----------|-------------|------|
| UJ-VIS-t0u1v2w3 | P3 | R2 | WFG-002 (Check-in partial failure: appointment created but visit draft fails) has no recovery UI — `handleCheckIn` in calendar catches and discards the error; no retry mechanism or compensating action exposed to user | `apps/dentalemon/src/routes/_dashboard/calendar.tsx` |
| UJ-VIS-u1v2w3x4 | P3 | R2 | WFG-003 (concurrent visit conflict BR-001) — workspace silently auto-selects first visit on load; if a concurrent visit was created server-side the user has no indication | `apps/dentalemon/src/routes/_workspace/$patientId.tsx` |

---

## dental-patient — Run 6 (strict) | Registries 2, 4, 5, 6 | run-6-strict-2026-05-29

> Deep re-audit of Registries 2 (Interaction Flows), 4 (Error States), 5 (Loading States), 6 (Role Visibility) for the dental-patient module.
> Source files: `apps/dentalemon/src/features/patients/`, `apps/dentalemon/src/routes/_dashboard/patients.tsx`
> Spec reference: `docs/product/modules/dental-patient/MODULE_SPEC.md` §6–9, WF-005, WF-023

| ID | Sev | Registry | Description | File |
|----|-----|----------|-------------|------|
| UJ-PAT-001 | P1 | R2 | WF-005 consent flow: consent checkbox present and `validate()` blocks submit if unchecked (error rendered). However `marketing_consent` is the only consent field in `PatientRegistrationData`; `data_sharing_consent`, `sms_consent`, `email_consent` (all required non-nullable booleans in API contract POST body) are absent from modal state and not submitted. Backend receives no values for those fields. | `apps/dentalemon/src/features/patients/components/patient-registration-modal.tsx` |
| UJ-PAT-002 | P1 | R6 | Archive action exposed to all roles — `patients.tsx` passes `onArchive={archive}` unconditionally; no role check against `dentist_owner` before wiring the prop. MODULE_SPEC §6: "Archive patient: dentist_owner | all others". Any `staff_full` or `dentist_associate` sees and can invoke archive. Backend enforces but frontend must gate per spec. | `apps/dentalemon/src/routes/_dashboard/patients.tsx` |
| UJ-PAT-003 | P1 | R6 | Export action role-ungated — `onExport={exportPatients}` wired unconditionally. MODULE_SPEC §6: "Export/bulk ops: dentist_owner | all others". No session role check before passing prop; Export button renders for any authenticated user. | `apps/dentalemon/src/routes/_dashboard/patients.tsx` |
| UJ-PAT-004 | P1 | R4 | Archived patient profile: status badge "Archived" renders via `statusBadge()` but no read-only enforcement in `PatientProfilePage` — no disabled inputs, no "record is archived" banner, no edit suppression. AC-PAT-002 + BR-015b require read-only UI. Spec §9 names "Archived notice (read-only badge)" as a required state. Users can attempt writes; only backend 403 stops them with no UX signal. | `apps/dentalemon/src/features/patients/components/patient-profile-page.tsx` |
| UJ-PAT-005 | P2 | R2 | WF-023 search: `onSearchChange` fires on every keystroke via raw `onChange` with no debounce. PRD FR2.2 mandates 300ms debounce. No `debounce`, `useDeferredValue`, or `useTransition` found in `patients.tsx` or `patient-list.tsx`. Every keystroke issues a network request. | `apps/dentalemon/src/routes/_dashboard/patients.tsx` |
| UJ-PAT-006 | P2 | R2 | WF-023 branch filter: `usePatients` passes `branchId` from `useOrgContextStore` to API correctly. No UI control to switch branch on the patient list. Multi-branch users cannot manually filter by branch; it is implicit and locked to active org context. WORKFLOW_MAP WF-023 lists "Branch" as a filter criterion. | `apps/dentalemon/src/routes/_dashboard/patients.tsx` |
| UJ-PAT-007 | P2 | R4 | Duplicate patient detection absent (FR2.5): no fuzzy-match warning on registration. `PatientRegistrationModal` has no duplicate-check pre-flight; `handleRegister` fires create API directly. PRD requires "Warning dialog if match score > 80%". | `apps/dentalemon/src/features/patients/components/patient-registration-modal.tsx` |
| UJ-PAT-008 | P2 | R4 | Archive confirmation uses `window.confirm()` (native browser dialog) — not spec-compliant. FR2.7 and wireframes require a custom modal dialog. `window.confirm` blocks the main thread, is untestable with Playwright component tests, and is unstyled on mobile. | `apps/dentalemon/src/features/patients/components/patient-list.tsx` |
| UJ-PAT-009 | P2 | R5 | Safety floor aggregation entirely absent from profile UI. MODULE_SPEC §7 defines it as aggregated at query time (allergies, medications, conditions); §9 lists it as a named component. No `useSafetyFloor` hook call, no loading indicator, no banner rendered in `patient-profile-page.tsx`. Missing feature, not just a loading-state gap. | `apps/dentalemon/src/features/patients/components/patient-profile-page.tsx` |
| UJ-PAT-010 | P3 | R5 | Inner tab loading states inconsistent — `VisitTab` and `PaymentTab` show plain "Loading…" text with no `data-testid` and no skeleton, while route-level uses a skeleton with `data-testid="profile-loading"`. Diverges from established loading pattern. | `apps/dentalemon/src/features/patients/components/patient-profile-page.tsx` |
| UJ-PAT-011 | P3 | R2 | FR2.7 archive EC1 (active payment plan) not preemptively guarded: `handleArchive` fires `onArchive` without checking `hasActivePaymentPlan` on the patient card. Backend returns 422 but no frontend warning shown before attempt. `PatientCardData.hasBalance` rolls up `hasActivePaymentPlan`. | `apps/dentalemon/src/features/patients/components/patient-list.tsx` |

---

## Workflow Coverage

Coverage assessment against WORKFLOW_MAP.md (98 total workflows, 44 explicit PRD, 54 inferred).

| WF-ID | Workflow | Route | Coverage | Notes |
|-------|---------|-------|----------|-------|
| WF-001 | Login | `auth/$authView.tsx` | COVERED | Better-Auth sign-in flow |
| WF-002 | Passkey login | `auth/$authView.tsx` | COVERED | Better-Auth passkey |
| WF-003 | Magic link (patient) | `auth/$authView.tsx` | PARTIAL | No patient portal route post-login |
| WF-005 | New patient registration | `_dashboard/patients.tsx` | COVERED | Modal + handleRegister |
| WF-006 | Book appointment | `_dashboard/calendar.tsx` | COVERED | AppointmentModal |
| WF-007 | Check-in → visit creation | `_dashboard/calendar.tsx` | PARTIAL | Check-in triggers API but error path missing (UJ-SCH-e5f6g7h8) |
| WF-008 | Workspace open | `_workspace/$patientId.tsx` | COVERED | Route navigates to workspace |
| WF-009 | Chart condition | `_workspace/$patientId.tsx` | COVERED | ToothSlideout + useSaveToothFlow |
| WF-010 | Mark treatment performed | `_workspace/$patientId.tsx` | COVERED | TreatmentTable + useMarkTreatmentDone |
| WF-011 | Clinical notes | `_workspace/$patientId.tsx` | COVERED | SoapNotesSheet |
| WF-012 | Complete visit | `_workspace/$patientId.tsx` | COVERED | PreCompletionChecklist |
| WF-013 | Create invoice | `_workspace/$patientId.tsx` | PARTIAL | WorkspacePaymentModal creates invoice; no standalone create from `/billing` route |
| WF-014 | Record payment | `_dashboard/billing.tsx` | COVERED | InvoiceDetail → PaymentPlanView |
| WF-016 | Prescriptions | `_workspace/$patientId.tsx` | COVERED | RxSheet (WBAR-02) |
| WF-017 | Lab orders | `_workspace/$patientId.tsx` | COVERED | LabOrdersSheet (WBAR-04) |
| WF-018 | Consent | `_workspace/$patientId.tsx` | COVERED | ConsentSheet (WBAR-03) |
| WF-019 | Upload imaging study | `_workspace/$patientId.tsx` | COVERED | WorkspaceImagingOverlay |
| WF-020 | Annotate radiograph | `_workspace/$patientId.tsx` | COVERED | imaging-workspace.tsx via overlay |
| WF-021 | Generate PMD | `_workspace/$patientId.tsx` | COVERED | PMDViewerSheet + handleSharePMD |
| WF-023 | Patient search | `_dashboard/patients.tsx` | COVERED | usePatients with searchQuery |
| WF-024 | Calendar view | `_dashboard/calendar.tsx` | COVERED | CalendarDay/Week/Month |
| WF-025 | Adjust fee schedule | — | NOT COVERED | No fee schedule route |
| WF-028 | Audit log | — | NOT COVERED | No audit log route |
| WF-029 | Outstanding invoices dashboard | `_dashboard/dashboard.tsx` | PARTIAL | Dashboard exists; outstanding invoices widget unverified |
| WF-030 | Ceph analysis | `imaging-ceph-report.$imageId.tsx` | PARTIAL | Route exists; no auth guard (UJ-IMG-r8s9t0u1) |
| WF-035 | Revoke consent | — | NOT COVERED | No standalone consent management UI |
| WF-043 | Branch selection | `dental-onboarding.tsx` | PARTIAL | Only at onboarding; no post-onboarding branch switch |
| WF-059 | Edit appointment | `_dashboard/calendar.tsx` | COVERED | handleAppointmentClick → AppointmentModal edit mode |
| WF-060 | Reschedule appointment | `_dashboard/calendar.tsx` | PARTIAL | AppointmentModal likely handles; not explicitly verified |
| WF-066 | View PMD | `_workspace/$patientId.tsx` | COVERED | PMDViewerSheet |
| WF-069 | Create organization | `dental-onboarding.tsx` | PARTIAL | Onboarding only; no admin management route |
| WF-070 | Create branch | `dental-onboarding.tsx` | PARTIAL | Onboarding only; no admin management route |
| WF-073 | Dentist-Owner morning review | Multiple routes | COVERED | Calendar + Dashboard + Billing |
| WF-074 | Dentist-Owner patient visit | Multiple routes | COVERED | Calendar → Workspace flow complete |
| WF-075 | Dentist Associate session | Multiple routes | PARTIAL | Access granted but "own patients" filter not enforced (RBAC gap) |
| WF-076 | Front desk daily | Multiple routes | COVERED | Calendar + Patients + Billing(payments) |
| WF-077 | Scheduler-only daily | `_dashboard/calendar.tsx` | COVERED | Calendar as landing, booking actions |
| WF-078 | Patient portal session | — | NOT COVERED | No patient portal route (Phase 2) |
| WF-079 | Admin tenant provisioning | — | NOT COVERED | No admin UI routes |
| WF-088 | GDPR patient erasure | — | NOT COVERED | No erasure UI; WFG-006 |

**Not covered (no route):** WF-025 (fee schedule), WF-028 (audit log), WF-035 (consent revocation standalone), WF-078 (patient portal), WF-079 (admin provisioning), WF-088 (GDPR erasure)

---

## Navigation Integrity (Registry 6 — partial)

| Route | Auth Guard | Role Guard | Notes |
|-------|-----------|------------|-------|
| `/_dashboard/*` | requireAuth + PIN session | Layout-level only | Layout guards all dashboard children |
| `/_dashboard/billing` | Inherited | requireRole('billing') | Correct |
| `/_dashboard/staff` | Inherited | requireRole('staff') | Correct; redundant runtime check present |
| `/_dashboard/patients` | Inherited | **NONE** | Missing requireRole('patients') |
| `/_dashboard/calendar` | Inherited | **NONE** | Missing requireRole('calendar') |
| `/_dashboard/patients_/$patientId` | Inherited | **NONE** | No module-level guard |
| `/_workspace/*` | requireAuth | **NONE** | Missing requireRole('workspace') — critical |
| `/imaging-ceph-report/$imageId` | **NONE** | **NONE** | No auth, no role — publicly accessible |

---

## Executive Summary

### Findings by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| P0 | 1 | Silent error discard in check-in breaks WF-007 recovery (UJ-SCH-e5f6g7h8) |
| P1 | 5 | Missing role guards (workspace, patients, calendar); direct fetch in registration; ceph route unauthenticated |
| P2 | 7 | Billing error surface delegated; walk-in distinction lost; visit/profile role gaps; clinical error states missing; raw fetch in ceph |
| P3 | 5 | Month view spec gap; patient portal no route; org branch post-onboarding; WFG-002/003 no recovery UI |

### Top 3 Risks

1. **Ceph report publicly accessible** — `/imaging-ceph-report/:imageId` has zero auth guards; any unauthenticated user who knows (or guesses) an imageId can view PHI-containing cephalometric reports. P1 (UJ-IMG-r8s9t0u1) + raw fetch with no credentials (UJ-IMG-s9t0u1v2).

2. **Workspace accessible to staff_scheduling** — `/_workspace` layout only calls `requireAuth`, not `requireRole('workspace')`. RBAC explicitly bars `staff_scheduling` from workspace. A scheduler can navigate directly to `/_workspace/:patientId` and access the full clinical workspace. P1 (UJ-CLI-o5p6q7r8).

3. **Silent check-in failure** — `handleCheckIn` catch block has comment `// Network error — ignore silently`. When check-in fails the calendar shows a checked-in appointment that was never actually checked in on the server. This is a P0 data-integrity risk for WF-007 (WFG-002 in WORKFLOW_MAP). P0 (UJ-SCH-e5f6g7h8).

### What's Next

P0 present — fix immediately:
1. `UJ-SCH-e5f6g7h8` — remove silent catch in `handleCheckIn`; surface error to user with retry.
2. `UJ-IMG-r8s9t0u1` — add `beforeLoad: requireAuth` (at minimum) to `imaging-ceph-report.$imageId.tsx`.
3. `UJ-CLI-o5p6q7r8` — add `beforeLoad: requireRole('workspace')` to `_workspace.tsx` layout.
4. `UJ-PAT-i9j0k1l2` — migrate patient registration to SDK mutation hook.
5. `UJ-PAT-j0k1l2m3` — add `requireRole('patients')` to `patients.tsx`.

After P0/P1 resolution, run `/oli-trace` for full end-to-end traceability from WF-NNN through API contract to implementation.

---

## Run-6 — dental-billing Component-Level Audit
<!-- oli-ui-journey --strict | run: run-6-strict-2026-05-29 | registries: R2, R4, R5, R6 -->
<!-- files: components/invoice-detail.tsx, components/billing-list.tsx, components/payment-plan-view.tsx -->

### Findings

| ID | Sev | Registry | WF | Description | File |
|----|-----|----------|----|-------------|------|
| UJ-BIL-001 | P1 | R6 | WF-041 | `Void` button rendered for any role that can view an invoice — `canVoid()` gates only on invoice status, zero role check in component; spec §6 restricts void to `dentist_owner` only | `apps/dentalemon/src/features/billing/components/invoice-detail.tsx` |
| UJ-BIL-002 | P1 | R6 | WF-014 | `Record Payment` button rendered for all roles with invoice view access — `canRecord()` gates only on status; spec §6 restricts record payment to `staff_full` + `dentist_owner`; `dentist_associate` must not see this button | `apps/dentalemon/src/features/billing/components/invoice-detail.tsx` |
| UJ-BIL-003 | P1 | R2 | WF-013 | WF-013 (Create Invoice from visit) has no UI entry point anywhere in the billing feature — `billing-list.tsx` has no "Generate Invoice" / "Create Invoice" action; the feature path `apps/dentalemon/src/features/billing/` contains zero references to invoice creation; entry is only in the workspace payment modal (confirmed by empty grep on billing dir) | `apps/dentalemon/src/features/billing/` |
| UJ-BIL-004 | P1 | R2 | WF-041 | `canVoid()` in `invoice-detail.helpers` returns false for `draft` status, but spec WF-041 explicitly states the action is available on invoices in `draft` or `issued` state — code-spec discrepancy; draft invoices cannot be voided from UI | `apps/dentalemon/src/features/billing/components/invoice-detail.tsx` |
| UJ-BIL-005 | P2 | R4 | WF-041 | `handleVoid` fires POST immediately with no confirmation dialog and no reason input — spec WF-041 step 2 requires a confirmation dialog with mandatory reason text; current UI shows a plain destructive button with no intermediate step | `apps/dentalemon/src/features/billing/components/invoice-detail.tsx` |
| UJ-BIL-006 | P2 | R4 | WF-014 | `buildPaymentPayload` is called with `recordedByMemberId: ''` (empty string hardcoded) — audit event `billing.payment.recorded` will have no actor; violates spec §5 / audit requirements | `apps/dentalemon/src/features/billing/components/invoice-detail.tsx` |
| UJ-BIL-007 | P2 | R4 | WF-052 | `handleIssue` catches all errors as generic "Failed to issue invoice" — BR-009 (no performed treatments) returns a specific server error; UI does not distinguish "no billable treatments" from generic network failure; user receives no actionable guidance | `apps/dentalemon/src/features/billing/components/invoice-detail.tsx` |
| UJ-BIL-008 | P2 | R4 | WF-041 | `handleVoid` catches all errors as generic "Failed to void invoice" — BR-011 (active payment plan → 409 ACTIVE_PAYMENT_PLAN) returns a specific error; UI does not surface "cannot void: active payment plan exists"; user receives no actionable guidance | `apps/dentalemon/src/features/billing/components/invoice-detail.tsx` |
| UJ-BIL-009 | P2 | R5 | — | `BillingList` loading state is a plain text cell "Loading invoices..." — no animated skeleton; spec §9 lists "Loading" as a named UI state implying skeleton treatment; inconsistent with app-wide loading patterns | `apps/dentalemon/src/features/billing/components/billing-list.tsx` |
| UJ-BIL-010 | P2 | R5 | — | `InvoiceDetail` loading state is plain text "Loading..." — no animated skeleton; `PaymentPlanView` also uses plain text "Loading..." — three billing modals all missing skeleton loaders | `apps/dentalemon/src/features/billing/components/invoice-detail.tsx` |
| UJ-BIL-011 | P3 | R2 | WF-015 | `PaymentPlanView` renders plan details but has no "Create Payment Plan" action — WF-015 step 2 (dialog for installment count / frequency / start date) is absent; plan can be viewed but not created from the billing feature components | `apps/dentalemon/src/features/billing/components/payment-plan-view.tsx` |
| UJ-BIL-012 | P3 | R5 | WF-014 | No success state after payment recorded — `handleRecordPayment` closes the form and re-fetches invoice but shows no "Payment recorded successfully" confirmation; spec §9 lists "Payment success" as a named UI state | `apps/dentalemon/src/features/billing/components/invoice-detail.tsx` |

### Run-6 Summary

| Severity | Count | Key Issues |
|----------|-------|------------|
| P1 | 4 | Void + Record Payment role-ungated; WF-013 entry absent; canVoid excludes draft (spec violation) |
| P2 | 6 | No void confirmation dialog; hardcoded empty memberId; generic error messages for BR-009/BR-011; text-only loading states |
| P3 | 2 | No payment plan creation UI; no payment success state |
| **Total** | **12** | |

### Updated Workflow Coverage (billing-specific)

| WF-ID | Status | Notes |
|-------|--------|-------|
| WF-013 | BROKEN | No "Create Invoice" entry point in billing feature |
| WF-014 | PARTIAL | Payment form exists but `recordedByMemberId` empty; no success state |
| WF-015 | PARTIAL | View only — create plan UI absent |
| WF-041 | BROKEN | No confirmation dialog; no reason input; canVoid excludes draft; no role gate |
| WF-052 | PARTIAL | Issue button present, status-gated; BR-009 error not distinguished |

---

## Run-6 — dental-pmd Component-Level Audit
<!-- oli-ui-journey --strict | run: run-6-strict-2026-05-29 | registries: R2, R4, R5, R6 -->
<!-- files: features/pmd/components/pmd-import.tsx, features/pmd/components/pmd-viewer.tsx, features/pmd/components/pmd-viewer-sheet.tsx, features/workspace/hooks/use-pmd.ts, features/workspace/hooks/use-share-pmd.ts, routes/_workspace/$patientId.tsx -->

### Findings

| ID | Sev | Registry | WF | Description | File |
|----|-----|----------|----|-------------|------|
| UJ-PMD-001 | P1 | R6 | WF-021 | "Share PMD" button (`data-testid="share-pmd-btn"`) has no role guard — visibility gated only on `isReadOnly` (visit completion status). MODULE_SPEC §6 grants generate to `dentist_owner`/`dentist_associate` only; `staff_full` and `staff_scheduling` (reachable via workspace RBAC gap UJ-CLI-o5p6q7r8) can trigger PMD generation with zero RBAC enforcement at the UI layer | `apps/dentalemon/src/routes/_workspace/$patientId.tsx` |
| UJ-PMD-002 | P2 | R2 | WF-021 | No confirmation step before PMD generation — `handleSharePMD()` fires `useSharePMD` mutation immediately on click with no confirm dialog; PMD is a compliance record (immutable, checksum-verified per BR-022); accidental generation has no undo path; spec WF-021 implies explicit two-step intent (generate + share) | `apps/dentalemon/src/routes/_workspace/$patientId.tsx` |
| UJ-PMD-003 | P2 | R4 | WF-021 | `sharePMDMutation` has no `onError` callback — if the generate/share call fails (network error, 422 VISIT_NOT_COMPLETED, timeout) the error is silently discarded; `pmdShared` stays false and the button remains "Share PMD" with no user-facing error or retry path | `apps/dentalemon/src/routes/_workspace/$patientId.tsx` |
| UJ-PMD-004 | P2 | R5 | WF-021 | No loading/disabled state on "Share PMD" button while `sharePMDMutation.isPending` — double-click fires duplicate PMD generation requests; button text changes only to "✓ PMD shared" on success; no spinner, no `disabled` attr during the async call | `apps/dentalemon/src/routes/_workspace/$patientId.tsx` |
| UJ-PMD-005 | P2 | R4 | WF-022 | `handleConfirm` in `PMDImport` maps all non-OK API responses to generic `'Failed to import PMD'` — 422 CHECKSUM_MISMATCH (BR-022, §15), missing `source_description`, UUID validation failures, and 405 (read-only guard) are all indistinguishable; no actionable recovery hint provided | `apps/dentalemon/src/features/pmd/components/pmd-import.tsx` |
| UJ-PMD-006 | P2 | R6 | WF-022 | `PMDImport` component has no client-side role check — `PMDViewerSheet` renders "Import External PMD" button for all roles who can open the sheet; MODULE_SPEC §6 limits import to `dentist_owner`, `dentist_associate`, `staff_full`; `staff_scheduling` can open and submit the import form | `apps/dentalemon/src/features/pmd/components/pmd-viewer-sheet.tsx` |
| UJ-PMD-007 | P3 | R2 | WF-021 | No download link flow — MODULE_SPEC §9 requires a "download button" on the PMD list; implementation uses `navigator.share()` (Web Share API) unavailable in most desktop browsers and falls back to silently setting `pmdShared=true` with no file download or shareable link; PMD-S2 (Download) vertical slice not covered | `apps/dentalemon/src/routes/_workspace/$patientId.tsx` |

### Run-6 Summary (dental-pmd)

| Severity | Count | Key Issues |
|----------|-------|------------|
| P1 | 1 | Share PMD button role-ungated; any workspace-accessible role can generate compliance records |
| P2 | 5 | No generate confirmation; silent generate error; no loading state on generate; generic import error; import role-ungated |
| P3 | 1 | No download link — Web Share API fallback silently swallows the action |
| **Total** | **7** | |

### Workflow Coverage (dental-pmd)

| WF-ID | Status | Notes |
|-------|--------|-------|
| WF-021 | PARTIAL | Generate fires via mutation; no confirmation, no error state, no loading state, no download link; role-ungated |
| WF-022 | PARTIAL | Import 3-step form present (form→preview→done); client validation inline; generic error on API failure; no role gate on button |
| WF-066 | COVERED | `PMDViewerSheet` renders `PMDViewer` with structured data (treatments, prescriptions, signature, checksum, status badge) |

---

## Run-6 — dental-scheduling Component-Level Audit
<!-- oli-ui-journey --strict | run: run-6-strict-2026-05-29 | registries: R2, R4, R5, R6 -->
<!-- files: components/appointment-modal.tsx, components/queue-board.tsx, components/calendar-week.tsx, components/appointment-card.tsx, hooks/use-appointments.ts, hooks/use-queue-board.ts -->

### Findings

| ID | Sev | Registry | WF | Description | File |
|----|-----|----------|----|-------------|------|
| UJ-SCH-101 | P1 | R2 | WF-006 | `AppointmentModal` is a **flat single-step form** — no slot selection step, no patient picker, no confirm step. Spec §4 WF-006 defines: select date/time/dentist → overlap check → save. Patient field accepts raw UUID typed by hand (no lookup). FR3.1 (slot selection from availability grid) absent. | `apps/dentalemon/src/features/scheduling/components/appointment-modal.tsx` |
| UJ-SCH-102 | P1 | R2 | WF-SCH-CANCEL | **No cancel-appointment UI anywhere in the feature** — `appointment-card.tsx` exposes only a Check-In button; `appointment-modal.tsx` has no cancel flow; no `DELETE /dental/appointments/:id` call exists in any component. BR-SCH-003 (`cancellation_reason NOT NULL`) is completely unimplemented at the UI layer. | `apps/dentalemon/src/features/scheduling/components/appointment-card.tsx`, `apps/dentalemon/src/features/scheduling/components/appointment-modal.tsx` |
| UJ-SCH-103 | P1 | R6 | WF-007 | **`AppointmentCard` Check-In button visible to all roles** — `canCheckIn()` (line 41) checks only `status === 'scheduled'`; no role check. MODULE_SPEC §8 RBAC restricts check-in to `staff_full`, `dentist_owner`, `dentist_associate`; `staff_scheduling` must NOT trigger check-in. Zero `useRole`/session check in component. | `apps/dentalemon/src/features/scheduling/components/appointment-card.tsx:41,70` |
| UJ-SCH-104 | P1 | R6 | WF-006 | **`AppointmentModal` has no role gate** — WF-006 actor is `staff_full | dentist_owner` only. No internal role check prevents `staff_scheduling` from completing a booking via the modal. Role enforcement depends entirely on the absent parent route guard (UJ-SCH-f6g7h8i9). | `apps/dentalemon/src/features/scheduling/components/appointment-modal.tsx` |
| UJ-SCH-105 | P1 | R6 | WF-007 | **`QueueBoard` FSM action buttons have no role gating** — "Call / Start / Done / Cancel" buttons render for any authenticated user. MODULE_SPEC §8: queue board visible to all dental staff, but FSM transitions (`waiting→called→in_progress→completed`) should be restricted to `staff_full`/`dentist_*`. `staff_scheduling` (calendar-only RBAC) can advance FSM states. | `apps/dentalemon/src/features/scheduling/components/queue-board.tsx:86-105` |
| UJ-SCH-106 | P2 | R4 | WF-006 | **`AppointmentModal` `handleSave` has no catch block** — `try { ... } finally { setSaving(false) }`. SDK errors from `createAppointment`/`updateAppointment` (network, 4xx/5xx) are uncaught. A 409 `DOUBLE_BOOKING` or 422 `OUTSIDE_WORKING_HOURS` response bubbles as an unhandled rejection; user sees "Saving…" briefly then nothing. | `apps/dentalemon/src/features/scheduling/components/appointment-modal.tsx:104-148` |
| UJ-SCH-107 | P2 | R4 | WF-006 | **Double-booking warning (AC-SCH-001) never shown** — spec: booking at create returns 201 + `DOUBLE_BOOKING` in response body. `AppointmentModal` does not read `response.warnings`, render an inline warning, or show a confirm-before-proceed dialog. Soft double-booking is silently accepted. | `apps/dentalemon/src/features/scheduling/components/appointment-modal.tsx` |
| UJ-SCH-108 | P2 | R5 | WF-024 | **`CalendarWeek` has no `isLoading` prop or skeleton** — component signature: `{ weekStart, appointments, onAppointmentClick, onDayClick }`. MODULE_SPEC §9 names "Loading" as a required UI state. Zero `isLoading`/`Skeleton`/`skeleton`/`spinner` references in component. Parent route must own loading UI entirely. | `apps/dentalemon/src/features/scheduling/components/calendar-week.tsx:59-64` |
| UJ-SCH-109 | P2 | R5 | WF-006 | **API errors from `createAppointment` entirely invisible** — `handleSave` line 140-142 only catches the case where response returns `null` data. If the SDK throws (non-2xx with body), no `setErrors()` is called, no error banner appears. Distinct error codes (OUTSIDE_WORKING_HOURS, DOUBLE_BOOKING) produce zero UI differentiation. | `apps/dentalemon/src/features/scheduling/components/appointment-modal.tsx:140-142` |
| UJ-SCH-110 | P3 | R5 | WF-024 | **`QueueBoard` 15s polling has no freshness indicator** — `refetchInterval: 15_000` set but `QueueBoard` renders no `isFetching` badge, no "last updated" timestamp, no spinner overlay during background refresh. Staff may act on stale data without knowing a re-fetch is in flight. | `apps/dentalemon/src/features/scheduling/hooks/use-queue-board.ts:42-43`, `apps/dentalemon/src/features/scheduling/components/queue-board.tsx` |
| UJ-SCH-111 | P3 | R5 | WF-007 | **No check-in confirmation dialog** — `check-in-flow.test.ts` tests logic helpers defined locally (not imported from a component). MODULE_SPEC §9 names "Check-in confirmation" as a required UI state. `AppointmentCard` fires check-in immediately on button click (lines 96-100) with no confirm sheet or summary dialog. | `apps/dentalemon/src/features/scheduling/components/appointment-card.tsx:96-100`, `apps/dentalemon/src/features/scheduling/components/check-in-flow.test.ts` |

### Run-6 Summary (dental-scheduling)

| Severity | Count | Key Issues |
|----------|-------|------------|
| P1 | 5 | Flat WF-006 (no steps, no patient picker); no cancel UI (BR-SCH-003 unimplemented); check-in ungated; book ungated; queue FSM ungated |
| P2 | 4 | No catch in handleSave (409/422 silent); double-booking warning absent; CalendarWeek no isLoading/skeleton; API errors invisible |
| P3 | 2 | Queue polling no freshness indicator; no check-in confirmation dialog |
| **Total** | **11** | |

### Workflow Coverage (dental-scheduling)

| WF-ID | Status | Notes |
|-------|--------|-------|
| WF-006 | PARTIAL | Modal exists; flat form (no slot picker, no patient search, no confirm); double-booking warning absent; role not gated |
| WF-007 | PARTIAL | Check-in button on AppointmentCard; no confirmation dialog; error path silent (UJ-SCH-e5f6g7h8 + UJ-SCH-106); role not gated |
| WF-024 | PARTIAL | Calendar renders; CalendarWeek has no loading state prop; cancel flow absent |
| WF-SCH-CANCEL | NOT COVERED | No DELETE call, no cancel dialog, no reason field anywhere in feature |
