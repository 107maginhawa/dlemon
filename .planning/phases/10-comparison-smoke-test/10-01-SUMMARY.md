---
phase: "10"
plan: "10-01"
subsystem: imaging
tags: [comparison, offline, selection, IMG-17, IMG-18]
dependency_graph:
  requires: [phases/08, phases/09]
  provides: [ComparisonView, PatientImageList-checkbox, OfflinePlaceholder]
  affects: [_workspace/$patientId.tsx]
tech_stack:
  added: []
  patterns: [blob-objecturl-cleanup, checkbox-multiselect, conditional-pane-render]
key_files:
  created:
    - apps/dentalemon/src/features/imaging/components/comparison-view.tsx
  modified:
    - apps/dentalemon/src/features/imaging/components/patient-image-list.tsx
    - apps/dentalemon/src/routes/_workspace/$patientId.tsx
decisions:
  - "blob null → OfflinePlaceholder not passed to ImagingWorkspace (avoids broken canvas)"
  - "object URLs revoked on useEffect cleanup (both blobs)"
  - "checkbox onChange stopsPropagation; row content onClick still triggers preview"
metrics:
  duration: "~15 min"
  completed: "2026-05-11"
  tasks_completed: 4
  files_changed: 3
---

# Phase 10 Plan 01: ComparisonView + PatientImageList Selection + Offline Placeholder Summary

**One-liner:** Side-by-side X-ray comparison (IMG-17) with checkbox multi-select and degraded offline UX via gray placeholder when blob is null (IMG-18).

## What Was Built

### Task 1: ComparisonView (new file)
- `comparison-view.tsx` — two-pane flex layout with `ImagingWorkspace` per pane
- `OfflinePlaceholder` internal component: gray bg + `role="alert"` message
- `useEffect` on `[imageA.id, imageB.id, getCachedBlob]` — fetches both blobs in parallel via `Promise.all`, creates object URLs, tracks for cleanup
- Cleanup: `cancelled = true; objectUrls.forEach(URL.revokeObjectURL)` on unmount
- Loading state: `animate-pulse` skeleton; null state: `OfflinePlaceholder`; URL state: `ImagingWorkspace`
- Header: "Compare Images" + "✕ Exit Compare" button

### Task 2: PatientImageList checkbox selection
- Added `onCompare?: (items: [PatientImageItem, PatientImageItem]) => void` prop
- `selectedIds: Set<string>` state, max 2 enforced in `toggleSelect`
- Checkbox `onChange` with `stopPropagation` — separates from row content `onClick`
- "Compare ▶" button (lemon `#FFE97D`) visible only when `selectedIds.size === 2`
- `data-testid="compare-btn"` and `data-testid="select-image-{id}"` for testing

### Task 3: $patientId.tsx wiring
- Imported `ComparisonView`
- Added `comparisonItems` state alongside `selectedImageItem`
- `onCompare` wired: sets comparisonItems, clears selectedImageItem
- Right-pane conditional: ComparisonView > ImagingWorkspace > empty prompt
- Close handler clears all three: `imagingOpen`, `selectedImageItem`, `comparisonItems`

## Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| AC-1 | 2 selected → Compare ▶ visible | PASS |
| AC-2 | < 2 selected → Compare ▶ not visible | PASS |
| AC-3 | 3rd checkbox is no-op (max 2 guard) | PASS |
| AC-4 | ComparisonView two panes in flex row | PASS |
| AC-5 | Each pane labeled with fileName | PASS |
| AC-6 | Cached blob → ImagingWorkspace in pane | PASS |
| AC-7 | Null blob → placeholder + role="alert" | PASS |
| AC-8 | Object URLs revoked on unmount | PASS |
| AC-9 | Row click still opens single preview | PASS |
| AC-10 | TypeScript typecheck zero errors | PASS |
| AC-11 | IMG-17 side-by-side comparison | PASS |
| AC-12 | IMG-18 degraded offline UX | PASS |

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| 976318e | feat(10-01): comparison view + image selection + offline placeholder |

## Self-Check: PASSED

- `apps/dentalemon/src/features/imaging/components/comparison-view.tsx` — FOUND
- `apps/dentalemon/src/features/imaging/components/patient-image-list.tsx` — FOUND (modified)
- `apps/dentalemon/src/routes/_workspace/$patientId.tsx` — FOUND (modified)
- Commit 976318e — FOUND
- TypeScript typecheck — PASSED (exit code 0)
