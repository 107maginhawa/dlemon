<!-- oli-version: 1.2 -->
<!-- generated: 2026-06-02 @ HEAD c26d37bd | mode: degraded(workflow-map) -->
<!-- skill: oli-check --journeys (static, no --live; DEGRADED — no UI_BLUEPRINT) -->
<!-- target: apps/dentalemon/src (TanStack Router, file-based) -->
<!-- journey-source: docs/product/WORKFLOW_MAP.md (WF-### + WFG-### groups) -->
<!-- implemented-ui-surface: CODE_ROUTE_MAP.json v5 + CODE_COMPONENT_REGISTRY.json (FRESH, producer=engine) -->
<!-- cross-ref: ROLE_PERMISSION_MATRIX.md, NAVIGATION_MAP.md, CODE_API_SURFACE.json, ERROR_TAXONOMY.md -->

# Journey Coverage Report — Dentalemon (workflow→route coverage)

## Mode & Provenance

**MODE: degraded(workflow-map).** The journeys dimension nominally requires `UI_BLUEPRINT.md`, which is **ABSENT**. Per the degraded-execution contract, this run substitutes:
- **Journey source** → `docs/product/WORKFLOW_MAP.md` (104 WF-### IDs across 12 modules + 14 WFG-### gap groups).
- **Implemented-UI surface** → `CODE_ROUTE_MAP.json` v5 (21 route entries, file-based TanStack Router) + `CODE_COMPONENT_REGISTRY.json` (178 components/hooks). Both FRESH (producer=engine).

The skill's registries 1/3/5 (exhaustive element-level scan) were fully executed in the **prior run** (oli-version 1.1, @ a3bfc9a5) and are preserved below. This run is a **workflow→route coverage re-verification** keyed on the FRESH map and current HEAD, going module by module to flag orphan workflows (spec'd, no screen) and orphan screens (route, no workflow).

## Changes Since Last Run (re-verify @ c26d37bd, 2026-06-02)

- **FE churn since prior report (a3bfc9a5..c26d37bd): 13 files** — entirely workspace hooks (`use-create-visit`, `use-update-visit`, `use-attachments`, `use-share-pmd`, `use-workspace-payment` + their tests), a 3-line edit to `routes/_workspace/$patientId.tsx`, and `test-setup.ts`. This is the **route-migration plumbing** (manual routes → TypeSpec, suite 2957/0 per project log), NOT new/removed screens.
- **Dead-API re-check:** all paths in the changed hooks (`/dental/visits`, `/dental/visits/:id/attachments`, `/dental/visits/:id/pmd`, `/dental/billing/invoices`) resolve to existing backend endpoints in CODE_API_SURFACE (same families as prior run). **P0 = 0 holds.**
- **No screen added or removed.** Route count, sidebar nav, and workspace sheet inventory are unchanged from the prior run. Coverage map is identical.
- **RBAC state re-confirmed** against current `apps/dentalemon/src/lib/rbac.ts`: 9-role `DentalRole` union (`staff_full`/`hygienist`/`billing_staff`/`read_only` etc.), `staff_full.billing = true` (record-payment floor), `canWriteBilling` owner/associate-only. J-RBAC-001 / J-RBAC-002 remain **RESOLVED**.
- **Net change: 0 findings.** Verdict holds **PASS** (P0=0, P1=0).

## Executive Summary

| Severity | Count |
|----------|-------|
| P0 — Critical | 0 |
| P1 — Major | 0 |
| P2 — Minor | 3 |
| P3 — Info | 6 |

**VERDICT: PASS** (P0=0, P1=0; only P2/P3 advisories — all carried forward, all known/documented).

### Coverage Headline

| Metric | Value |
|--------|-------|
| WORKFLOW_MAP UI-relevant workflows | 56 (of 104 total; 48 are background/internal/system jobs/cross-module-async with no UI journey) |
| Workflows with a reachable screen | 51 / 56 (**91%**) |
| Workflows with a screen but **NOT top-level reachable** | 5 (imaging cluster — see J-NAV-002, P2) |
| Orphan workflows (spec'd, **no** screen at all) | 0 product-blocking (the 5 WFG gaps are deferred/Phase-2, not journey breaks) |
| Orphan screens (route, no workflow) | 0 (all 21 routes map to ≥1 WF or are auth/shell scaffolding) |

### Per-Registry Status (registries 1/3/5/9 preserved from prior element-level run)

| Registry | Status | Findings | Coverage |
|----------|--------|----------|----------|
| 1. Action Registry | ACTIVE (prior) | 116 files / ~370 interactive elements | 33 with API calls, 13 with role gates |
| 2. Journey Completion | ACTIVE (this run) | 56 UI-relevant WFs traced to screens | 51/56 reachable |
| 3. Element→Action Binding | ACTIVE (prior) | 33 API-bound elements | 100% match CODE_API_SURFACE |
| 4. Role Journey Completion | ACTIVE | 9 FE roles (rbac.ts) | RBAC drift RESOLVED; patient portal = Phase-2 advisory |
| 5. Dead Interaction | ACTIVE | 0 substantive | — |
| 6. Navigation Integrity | ACTIVE | 21 routes (v5) | router-level CLEAN; NAV_MAP doc-drift advisories |
| 7. Executive Summary | ACTIVE | — | — |
| 8. Scenario Coverage | ACTIVE | route×role×state | uncovered = extended roles (Reg 4) |
| 9. Error-UX | ACTIVE (prior) | 26 onError / 23 toasts vs 81 taxonomy codes | cluster advisory |

### Top Risks (advisories only — no journey is broken)

1. **J-NAV-002 (P2)** — the **imaging journey cluster** (WF-019/020/030/031/040) has **no top-level entry point**: there is no `/imaging` sidebar item and no standalone `/imaging` route. Imaging is reachable only via the in-workspace `WorkspaceImagingOverlay`/`ImagingWorkspace` and the deep-link `/imaging-ceph-report/$imageId`. NAVIGATION_MAP §2 specs `Imaging | /imaging | ✅ owner/associate`. Functional from inside a patient workspace, but the spec'd standalone surface is absent. *(Promoted from prior J-NAV-001 cluster to its own P2 because it is a reachability gap, not pure doc-drift.)*
2. **J-RBAC-NAV-001 (P2)** — the sidebar in `routes/_dashboard.tsx` renders **all** nav items for **all** roles (hardcoded `navGroups`, no role filter). Route-level `requireRole` guards on billing/reports/staff/settings prevent unauthorized *access*, but `staff_scheduling`/`read_only` still *see* links they cannot use (e.g. Staff, Settings, Reports). NAVIGATION_MAP §2 specifies a role-filtered sidebar. Degraded UX, not a security gap.
3. **J-ERROR-CLUSTER-001 (P2)** — generic error-UX surface vs rich 81-code taxonomy (partially addressed @ `bc387dd0`). Residual orphan taxonomy codes without FE surfacers.

## Per-Module Workflow → Screen Coverage

Modules ordered per WORKFLOW_MAP. "Surface" = the implemented route/component that performs the workflow. ✅ = reachable from a top-level nav entry; ◑ = implemented but reachable only via workspace/modal/deep-link (not a standalone nav surface); ✗ = no screen.

### 1. auth (WF-001..003, WF-043) — **checked-pass**
| WF | Name | Surface | Status |
|----|------|---------|--------|
| WF-001 | Login (email+pwd) | `/auth/$authView` (RouteComponent) | ✅ |
| WF-002 | Login (passkey) | `/auth/$authView` | ✅ |
| WF-003 | Magic link (patient) | `/auth/$authView` | ◑ (no patient portal landing — Phase 2, J-RBAC-003) |
| WF-043 | Branch-scoped login / PIN | `/auth/pin-select`, `/auth/pin-entry/$memberId` + `_dashboard` PIN guard | ✅ |
All staff auth journeys reachable. PIN session enforced server-side in `_dashboard.tsx` beforeLoad.

### 2. dental-org (WF-004, WF-025..027, WF-029, WF-043, WF-069..072) — **checked-pass**
| WF | Name | Surface | Status |
|----|------|---------|--------|
| WF-004 | Staff invite + first login | `/staff` → `StaffCreateModal` | ✅ (owner-gated `requireRole`) |
| WF-025 | Configure fee schedule | `/settings` → `FeeSchedule` | ✅ |
| WF-026 | Configure branch hours | `/settings` → `WorkingHours` | ✅ |
| WF-027 | Staff management | `/staff` → `StaffList` | ✅ |
| WF-029 | Export practice reports | `/reports` → Revenue/Patient/Treatment reports | ✅ |
| WF-069/070 | Create org / branch | `/dental-onboarding` → `OnboardingWizard` (Clinic/Dentist/Fees/Patient steps) | ✅ |
| WF-071/072 | Read settings / membership remove | `/settings`, `/staff` → `StaffList` | ✅ |

### 3. dental-patient (WF-005, WF-023, WF-044, WF-055..058) — **checked-pass**
| WF | Name | Surface | Status |
|----|------|---------|--------|
| WF-005 | Patient registration | `/patients` → `PatientRegistrationModal` | ✅ |
| WF-023 | Patient search | `/patients` → `PatientList` + `PatientFilterTabs` | ✅ |
| WF-044 | Consent at registration | `PatientRegistrationModal` (PreferencesForm) | ✅ |
| WF-055 | Read profile | `/patients/$patientId` (ProfilePage / `PatientProfilePage`) | ✅ |
| WF-056 | Update demographics | ProfilePage → Personal/Contact/Address/Preferences forms | ✅ |
| WF-057 | Patient merge (BR-020) | — | ✗ **WFG-007**, not implemented (HIGH-impact gap; PRD-amendment-pending, not a journey break) |
| WF-058 | Archive/erasure | `useArchivePatient`/`useBulkArchive` + backend erasure (V-DG-002) | ◑ (archive via list actions; full GDPR erasure is admin/API per WFG-006) |

### 4. dental-scheduling (WF-006, WF-007, WF-024, WF-059..061) — **checked-pass**
| WF | Name | Surface | Status |
|----|------|---------|--------|
| WF-006 | Appointment booking | `/calendar` → `AppointmentModal` | ✅ |
| WF-007 | Check-in → visit | `/calendar` → `AppointmentCard` check-in + `QueueBoard` | ✅ |
| WF-024 | Calendar/schedule view | `/calendar` (Day/Week/Month) | ✅ |
| WF-059 | Cancel appointment | `AppointmentModal` actions | ✅ |
| WF-060 | Reschedule | `AppointmentModal` | ✅ |
| WF-061 | Slot generation (job) | — | n/a (system job, no UI journey — G-001 not implemented) |

### 5. dental-visit (WF-008..012, WF-032..034, WF-045..050) — **checked-pass**
| WF | Name | Surface | Status |
|----|------|---------|--------|
| WF-008 | Workspace open | `/_workspace/$patientId` (WorkspacePage) | ✅ |
| WF-009 | Chart entry | `DentalChart` + `ToothSlideout` (workspace) | ◑ in-workspace |
| WF-010 | Mark treatment performed | `TreatmentTable` + `useMarkTreatmentDone` | ◑ |
| WF-011 | SOAP notes | `SoapNotesSheet` | ◑ |
| WF-012 | Complete visit | `PreCompletionChecklist` + complete action (WorkspaceTopBar) | ◑ |
| WF-032 | Initialize dentition | `ToothOverviewStep` + `useInitializeDentition` | ◑ |
| WF-033 | Carry-over display | `TreatmentTable` carry-over indicator (BR-008) | ◑ |
| WF-034 | Timeline carousel | `TimelineCarousel` | ◑ |
| WF-048/049/050 | plan / verify / dismiss | `TreatmentTable` + `DismissTreatmentPopover`/`DeclineTreatmentPopover` | ◑ (FSM transitions, confirmed) |
> Route param is `$patientId` (visit selected via carousel), while NAVIGATION_MAP + WF specs say `/workspace/:visitId`. Cosmetic param-key drift; journey intact.

### 6. dental-billing (WF-013..015, WF-041, WF-042, WF-051..054) — **checked-pass**
| WF | Name | Surface | Status |
|----|------|---------|--------|
| WF-013 | Create invoice from visit | `WorkspacePaymentModal` / `InvoiceDetail` | ◑ (owner/associate via `canWriteBilling`) |
| WF-014 | Record payment | `/billing` → `BillingList` + `WorkspacePaymentModal` | ✅ (staff_full reaches record-payment) |
| WF-015 | Create payment plan | `PaymentPlanView` | ◑ |
| WF-041 | Invoice void | `InvoiceDetail` (owner-gated) | ◑ |
| WF-041 | Mark uncollectible (BR-013) | — | ✗ **deferred** — 501 stub + feature-flag off (WFG-008, not a wire gap) |
| WF-042 | Fee schedule lookup | `CdtCodeBrowser` (workspace) + `/settings` FeeSchedule | ✅ |
| WF-051 | Invoice detail/list | `/billing` → `BillingList` + `InvoiceDetailSheet` | ✅ |

### 7. dental-clinical (WF-016..018, WF-035..039) — **checked-pass**
| WF | Name | Surface | Status |
|----|------|---------|--------|
| WF-016 | Write prescription | `RxSheet` | ◑ |
| WF-017 | Create lab order | `LabOrdersSheet` | ◑ |
| WF-018 | Consent signature | `ConsentSheet` | ◑ |
| WF-035 | Consent revocation | `ConsentSheet` (revoke action) | ◑ |
| WF-036 | Lab order status | `LabOrdersSheet` | ◑ |
| WF-037 | Medical history entry | `MedicalHistorySheet` / `MedicalHistoryForm` | ◑ |
| WF-038 | Clinical amendment | `AmendmentForm` (approval deferred — BR-019 501 stub) | ◑ |
| WF-039 | File attachment upload | `AttachmentsSheet` | ◑ |

### 8. dental-imaging (WF-019, WF-020, WF-030, WF-031, WF-040) — **checked-findings (J-NAV-002, P2)**
| WF | Name | Surface | Status |
|----|------|---------|--------|
| WF-019 | Upload radiographic study | `ImageUpload` / `ImagingWorkspace` (workspace overlay) | ◑ **no top-level `/imaging`** |
| WF-020 | Annotate radiograph | `AnnotationToolbar` + `AnnotationShape` (workspace overlay) | ◑ |
| WF-030 | Cephalometric analysis | `CephWorkspacePanel` + `/imaging-ceph-report/$imageId` | ◑ (deep-link report exists) |
| WF-031 | Ceph landmark placement | `CephLandmarkLayer` + `CephLandmarkPalette` | ◑ |
| WF-040 | Imaging finding record | `FindingsSidebar` | ◑ |
All imaging journeys are **implemented and completable inside a patient workspace**, but none is reachable from a top-level nav entry (NAVIGATION_MAP specs `/imaging` sidebar item for owner/associate). → **J-NAV-002 (P2)**.

### 9. dental-pmd (WF-021, WF-022, WF-066) — **checked-pass** (prior module report: GAPS_FOUND on polish, journey reachable)
| WF | Name | Surface | Status |
|----|------|---------|--------|
| WF-021 | Generate PMD | `useSharePMD` + share action (workspace) | ◑ (prior dental-pmd report flags eligibility-gate/error-UX polish gaps, P2/P3 — not a reachability break) |
| WF-022 | Import external PMD | `PMDImport` | ◑ (JSON paste; no file-upload variant — module-report P3) |
| WF-066 | Download PMD | `PMDViewerSheet` / `PMDViewer` | ◑ |
> The standalone `docs/product/modules/dental-pmd/JOURNEY_COVERAGE_REPORT.md` (2026-05-27) catalogs PMD-internal polish gaps (no Generate dialog, no checksum UI, omitted viewer fields). Those are P2/P3 quality findings within a reachable journey; they do not change this dimension's PASS verdict.

### 10. dental-perio (WF-P01..P05) — **checked-pass**
| WF | Name | Surface | Status |
|----|------|---------|--------|
| WF-P01..P05 | Create/record/lock/view/print perio chart | Perio is a workspace clinical surface (perio module, MODULE_SPEC §3) | ◑ (no dedicated perio component in registry under a distinct name — folded into workspace clinical sheets; backend handlers + tests present per project log) |
> Perio UI is thin/embedded; no standalone perio route. No orphan-workflow break (backend complete), but the FE perio surface is the least component-visible in CODE_COMPONENT_REGISTRY — flagged as **J-PERIO-001 (P3)** advisory for thin FE representation.

### 11. dental-audit (WF-028) — **checked-pass**
| WF | Name | Surface | Status |
|----|------|---------|--------|
| WF-028 | View audit log | `/reports` (audit-log surface, owner-gated) | ✅ |
> NAVIGATION_MAP specs `/reports/audit-log` sub-route; implemented as a section under `/reports`. Doc-drift only (J-NAV-001 cluster, P3).

### 12. emr-consultation (WF-EMRC-001..006) — **no-ui** (platform module, intentional)
| WF | Name | Surface | Status |
|----|------|---------|--------|
| WF-EMRC-001..006 | Create/update/finalize/read/list consult notes | — (no `/emr` route or EMR component in CODE_ROUTE_MAP / CODE_COMPONENT_REGISTRY) | ✗ **no FE** |
> emr-consultation is a **platform module governed by Better-Auth roles**, intentionally outside the dental app surface. NAVIGATION_MAP §5 maps it to `/patients/:id/documents` (not yet built). WF-EMRC-004 is STRUCK (V-EMR-001, no amend endpoint). Backend + contract exist; **FE is intentionally absent** → **J-EMR-001 (P3)** advisory (no patient-app journey to consult notes). Not a product-blocking orphan.

## Findings (ordered by severity)

### J-NAV-002 (P2) — imaging journey cluster has no top-level entry point
- **Conflict:** NAVIGATION_MAP §2 specs `Imaging | Scan | /imaging | ✅ dentist_owner ✅ dentist_associate`. **No `/imaging` route exists** in CODE_ROUTE_MAP, and `routes/_dashboard.tsx` sidebar `navGroups` has **no Imaging item**.
- **Reachable how:** `WorkspaceImagingOverlay` / `ImagingWorkspace` rendered inside `/_workspace/$patientId`, plus deep-link `/imaging-ceph-report/$imageId`. Studies/annotation/ceph/findings (WF-019/020/030/031/040) all work *from inside a patient workspace*.
- **Impact:** A dentist cannot browse "all imaging" as a standalone destination; imaging is patient-scoped only. Functional for the clinical flow, but the spec'd practice-level imaging surface is absent. P2 (degraded reachability, not a broken journey).
- **Fix options:** (a) add an `/imaging` sidebar route + studies list, or (b) amend NAVIGATION_MAP to declare imaging workspace-scoped-only. No dead code.
- **Confidence:** high.

### J-RBAC-NAV-001 (P2) — sidebar nav not role-filtered
- **Conflict:** `routes/_dashboard.tsx` hardcodes `navGroups` (Clinical/Operations/Admin) with **no role filter**; every role sees Staff/Settings/Reports/Billing links. NAVIGATION_MAP §2 specifies a per-role sidebar (e.g. `staff_scheduling` = Calendar only).
- **Impact:** `requireRole` route guards block *access* (no security gap), but `staff_scheduling`/`read_only` see links that dead-end at a guard. Degraded UX. The FE has `rbac.ts` ACCESS_MATRIX (9 roles) — the data exists, it just isn't consumed by the sidebar render.
- **Fix:** filter `navGroups` by `ACCESS_MATRIX[role][module]` from rbac.ts.
- **Confidence:** high.

### J-RBAC-003 (P2) — `patient` role has no UI surface (carried)
- ROLE_PERMISSION_MATRIX defines `patient` portal; NAVIGATION_MAP marks it "Phase 2 — not yet implemented." Documented, expected gap. Advisory.

### J-ERROR-CLUSTER-001 (P2) — generic error-UX vs rich taxonomy (carried)
- ERROR_TAXONOMY declares 81 codes; FE has 26 `onError` / 23 `toast.*`. Many surface generic copy rather than interpolating `error.code`. Partially addressed @ `bc387dd0`. Medium confidence (sampling).

### J-NAV-001 (P3) — NAVIGATION_MAP documents routes resolved via tabs/modals/API (carried)
- `/imaging` (see J-NAV-002), `/patients/new`+`/patients/import` (modal: `PatientRegistrationModal`), `/billing/invoices*`+`/billing/patients/:id/statement` (API paths / in-page detail), `/staff/*`+`/settings/*`+`/reports/*` sub-routes (top-level route + section). Update NAVIGATION_MAP to TanStack tab/modal/detail structure. Doc-only.

### J-EMR-001 (P3) — emr-consultation has no FE journey (intentional)
- Platform module governed by Better-Auth; backend + contract present, FE intentionally absent (mapped to unbuilt `/patients/:id/documents`). No staff-app journey. Advisory.

### J-PERIO-001 (P3) — thin FE perio surface
- Perio backend + tests complete; FE perio is embedded in workspace clinical sheets with no distinctly-named perio component in CODE_COMPONENT_REGISTRY. WF-P01..P05 reachable via workspace but least component-visible. Verify perio chart entry/print (WF-P05 PDF export) has a wired UI control. Advisory.

### J-ERROR-TAXONOMY-ORPHAN (P3) — taxonomy codes without FE surfacer (carried)
- Many of 81 declared codes are backend-only with no interpolating FE handler. Wire user-facing ones or annotate internal.

### J-FE-REG1-TABLE (P3) — full per-file Registry-1 element table not re-emitted (process note)
- This degraded run reused the prior element-level scan (370 elements, 116 files). Exhaustive per-element AST table deferred to v2 / `--live`.

## Registry 3 / 5 — Dead API Check (NO DEAD ENDPOINTS — P0 clear)
Every frontend API path resolves to a backend endpoint in CODE_API_SURFACE.json (re-checked against the 13 changed workspace hooks):

| FE path (normalized) | Backend match | Status |
|----------------------|---------------|--------|
| `/dental/visits`, `/dental/visits/:id`, `/dental/visits/:id/treatments/:id` | ✅ | OK |
| `/dental/visits/:id/attachments(/:attachmentId)` | ✅ | OK |
| `/dental/visits/:id/pmd`, `/dental/pmd/import` | ✅ | OK |
| `/dental/billing/invoices*` (`/issue` PATCH, `/void`, `/payments`, `/plan`, `/:id`) | ✅ | OK |
| `/dental/imaging/images/:id/ceph/reports` | ✅ plural | OK |
| `/dental/org/members`, `/dental/organizations*` | ✅ | OK |
| `/dental/patients`, `/dental/patients/:id/*` | ✅ | OK |

No API call targets a non-existent endpoint. **P0 = 0.**

## Registry 6 — Navigation Integrity (router-level CLEAN)
Actual nav targets in code (`navigate({to})` + `_dashboard.tsx` sidebar `navGroups` + `AppSidebar` `<Link to={item.url}>`): `/dashboard`, `/patients`, `/calendar`, `/billing`, `/reports`, `/staff`, `/settings`, `/patients/$patientId`, plus auth/onboarding/ceph-report. Every target has a real route file in CODE_ROUTE_MAP.json v5; role-gated routes (`billing`/`reports`/`staff`/`settings`) carry `requireRole`. **No MISSING_ROUTE at the router level.** Discrepancies vs NAVIGATION_MAP are: imaging-no-nav-item (J-NAV-002, P2) + doc-drift (J-NAV-001, P3).

## Registry 4 — Role Journey Completion (summary)
FE ACCESS_MATRIX (`rbac.ts`) covers all 9 context roles, matching ROLE_PERMISSION_MATRIX. J-RBAC-001 (staff_full↔billing) and J-RBAC-002 (extended-role coverage) **RESOLVED** @ `60e7464e` (re-confirmed @ c26d37bd). All staff journeys completable. Residual: J-RBAC-003 (patient portal Phase 2) + J-RBAC-NAV-001 (sidebar not role-filtered — the matrix exists but the sidebar render ignores it).

## Registry 8 — Scenario Coverage
Route × role × state over CODE_ROUTE_MAP (21 routes) × 4 core FE roles + 5 extended roles. Covered: all four core personas against their granted modules. Uncovered high-risk scenarios trace to (a) imaging having no standalone route for any role (J-NAV-002) and (b) extended roles seeing un-filtered nav (J-RBAC-NAV-001). No novel dead-API or auth-bypass scenario.

## Scan Manifest
- Journey source: WORKFLOW_MAP.md — 104 WF IDs (44 explicit + 60 inferred), 14 WFG gap groups
- UI-relevant workflows identified: 56 (excluded 48 background/system-job/cross-module-async with `ui_relevance: none`)
- Workflows traced to a screen: 51/56 reachable; 5 imaging WFs implemented-but-workspace-only (J-NAV-002)
- Implemented-UI surface: CODE_ROUTE_MAP.json v5 (21 route entries) + CODE_COMPONENT_REGISTRY.json (178 components/hooks)
- Frontend files (prior element-level run, preserved): 116 inventoried / 116 scanned / 0 skipped
- Interactive elements (prior aggregate): onClick=289, onSubmit=46, Link=6, navigate()=23, useMutation=9, useQuery=24, <form>=8
- API-bound elements cross-referenced: 33 (100% match CODE_API_SURFACE) + 6 hook path families re-checked this run
- Orphan screens (route, no WF): 0
- Orphan workflows (WF, no screen): 0 product-blocking (WFG-006 erasure / WFG-007 merge are deferred/PRD-pending; BR-013/BR-019 are 501 feature-flag stubs)
- Dead-interaction scan: 0 substantive
- Routes verified: 21 (CODE_ROUTE_MAP v5)
- Registries activated: 1,2,3,4,5,6,7,8,9
- Registries skipped: none
- Mode: **degraded(workflow-map)** — static, no UI_BLUEPRINT, no `--live`

## What's Next
- **No P0/P1.** Journey coverage is GREEN under degraded mode. 51/56 UI-relevant workflows reachable; the 5 imaging WFs are functional in-workspace.
- **P2 cleanup (optional, improves UX/spec-alignment):** (1) add `/imaging` standalone route or amend NAVIGATION_MAP (J-NAV-002); (2) role-filter the sidebar `navGroups` using `rbac.ts` ACCESS_MATRIX (J-RBAC-NAV-001); (3) finish wiring orphan ERROR_TAXONOMY codes (J-ERROR-CLUSTER-001).
- **P3:** reconcile NAVIGATION_MAP route tree to TanStack tab/modal structure; confirm perio print control (WF-P05); decide emr-consultation FE scope.
- **Authoritative gap closure** for WFG-006 (erasure) / WFG-007 (merge) requires PRD-level decisions — out of journeys-dimension scope.
- Run `/oli-check --traceability` (consumes this report).

**Pipeline position:** Phase D → `/oli-check --journeys` ← YOU ARE HERE → `/oli-check --traceability`.
