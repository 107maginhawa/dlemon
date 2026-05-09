# Phase 5: Documentation - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — scaffolding docs, no grey areas)

<domain>
## Phase Boundary

Scaffold two developer reference docs for the dentalemon frontend:
1. `docs/development/SCREENS.md` — maps 28 wireframes to routes and primary components
2. `docs/development/COMPONENTS.md` — inventories shared + feature components with props and usage

Wireframes are at `docs/prd/context/wireframes/` (28 HTML files). Routes are in `apps/dentalemon/src/routes/`. Components are in `apps/dentalemon/src/components/` (Shadcn/shared) and `apps/dentalemon/src/features/` (domain components).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use the actual codebase files to extract accurate component names, props, and route paths. Do not hallucinate.

</decisions>

<code_context>
## Existing Code Insights

**Wireframes (28 total at `docs/prd/context/wireframes/`):**
- auth-user-select, auth-pin-entry
- dashboard
- patient-list, patient-profile, patient-registration
- calendar-day, calendar-week, appointment-modal
- billing-list, invoice-detail, payment-plan
- reports, report-detail
- staff-list, staff-create
- settings
- onboarding-wizard
- nav-shell, medical-history-form, treatment-plan
- ws-tooth-slideout, ws-consent-form, ws-payment-modal, ws-attachments, ws-tooth-history, ws-rx-sheet, ws-lab-orders

**Routes (`apps/dentalemon/src/routes/`):**
- `index.tsx` — root redirect
- `onboarding.tsx` — onboarding flow
- `verify-email.tsx` — email verification
- `auth/$authView.tsx` — auth views
- `auth/pin-entry.$memberId.tsx` — PIN entry
- `auth/pin-select.tsx` — PIN selection
- `_dashboard.tsx` — dashboard layout
- `_dashboard/dashboard.tsx` — main dashboard
- `_dashboard/patients.tsx` — patient list
- `_dashboard/calendar.tsx` — calendar
- `_dashboard/billing.tsx` — billing
- `_dashboard/reports.tsx` — reports
- `_dashboard/staff.tsx` — staff management
- `_dashboard/settings.tsx` — settings
- `_dashboard/dental-onboarding.tsx` — dental onboarding
- `_workspace.tsx` — workspace layout
- `_workspace/$patientId.tsx` — patient workspace

**Shared Components (`apps/dentalemon/src/components/`):**
alert-dialog, alert, app-sidebar, avatar, badge, button, calendar, card, checkbox, combobox, command, datetime-filter, dialog, dropdown-menu, empty-state, form, image-cropper-dialog, input, label, loading, logo, not-found, pagination, phone-input, popover, progress, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle-group, toggle, tooltip

**Feature Components (`apps/dentalemon/src/features/`):**
- billing: billing-list, invoice-detail, payment-plan-view
- dashboard: metric-card, morning-briefing
- onboarding: onboarding-wizard
- patients: dental-chart-thumbnail, patient-filter-tabs, patient-folder-card, patient-list, patient-registration-modal
- person: address-form, contact-info-form, personal-info-form, preferences-form
- pmd: pmd-import, pmd-viewer
- reports: revenue-report
- scheduling: appointment-card, appointment-modal, calendar-day, calendar-week
- settings: clinic-settings, fee-schedule, locale-settings
- staff: staff-create-modal, staff-list
- workspace: consent-sheet, dental-chart, five-surface-selector, lab-orders-sheet, medical-history-form, rx-sheet, timeline-carousel, tooth-slideout, workspace-tabs

**Feature Hooks (`apps/dentalemon/src/features/`):**
- billing: use-invoices
- dashboard: use-dashboard-summary
- patients: use-patients
- scheduling: use-appointments
- settings: use-branch-settings
- staff: use-staff-members
- workspace: use-create-visit, use-dental-chart-query, use-medical-history, use-save-chart, use-save-treatment, use-share-pmd, use-treatments, use-visits

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Use codebase inventory above to write accurate docs.

</specifics>

<deferred>
## Deferred

None.

</deferred>
