# dental-imaging — File Enforcement
<!-- oli-enforce-file v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary
- Files scanned: 45 (21 handler/impl, 21 PascalCase shims, 3 repo, 3 schema, 5 test)
- Findings: 3 (P0: 0, P1: 2, P2: 1, P3: 0)
- Service files present: `.service.ts` ❌ (none), `.repo.ts` ✅ (3 present)

## Findings

| ID | Sev | Description | File | Line |
|----|-----|-------------|------|------|
| EF-IMG-001 | P1 | No `.service.ts` when complex business logic exists. `createMeasurement.ts` (183 lines) inlines tier-gating, Zod discriminated-union geometry validation, and measurement-type enforcement. `batchUpsertCephLandmarks.ts` (103 lines), `createCephReport.ts` (115 lines), `recomputeCephAnalysis.ts` (80 lines), and `updateCephLandmark.ts` (116 lines) each contain multi-step orchestration inline. A `ceph.service.ts` or `imaging.service.ts` is needed to house tier-gate logic, geometry validation, and ceph analysis orchestration. | `createMeasurement.ts`, `createCephReport.ts`, `batchUpsertCephLandmarks.ts`, `recomputeCephAnalysis.ts`, `updateCephLandmark.ts` | — |
| EF-IMG-002 | P1 | `imaging_finding.repo.ts` (57 lines) is thin relative to the domain it covers. It lacks `updateFinding` and `deleteFinding` repo methods — those operations are performed ad-hoc inline in `updateFinding.ts` and `deleteFinding.ts` without going through the repo layer, bypassing the DB-access boundary. | `repos/imaging_finding.repo.ts`, `updateFinding.ts` (87 lines), `deleteFinding.ts` (47 lines) | — |
| EF-IMG-003 | P2 | No handler-unit `.test.ts` for ceph handler paths in isolation. `ceph.test.ts` (1270 lines) and `imaging-coverage.test.ts` (1000 lines) provide integration coverage; `ceph-landmark.fsm.property.test.ts` (80 lines) covers the FSM only. No unit test covers `createCephReport` / `getCephReport` / `getCephAnalysis` handler logic independently of a running server. | `ceph-landmark.fsm.property.test.ts` | — |

## Notes on PascalCase Shims

All PascalCase files are **confirmed valid delegation shims** — ALLOWED per project rule:

- `CephMgmt_*.ts` — **9 lines each**. Single import + single delegation call. ✅ ALLOWED
- `ImagingMgmt_*.ts` / `ImagingFindingsMgmt_*.ts` / `PatientImageMgmt_*.ts` — **18–19 lines each**. Same pattern with an extra type import. ✅ ALLOWED

No PascalCase shim contains business logic. All comply with the codegen delegation pattern.

## File Inventory

### Root Handler Files

| File | Lines | Notes |
|------|-------|-------|
| `batchUpsertCephLandmarks.ts` | 103 | Business logic inline — needs service (EF-IMG-001) |
| `createCephReport.ts` | 115 | Business logic inline — needs service (EF-IMG-001) |
| `createFinding.ts` | 83 | OK |
| `createImagingStudy.ts` | 95 | OK |
| `createMeasurement.ts` | 183 | Tier-gate + Zod geometry inline — needs service (EF-IMG-001) |
| `deleteCephLandmark.ts` | 64 | OK |
| `deleteFinding.ts` | 47 | DB ops bypass repo (EF-IMG-002) |
| `deleteImage.ts` | 50 | OK |
| `deleteMeasurement.ts` | 41 | OK |
| `getCephAnalysis.ts` | 71 | OK |
| `getCephReport.ts` | 65 | OK |
| `getImagingStudy.ts` | 43 | OK |
| `listCephLandmarks.ts` | 70 | OK |
| `listFindings.ts` | 46 | OK |
| `listMeasurements.ts` | 38 | OK |
| `listPatientImages.ts` | 109 | OK |
| `recomputeCephAnalysis.ts` | 80 | Business logic inline — needs service (EF-IMG-001) |
| `updateCephLandmark.ts` | 116 | Business logic inline — needs service (EF-IMG-001) |
| `updateFinding.ts` | 87 | DB ops bypass repo (EF-IMG-002) |
| `updateImageCalibration.ts` | 44 | OK |
| `updateImageModality.ts` | 39 | OK |

### PascalCase Shims (All ALLOWED)

| File | Lines | Delegates to |
|------|-------|--------------|
| `CephMgmt_batchUpsertCephLandmarks.ts` | 9 | `batchUpsertCephLandmarks` |
| `CephMgmt_createCephReport.ts` | 9 | `createCephReport` |
| `CephMgmt_deleteCephLandmark.ts` | 9 | `deleteCephLandmark` |
| `CephMgmt_getCephAnalysis.ts` | 9 | `getCephAnalysis` |
| `CephMgmt_getCephReport.ts` | 9 | `getCephReport` |
| `CephMgmt_listCephLandmarks.ts` | 9 | `listCephLandmarks` |
| `CephMgmt_recomputeCephAnalysis.ts` | 9 | `recomputeCephAnalysis` |
| `CephMgmt_updateCephLandmark.ts` | 9 | `updateCephLandmark` |
| `ImagingFindingsMgmt_createFinding.ts` | 19 | `createFinding` |
| `ImagingFindingsMgmt_deleteFinding.ts` | 19 | `deleteFinding` |
| `ImagingFindingsMgmt_listFindings.ts` | 19 | `listFindings` |
| `ImagingFindingsMgmt_updateFinding.ts` | 19 | `updateFinding` |
| `ImagingMgmt_createImagingStudy.ts` | 18 | `createImagingStudy` |
| `ImagingMgmt_createMeasurement.ts` | 19 | `createMeasurement` |
| `ImagingMgmt_deleteImage.ts` | 18 | `deleteImage` |
| `ImagingMgmt_deleteMeasurement.ts` | 19 | `deleteMeasurement` |
| `ImagingMgmt_getImagingStudy.ts` | 18 | `getImagingStudy` |
| `ImagingMgmt_listMeasurements.ts` | 19 | `listMeasurements` |
| `ImagingMgmt_updateImageCalibration.ts` | 19 | `updateImageCalibration` |
| `ImagingMgmt_updateImageModality.ts` | 18 | `updateImageModality` |
| `PatientImageMgmt_listPatientImages.ts` | 18 | `listPatientImages` |

### Repo / Schema Files

| File | Lines | Notes |
|------|-------|-------|
| `repos/imaging.repo.ts` | 209 | ✅ |
| `repos/imaging.schema.ts` | 140 | ✅ |
| `repos/imaging_ceph.repo.ts` | 205 | ✅ |
| `repos/imaging_ceph.schema.ts` | 154 | ✅ |
| `repos/imaging_finding.repo.ts` | 57 | Thin — missing update/delete ops (EF-IMG-002) |
| `repos/imaging_finding.schema.ts` | 85 | ✅ |

### Test Files

| File | Lines | Notes |
|------|-------|-------|
| `imaging.test.ts` | 1638 | Integration — full server |
| `ceph.test.ts` | 1270 | Integration — full server |
| `imaging-coverage.test.ts` | 1000 | Coverage sweep |
| `imaging-finding.fsm.property.test.ts` | 88 | FSM property test |
| `ceph-landmark.fsm.property.test.ts` | 80 | FSM property test |
