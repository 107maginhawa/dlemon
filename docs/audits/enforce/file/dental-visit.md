# dental-visit — File Enforcement
<!-- oli-enforce-file v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary
- Files scanned: 57 (source: 38, tests: 19)
- Findings: 7 (P0: 0, P1: 3, P2: 3, P3: 1)
- Service files present: `.service.ts` ✅ (`utils/visit.service.ts`, 26 lines — partial), `.repo.ts` ✅ (4 repos: `visit.repo.ts`, `treatment.repo.ts`, `dental-chart.repo.ts`, `dental-chart-baseline.repo.ts`)

## Findings

| ID | Sev | Description | File | Line |
|----|-----|-------------|------|------|
| EF-VIS-001 | P1 | `utils/treatmentTemplates.ts` (169 lines) contains direct `db.insert/select/update/delete` calls but lives in `utils/` not `repos/`. It is acting as an undeclared repo — 7 direct DB calls (`db.select`, `db.insert`, `db.update`) with no repo class wrapper. Should be converted to a proper `repos/treatment-template.repo.ts`. | `utils/treatmentTemplates.ts` | 52, 69, 92, 103, 115, 120, 146 |
| EF-VIS-002 | P1 | `utils/visit.service.ts` (26 lines) is a thin service shim in `utils/` instead of the module root. Only 4 functions, all delegating to `VisitRepository`. Not discoverable as a service layer from the module root. Placement convention: service files belong at `handlers/dental-visit/dental-visit.service.ts`, not nested under `utils/`. | `utils/visit.service.ts` | — |
| EF-VIS-003 | P1 | Five `templates/` handler files are 1-line stubs (`applyTemplate.ts`, `createTreatmentTemplate.ts`, `deleteTreatmentTemplate.ts`, `listTreatmentTemplates.ts`, `updateTreatmentTemplate.ts` — all 1 line each). Template logic actually lives in `utils/treatmentTemplates.ts`. The `templates/` subdirectory is a dead forwarding layer with no real content. Templates directory structure is misleading: either implement the handlers properly or consolidate into `utils/treatmentTemplates.ts` as the single entry point. | `templates/*.ts` (all 5) | 1 |
| EF-VIS-004 | P2 | `utils/treatmentTemplates.ts` uses camelCase filename in a `utils/` directory (convention: kebab-case for multi-word filenames → `treatment-templates.ts`). Additionally, `treatmentTemplates.ts` is a mixed-concern file — it combines DB access, business logic, and handler dispatch — violating single-responsibility. | `utils/treatmentTemplates.ts` | — |
| EF-VIS-005 | P2 | `repos/treatment.repo.ts` at 241 lines is the largest repo file. While within the 500-line threshold, it is approaching complexity territory and mixes treatment CRUD, FSM validation, and carry-over logic. Consider splitting FSM/transition helpers into a dedicated `treatment-fsm.ts`. | `repos/treatment.repo.ts` | — |
| EF-VIS-006 | P2 | `visits/updateDentalVisit.ts` (147 lines) contains inline business logic: consent check, immutability enforcement, auto-discard, treatment-open validation, and audit dispatch. Handler exceeds the 100-line threshold with embedded orchestration. Service layer (`utils/visit.service.ts`) is not used by this handler. | `visits/updateDentalVisit.ts` | — |
| EF-VIS-007 | P3 | `dental-chart-baseline.test.ts` appears at both root level (52 lines) and `repos/dental-chart-baseline.test.ts` (74 lines). Two test files covering the same domain — verify there is no duplicate coverage and consolidate. | `dental-chart-baseline.test.ts`, `repos/dental-chart-baseline.test.ts` | — |

## Notes

- `visit.service.ts` IS present but misplaced (`utils/`) and thin — this is the reference pattern being evaluated for F2. It delegates correctly to `VisitRepository` but covers only 4 visit operations. Template, treatment, and chart operations have no service layer.
- Direct `db.*` calls found ONLY in `utils/treatmentTemplates.ts` (not in any handler file under `visits/`, `treatments/`, `notes/`, `chart/`, or `treatment-plans/`). All other DB ops go through the 4 repo classes. ✅ (except EF-VIS-001)
- No cross-module schema imports. ✅
- No files exceed 500 lines. ✅
- 8 subdirectories (`chart/`, `notes/`, `repos/`, `templates/`, `treatment-plans/`, `treatments/`, `utils/`, `visits/`) — well-organized domain split. ✅
- Rich test coverage: 19 test files including FSM property tests, business-rules tests, revenue-path regression, and signed-notes tests. ✅

## F2 Service-Layer Assessment

`utils/visit.service.ts` is the closest thing to a service layer in this module. It is a valid pattern starter but:
1. Wrong location (`utils/` vs module root)
2. Only covers 4 visit CRUD operations
3. Not used by `updateDentalVisit.ts` or `createDentalVisit.ts`
4. Templates, treatments, chart, and notes have NO service layer

The reference pattern for F2: move `visit.service.ts` → `dental-visit.service.ts` at module root, expand to cover orchestration from `updateDentalVisit.ts`, and add parallel service functions for treatment and template operations.

## File Inventory

| File | Lines | Role |
|------|-------|------|
| `dental-visit.test.ts` | 1043 | Integration test |
| `dental-visit.treatment-templates.test.ts` | 770 | Integration test |
| `dental-treatment.test.ts` | 646 | Integration test |
| `dental-visit.treatment-status-transitions.test.ts` | 562 | FSM transition test |
| `dental-visit.signed-notes.test.ts` | 461 | Signed notes test |
| `repos/dental-chart.test.ts` | 350 | Repo unit test |
| `treatment-fsm-http.test.ts` | 287 | FSM HTTP test |
| `business-rules.test.ts` | 284 | Business rules test |
| `dental-visit.visit-note-persistence.test.ts` | 261 | Note persistence test |
| `dental-visit.treatment-plan-versioning.test.ts` | 243 | Versioning test |
| `repos/treatment.repo.ts` | 241 | Repository ✅ (P2 complexity) |
| `repos/treatment.test.ts` | 240 | Repo unit test |
| `surface-condition-map.test.ts` | 215 | Unit test |
| `repos/visit.repo.ts` | 177 | Repository ✅ |
| `repos/visit.test.ts` | 175 | Repo unit test |
| `utils/treatmentTemplates.ts` | 169 | DB-access util (P1 — should be repo) |
| `dental-visit.revenue-path-regression.test.ts` | 167 | Regression test |
| `visits/updateDentalVisit.ts` | 147 | Handler (logic-heavy — P2) |
| `treatments/carryOverTreatments.ts` | 143 | Handler |
| `repos/dental-chart.repo.ts` | 143 | Repository ✅ |
| `treatments/acceptTreatmentPlan.ts` | 120 | Handler |
| `chart/initializeDentition.ts` | 119 | Handler |
| `treatments/updateDentalTreatment.ts` | 113 | Handler |
| `treatment-plans/getTreatmentPlan.ts` | 107 | Handler |
| `repos/treatment.schema.ts` | 98 | Schema |
| `repos/dental-chart.schema.ts` | 89 | Schema |
| `chart/getToothHistory.ts` | 84 | Handler |
| `treatment.fsm.property.test.ts` | 83 | Property-based test |
| `visit.fsm.property.test.ts` | 77 | Property-based test |
| `repos/dental-chart-baseline.test.ts` | 74 | Repo unit test |
| `treatments/createDentalTreatment.ts` | 72 | Handler |
| `repos/dental-chart-baseline.repo.ts` | 71 | Repository ✅ |
| `repos/treatment-decline.test.ts` | 67 | Repo unit test |
| `visits/createDentalVisit.ts` | 63 | Handler |
| `repos/visit.schema.ts` | 58 | Schema |
| `notes/upsertVisitNotes.ts` | 55 | Handler |
| `chart/updateTooth.ts` | 53 | Handler |
| `dental-chart-baseline.test.ts` | 52 | Test (duplicate? — P3) |
| `notes/signVisitNotes.ts` | 51 | Handler |
| `notes/createVisitNoteAddendum.ts` | 51 | Handler |
| `chart/upsertDentalChart.ts` | 50 | Handler |
| `treatment-plans/getTreatmentPlanVersion.ts` | 46 | Handler |
| `repos/visit-billing.facade.ts` | 42 | Facade |
| `visits/listDentalVisits.ts` | 41 | Handler |
| `notes/getVisitNoteHistory.ts` | 40 | Handler |
| `repos/visit-pmd.facade.ts` | 38 | Facade |
| `treatments/listDentalTreatments.ts` | 37 | Handler |
| `notes/getVisitNotes.ts` | 35 | Handler |
| `chart/getDentalChart.ts` | 33 | Handler |
| `repos/treatment-template.schema.ts` | 32 | Schema |
| `repos/treatment-plan-version.schema.ts` | 30 | Schema |
| `repos/dental-chart-baseline.schema.ts` | 30 | Schema |
| `visits/getDentalVisit.ts` | 28 | Handler |
| `utils/visit.service.ts` | 26 | Service (P1 — misplaced) |
| `repos/visit-dental-patient.facade.ts` | 24 | Facade |
| `repos/procedure-code.schema.ts` | 17 | Schema |
| `templates/applyTemplate.ts` | 1 | Stub handler (P1) |
| `templates/createTreatmentTemplate.ts` | 1 | Stub handler (P1) |
| `templates/deleteTreatmentTemplate.ts` | 1 | Stub handler (P1) |
| `templates/listTreatmentTemplates.ts` | 1 | Stub handler (P1) |
| `templates/updateTreatmentTemplate.ts` | 1 | Stub handler (P1) |
