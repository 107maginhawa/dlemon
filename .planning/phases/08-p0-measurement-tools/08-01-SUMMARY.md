---
phase: 08-p0-measurement-tools
plan: "01"
subsystem: dental-imaging
tags: [typespec, codegen, measurement, calibration, annotation, imaging, tdd]
dependency_graph:
  requires: []
  provides:
    - PATCH /dental/imaging/images/{imageId}/calibration
    - POST /dental/imaging/images/{imageId}/measurements
    - GET /dental/imaging/images/{imageId}/measurements
    - DELETE /dental/imaging/measurements/{measurementId}
  affects:
    - services/api-ts/src/generated/openapi/*
    - services/api-ts/src/handlers/dental-imaging/
tech_stack:
  added: []
  patterns:
    - Zod discriminated union for geometry validation
    - assertBranchAccess on all new endpoints
    - resolveImagingTier for free-tier gate
    - ImagingRepository extended with annotation CRUD
key_files:
  created:
    - services/api-ts/src/handlers/dental-imaging/updateImageCalibration.ts
    - services/api-ts/src/handlers/dental-imaging/createMeasurement.ts
    - services/api-ts/src/handlers/dental-imaging/listMeasurements.ts
    - services/api-ts/src/handlers/dental-imaging/deleteMeasurement.ts
    - services/api-ts/src/handlers/dental-imaging/ImagingMgmt_updateImageCalibration.ts
    - services/api-ts/src/handlers/dental-imaging/ImagingMgmt_createMeasurement.ts
    - services/api-ts/src/handlers/dental-imaging/ImagingMgmt_listMeasurements.ts
    - services/api-ts/src/handlers/dental-imaging/ImagingMgmt_deleteMeasurement.ts
  modified:
    - specs/api/src/modules/dental-imaging.tsp
    - services/api-ts/src/handlers/dental-imaging/repos/imaging.repo.ts
    - services/api-ts/src/handlers/dental-imaging/imaging.test.ts
    - services/api-ts/src/generated/openapi/validators.ts
    - services/api-ts/src/generated/openapi/routes.ts
    - services/api-ts/src/generated/openapi/registry.ts
decisions:
  - Geometry discriminated union uses 'distance' as API type mapping to 'line' DB enum (per existing imagingAnnotationTypeEnum)
  - Org tier resolved via branch→org join (dentalBranches.organizationId → dentalOrganizations.imagingTier)
  - listMeasurements filters type IN ('line','angle','area') AND visible=true — no pagination needed at this phase
  - pixelSpacingMm validated > 0 at handler level per T-08-05 threat mitigation
metrics:
  duration: "4 minutes"
  completed: "2026-05-11T09:45:08Z"
  tasks_completed: 2
  files_created: 8
  files_modified: 6
---

# Phase 08 Plan 01: Measurement Tools API Summary

4 TypeSpec ops (calibration PATCH + measurement POST/GET/DELETE) compiled, codegen'd, and implemented with full branch-access guards, free-tier gate, and Zod geometry validation.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Extend TypeSpec + codegen (4 new ops) | c52629f | Done |
| 2 | Implement 4 handlers + tests | 98ced6e | Done |

## What Was Built

**TypeSpec additions** (`dental-imaging.tsp`):
- `ImagingAnnotation` model matching imaging_annotation table
- `UpdateCalibrationBody`, `CreateMeasurementBody`, `MeasurementListResponse` models
- 4 new ops in `ImagingManagement` interface

**Handler implementations**:
- `updateImageCalibration`: validates `pixelSpacingMm > 0`, assertBranchAccess, no tier gate
- `createMeasurement`: assertBranchAccess + free-tier 403 + Zod discriminated union (DistanceGeometry/AngleGeometry/AreaGeometry) + maps 'distance'→'line' for DB enum
- `listMeasurements`: assertBranchAccess, returns `{items}` filtered to measurement types
- `deleteMeasurement`: fetches annotation → verifies branch → deletes, returns 204

**ImagingRepository additions**: `updateImageCalibration`, `createAnnotation`, `listMeasurementAnnotations`, `findAnnotationById`, `deleteAnnotation`

**Tests**: 10 new cases across 4 describes; 22/22 pass. Typecheck clean.

## Verification

```
bun run build (specs/api): exit 0, 4 ops in openapi.json
bun run generate (api-ts): exit 0, 4 stubs generated
bun test imaging.test.ts: 22 pass, 0 fail
bun run typecheck: clean (no errors)
```

## Deviations from Plan

**[Rule 1 - Bug] Duplicate `where` key in mock builder**
- Found during: Task 2 test run
- Issue: `makeMeasurementDb` had two `where` keys (one overrode the other), causing `listMeasurements` to return a non-array thenable instead of array
- Fix: Unified into single `whereFn` that returns a thenable Promise with `.limit()` method attached
- Files modified: `imaging.test.ts`
- Commit: 98ced6e (included in task commit)

## Known Stubs

None — all 4 endpoints are fully wired.

## Threat Flags

None — all threat model mitigations (T-08-01 through T-08-06) implemented as planned.

## Self-Check: PASSED

- c52629f exists: `git log --oneline | grep c52629f` ✓
- 98ced6e exists: `git log --oneline | grep 98ced6e` ✓
- openapi.json has 4 ops: grep count = 4 ✓
- All handler files created ✓
- 22/22 tests pass ✓
- typecheck clean ✓
