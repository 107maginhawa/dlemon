---
phase: 08-p0-measurement-tools
plan: "02"
subsystem: dental-imaging
tags: [imaging, measurements, svg-overlay, calibration, tanstack-query, playwright]
dependency_graph:
  requires:
    - 08-01 (measurement API endpoints)
  provides:
    - MeasurementToolbar component
    - CalibrationDialog component
    - useMeasurements hook
    - SVG overlay in ImagingWorkspace
  affects:
    - apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx
tech_stack:
  added: []
  patterns:
    - TanStack Query optimistic create/delete with rollback
    - SVG overlay (absolute inset-0) sibling to canvas element
    - aria-pressed for tool button active state
    - noUncheckedIndexedAccess-safe array access via non-null assertions after length guards
key_files:
  created:
    - apps/dentalemon/src/features/imaging/hooks/use-measurements.ts
    - apps/dentalemon/src/features/imaging/components/measurement-toolbar.tsx
    - apps/dentalemon/src/features/imaging/components/calibration-dialog.tsx
    - apps/dentalemon/tests/e2e/imaging-measurement.spec.ts
  modified:
    - apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx
decisions:
  - SVG overlay uses absolute inset-0 sibling to canvas; pointerEvents:none when toolMode=none preserving canvas pan
  - aria-pressed attribute used for tool active state (accessible + testable)
  - noUncheckedIndexedAccess requires explicit non-null assertion after length guards (not destructuring)
  - Panoramic warning rendered via role=alert div (not Badge variant) to avoid missing variant
  - Area tool uses double-click to close polygon
metrics:
  duration: "12 minutes"
  completed: "2026-05-11T10:15:00Z"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 08 Plan 02: Measurement Tools UI Summary

SVG-based measurement tools (distance, angle, area, calibration) wired into ImagingWorkspace via absolute SVG overlay, TanStack Query optimistic mutations, and shadcn Dialog/Badge components.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | use-measurements hook + MeasurementToolbar + CalibrationDialog | b3339c9 | Done |
| 2 | Extend ImagingWorkspace with SVG overlay + E2E spec | 4f06c45 | Done |

## What Was Built

**use-measurements.ts**: TanStack Query hook with `useQuery` (GET measurements) + two `useMutation`s (POST create, DELETE remove), both with optimistic cache updates and rollback on error.

**measurement-toolbar.tsx**: 4 buttons (Calibrate/Distance/Angle/Area) with `aria-pressed`, active highlight (`bg-zinc-600 ring-1 ring-white`), green "Calibrated" badge when `isCalibrated`, yellow panoramic warning (`role="alert"`) when `modality==='panoramic' && toolMode !== 'none'` (BR-024).

**calibration-dialog.tsx**: shadcn Dialog, number input with `min=0.1 step=0.01`, Enter key support, disabled Confirm when value ≤ 0 (T-08-07 mitigation: division-by-zero prevention).

**imaging-workspace.tsx** extended:
- New props: `toolMode`, `onToolModeChange`, `onMeasurementSaved`, `modality`, `pixelSpacingMm`, `onCalibrationSaved`
- `<svg data-testid="measurement-svg-overlay">` absolute sibling to canvas; `pointerEvents: none` when `toolMode === 'none'` — pan/zoom unaffected
- `MeasurementShape` sub-component renders line/angle/polygon from persisted annotations with delete handles
- `DrawingPreview` sub-component renders dashed in-progress ghost shape
- `handleSvgClick`: 2-click distance/calibration, 3-click angle, multi-click area (double-click closes)
- Calibration: PATCH `/dental/imaging/images/{imageId}/calibration`, stores `pixelSpacingMm`, shows "Calibrated" badge

**imaging-measurement.spec.ts**: Playwright E2E spec with 7 test cases covering toolbar buttons, aria-pressed state, single-active tool constraint, panoramic warning, SVG overlay presence/cursor, calibration dialog open flow.

## Deviations from Plan

**[Rule 1 - Bug] noUncheckedIndexedAccess TS errors on array destructuring**
- Found during: Task 2 typecheck
- Issue: `const [p1, p2] = pts` after length guard still triggered TS18048 under strict config
- Fix: Replaced destructuring with `pts[0]!` / `pts[1]!` etc. after explicit length guards
- Files: `imaging-workspace.tsx`
- Commit: 4f06c45

**[Rule 2 - Missing validation] CalibrationDialog confirm disabled when value ≤ 0**
- Per threat model T-08-07: client validates `actualMm > 0` before PATCH (division by zero prevention)
- Added `disabled={!value || parseFloat(value) <= 0}` on Confirm button
- Commit: b3339c9

**Checkpoint skipped (per executor instructions)**
- Task 3 was `checkpoint:human-verify` — replaced with Playwright E2E spec per executor prompt instructions

## Known Stubs

None — all measurement flows are wired to real API endpoints from Plan 01.

## Threat Flags

None — T-08-07 (division by zero in calibration) mitigated client-side. T-08-09 (cross-patient visibility) mitigated via imageId-scoped query key + server-enforced branch access from Plan 01.

## Self-Check: PASSED

- b3339c9 exists: ✓ (3 files created)
- 4f06c45 exists: ✓ (2 files modified/created)
- use-measurements.ts exists: ✓
- measurement-toolbar.tsx exists: ✓
- calibration-dialog.tsx exists: ✓
- imaging-workspace.tsx modified with SVG overlay: ✓
- imaging-measurement.spec.ts created: ✓
- typecheck clean (0 errors): ✓
