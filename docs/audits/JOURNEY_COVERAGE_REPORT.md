<!-- oli-version: 1.1 -->
<!-- generated: 2026-05-31 -->
<!-- skill: oli-check --journeys (static, no --live) -->
<!-- target: apps/dentalemon/src -->
<!-- based-on: WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md, NAVIGATION_MAP.md, CODE_ROUTE_MAP.json v5, CODE_API_SURFACE.json, ERROR_TAXONOMY.md -->

# Journey Coverage Report — Dentalemon (all-frontend)

## Changes Since Last Run
- **Resolved findings: 2**
  - J-FE-001 (was P1) — Invoice "Issue" method mismatch. RESOLVED: `invoice-detail.tsx:73` now uses `method:'PATCH'`, matching backend `/dental/billing/invoices/:invoiceId/issue` (PATCH).
  - J-FE-002 (was P1) — Ceph report path singular/plural. RESOLVED: all 3 FE call sites (`CephWorkspacePanel.tsx:84`, `imaging-ceph-report.$imageId.tsx:35-36`) use plural `/ceph/reports`, matching backend.
- **New findings: 3** — J-RBAC-001 (P1), J-RBAC-002 (P1/P2), J-RBAC-003 (P2).
- **Net change:** −2 prior P1 (resolved) +2 new P1 (RBAC). Verdict moves from prior to WARN (no P0).

## Executive Summary

| Severity | Count |
|----------|-------|
| P0 — Critical | 0 |
| P1 — Major | 2 |
| P2 — Minor | 4 |
| P3 — Info | 6 |

**Verdict: WARN** (P0=0 → no BLOCK; P1>0 → WARN).

### Per-Registry Status
| Registry | Status | Findings | Coverage |
|----------|--------|----------|----------|
| 1. Action Registry | ACTIVE | 116 files / ~370 interactive elements | 33 with API calls, 13 with role gates |
| 2. Journey Completion | ACTIVE | core WFs traced; 18 Playwright journey specs corroborate | high (no broken core journey) |
| 3. Element→Action Binding | ACTIVE | 33 API-bound elements | 100% match CODE_API_SURFACE |
| 4. Role Journey Completion | ACTIVE | 4 FE roles × modules | 3 findings (RBAC drift) |
| 5. Dead Interaction | ACTIVE | 0 substantive | — |
| 6. Navigation Integrity | ACTIVE | 19 routes | router-level CLEAN; NAV_MAP doc-drift advisories |
| 7. Executive Summary | ACTIVE | — | — |
| 8. Scenario Coverage | ACTIVE | route×role×state | uncovered scenarios = extended roles (see Reg 4) |
| 9. Error-UX | ACTIVE | 26 onError / 23 toasts vs 81 taxonomy codes | cluster advisory |

### Top 3 Risks
1. **J-RBAC-001 (P1)** — `staff_full` blocked from `/billing` despite ROLE_PERMISSION_MATRIX + NAVIGATION_MAP granting billing (record payments). FE `rbac.ts:37` `ACCESS_MATRIX.staff_full.billing=false`.
2. **J-RBAC-002 (P1/P2)** — `hygienist`, `dental_assistant`, `front_desk`, `billing_staff` defined in ROLE_PERMISSION_MATRIX but absent from FE `DentalRole` (only 4 roles) → no route-guard representation; cannot complete any role-gated journey.
3. **NAV_MAP documentation drift (P3 cluster)** — NAVIGATION_MAP documents `/imaging`, `/patients/new`, `/patients/import`, `/billing/invoices*` sub-routes that resolve via workspace tabs / modals / API paths, not TanStack route files.

## Findings (ordered by severity)

### J-RBAC-001 (P1) — staff_full cannot reach /billing (route guard contradicts role matrix)
- **File:** `apps/dentalemon/src/lib/rbac.ts:37` (`ACCESS_MATRIX.staff_full.billing = false`); guard applied at `routes/_dashboard/billing.tsx:19` (`beforeLoad: requireRole('billing')`).
- **Conflict:** ROLE_PERMISSION_MATRIX.md ("Billing | … | Record payments only" for staff_full) and NAVIGATION_MAP.md (`/billing` ✅ for staff_full) both grant access. FE blocks it.
- **Impact:** A staff_full member assigned the "record payment" journey is redirected away from `/billing`. Role assigned to workflow but cannot complete.
- **Fix:** Set `staff_full.billing = true` in `rbac.ts` (scope write-vs-read at the action level if needed), or reconcile the matrix downward if billing is intentionally owner-only.
- **Confidence:** high.

### J-RBAC-002 (P1 for hygienist/front_desk, P2 aggregate) — extended roles unmapped in FE
- **File:** `apps/dentalemon/src/lib/rbac.ts:8` (`type DentalRole = 4 roles only`).
- **Conflict:** ROLE_PERMISSION_MATRIX.md defines `hygienist`, `dental_assistant`, `front_desk`, `billing_staff` with explicit module access. None exist in the FE role union or ACCESS_MATRIX. No code references them outside tests.
- **Impact:** Any user provisioned with these roles has undefined route-guard behavior (falls through / no canAccess entry) → cannot complete assigned role-gated journeys. `hygienist` (clinical R/W) and `front_desk` (check-in/scheduling) are the highest-impact gaps (P1); `dental_assistant`/`billing_staff` P2.
- **Fix:** Extend `DentalRole` + `ACCESS_MATRIX` to cover all matrix roles, or document that extended roles map onto the 4 base roles at the membership layer.
- **Confidence:** high.

### J-RBAC-003 (P2) — `patient` role has no UI surface
- **Conflict:** ROLE_PERMISSION_MATRIX defines `patient` (portal access). NAVIGATION_MAP marks patient portal "Phase 2 — not yet implemented."
- **Impact:** Expected, documented gap. No journey is currently assigned to a patient in the staff app. Advisory only.
- **Confidence:** high.

### J-NAV-001 (P3) — NAVIGATION_MAP documents routes resolved via tabs/modals/API, not route files
- `/imaging` — sidebar has no imaging item; imaging is a **workspace tab** (8 refs in `features/workspace`) + standalone `/imaging-ceph-report/$imageId`.
- `/patients/new`, `/patients/import` — triggered via `PatientRegistrationModal` (modal), not routes.
- `/billing/invoices*`, `/billing/patients/:id/statement` — these are **API paths** / in-page detail views, not separate UI routes.
- `/staff/*`, `/settings/*`, `/reports/*` sub-routes — top-level routes exist with `requireRole` guards; sub-routes are doc-only.
- **Fix:** Update NAVIGATION_MAP.md route tree to reflect TanStack tab/modal/detail-view structure. No code change needed.
- **Confidence:** high.

### J-ERROR-CLUSTER-001 (P2) — generic error-UX surface vs rich taxonomy
- ERROR_TAXONOMY.md declares 81 codes. FE has 26 `onError` handlers / 23 `toast.*` calls. Many mutations surface generic copy rather than interpolating `error.code`/`error.message`.
- **Fix:** Audit toast handlers to interpolate taxonomy codes; many of the 81 codes are backend-only with no FE surfacer (orphan codes — P3 advisory below).
- **Confidence:** medium (sampling-based; full per-handler classification deferred).

### J-ERROR-TAXONOMY-ORPHAN (P3) — taxonomy codes without FE surfacer
- A large share of the 81 declared error codes have no FE handler that surfaces them via interpolation (backend-only). Wire to UI where user-facing, or annotate as internal in ERROR_TAXONOMY.md.
- **Confidence:** medium.

### J-FE-REG1-TABLE (P3) — full per-file Registry-1 element table not emitted
- Static-analysis run captured aggregate counts and API-bound element bindings, not the exhaustive per-element table. AST-based emission deferred to v2.
- **Confidence:** n/a (process note).

### J-DEAD-HEURISTIC (P3) — heuristic dead-interaction advisories (low confidence)
- 69 `() => {}` occurrences are TypeScript type signatures / no-op default props, NOT dead handlers (`onClick={() => {}}` = 0, console-only handlers = 0, TODO/FIXME in handlers = 0). No confirmed NOOP_BUTTON / ORPHAN_FORM / EMPTY_HANDLER. Listed for transparency only.
- **Confidence:** low.

## Registry 3 / 5 — Dead API Check (NO DEAD ENDPOINTS — P0 clear)
Every frontend API path resolves to a backend endpoint in CODE_API_SURFACE.json:

| FE path (normalized) | Backend match | Status |
|----------------------|---------------|--------|
| `/dental/billing/invoices*` (`/issue` PATCH, `/void`, `/payments`, `/plan`, `/:id`) | ✅ all present | OK |
| `/dental/imaging/images/:id/ceph/reports` | ✅ plural | OK |
| `/dental/org/members`, `/dental/organizations*` | ✅ | OK |
| `/dental/patients`, `/dental/patients/:id/*` | ✅ | OK |
| `/dental/pmd/import` | ✅ | OK |
| `/dental/visits/:id/treatments/:id` | ✅ | OK |

No API call targets a non-existent endpoint. **P0 = 0.**

## Registry 6 — Navigation Integrity (router-level CLEAN)
Actual navigation targets in code (`navigate({to})` + sidebar `_dashboard.tsx` items): `/dashboard`, `/patients`, `/calendar`, `/billing`, `/reports`, `/staff`, `/settings`, `/patients/$patientId`, plus auth/onboarding/ceph-report routes. Every target has a real route file in CODE_ROUTE_MAP.json; role-gated routes (`billing`, `reports`, `staff`, `settings`) carry `requireRole` guards. No MISSING_ROUTE at the router level. NAV_MAP discrepancies are documentation drift (see J-NAV-001, P3).

## Registry 4 — Role Journey Completion (summary)
FE ACCESS_MATRIX (rbac.ts) covers 4 roles. ROLE_PERMISSION_MATRIX defines up to 9. Findings: J-RBAC-001 (staff_full↔billing contradiction), J-RBAC-002 (5 unmapped roles), J-RBAC-003 (patient portal Phase 2). Owner/associate journeys are fully completable.

## Registry 8 — Scenario Coverage
Route × role × state cartesian over CODE_ROUTE_MAP (19 routes) × 4 FE roles. Covered: owner/associate/staff_full/staff_scheduling against their granted modules. Uncovered high-risk scenarios all trace to Registry 4 (extended roles with no FE representation + staff_full/billing contradiction). No additional novel uncovered auth/mutation scenario beyond the RBAC findings.

## Scan Manifest
- Frontend files inventoried: 116 (non-test .tsx under apps/dentalemon/src)
- Frontend files scanned: 116
- Frontend files skipped: 0
- Interactive elements (aggregate): onClick=289, onSubmit=46, Link=6, navigate()=23, useMutation=9, useQuery=24, <form>=8
- API-bound elements cross-referenced: 33 (100% match CODE_API_SURFACE)
- UI-relevant workflows: traced against WORKFLOW_MAP (104 WF IDs) + 18 Playwright journey specs as corroboration
- Dead-interaction scan: 116 files; 0 substantive findings
- Routes verified: 19 (CODE_ROUTE_MAP v5)
- Registries activated: 1,2,3,4,5,6,7,8,9
- Registries skipped: none
- Mode: static analysis (no --live)

## What's Next
- Fix J-RBAC-001 + J-RBAC-002 (the two P1s) — reconcile FE rbac.ts with ROLE_PERMISSION_MATRIX.
- Update NAVIGATION_MAP.md to match TanStack tab/modal structure (clears J-NAV-001).
- Optionally run `/oli-check --traceability` (consumes this report) and `/oli-check --compliance --category ui` (now that UI_CONSISTENCY_SPEC.md exists).

**Pipeline position:** Phase D → journeys ← YOU ARE HERE → traceability.
