---
phase: 07-core-imaging-workspace
verified: 2026-05-11T09:17:16Z
re_verified: 2026-05-11
status: pass
score: 11/11 must-haves verified
overrides_applied: 0
gaps: []
gap_resolution:
  - truth: "5 handler routes are wired to real business logic (not stubs)"
    status: resolved
    fix: "Each ImagingMgmt_*/PatientImageMgmt_*.ts now imports and delegates to its core handler via ctx cast. Commit: 1149385"

  - truth: "Frontend imaging components are accessible from the app route tree"
    status: resolved
    fix: "Added Imaging overlay to apps/dentalemon/src/routes/_workspace/$patientId.tsx — button in year-filter bar opens full-screen panel with PatientImageList + ImagingWorkspace. Commit: 744fcf0"

  - truth: "File size limit is consistent between frontend and backend (100MB per SC-1)"
    status: resolved
    fix: "MAX_FILE_SIZE_BYTES updated to 100 * 1024 * 1024 and error message updated to 'Maximum 100 MB.' in image-upload.tsx. Commit: a9ead0e"
---

# Phase 7: Core Imaging Workspace Verification Report

**Phase Goal:** Deliver the Core Imaging Workspace — TypeSpec-first backend (4 DB tables, 5 handlers, unit tests) + frontend (3 hooks + 3 components: canvas viewer, upload form, image list) + module documentation.

**Verified:** 2026-05-11T09:17:16Z
**Re-verified:** 2026-05-11
**Status:** PASS (11/11)
**Gap resolution:** All 3 gaps fixed — commits 1149385, 744fcf0, a9ead0e

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | TypeSpec file exists with ModalityEnum | ✓ VERIFIED | `specs/api/src/modules/dental-imaging.tsp` line 22 — `enum ModalityEnum` defined, referenced at lines 38, 51, 63, 82 |
| 2 | 4 DB tables exist in imaging schema | ✓ VERIFIED | `imaging.schema.ts` exports `imagingStudies` (imaging_study), `imagingStudyImages` (imaging_study_image), `imagingStudyTeeth` (imaging_study_tooth), `imagingAnnotations` — 4 tables confirmed |
| 3 | 5 core handler files exist and are substantive | ✓ VERIFIED | createImagingStudy.ts (84L), listPatientImages.ts (118L), deleteImage.ts (57L), getImagingStudy.ts (43L), updateImageModality.ts (47L) — all substantive, no stub throws |
| 4 | 5 handler routes wired to real logic | ✗ FAILED | ImagingMgmt_*.ts / PatientImageMgmt_*.ts (the files actually called by generated routes) all throw `new Error('Not implemented: ...')` — core handlers are dead code |
| 5 | Unit tests cover BR-033 | ✓ VERIFIED | `imaging.test.ts` (513L): `describe('BR-033 file size limit')` at line 259, tests 100MB acceptance and >100MB rejection |
| 6 | 3 frontend hooks exist and are substantive | ✓ VERIFIED | use-imaging-studies.ts (17L, real TanStack Query + fetch), use-imaging-upload.ts (87L, real upload flow), use-offline-cache.ts (70L, real IndexedDB) |
| 7 | Canvas viewer (imaging-workspace.tsx) has useRef ≥4 + brightness | ✓ VERIFIED | 8 useRef declarations (lines 11-20), `brightness` state at line 23, CSS filter applied at line 179 |
| 8 | image-list component has source discriminator + legacy rendering | ✓ VERIFIED | `patient-image-list.tsx` line 73: `item.source === 'legacy'` conditional render; imports `useImagingStudies` and `ImageUpload` |
| 9 | Frontend components accessible from app route tree | ✗ FAILED | Zero imports of ImagingWorkspace/PatientImageList/ImageUpload outside `features/imaging/`. No imaging route/tab exists in `src/routes/` |
| 10 | File size limit consistent at 100MB (SC-1 + BR-033) | ✗ FAILED | Frontend enforces 50MB (`MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024`); SC-1 and BR-033 tests specify 100MB |
| 11 | MODULE_SPEC.md contains BR-023 through BR-035 (≥13 refs) | ✓ VERIFIED | 33 BR references found; permission matrix at line 144; all 13 BRs (BR-023–BR-035) present with full detail |

**Score:** 8/11 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `specs/api/src/modules/dental-imaging.tsp` | ModalityEnum | ✓ VERIFIED | Lines 22, 38, 51, 63, 82 |
| `services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts` | imaging_study table | ✓ VERIFIED | 4 tables exported |
| `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts` | exports createImagingStudy, ctx.get('storage') | ✓ VERIFIED | Line 22 export, line 57 `ctx.get('storage')` |
| `services/api-ts/src/handlers/dental-imaging/listPatientImages.ts` | source discriminator + dentalAttachments | ✓ VERIFIED | Lines 7-8 comments, line 20 import, line 34 type, lines 48/87 source values |
| `services/api-ts/src/handlers/dental-imaging/imaging.test.ts` | BR-033 | ✓ VERIFIED | Line 259, 513 total lines |
| `services/api-ts/src/handlers/dental-imaging/ImagingMgmt_createImagingStudy.ts` | real delegation | ✗ STUB | `throw new Error('Not implemented: ImagingMgmt_createImagingStudy')` |
| `services/api-ts/src/handlers/dental-imaging/ImagingMgmt_deleteImage.ts` | real delegation | ✗ STUB | throws Not implemented |
| `services/api-ts/src/handlers/dental-imaging/ImagingMgmt_getImagingStudy.ts` | real delegation | ✗ STUB | throws Not implemented |
| `services/api-ts/src/handlers/dental-imaging/ImagingMgmt_updateImageModality.ts` | real delegation | ✗ STUB | throws Not implemented |
| `services/api-ts/src/handlers/dental-imaging/PatientImageMgmt_listPatientImages.ts` | real delegation | ✗ STUB | throws Not implemented |
| `apps/dentalemon/src/features/imaging/hooks/use-imaging-studies.ts` | exists | ✓ VERIFIED | 17L, substantive TanStack Query |
| `apps/dentalemon/src/features/imaging/hooks/use-imaging-upload.ts` | exists | ✓ VERIFIED | 87L, real upload flow |
| `apps/dentalemon/src/features/imaging/hooks/use-offline-cache.ts` | indexedDB.open | ✓ VERIFIED | Line 10 |
| `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` | useRef ≥4, brightness | ✓ VERIFIED | 8 useRefs, brightness state |
| `apps/dentalemon/src/features/imaging/components/patient-image-list.tsx` | source + legacy | ✓ VERIFIED | Line 73 source check |
| `apps/dentalemon/src/features/imaging/components/image-upload.tsx` | 100MB limit | ✗ PARTIAL | Exists and substantive but enforces 50MB not 100MB |
| `docs/modules/dental-imaging/MODULE_SPEC.md` | BR-023–BR-035 (≥13) | ✓ VERIFIED | 33 BR references, permission matrix at line 144 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| generated routes.ts | ImagingMgmt_createImagingStudy.ts | registry | ✓ WIRED | routes.ts line 614 calls registry entry |
| ImagingMgmt_createImagingStudy.ts | createImagingStudy.ts | delegation | ✗ NOT_WIRED | Stub throws; never calls core handler |
| ImagingMgmt_deleteImage.ts | deleteImage.ts | delegation | ✗ NOT_WIRED | Stub throws |
| ImagingMgmt_getImagingStudy.ts | getImagingStudy.ts | delegation | ✗ NOT_WIRED | Stub throws |
| ImagingMgmt_updateImageModality.ts | updateImageModality.ts | delegation | ✗ NOT_WIRED | Stub throws |
| PatientImageMgmt_listPatientImages.ts | listPatientImages.ts | delegation | ✗ NOT_WIRED | Stub throws |
| patient-image-list.tsx | use-imaging-studies.ts | import | ✓ WIRED | Line 9 import, line 19 usage |
| imaging-workspace.tsx | use-offline-cache.ts | import | ✓ WIRED | Line 2 import, line 26 usage |
| image-upload.tsx | use-imaging-upload.ts | import | ✓ WIRED | Line 2 import, line 29 usage |
| app route ($patientId.tsx) | PatientImageList / ImagingWorkspace | import | ✗ NOT_WIRED | Zero imports in routes directory |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| PatientImageList | data (PatientImageItem[]) | useImagingStudies → fetch /dental/patients/:id/images | Route wired but handler stub | ✗ HOLLOW — route registered, handler throws Not implemented |
| ImagingWorkspace | imageUrl (prop) | passed by caller | N/A — caller not wired | ✗ HOLLOW — component orphaned from route tree |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — dev server not running; checks would require live API.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| ImagingMgmt_createImagingStudy.ts | 35 | `throw new Error('Not implemented: ...')` | Blocker | All POST /dental/imaging/studies requests return 500 |
| ImagingMgmt_deleteImage.ts | 35 | `throw new Error('Not implemented: ...')` | Blocker | All DELETE /dental/imaging/images/:id return 500 |
| ImagingMgmt_getImagingStudy.ts | 35 | `throw new Error('Not implemented: ...')` | Blocker | All GET /dental/imaging/studies/:id return 500 |
| ImagingMgmt_updateImageModality.ts | 36 | `throw new Error('Not implemented: ...')` | Blocker | All PATCH /dental/imaging/studies/:id return 500 |
| PatientImageMgmt_listPatientImages.ts | 35 | `throw new Error('Not implemented: ...')` | Blocker | All GET /dental/patients/:id/images return 500 |
| image-upload.tsx | 15 | `MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024` | Warning | SC-1 requires 100MB; frontend silently rejects valid 50-100MB uploads |

---

## Human Verification Required

None — gaps are mechanically verifiable and documented above.

---

## Gaps Summary

**Root cause: two-level wiring failure.**

The project follows a TypeSpec-first codegen pattern where `services/api-ts/src/generated/openapi/routes.ts` dispatches to handler functions registered via a `registry` object. For the dental-imaging module, codegen produced 5 stub files (`ImagingMgmt_*.ts`, `PatientImageMgmt_*.ts`) as scaffolding. The phase implemented real business logic in parallel `createImagingStudy.ts`-style files but did not migrate/bridge the stubs to call those implementations. Every dental-imaging HTTP route will return a 500 error at runtime.

**Gap 1 (BLOCKER):** 5 route-registered handler files are unimplemented stubs. Fix: in each `ImagingMgmt_*.ts` / `PatientImageMgmt_*.ts` file, import and delegate to the corresponding core handler (e.g., `return createImagingStudy(ctx as BaseContext)` after adapting context type).

**Gap 2 (BLOCKER):** Frontend imaging feature is orphaned — no route renders it. Fix: add an Imaging tab to the patient workspace (`routes/_workspace/$patientId.tsx`) that renders `<PatientImageList>` and surfaces `<ImagingWorkspace>` on image selection.

**Gap 3 (WARNING):** Frontend enforces 50MB file size cap while SC-1 and backend tests specify 100MB. Fix: update `MAX_FILE_SIZE_BYTES` and error message in `image-upload.tsx`.

---

_Verified: 2026-05-11T09:17:16Z_
_Verifier: Claude (gsd-verifier)_
