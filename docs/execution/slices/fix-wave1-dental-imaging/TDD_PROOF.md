# TDD_PROOF — fix-wave1-dental-imaging

## Fixes Applied

### EF-IMG-010 — fileSizeBytes:0 stub removed
**Commit**: 30b592a7

**Files changed**:
- `services/api-ts/src/handlers/dental-imaging/repos/imaging.repo.ts`
  — Added `import { storedFiles } from '@/handlers/storage/repos/file.schema'`
  — `listImagingImagesForPatient` now LEFT JOINs `stored_file` on `fileId = id`
  — Selects `storedFiles.size` as `fileSizeBytes`; falls back to `0` when row absent
  — Return type updated to include `fileSizeBytes: number`
- `services/api-ts/src/handlers/dental-imaging/listPatientImages.ts`
  — `fileSizeBytes: 0` stub replaced with `row.fileSizeBytes` from repo result
  — Also reads `meta?.mimeType` from dicomMetadata (bonus: was always empty string)

### EF-IMG-011 — assertBranchAccess → assertBranchRole in updateImageCalibration
**Commit**: d1ddb7ff

**Files changed**:
- `services/api-ts/src/handlers/dental-imaging/updateImageCalibration.ts`
  — Import changed from `assertBranchAccess` to `assertBranchRole`
  — Call changed to `assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate'])`
  — Aligns with all other write handlers in dental-imaging module

## Verification

`bun run typecheck` — 0 errors in modified files (pre-existing errors in unrelated test files are unchanged).

Pattern audit summary (dental-imaging):
- READ handlers (get*, list*): `assertBranchAccess` — correct
- WRITE handlers (create*, update*, delete*, batch*, recompute*): `assertBranchRole(['dentist_owner','dentist_associate'])` — now fully consistent after EF-IMG-011
