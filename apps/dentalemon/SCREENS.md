# Screens Inventory

All routes in `apps/dentalemon/src/routes/`. PR1 = Foundation (data layer + shared components). PR2 = Screens (remaining panels + reports).

## Legend
- ✅ Done — renders correctly, data layer working
- 🔧 Needs work — route exists, data layer broken or missing
- ❌ Missing — screen not yet built

---

## Auth Screens (out of scope for PR1/PR2)

| Screen | Route | File | Wireframe | Status |
|--------|-------|------|-----------|--------|
| Sign In / Sign Up | `/auth/$authView` | `auth/$authView.tsx` | `auth-user-select.html` | ✅ |
| PIN Entry | `/auth/pin-entry.$memberId` | `auth/pin-entry.$memberId.tsx` | `auth-pin-entry.html` | ✅ |
| PIN Select | `/auth/pin-select` | `auth/pin-select.tsx` | — | ✅ |
| Verify Email | `/verify-email` | `verify-email.tsx` | — | ✅ |
| Onboarding | `/onboarding` | `onboarding.tsx` | `onboarding-wizard.html` | ✅ |

---

## Dashboard Screens (PR1: data layer only, PR2: full screen rebuild)

### `/patients` — Patient List
- **File:** `_dashboard/patients.tsx`
- **Wireframe:** `patient-list.html`
- **Status:** 🔧 Route exists. Data layer is inline `useEffect` + `fetch`. Filter tabs (All / Active / Needs Follow-Up / Archived) not wired. ManilaFolderCard style doesn't match wireframe manila tab design.
- **PR1 work:** Replace inline fetch with `usePatients` hook (TanStack Query). Add filter tabs. Fix card to match wireframe.

### `/_workspace/$patientId` — Clinical Workspace
- **File:** `_workspace/$patientId.tsx`
- **Wireframe:** `workspace-wireframe.html`
- **Status:** 🔧 Route exists. 180 lines of inline `useEffect` + `fetch`. `use-visit.ts` returns null. `use-dental-chart.ts` uses closures (not React state). Workspace tabs (Odontogram / Periodontal / Treatment Plan / Notes) not extracted.
- **PR1 work:** Delete broken hooks. Rewrite with `useVisits`, `useDentalChart`, `useTreatments` (TanStack Query). Extract `WorkspaceTabs`. Fix FDI adapter. Fix `priceCents` → `priceInput`. Fix treatment status.

### `/dashboard` — Morning Briefing
- **File:** `_dashboard/dashboard.tsx`
- **Wireframe:** `dashboard.html`
- **Status:** 🔧 Component exists (`morning-briefing.tsx`, `metric-card.tsx`). Data layer inline.
- **PR1 work:** None (deferred to PR2).

### `/calendar` — Schedule
- **File:** `_dashboard/calendar.tsx`
- **Wireframe:** `calendar-day.html`, `calendar-week.html`
- **Status:** 🔧 Components exist. `appointment-modal.tsx` wired inline.
- **PR1 work:** None (deferred to PR2).

### `/billing` — Billing
- **File:** `_dashboard/billing.tsx`
- **Wireframe:** `billing-list.html`, `invoice-detail.html`, `payment-plan.html`
- **Status:** 🔧 Components exist (`billing-list.tsx`, `invoice-detail.tsx`, `payment-plan-view.tsx`). Data inline.
- **PR1 work:** None (deferred to PR2).

### `/reports` — Reports
- **File:** `_dashboard/reports.tsx`
- **Wireframe:** `reports.html`, `report-detail.html`
- **Status:** 🔧 Component exists (`revenue-report.tsx`). No backend aggregate handlers yet.
- **PR1 work:** None (deferred to PR2 + backend).

### `/settings` — Settings
- **File:** `_dashboard/settings.tsx`
- **Wireframe:** `settings.html`
- **Status:** 🔧 Components exist (`clinic-settings.tsx`, `fee-schedule.tsx`, `locale-settings.tsx`).
- **PR1 work:** None (deferred to PR2).

### `/staff` — Staff Management
- **File:** `_dashboard/staff.tsx`
- **Wireframe:** `staff-list.html`, `staff-create.html`
- **Status:** 🔧 Components exist (`staff-list.tsx`, `staff-create-modal.tsx`).
- **PR1 work:** None (deferred to PR2).

---

## Workspace Panels (all live inside `_workspace/$patientId.tsx`)

| Panel | Wireframe | Component | Status | PR |
|-------|-----------|-----------|--------|----|
| Odontogram (dental chart) | `workspace-wireframe.html` | `dental-chart.tsx` | 🔧 FDI mismatch, wrong surface type | PR1 |
| Tooth Slideout | `ws-tooth-slideout.html` | `tooth-slideout.tsx` | 🔧 `priceCents` naming bug, no state reset | PR1 |
| Treatment Plan | `treatment-plan.html` | inline in `$patientId.tsx` | 🔧 treatment status bug ('proposed') | PR1 |
| Timeline Carousel | `workspace-wireframe.html` | `timeline-carousel.tsx` | 🔧 no TanStack Query | PR1 |
| Medical History | `medical-history-form.html` | ❌ missing | ❌ | PR2 |
| Attachments | `ws-attachments.html` | `attachments-sheet.tsx`? | ❌ not wired | PR2 |
| Lab Orders | `ws-lab-orders.html` | `lab-orders-sheet.tsx` | ✅ component exists | PR2 |
| Rx Sheet | `ws-rx-sheet.html` | `rx-sheet.tsx` | ✅ component exists | PR2 |
| Consent Form | `ws-consent-form.html` | `consent-sheet.tsx` | ✅ component exists | PR2 |
| Tooth History | `ws-tooth-history.html` | inline | 🔧 no dedicated component | PR2 |
| Payment Modal | `ws-payment-modal.html` | — | ❌ deferred | PR2 |

---

## Vertical TDD Build Order (PR1)

1. **Patient List** — `usePatients` hook → `PatientFolderCard` → filter tabs → wire `patients.tsx`
2. **Workspace** — `useVisits` + `useDentalChart` + `useTreatments` hooks → FDI adapter → `WorkspaceTabs` → fix `$patientId.tsx`
