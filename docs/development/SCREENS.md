# Screen Reference: Dentalemon Frontend

Maps every wireframe to its TanStack Router route and primary React components.

**Wireframes:** `docs/prd/context/wireframes/`
**Routes:** `apps/dentalemon/src/routes/`
**Components:** `apps/dentalemon/src/features/` · `apps/dentalemon/src/components/`

---

## Auth Screens

| Wireframe | Route File | Route Path | Primary Components |
|-----------|-----------|------------|-------------------|
| auth-user-select | `auth/$authView.tsx` | `/auth/$authView` | — (auth shell only) |
| auth-pin-entry | `auth/pin-entry.$memberId.tsx` | `/auth/pin-entry/$memberId` | — (auth shell only) |

---

## Onboarding

| Wireframe | Route File | Route Path | Primary Components |
|-----------|-----------|------------|-------------------|
| onboarding-wizard | `onboarding.tsx` | `/onboarding` | `OnboardingWizard` |

---

## Dashboard (layout: `_dashboard.tsx`)

| Wireframe | Route File | Route Path | Primary Components |
|-----------|-----------|------------|-------------------|
| nav-shell | `_dashboard.tsx` (layout) | all `/_dashboard/*` | `AppSidebar` |
| dashboard | `_dashboard/dashboard.tsx` | `/_dashboard/dashboard` | `MorningBriefing`, `MetricCard` |
| patient-list | `_dashboard/patients.tsx` | `/_dashboard/patients` | `PatientList`, `PatientFolderCard`, `PatientFilterTabs` |
| patient-registration | `_dashboard/patients.tsx` (modal) | `/_dashboard/patients` | `PatientRegistrationModal` |
| calendar-week | `_dashboard/calendar.tsx` | `/_dashboard/calendar` | `CalendarWeek` |
| calendar-day | `_dashboard/calendar.tsx` | `/_dashboard/calendar` | `CalendarDay` |
| appointment-modal | `_dashboard/calendar.tsx` (modal) | `/_dashboard/calendar` | `AppointmentModal` |
| billing-list | `_dashboard/billing.tsx` | `/_dashboard/billing` | `BillingList` |
| invoice-detail | `_dashboard/billing.tsx` (detail panel) | `/_dashboard/billing` | `InvoiceDetail` |
| payment-plan | `_dashboard/billing.tsx` (modal) | `/_dashboard/billing` | `PaymentPlanView` |
| reports | `_dashboard/reports.tsx` | `/_dashboard/reports` | `RevenueReport` |
| report-detail | `_dashboard/reports.tsx` (detail panel) | `/_dashboard/reports` | `RevenueReport` |
| staff-list | `_dashboard/staff.tsx` | `/_dashboard/staff` | `StaffList` |
| staff-create | `_dashboard/staff.tsx` (modal) | `/_dashboard/staff` | `StaffCreateModal` |
| settings | `_dashboard/settings.tsx` | `/_dashboard/settings` | `ClinicSettings`, `FeeSchedule`, `LocaleSettings` |

---

## Workspace (layout: `_workspace.tsx`)

Patient workspace lives under `_workspace/$patientId.tsx`. All ws-* screens render
inside this single route via tab or slideout state — no sub-routes.

| Wireframe | Route File | Route Path | Primary Components |
|-----------|-----------|------------|-------------------|
| patient-profile | `_workspace/$patientId.tsx` | `/_workspace/$patientId` | `WorkspaceTabs`, `DentalChart` |
| medical-history-form | `_workspace/$patientId.tsx` | `/_workspace/$patientId` | `MedicalHistoryForm` |
| treatment-plan | `_workspace/$patientId.tsx` | `/_workspace/$patientId` | `WorkspaceTabs` |
| ws-tooth-slideout | `_workspace/$patientId.tsx` | `/_workspace/$patientId` | `ToothSlideout`, `FiveSurfaceSelector` |
| ws-consent-form | `_workspace/$patientId.tsx` | `/_workspace/$patientId` | `ConsentSheet` |
| ws-payment-modal | `_workspace/$patientId.tsx` | `/_workspace/$patientId` | — (inline modal, no named component) |
| ws-attachments | `_workspace/$patientId.tsx` | `/_workspace/$patientId` | — (inline panel, no named component) |
| ws-tooth-history | `_workspace/$patientId.tsx` | `/_workspace/$patientId` | `TimelineCarousel` |
| ws-rx-sheet | `_workspace/$patientId.tsx` | `/_workspace/$patientId` | `RxSheet` |
| ws-lab-orders | `_workspace/$patientId.tsx` | `/_workspace/$patientId` | `LabOrdersSheet` |

---

## Notes

- **Modal / panel screens** share the parent route. The wireframe suffix (`(modal)`,
  `(detail panel)`, etc.) indicates they are triggered by UI state within the route,
  not a separate URL.
- **ws-payment-modal** and **ws-attachments** have no named extracted component as of
  Phase 4; they render inline in `$patientId.tsx`.
- **nav-shell** is the `_dashboard.tsx` layout shell; `AppSidebar` appears on every
  dashboard-child route.
