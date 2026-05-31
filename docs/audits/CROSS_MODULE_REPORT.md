# Cross-Module Enforcement Report

> Sub-check of `/oli-check` — architectural boundaries **between** modules (backend handlers + frontend features). Read-only.
> Generated: 2026-05-31 at HEAD (`feat/ceph-demoable-and-manual-ux`). Evidence: fresh codebase map (`docs/audits/codebase-map/`, producer=engine) + direct import-graph re-derivation over `services/api-ts/src/handlers/` and `apps/dentalemon/src/features/`.

## Verdict: **WARN** — P0=0, P1=4, P2=4

No security/tenant boundary is broken at the module seam. The official boundary checker (`bun run check:boundaries`) passes — **0** alias-form cross-module repo imports; every `@/handlers/*` cross-import goes through an approved `*.facade.ts`. The findings below are architectural-hygiene issues: two real frontend dependency cycles, a lib→feature layer inversion, handler-to-handler re-export shims that bypass the facade contract, and the documented (in-progress) relative-`.repo` ESLint debt.

---

## 1. Dependency-Edge Findings

| ID | Sev | Modules | Kind | Evidence |
|----|-----|---------|------|----------|
| EX-001 | P1 | FE `patients` ↔ `workspace` | Circular dep + internals reach-through | `workspace/components/workspace-top-bar.tsx` → `@/features/patients/hooks/use-patient-profile`; `patients/components/patient-profile-page.tsx` → `@/features/workspace/hooks/use-visits`; `patients/components/{dental-chart-thumbnail,patient-folder-card}.tsx` + `patients/hooks/use-patients.ts` → `@/features/workspace/components/dental-chart.helpers` |
| EX-002 | P1 | FE `lib` → `features` | Layer inversion + cycle (lib imports app layer) | `apps/dentalemon/src/lib/ceph-export.ts` imports `../features/imaging/hooks/use-ceph-landmarks` and `../features/imaging/lib/ceph-geometry`; reverse edge `features/imaging/components/imaging-workspace.tsx` → `../../../lib/ceph-export`. Matches `CODE_IMPORT_GRAPH.json` `circular_deps: [["lib","features"]]` |
| EX-003 | P1 | BE `dental-patient` → `dental-visit` | Handler-to-handler direct re-export (bypasses `visit.service` facade) | `dental-patient/treatment-plans/{getTreatmentPlan,getTreatmentPlanVersion,acceptTreatmentPlan}.ts` each `export { … } from '../../dental-visit/treatment-plans/…'` / `'../../dental-visit/treatments/acceptTreatmentPlan'` — re-exports another module's **handler** file directly |
| EX-004 | P1 | BE `dental-org` → `dental-scheduling` | Handler-to-handler direct re-export | `dental-org/{updateWorkingHours,getWorkingHours}.ts` `export { … } from '../dental-scheduling/workingHours'` — dental-org re-exports a dental-scheduling handler (and dental-scheduling imports dental-org's `org-scheduling.facade` back, closing a cycle) |
| EX-005 | P2 | BE `dental-patient`→`patient` (11), `billing`→`person` (12), `notifs`→`person` (5), `dental-billing`→`patient` (1), `dental-patient`→`dental-visit` (2), `patient`/`provider`→`person` (1 each) | Relative `../module/repos/*.repo` import (no facade) | e.g. `dental-patient/identity/getDentalPatient.ts` ← `../../patient/repos/patient.repo`; `billing/getInvoice.ts` ← `../person/repos/person.repo`; `notifs/listNotifications.ts` ← `../person/repos/person.repo`. **Already tracked**: ESLint `no-restricted-imports` (~64 warnings incl. schema), migration-in-progress per `docs/development/MODULE_BOUNDARIES.md`. Most target platform primitives `person`/`patient`. |
| EX-006 | P2 | BE schema FK coupling: `dental-{visit,billing,clinical,scheduling,perio}` → `dental-org`/`patient`/`person` `*.schema` | DB-layer FK coupling via `*.schema` import | e.g. `dental-visit/repos/visit.schema.ts` ← `../../patient/repos/patient.schema` + `../../dental-org/repos/branch.schema`. **Explicitly exempted** by MODULE_BOUNDARIES.md (Drizzle FK = DB-layer, not code-layer). Documented as a contract per MODULE_MAP coupling table. No action — recorded for completeness. |
| EX-007 | P2 | Event DE-019 `ImagingFindingConfirmed` consumer placement | Event-contract consumer mismatch | EVENT_CONTRACTS.md §4 declares the consumer as `dental-clinical` (safety-floor reference), but the safety-floor reader lives in `dental-patient/identity/getDentalPatientSafetyFloor.ts`, not `dental-clinical`. Fact is consumed (not unwired) — only the declared owning module differs. |
| EX-008 | P2 | Event DE-021 `PatientRegistered` | Declared-but-unwired publisher | `patient/createPatient.ts` emits Pino `info` only, no `dental_audit_log` row → no audit-marker publisher. Already documented as DEFERRED in EVENT_CONTRACTS.md §3b. |

### Notes on what is NOT a violation (verified compliant)
- **`dental-imaging` → `dental-org` (11 imports)**: all via `@/handlers/dental-org/repos/org-imaging.facade` (`getImagingTierForBranch`, `getOrgDataForBranch`) — approved bridge. dental-imaging keeps its loose-coupling (UUID-only, no DB FK) pattern.
- **`dental-clinical` → `dental-visit` (visit reads)**: all via `@/handlers/dental-visit/utils/visit.service` (the documented `VisitService` cross-module facade, C7/G-003) — the previously-flagged "VisitRepository direct access" P1 is **RESOLVED**. No `visit.repo` import remains in dental-clinical handlers.
- **`dental-billing` → `dental-org`**, **`dental-scheduling` → `dental-org`**, **`dental-visit` → `dental-org`**: via `org-billing.facade` / `org-scheduling.facade` — approved.
- **`shared` → `dental-org`**: the sanctioned cross-cutting hub (`assert-branch-access`/`assert-branch-role` read `membership.schema`) — exempt by design.

---

## 2. Circular Dependencies

### Frontend (real, code-layer)
- **`features/patients` ↔ `features/workspace`** (EX-001) — bidirectional reach into each other's `components/` + `hooks/`. The shared chart helper `workspace/components/dental-chart.helpers` is consumed by 3 `patients` files; resolve by extracting it to a shared location (e.g. `lib/` or a `shared` feature) and routing patient-profile/visit reads through one direction only.
- **`lib` ↔ `features`** (EX-002) — `lib/ceph-export.ts` imports `features/imaging`. Lower layer importing higher layer. Move ceph landmark/geometry types into `lib` (or a `packages/ceph-math`-adjacent shared module) so `lib` stops depending on `features`.

### Backend (module-level, facade-mediated unless noted)
The following module pairs form import cycles. Most are **acceptable** because the back-edge is a narrow `*.facade.ts` (intended bidirectional contract: a module both exposes a facade to and consumes a facade from `dental-org` the dashboard aggregator), but they are recorded because facade-mediated ESM cycles can still surface as TS project-ref / init-order hazards:

| Cycle | Mediation | Assessment |
|-------|-----------|------------|
| `dental-org` ↔ `dental-billing` | both via facades (`org-billing.facade` ↔ `billing-dashboard.facade`) | Acceptable (dashboard aggregation) |
| `dental-org` ↔ `dental-clinical` | facades (`org-clinical`/`org-billing` ↔ `clinical-dashboard.facade`) | Acceptable |
| `dental-org` ↔ `dental-visit` | facades (`org-billing` ↔ `visit-org.facade`) | Acceptable |
| `dental-clinical` ↔ `dental-visit` | `visit.service` + `clinical-visit.facade` (+ schema FK) | Acceptable (facade both ways) |
| `dental-patient` ↔ `dental-visit` | mostly facade/service, **but** EX-003 handler re-export + `initializeDentition.ts` ← `dental-visit/repos/{visit,dental-chart}.repo` (relative repo, EX-005-class) | **P1** — has a non-facade back-edge |
| `dental-org` ↔ `dental-scheduling` | facade one way, **handler re-export** the other (EX-004) | **P1** — non-facade edge |
| `shared` ↔ `dental-org` | sanctioned hub | Exempt |

---

## 3. Event-Contract Cross-Module Wiring

Per ADR-006 these are **audit-log-only semantic markers** (no bus/queue). Cross-module facts DE-001..DE-022 have synchronous audit-row producers with DE-ID-keyed trace tests present (`dental-imaging/dental-imaging-events.test.ts`, `dental-pmd/dental-pmd-events.test.ts`, `dental-org/dental-org-events.test.ts`). No **undeclared** cross-module events found. Open items: EX-007 (DE-019 consumer placement), EX-008 (DE-021 deferred). DE-024 is a documented 501 stub. No P1 unwired declared events.

---

## 4. Shared-Code Leakage
- `workspace/components/dental-chart.helpers` is imported across the `workspace`/`patients` boundary by 4 files (drives EX-001). Should live in a shared module, not inside the `workspace` feature.
- Ceph geometry/landmark types split between `lib/ceph-export.ts` and `features/imaging/lib/ceph-geometry` + `features/imaging/hooks/use-ceph-landmarks` (drives EX-002). Consolidate the shared math/types into the lower layer (or `packages/ceph-math`).

---

## Summary
- **Verdict: WARN** (P0=0, P1=4, P2=4).
- Backend module seam is in good shape: the official alias-import boundary checker is **green**, and the historically-flagged dental-clinical→VisitRepository P1 is now facade-mediated and resolved. Remaining backend P1s are two narrow handler-to-handler re-export shims (EX-003, EX-004) and the facade pattern is otherwise consistently applied.
- The sharper issues are on the **frontend**: two genuine code-layer cycles (`patients↔workspace`, `lib↔features`) caused by features reaching into each other's `components/hooks` and a lib→feature inversion.
- P2 backend `.repo` relative-import debt is real but already tracked + enforced (ESLint warnings, documented migration), mostly against platform primitives `person`/`patient`.
