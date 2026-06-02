<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- reconciled: 2026-06-02 (F15 / J-NAV-001 + J-NAV-002 — aligned to actual TanStack route tree) -->
<!-- skill: oli-ui-blueprint --blueprint --all -->
<!-- based-on: ROLE_PERMISSION_MATRIX.md, MODULE_MAP.md, MODULE_SPEC.md ×10 -->

# Navigation Map — Dentalemon

> Role-aware routing + sidebar structure for the dental clinic application.

> **Reconciliation note (2026-06-02):** This map was originally a forward-looking
> blueprint. It has been reconciled against the **actual** file-based TanStack
> route tree in `apps/dentalemon/src/routes/`. Routes that resolve via
> modals / sheets / tabs rather than dedicated URLs are now annotated as such,
> and the imaging surface is documented as **workspace-scoped** (no standalone
> `/imaging` route — see §2 and §3). Logical/path naming reflects the real tree:
> the two layout shells are `_dashboard` and `_workspace`, and the clinical
> workspace is keyed by **`$patientId`**, not `:visitId`.

---

## 1. Application Shells

| Shell | Route prefix | Used by |
|-------|-------------|---------|
| Auth shell | `/auth/*` | Unauthenticated |
| Clinic shell | `/` | All authenticated dental staff |
| Patient portal | `/portal/*` | Phase 2 — not yet implemented |

---

## 2. Sidebar Navigation Structure

### Sidebar items by role

> **Implementation note:** Sidebar items below are the items actually rendered
> by `AppSidebar` in `_dashboard.tsx`, grouped as **Clinical** (Dashboard,
> Patients, Calendar), **Operations** (Billing, Reports), and **Admin** (Staff,
> Settings). There is **no `Imaging` sidebar item and no `Workspace` sidebar
> item** — the workspace is entered by selecting a patient (see §3), and imaging
> is reached from inside the workspace (see "Imaging is workspace-scoped" below).
> Role visibility is enforced by `filterNavGroupsByRole` + per-route
> `requireRole(module)` guards, which read the same org-context store.

| Nav Item | Icon (lucide) | Route | Group | Notes |
|----------|------|-------|-------|-------|
| Dashboard | `Home` | `/dashboard` | Clinical | Ungated fallback (always reachable) |
| Patients | `Users` | `/patients` | Clinical | gated `patients` |
| Calendar | `Calendar` | `/calendar` | Clinical | gated `calendar` |
| Billing | `Receipt` | `/billing` | Operations | gated `billing` |
| Reports | `BarChart3` | `/reports` | Operations | gated `reports` |
| Staff | `UserCog` | `/staff` | Admin | gated `staff` |
| Settings | `Settings` | `/settings` | Admin | gated `settings` |

> Per-role visibility is derived from each item's `module` gate via
> `filterNavGroupsByRole` (see `apps/dentalemon/src/components/app-sidebar.tsx`).
> Refer to `ROLE_PERMISSION_MATRIX.md` for the authoritative role→module grants.

**Surfaces with NO sidebar entry (reached contextually):**

| Surface | Route | Entered via |
|---------|-------|-------------|
| Workspace | `/_workspace/$patientId` | Selecting a patient from the Patients list |
| Imaging | (none — overlay) | Workspace → "Imaging" tab button → `WorkspaceImagingOverlay` |
| Cephalometric report (print) | `/imaging-ceph-report/$imageId` | Deep-link from the imaging overlay's ceph view |
| Patient profile | `/patients/$patientId` | Patient list "Profile" action / workspace "Profile" link |

---

## 3. Route Tree

> **Actual** file-based TanStack route tree, mirroring
> `apps/dentalemon/src/routes/`. Underscore-prefixed segments (`_dashboard`,
> `_workspace`) are **pathless layout routes** — they wrap children in a shell
> (sidebar vs. tab-bar) without adding a URL segment, so `/_dashboard/patients`
> is served at the URL `/patients`. Items marked **(modal)** / **(sheet)** /
> **(tab)** resolve as in-page UI, not dedicated URLs.

```
/                              index.tsx (landing / role redirect)
│
├── /auth
│   ├── /auth/$authView        (login / signup / etc. — Better-Auth views)
│   ├── /auth/pin-select       (PIN selection for locked sessions)
│   └── /auth/pin-entry/$memberId
│
├── /onboarding                (account-level onboarding)
├── /verify-email
├── /dental-onboarding         (clinic/org setup wizard — FR7.5/FR9.8 redirect target)
│
├── _dashboard  (layout: SidebarProvider + AppSidebar; requireAuth + PIN gate)
│   ├── /dashboard
│   ├── /patients
│   │   └── + New Patient          (modal) PatientRegistrationModal — no /patients/new URL
│   ├── /patients/$patientId       (standalone patient profile; route dir `patients_/$patientId`)
│   ├── /calendar                  (book appointment is in-page, no /calendar/new URL)
│   ├── /billing
│   │   ├── invoice detail         (sheet) InvoiceDetail — no /billing/invoices/:id URL
│   │   └── payment plan           (modal) PaymentPlanView
│   ├── /reports
│   ├── /staff
│   └── /settings
│
├── _workspace  (layout: full-screen clinical shell; tab-bar replaces sidebar)
│   ├── /$patientId                ← clinical workspace, keyed by PATIENT id
│   │   ├── Carousel + TreatmentTable   (primary view: chart + treatment list)
│   │   ├── Imaging                (overlay)  WorkspaceImagingOverlay  ← imaging lives here
│   │   ├── Notes / Rx / Consent / Lab / PMD / Attachments / Plans  (sheets)
│   │   ├── Recalls               (sheet)
│   │   └── Continue to Payment   (modal)  WorkspacePaymentModal
│   └── /queue-board               (visit queue board)
│
└── /imaging-ceph-report/$imageId  (top-level PRINT route for frozen ceph report
                                     snapshots; ?version=N selects a version.
                                     Deep-linked from the imaging overlay — NOT a
                                     browsable /imaging surface.)
```

> ### Imaging is workspace-scoped (no standalone `/imaging` route)
>
> Imaging (studies, findings, cephalometric analysis) is **per-patient** and is
> only reachable from inside a patient's workspace:
>
> 1. Open a patient → `/_workspace/$patientId`.
> 2. Click the **Imaging** tab button (`data-testid="imaging-tab-btn"`) →
>    `WorkspaceImagingOverlay` renders the patient's studies + ceph tools.
> 3. A generated cephalometric report can be printed via the deep-link
>    `/imaging-ceph-report/$imageId` (the only top-level imaging route, and it is
>    a frozen-snapshot print view, not a clinic-wide browser).
>
> There is intentionally **no `/imaging`, `/imaging/studies`, or
> `/imaging/ceph/:id` clinic-wide route, and no Imaging sidebar item.** This
> reflects the deliberate workspace-scoped design (imaging belongs to a patient,
> accessed in the context of treating that patient).
>
> **Future enhancement (not implemented):** if a clinic-wide studies worklist is
> ever desired (e.g. "all radiographs captured today" across patients), it would
> be added as a new top-level `/imaging` surface + sidebar item. Until then, this
> map documents the actual workspace-scoped behaviour.

---

## 4. Default Landing Pages

| Role | Default route |
|------|-------------|
| `dentist_owner` | `/dashboard` |
| `dentist_associate` | `/dashboard` |
| `staff_full` | `/patients` |
| `staff_scheduling` | `/calendar` |

---

## 5. Module → Route Mapping

| Module | Primary surface(s) |
|--------|---------------|
| dental-org | `/staff`, `/settings` |
| dental-patient | `/patients`, `/patients/$patientId` (profile) |
| dental-visit | `/_workspace/$patientId` |
| dental-scheduling | `/calendar`, `/_workspace/queue-board` |
| dental-billing | `/billing`, workspace payment modal |
| dental-clinical | workspace sheets (Notes / Rx / Consent / Lab) |
| dental-imaging | workspace Imaging overlay; `/imaging-ceph-report/$imageId` (print). **No standalone `/imaging` route.** |
| dental-pmd | workspace PMD viewer/import sheets |
| dental-emr | workspace clinical sheets |
| dental-audit | `/reports` (audit log surfaced within reports) |

---

## 6. Navigation State

- Active sidebar item: lemon (`#FFE97D`) text + 3px left border + soft bg
- Collapsed sidebar: shows icon rail; active item shows lemon icon
- Mobile (<768px): sidebar hidden by default, hamburger toggle
- Workspace: top tab bar replaces sidebar sub-navigation
