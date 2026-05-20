# Phase 2: Core Imaging Workspace — Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Mode:** Smart Discuss (autonomous)

<domain>
## Phase Boundary

Upload X-rays, view with basic tools, link to patient/visit/tooth chart — offline-capable.
This is the largest phase: full backend (TypeSpec + 4 DB tables + 5 handlers) + frontend
(Canvas viewer + upload form + image list with legacy adapter).

**Requirements:** IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, IMG-06, IMG-18
**Dependencies:** Phase 1 (Canvas PASS assumed) + Phase 1.5 (multipart upload + imagingTier) — both complete ✅

**Success Criteria:**
1. Upload JPEG/PNG/TIFF/BMP X-ray up to 100MB via chunked upload
2. Image displays with zoom, pan, rotate, flip, brightness/contrast
3. Image linked to patient, visit, tooth number(s), modality (non-nullable, default 'other')
4. Union adapter: legacy dental_attachment X-rays appear alongside imaging_study records (source: 'imaging' | 'legacy')
5. Offline: IndexedDB caches image blobs + annotation JSON
6. Audit docs (MODULE_SPEC.md, BR-023–035, permission matrix) bundled

</domain>

<decisions>
## Implementation Decisions

### Backend (from eng review D1-D10):

**Schema (4 tables in `services/api-ts/src/handlers/dental-imaging/repos/`):**
- `imaging_study` — patient_id, visit_id (nullable), branch_id, acquired_by, modality enum (non-nullable, default 'other'), status ('active'|'archived')
- `imaging_study_image` — study_id FK, file_id FK (stored_file), pixel_spacing_mm nullable, sequence_number, dicom_metadata JSONB nullable
- `imaging_study_tooth` — image_id FK, tooth_number, numbering_system (JOIN TABLE, not JSONB array)
- `imaging_annotation` — image_id FK, type enum, geometry JSONB (Zod discriminated union), measurement_value nullable, measurement_unit nullable, tooth_number nullable, visible bool

**Modality enum (D10 — non-nullable):** 'periapical' | 'bitewing' | 'panoramic' | 'cephalometric' | 'intraoral_photo' | 'extraoral_photo' | 'other'

**TypeSpec:** New module `specs/api/src/modules/dental-imaging.tsp` — add to main.tsp after dental-clinical.tsp

**Handlers (5):**
- `createImagingStudy.ts` — BR-033 (100MB), BR-034 (format: jpeg/png/tiff/bmp only)
- `getImagingStudy.ts` — viewer data + branch isolation (assertBranchAccess)
- `listPatientImages.ts` — union adapter: dental_attachment (xray/photo/scan) + imaging_study, with `source` discriminator (D8)
- `deleteImage.ts` — soft-delete (status='archived'), default-deny roles (BR-026, BR-027)
- `updateImageModality.ts` — reclassify post-upload

**Permission matrix (default-deny — prior learning applied):**
```
if (!role || !allowedRoles.includes(role)) throw new ForbiddenError(...)
```
| Action | Dentist | Associate | Hygienist | Front Desk |
|--------|---------|-----------|-----------|------------|
| Upload | Yes | Yes | Yes | No |
| View | Yes | Yes | Yes | Yes (own branch) |
| Delete images | Yes | Own only | No | No |

**Union adapter mapping (dental_attachment → imaging):**
- `imageType='xray'` → `modality='other'` (legacy has no modality precision)
- `imageType='photo'` → `modality='intraoral_photo'`
- `imageType='scan'` → `modality='other'`
- `source` field: 'imaging' for imaging_study records, 'legacy' for dental_attachment

**Shared utilities to reuse:**
- `assertBranchAccess` from `@/handlers/shared/assert-branch-access`
- `UnauthorizedError`, `NotFoundError`, `ForbiddenError` from `@/core/errors`

**Composite index on imaging_annotation:** `(image_id, visible)` — prevents full table scan

### Frontend:

**Location:** `apps/dentalemon/src/features/imaging/`

**Grey Area: Offline storage — Tauri FS not available in dentalemon**
**Question:** Implementation plan says "Tauri FS stores image blobs locally" but dentalemon is a web app without Tauri.
**Proposed answer:** Use `IndexedDB` (via idb library or raw IndexedDB API) for both image blob caching AND annotation JSON. IndexedDB supports Blob storage. This achieves the same offline-first goal without Tauri. Annotation metadata also cached in IndexedDB. On load: check IndexedDB first, fall back to API fetch + re-cache.
**Grey Area Resolution:** IndexedDB for all offline storage. Service Worker is out of scope for Phase 2 (adds complexity). Simple hook: `use-offline-cache.ts` wrapping IndexedDB.

**Components:**
- `imaging-workspace.tsx` — main viewer (Canvas-based, builds on canvas-benchmark patterns)
- `image-upload.tsx` — upload form (modality select, tooth picker, progress bar via chunked upload)
- `patient-image-list.tsx` — unified list from union adapter, badge for legacy records

**Hooks:**
- `use-imaging-studies.ts` — TanStack Query, hits union endpoint
- `use-imaging-upload.ts` — chunked multipart upload with progress tracking
- `use-offline-cache.ts` — IndexedDB read/write for image blobs and annotation JSON

**Canvas viewer features (Phase 2 scope — IMG-02, IMG-03, IMG-04):**
- Zoom: mouse wheel / pinch
- Pan: click-drag
- Rotate: 90° CW/CCW buttons
- Flip: horizontal flip button
- Brightness/contrast: range sliders (CSS filter on canvas container OR canvas pixel manipulation)
- Full-screen: Fullscreen API

**Grey Area: Brightness/contrast implementation**
**Proposed answer:** CSS filter (`brightness()` + `contrast()`) applied to the canvas element. This is GPU-accelerated and avoids pixel-by-pixel manipulation. Simple and effective for Phase 2. Phase 3 (annotation) will need canvas-level access, but filters can be applied at the container level.

### Audit Docs:
- `docs/modules/dental-imaging/MODULE_SPEC.md` — module spec (business rules BR-023–035, permission matrix)
- Created alongside the code, not as a separate task

</decisions>

<code_context>
## Existing Code Insights

### dental_attachment (legacy source for union adapter):
```typescript
export const dentalAttachmentImageTypeEnum = pgEnum('dental_attachment_image_type', [
  'xray', 'photo', 'scan', 'document', 'other'
])
// imageType column on dental_attachment table
// toothNumbers: jsonb tooth_numbers.$type<number[]>()
// fileName, filePath, fileSizeBytes, mimeType
```

### assertBranchAccess:
- Location: `services/api-ts/src/handlers/shared/assert-branch-access.ts`
- Use in all imaging handlers for branch isolation

### main.tsp imports dental-imaging.tsp needs to go AFTER dental-clinical.tsp

### TypeSpec build → codegen → handlers (MANDATORY order per CLAUDE.md):
```bash
cd specs/api && bun run build
cd services/api-ts && bun run generate
cd services/api-ts && bun run db:generate  # for schema changes
```

### Test pattern (from uploadFile.test.ts):
- `buildTestApp()` with mock storage/logger/db
- `bun:mock` for mocking
- Per-BR describe blocks

### Canvas benchmark (from Phase 1):
- Location: `apps/dentalemon/src/features/imaging/spike/canvas-benchmark.tsx`
- Patterns: offscreen canvas, RAF loop, `drawAnnotations` function — reuse in imaging-workspace.tsx

### Existing workspace component pattern:
- Located at `apps/dentalemon/src/features/workspace/components/dental/`

</code_context>

<specifics>
## Specific Ideas

- `imaging-workspace.tsx` should accept an `imageUrl` prop and load the image into a canvas
  element using `drawImage`. Zoom/pan state kept in `useRef` for performance (not useState)
- Brightness/contrast via CSS filter string `brightness(${b}) contrast(${c})` on the canvas wrapper div
- The `use-imaging-upload.ts` hook should expose `{ progress, upload, isUploading }` — calls
  multipart initiate → part uploads → complete. On error: calls abort endpoint.
- Module spec doc format: follows existing docs/modules/ pattern if any, otherwise create it

</specifics>
