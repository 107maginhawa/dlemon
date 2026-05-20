---
phase: "07-core-imaging-workspace"
plan: "07-01"
subsystem: "dental-imaging"
tags: ["imaging", "typespec", "drizzle", "tdd", "storage", "union-adapter"]
dependency_graph:
  requires:
    - "dental-clinical (dental_attachment schema for legacy union)"
    - "storage handler (StorageProvider interface)"
    - "shared/assert-branch-access"
  provides:
    - "dental-imaging TypeSpec module + OpenAPI routes"
    - "4 Drizzle tables: imaging_study, imaging_study_image, imaging_study_tooth, imaging_annotation"
    - "5 handlers: createImagingStudy, getImagingStudy, listPatientImages, deleteImage, updateImageModality"
    - "ImagingRepository"
    - "Union adapter pattern (imaging + legacy dental_attachment)"
  affects:
    - "specs/api/dist/openapi/openapi.json (new Dental:Imaging tag + 5 endpoints)"
    - "services/api-ts/src/generated/ (routes, validators, registry updated)"
    - "Database schema (migration 0020)"
tech_stack:
  added:
    - "pgEnum: imaging_modality (7 values), imaging_status, imaging_annotation_type"
    - "date-fns addMinutes (used in presigned URL expiry)"
    - "uuid v4 for fileId generation"
  patterns:
    - "union adapter: imaging_study_image UNION dental_attachment with source discriminator"
    - "soft-delete: status='archived' instead of hard delete"
    - "role-gated delete: dentist=any, associate=own-only (BR-027), hygienist=forbidden"
    - "MIME allowlist: ALLOWED_IMAGING_MIME_TYPES constant (BR-034)"
key_files:
  created:
    - "specs/api/src/modules/dental-imaging.tsp"
    - "services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts"
    - "services/api-ts/src/handlers/dental-imaging/repos/imaging.repo.ts"
    - "services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts"
    - "services/api-ts/src/handlers/dental-imaging/getImagingStudy.ts"
    - "services/api-ts/src/handlers/dental-imaging/listPatientImages.ts"
    - "services/api-ts/src/handlers/dental-imaging/deleteImage.ts"
    - "services/api-ts/src/handlers/dental-imaging/updateImageModality.ts"
    - "services/api-ts/src/handlers/dental-imaging/imaging.test.ts"
    - "services/api-ts/src/generated/migrations/0020_bored_master_chief.sql"
  modified:
    - "specs/api/src/main.tsp (import + ImagingMgmt/PatientImageMgmt interfaces)"
    - "services/api-ts/src/generated/openapi/routes.ts"
    - "services/api-ts/src/generated/openapi/validators.ts"
    - "services/api-ts/src/generated/openapi/registry.ts"
decisions:
  - "ModalityEnum uses 7 values matching plan spec exactly: periapical|bitewing|panoramic|cephalometric|intraoral_photo|extraoral_photo|other"
  - "imaging_study_tooth is a JOIN TABLE (not JSONB), enabling indexed queries by tooth number"
  - "listPatientImages exports mapLegacyAttachment() for direct unit-test coverage of union adapter mapping"
  - "BR-026/BR-027 default-deny: only dentist+associate in ROLES_ALLOWED_TO_DELETE; associate further restricted to acquiredBy===user.id"
  - "Test mock uses Drizzle table column presence (personId/studyId/patientId) to route select() responses"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-05-11"
  tasks_completed: 2
  files_created: 10
  files_modified: 4
---

# Phase 7 Plan 01: TypeSpec + DB Schema + 5 Handlers Summary

JWT-authenticated dental imaging backend: TypeSpec-first, 4 Drizzle tables, 5 handlers, presigned-upload pattern, union adapter bridging new imaging studies with legacy dental_attachment rows.

## What Was Built

### Task 1: TypeSpec module + Drizzle schema (TDD)

- `dental-imaging.tsp`: `ModalityEnum` (7 values), `ImagingStudy`, `ImagingStudyImage`, `PatientImageItem` with `source: 'imaging' | 'legacy'` discriminator, CRUD operation interfaces
- `main.tsp`: import after `dental-billing.tsp`, `ImagingMgmt` + `PatientImageMgmt` interfaces with `Dental:Imaging` tag
- `imaging.schema.ts`: 4 tables — `imaging_study`, `imaging_study_image`, `imaging_study_tooth` (JOIN TABLE), `imaging_annotation` (JSONB geometry, composite index on `image_id + visible`)
- Migration `0020_bored_master_chief.sql`: 4 tables, FK constraints, `imaging_annotation_image_visible_idx`
- Codegen: updated routes/validators/registry with 5 new endpoints

### Task 2: 5 handlers + repository + unit tests (TDD)

**ImagingRepository** (`imaging.repo.ts`): createStudy, findStudyById, createImage, findImageById, listImagesByStudy, archiveImage (soft-delete), updateModality, addToothLink, listTeethByImage, listImagingImagesForPatient (JOIN query).

**createImagingStudy**: BR-034 MIME allowlist check first, role gate (dentist/associate/hygienist), assertBranchAccess, creates study, generates presigned upload URL via `ctx.get('storage')`, returns `{ study, uploadUrl, uploadMethod:'PUT', fileId, expiresAt }` with 201.

**getImagingStudy**: findStudyById → assertBranchAccess using study.branchId → fetch images → fetch tooth links per image → return `{ ...study, images: [{...image, toothNumbers}] }`.

**listPatientImages**: union adapter — imaging rows (`source:'imaging'`) + dental_attachment rows where `imageType IN ('xray','photo','scan')` (`source:'legacy'`), sorted by `createdAt DESC`. Mapping: xray→`other`, photo→`intraoral_photo`, scan→`other`.

**deleteImage**: fetch image → fetch study → assertBranchAccess → role check (BR-026: hygienist/front_desk forbidden) → BR-027: associate only deletes `acquiredBy===user.id` → `archiveImage()` (status='archived').

**updateImageModality**: fetch image → fetch study → assertBranchAccess → role check (dentist/associate/hygienist) → updateModality.

## Verification Results

```
bun run build (specs/api)   → EXIT 0, Compilation completed successfully
bun run generate (api-ts)   → EXIT 0, Code generation complete
migration 0020              → imaging_study, imaging_study_image, imaging_study_tooth, imaging_annotation + composite index
bun test imaging.test.ts    → 12 pass, 0 fail
bun run typecheck            → 0 errors
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mock DB routing by table column presence**
- **Found during:** Task 2 GREEN phase
- **Issue:** Initial mock returned membership rows for all `select().from().where().limit()` calls, including `findImageById`/`findStudyById`, causing `study.acquiredBy` to be undefined in the BR-027 associate test
- **Fix:** Mock detects table type by checking Drizzle column presence (`personId`=membership, `studyId`=imaging_image, `patientId`=imaging_study) and routes results accordingly
- **Files modified:** `imaging.test.ts`
- **Commit:** e7a218b

**2. [Rule 2 - Critical] TypeSpec CreateImagingStudyResponse model**
- **Found during:** Task 1
- **Issue:** Plan's TypeSpec snippet showed `createImagingStudy` returning `ImagingStudy | ErrorResponse`, but the handler returns `{ study, uploadUrl, uploadMethod, fileId, expiresAt }` — the plan's TypeSpec didn't model the presigned URL response
- **Fix:** Added `CreateImagingStudyResponse` model to TypeSpec with all fields the handler returns; avoids lying about the API contract
- **Files modified:** `dental-imaging.tsp`
- **Commit:** dd73e31

## Known Stubs

None — all handlers are fully wired to the repository and storage provider.

## Threat Flags

No new trust boundaries beyond the plan's threat model. All T-07-01 through T-07-05 mitigations implemented:
- T-07-01: UnauthorizedError on `!user?.id` in every handler
- T-07-02: BR-034 MIME allowlist before any DB/storage operation
- T-07-03: assertBranchAccess in listPatientImages (branch check via first study)
- T-07-04: Default-deny role check in deleteImage
- T-07-05: `study.acquiredBy === user.id` guard for associate role

## Self-Check: PASSED
