<!-- oli-version: 1.1 -->
<!-- generated: 2026-05-31; re-verified @ HEAD a3bfc9a5 (2026-06-01) after V-DG-002 erasure/legal-hold + GAP-001 localId — all backend/spec, 0 FE files changed -->
<!-- skill: oli-check --journeys (static, no --live) -->
<!-- target: apps/dentalemon/src -->
<!-- based-on: WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md, NAVIGATION_MAP.md, CODE_ROUTE_MAP.json v5, CODE_API_SURFACE.json, ERROR_TAXONOMY.md -->

# Journey Coverage Report — Dentalemon (all-frontend)

## Changes Since Last Run (re-verify @ a3bfc9a5, 2026-06-01)
- **Net change: 0.** `git diff f1b38d8..a3bfc9a5 -- apps/dentalemon/src` = **0 files**. The 5 intervening commits (V-DG-002 erasure/legal-hold, GAP-001 DB-backed localId) are entirely `services/api-ts` + `specs/api` — no UI surface. All journey findings carry forward unchanged. `rbac.ts` untouched since `60e7464e`.
- **J-RBAC-001 / J-RBAC-002 remain RESOLVED** (re-confirmed against current `rbac.ts`: 9-role union @8-19, `staff_full.billing=true` @46-55, `canWriteBilling` owner/associate-only @201). Verdict holds **PASS**.

### Prior run's resolution (preserved)
- **Resolved findings: 2 (the two known P1s — RBAC)**
  - J-RBAC-001 (was P1) — staff_full ↔ /billing contradiction. **RESOLVED** in commit `60e7464e`: `rbac.ts:46-55` now sets `staff_full.billing = true`; route guard `requireRole('billing')` admits staff_full; issue/void/create-invoice gated by new `canWriteBilling()` (rbac.ts:201, owner/associate only) and consumed at `invoice-detail.tsx`. Record-payment journey now completable for staff_full while write actions stay hidden — matches ROLE_PERMISSION_MATRIX + NAVIGATION_MAP.
  - J-RBAC-002 (was P1/P2) — extended roles unmapped in FE. **RESOLVED** in commit `60e7464e`: `DentalRole` union (rbac.ts:8-19) now covers all 9 context roles (dentist_owner, dentist_associate, staff_full, staff_scheduling, hygienist, dental_assistant, front_desk, billing_staff, read_only) with full ACCESS_MATRIX entries each. Route-guard behavior now defined for every provisioned role.
- **Context:** This run re-verifies after the V-DG-001 backend data-retention change, which has **no UI surface** — all frontend journeys are otherwise unchanged from the prior run.
- **Net change:** −2 P1 (both known RBAC P1s now resolved in code). Verdict improves WARN → **PASS** (P0=0, P1=0).

## Executive Summary

| Severity | Count |
|----------|-------|
| P0 — Critical | 0 |
| P1 — Major | 0 |
| P2 — Minor | 3 |
| P3 — Info | 6 |

**Verdict: PASS** (P0=0, P1=0; only P2/P3 advisories remain).

### Per-Registry Status
| Registry | Status | Findings | Coverage |
|----------|--------|----------|----------|
| 1. Action Registry | ACTIVE | 116 files / ~370 interactive elements | 33 with API calls, 13 with role gates |
| 2. Journey Completion | ACTIVE | core WFs traced; 18 Playwright journey specs corroborate | high (no broken core journey) |
| 3. Element→Action Binding | ACTIVE | 33 API-bound elements | 100% match CODE_API_SURFACE |
| 4. Role Journey Completion | ACTIVE | 9 FE roles × modules | RBAC drift RESOLVED (J-RBAC-001/002 fixed @60e7464e); J-RBAC-003 patient portal Phase-2 advisory only |
| 5. Dead Interaction | ACTIVE | 0 substantive | — |
| 6. Navigation Integrity | ACTIVE | 19 routes | router-level CLEAN; NAV_MAP doc-drift advisories |
| 7. Executive Summary | ACTIVE | — | — |
| 8. Scenario Coverage | ACTIVE | route×role×state | uncovered scenarios = extended roles (see Reg 4) |
| 9. Error-UX | ACTIVE | 26 onError / 23 toasts vs 81 taxonomy codes | cluster advisory |

### Top Risks (post-fix — advisories only)
1. **J-ERROR-CLUSTER-001 (P2)** — generic error-UX surface vs rich taxonomy (partially addressed by commit `bc387dd0` centralizing error toasts). Residual orphan taxonomy codes without FE surfacers.
2. **NAV_MAP documentation drift (P3 cluster)** — NAVIGATION_MAP documents `/imaging`, `/patients/new`, `/patients/import`, `/billing/invoices*` sub-routes that resolve via workspace tabs / modals / API paths, not TanStack route files. Doc-only.
3. **J-RBAC-003 (P2)** — `patient` portal role has no UI surface (documented Phase-2 gap). Advisory.

> The two previously-known P1s (J-RBAC-001 staff_full→/billing, J-RBAC-002 extended-role coverage) are **RESOLVED** in current code — see "Changes Since Last Run".

## Findings (ordered by severity)

### J-RBAC-001 (RESOLVED — was P1) — staff_full ↔ /billing reconciled
- **Status:** RESOLVED in commit `60e7464e`, verified @ f1b38d8.
- **Fix landed:** `rbac.ts:46-55` now `ACCESS_MATRIX.staff_full.billing = true`; route guard `routes/_dashboard/billing.tsx:21` (`requireRole('billing')`) admits staff_full. Invoice issue/void/create-invoice/payment-plan now gated by new `canWriteBilling()` (rbac.ts:201 — dentist_owner/associate only), consumed at `invoice-detail.tsx`. staff_full can complete the record-payment journey while write actions stay hidden — matches ROLE_PERMISSION_MATRIX + NAVIGATION_MAP.
- **Confidence:** high.

### J-RBAC-002 (RESOLVED — was P1/P2) — all 9 context roles now mapped in FE
- **Status:** RESOLVED in commit `60e7464e`, verified @ f1b38d8.
- **Fix landed:** `rbac.ts:8-19` `DentalRole` union now covers all 9 context roles (added hygienist, dental_assistant, front_desk, billing_staff, read_only); each has a complete ACCESS_MATRIX row (rbac.ts:66-127). Route-guard behavior is now defined for every provisioned role; no fall-through. Extended-role rationale documented inline (e.g., read_only reports stays owner-only per Administrative Operations table).
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
FE ACCESS_MATRIX (rbac.ts) now covers all 9 context roles, matching ROLE_PERMISSION_MATRIX. J-RBAC-001 (staff_full↔billing) and J-RBAC-002 (extended-role coverage) are RESOLVED @60e7464e. Only J-RBAC-003 (patient portal Phase 2, P2 advisory) remains. All staff journeys are completable; `patient` portal is a documented Phase-2 gap.

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
- No P0/P1 remain — journey coverage is GREEN. Both prior P1s (J-RBAC-001/002) resolved @60e7464e.
- Optional cleanup: update NAVIGATION_MAP.md to match TanStack tab/modal structure (clears J-NAV-001 P3); finish wiring orphan ERROR_TAXONOMY codes to FE surfacers (J-ERROR-CLUSTER-001 P2, partially done @bc387dd0).
- Run `/oli-check --traceability` (consumes this report).

**Pipeline position:** Phase D → journeys ← YOU ARE HERE → traceability.
