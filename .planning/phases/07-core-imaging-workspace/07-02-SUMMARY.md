---
phase: "07-core-imaging-workspace"
plan: "07-02"
subsystem: "dental-imaging-frontend"
tags: ["imaging", "react", "canvas", "tanstack-query", "indexeddb", "upload"]
dependency_graph:
  requires:
    - "07-01 (PatientImageItem type from @monobase/api-spec/types, /dental/imaging/studies endpoint)"
    - "apps/dentalemon/src/components/sheet.tsx (shadcn Sheet)"
    - "@tanstack/react-query (already in app dependencies)"
  provides:
    - "useImagingStudies — TanStack Query hook for listPatientImages union endpoint"
    - "useImagingUpload — presigned upload with progress tracking and abort"
    - "useOfflineCache — raw IndexedDB read/write for blobs and annotation JSON"
    - "ImagingWorkspace — canvas viewer with zoom/pan/rotate/flip/brightness/contrast/fullscreen"
    - "ImageUpload — upload form with modality selector, tooth picker, drag-and-drop, progress bar"
    - "PatientImageList — unified image list with Legacy badge, Sheet upload trigger"
  affects:
    - "apps/dentalemon/src/features/imaging/hooks/ (3 new files)"
    - "apps/dentalemon/src/features/imaging/components/ (3 new files)"
tech_stack:
  added: []
  patterns:
    - "zoom/pan state in useRef (not useState) — no re-render on every pan/zoom event"
    - "CSS filter brightness/contrast on canvas wrapper div (GPU-accelerated)"
    - "IndexedDB via raw indexedDB.open — no external library"
    - "presigned upload: POST /dental/imaging/studies → PUT to storage URL → DELETE abort on error"
    - "union adapter display: source:'imaging'|'legacy' discriminator drives Legacy badge"
    - "Sheet from @/components/sheet (not @/components/ui/sheet)"
key_files:
  created:
    - "apps/dentalemon/src/features/imaging/hooks/use-imaging-studies.ts"
    - "apps/dentalemon/src/features/imaging/hooks/use-imaging-upload.ts"
    - "apps/dentalemon/src/features/imaging/hooks/use-offline-cache.ts"
    - "apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx"
    - "apps/dentalemon/src/features/imaging/components/image-upload.tsx"
    - "apps/dentalemon/src/features/imaging/components/patient-image-list.tsx"
  modified: []
decisions:
  - "PatientImageItem imported from @monobase/api-spec/types (generated in 07-01) and re-exported from use-imaging-studies for downstream use"
  - "Sheet import path is @/components/sheet (not @/components/ui/sheet) — matches actual file at apps/dentalemon/src/components/sheet.tsx"
  - "File size validation (50 MB max) added inline in ImageUpload as Rule 2 critical security measure"
  - "drag-and-drop added to ImageUpload (Rule 2 — plan spec mentioned it in the must_haves)"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-05-11"
  tasks_completed: 2
  files_created: 6
  files_modified: 0
---

# Phase 7 Plan 02: Frontend Hooks + Components Summary

Canvas viewer with 6 clinical tools, presigned upload with progress/abort, and unified image list bridging new imaging studies with legacy dental_attachment records — all backed by IndexedDB offline caching via raw browser API.

## What Was Built

### Task 1: Three hooks

**use-imaging-studies.ts** — TanStack Query wrapper for `GET /dental/patients/:id/images`. Returns `{ items: PatientImageItem[], total }`. `staleTime: 30_000`. Re-exports `PatientImageItem` type from `@monobase/api-spec/types`.

**use-imaging-upload.ts** — Presigned upload flow: POST `/dental/imaging/studies` → PUT to `uploadUrl` → returns `{ studyId }`. `AbortController` ref enables `abort()`. On error calls `DELETE /storage/multipart/{fileId}/abort` for cleanup. Exposes `{ progress, upload, isUploading, abort }`.

**use-offline-cache.ts** — Raw `indexedDB.open` (no idb library). Two object stores: `image-blobs` (keyPath: `id`) and `annotations` (keyPath: `imageId`). Exposes `{ getCachedBlob, setCachedBlob, getCachedAnnotations, setCachedAnnotations }` — all `useCallback` memoized.

### Task 2: Three components

**imaging-workspace.tsx** — Canvas viewer. `scaleRef`, `offsetRef`, `rotationRef`, `flipRef`, `isDraggingRef`, `lastPosRef` all in `useRef` — zero re-renders on pan/zoom. `brightness`/`contrast` in `useState` (CSS filter on wrapper div). Wheel zoom (passive: false), mouse drag pan, rotate CCW/CW buttons, horizontal flip, fullscreen via `requestFullscreen()`. IndexedDB lookup before network fetch; caches blob after first load.

**image-upload.tsx** — 7 modality options (`periapical`, `bitewing`, `panoramic`, `cephalometric`, `intraoral_photo`, `extraoral_photo`, `other`). Tooth number input (1–32). File input + drag-and-drop zone. Inline validation errors for type (JPEG/PNG/TIFF/BMP) and size (50 MB max). Progress bar driven by `useImagingUpload`. Cancel button during upload.

**patient-image-list.tsx** — Calls `useImagingStudies(patientId)`. "Upload Image" button opens `Sheet` (320px right side) containing `ImageUpload`. On upload success: closes sheet, refetches list. `source === 'legacy'` items render a "Legacy" badge with lemon tint (`rgba(255,233,125,0.15)` / `#4A4018`).

## Verification Results

```
bun run typecheck   → 0 errors
useRef count        → 10 refs in imaging-workspace (scaleRef, offsetRef, rotationRef, flipRef,
                      imgRef, isDraggingRef, lastPosRef, canvasRef, containerRef + render useCallback)
brightness usage    → 4 occurrences (state, setter, CSS filter, slider)
indexedDB.open      → 1 occurrence (raw API, no external dep)
Legacy badge        → 1 conditional render on source === 'legacy'
Modality options    → 7 (all ModalityEnum values)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] File size validation added to ImageUpload**
- **Found during:** Task 2 implementation
- **Issue:** Plan's threat model (T-07-F01) specifies client-side validation before submit; plan text mentioned file size but ImageUpload spec only showed type check. 50 MB limit added per BR-034 defense-in-depth.
- **Fix:** `validateFile()` checks both MIME type and file size; error shown inline on file selection and on submit
- **Files modified:** `image-upload.tsx`
- **Commit:** d468df7

**2. [Rule 3 - Blocking] Sheet import path corrected**
- **Found during:** Task 2 — writing patient-image-list.tsx
- **Issue:** Plan showed `@/components/ui/sheet` but actual file is `@/components/sheet` (no `ui/` subdirectory)
- **Fix:** Import from `@/components/sheet`
- **Files modified:** `patient-image-list.tsx`
- **Commit:** d468df7

## Known Stubs

None — all hooks fetch from real API endpoints matching 07-01 handlers. Components render real data or explicit loading/error states.

## Threat Flags

No new trust boundaries beyond the plan's threat model. T-07-F01 client-side MIME + size check implemented as required.

## Self-Check: PASSED
