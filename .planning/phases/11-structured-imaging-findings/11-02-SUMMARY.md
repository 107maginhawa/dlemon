---
phase: 11-structured-imaging-findings
plan: "02"
subsystem: dental-imaging
tags: [frontend, react, tanstack-query, playwright, findings, imaging]
dependency_graph:
  requires:
    - use-measurements.ts (hook pattern reference)
    - imaging-workspace.tsx (canvas container)
    - 11-01 backend (POST/GET/PATCH/DELETE /dental/imaging/*/findings)
    - @/components/select, button, input, textarea, skeleton, badge
  provides:
    - useImagingFindings hook (create/update/delete mutations + list query)
    - FindingsSidebar component (form + findings list panel)
    - ImagingWorkspace updated (flex-row canvas, Findings toggle, sidebar wired)
  affects:
    - apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx
    - apps/dentalemon/src/routes/_workspace/$patientId.tsx
tech_stack:
  added: []
  patterns:
    - TanStack Query hook with simple invalidation (no optimistic update)
    - Controlled sidebar panel (isOpen prop, null render when closed)
    - Quick-select chip buttons above Select (CIMG-05 pattern)
    - Status cycle array with modulo wrap-around
    - Playwright page.route() mocking for network-isolated E2E
key_files:
  created:
    - apps/dentalemon/src/features/imaging/hooks/use-imaging-findings.ts
    - apps/dentalemon/src/features/imaging/components/FindingsSidebar.tsx
    - apps/dentalemon/tests/e2e/imaging-findings.spec.ts
  modified:
    - apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx
    - apps/dentalemon/src/routes/_workspace/$patientId.tsx
decisions:
  - "Simple invalidation pattern (no optimistic update) per plan spec — measurements hook uses optimistic but findings plan explicitly says simple invalidation"
  - "visitId/patientId/branchId added as optional props with '' defaults for backward compatibility; comparison-view.tsx call sites not updated (comparison mode does not create findings)"
  - "AnnotationShape <g> onClick routes to onAnnotationClick callback; delete circle uses e.stopPropagation() to avoid triggering annotation click"
  - "E2E spec uses page.route() mocking for deterministic testing — same pattern as other imaging specs that cannot assume a running backend"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-11"
  tasks_completed: 3
  files_created: 3
  files_modified: 2
---

# Phase 11 Plan 02: Structured Imaging Findings Frontend Summary

Frontend for structured imaging findings: TanStack Query hook with CRUD mutations, collapsible FindingsSidebar panel with 5 quick-select type chips (CIMG-05), toothNumber input (CIMG-06), findings list with status cycle and delete, wired into ImagingWorkspace, and 6 Playwright E2E tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Hook: use-imaging-findings.ts | 5f7bc79 | use-imaging-findings.ts |
| 2 | FindingsSidebar + imaging-workspace wiring | 5fd8260 | FindingsSidebar.tsx, imaging-workspace.tsx, $patientId.tsx |
| 3 | E2E test: imaging-findings.spec.ts | 553a011 | imaging-findings.spec.ts |

## Verification Results

- `bun run typecheck`: 0 errors
- `grep -c 'FindingsSidebar' imaging-workspace.tsx`: 3 (import + JSX + state reference)
- `grep -c 'useImagingFindings' FindingsSidebar.tsx`: 2
- `grep -c 'test(' imaging-findings.spec.ts`: 6 (>=4 required)
- All 3 tasks committed atomically

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] onAnnotationClick prop added to AnnotationShape**
- **Found during:** Task 2
- **Issue:** Plan says annotation click should open sidebar pre-filled; MeasurementShapeProps had no callback for this
- **Fix:** Added optional `onAnnotationClick?: (id: string) => void` to MeasurementShapeProps; AnnotationShape `<g>` wraps with onClick; delete circle uses stopPropagation
- **Files modified:** imaging-workspace.tsx

**2. [Rule 2 - Missing functionality] comparison-view.tsx call sites left without visitId/patientId/branchId**
- **Found during:** Task 2
- **Issue:** ComparisonView renders two ImagingWorkspace instances but comparison mode is read-only (no finding creation intended)
- **Fix:** Props are optional with '' defaults — comparison-view.tsx works fine without them; findings panel is not meaningful in split-screen comparison. Left as-is intentionally.

## Known Stubs

None — hook calls real API routes, sidebar renders real data from hook, E2E uses deterministic mocks (standard pattern for all imaging E2E specs in this project).

## Threat Surface Scan

No new network endpoints introduced. FindingsSidebar passes visitId/patientId/branchId from ImagingWorkspace props (set by $patientId.tsx route context, not user input) — T-11-06 mitigation satisfied. Hook only fires when imageId present and isOpen=true — T-11-07 accept disposition maintained.

## Self-Check: PASSED

- use-imaging-findings.ts: EXISTS at apps/dentalemon/src/features/imaging/hooks/use-imaging-findings.ts
- FindingsSidebar.tsx: EXISTS at apps/dentalemon/src/features/imaging/components/FindingsSidebar.tsx
- imaging-findings.spec.ts: EXISTS at apps/dentalemon/tests/e2e/imaging-findings.spec.ts
- imaging-workspace.tsx: MODIFIED (FindingsSidebar import + state + layout)
- $patientId.tsx: MODIFIED (visitId/patientId/branchId passed)
- Commits: 5f7bc79, 5fd8260, 553a011 — all in git log
