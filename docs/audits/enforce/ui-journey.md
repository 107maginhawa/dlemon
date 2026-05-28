# UI Journey Enforcement
<!-- oli-ui-journey v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->
<!-- modules: dental-billing, dental-scheduling, dental-patient, dental-org, dental-clinical, dental-imaging, dental-visit -->

## Summary

- **Modules assessed:** 7
- **Findings:** 18 (P0: 1, P1: 5, P2: 7, P3: 5)
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

### dental-visit

| ID | Sev | Registry | Description | File |
|----|-----|----------|-------------|------|
| UJ-VIS-t0u1v2w3 | P3 | R2 | WFG-002 (Check-in partial failure: appointment created but visit draft fails) has no recovery UI — `handleCheckIn` in calendar catches and discards the error; no retry mechanism or compensating action exposed to user | `apps/dentalemon/src/routes/_dashboard/calendar.tsx` |
| UJ-VIS-u1v2w3x4 | P3 | R2 | WFG-003 (concurrent visit conflict BR-001) — workspace silently auto-selects first visit on load; if a concurrent visit was created server-side the user has no indication | `apps/dentalemon/src/routes/_workspace/$patientId.tsx` |

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
