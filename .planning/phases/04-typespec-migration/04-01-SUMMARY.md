---
phase: 04-typespec-migration
plan: "01"
subsystem: typespec-pipeline
tags: [typespec, codegen, dental-visit, treatment-templates]
dependency_graph:
  requires: []
  provides: [listTreatmentTemplates, createTreatmentTemplate, updateTreatmentTemplate, deleteTreatmentTemplate, applyTemplate, carryOverTreatments, getTreatmentPlan]
  affects: [services/api-ts/src/generated/openapi/registry.ts, services/api-ts/src/app.ts]
tech_stack:
  added: []
  patterns: [typespec-interface-extension, codegen-re-export-stub]
key_files:
  created:
    - services/api-ts/src/handlers/dental-visit/listTreatmentTemplates.ts
    - services/api-ts/src/handlers/dental-visit/createTreatmentTemplate.ts
    - services/api-ts/src/handlers/dental-visit/updateTreatmentTemplate.ts
    - services/api-ts/src/handlers/dental-visit/deleteTreatmentTemplate.ts
    - services/api-ts/src/handlers/dental-visit/applyTemplate.ts
    - services/api-ts/src/handlers/dental-patient/getTreatmentPlan.ts
  modified:
    - specs/api/src/modules/dental-visit.tsp
    - specs/api/src/main.tsp
    - services/api-ts/src/app.ts
    - services/api-ts/src/generated/openapi/registry.ts
    - services/api-ts/src/generated/openapi/routes.ts
    - services/api-ts/src/generated/openapi/validators.ts
decisions:
  - "Re-export stubs: codegen generates one file per operationId; real handlers in treatmentTemplates.ts export multiple functions — created thin re-export files pointing to the real implementations"
  - "getTreatmentPlan codegen path: route under /dental/patients → codegen placed stub in dental-patient/; re-export points to original dental-visit/getTreatmentPlan.ts"
metrics:
  duration: "12 minutes"
  completed: "2026-05-11"
  tasks_completed: 2
  files_modified: 12
---

# Phase 04 Plan 01: Treatment Templates + Visit Actions TypeSpec Migration Summary

Seven manually-registered dental routes migrated from `app.ts` into the TypeSpec pipeline via three new interfaces, regenerated codegen, and re-export stubs bridging multi-export handler files to the per-operationId import pattern.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add TypeSpec interfaces to dental-visit.tsp | 1eeecfa | dental-visit.tsp, main.tsp |
| 2 | Run pipeline, clean app.ts | 1eeecfa | app.ts, registry.ts, routes.ts, validators.ts, 6 stub files |

## What Was Built

- **3 new TypeSpec interfaces** in `DentalVisitModule`: `TreatmentTemplateManagement` (4 ops), `VisitTemplateActions` (2 ops), `TreatmentPlanPresentation` (1 op)
- **7 new models**: TreatmentTemplate, CreateTreatmentTemplateRequest, UpdateTreatmentTemplateRequest, ApplyTemplateResponse, CarryOverTreatmentsRequest, CarryOverTreatmentsResponse, TreatmentPlanResponse
- **3 main.tsp bindings**: TreatmentTemplateMgmt (`/dental/treatment-templates`), VisitTemplateActsMgmt (`/dental/visits`), TreatmentPlanMgmt (`/dental/patients`)
- **7 operationIds** now in generated registry.ts
- **6 re-export stub files** created to bridge codegen's per-file import expectation to the real multi-export handler files
- **7 manual routes** and their imports removed from app.ts

## Deviations from Plan

### Auto-added Re-export Stubs (Rule 2 — Missing Critical Wiring)

**Found during:** Task 2 (codegen step)

**Issue:** The codegen derives handler file paths from operationId names (one file per operationId). The real handlers for treatment templates (`listTreatmentTemplates`, `createTreatmentTemplate`, `updateTreatmentTemplate`, `deleteTreatmentTemplate`, `applyTemplate`) all live in `treatmentTemplates.ts` as multi-exports. Similarly, `getTreatmentPlan` was in `dental-visit/getTreatmentPlan.ts` but codegen placed the stub in `dental-patient/` (matching the `/dental/patients` route prefix).

**Fix:** Created 6 thin re-export files that simply re-export the named function from the real implementation file. This satisfies the codegen import pattern without moving or duplicating handler code.

**Files created:** `dental-visit/listTreatmentTemplates.ts`, `createTreatmentTemplate.ts`, `updateTreatmentTemplate.ts`, `deleteTreatmentTemplate.ts`, `applyTemplate.ts`, `dental-patient/getTreatmentPlan.ts`

## Verification Results

- `bun run build` (TypeSpec): exit 0
- `bun run generate`: exit 0, 6 new stubs generated
- `bun run typecheck`: exit 0
- Registry matches for all 7 operationIds: 14 lines (7 imports + 7 registrations)
- Manual routes in app.ts: 0 (only a comment remains)

## Self-Check: PASSED

- All 6 re-export files exist and were committed
- Commit 1eeecfa verified in git log
- typecheck exits 0 — no type errors
