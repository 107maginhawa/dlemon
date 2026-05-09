---
phase: "01"
plan: "plan2"
subsystem: "workspace-mutations"
tags: [refactor, mutation-hooks, fetch-removal]
dependency_graph:
  requires: [01-plan1]
  provides: [workspace-hook-wiring]
  affects: [$patientId.tsx]
tech_stack:
  patterns: [tanstack-query-mutations, hook-delegation]
key_files:
  modified:
    - apps/dentalemon/src/routes/_workspace/$patientId.tsx
decisions:
  - "Removed refetchChart/refetchTreatments from destructuring since invalidation now lives in hooks"
  - "Kept teeth array building logic in component per plan specification"
metrics:
  duration: "2m"
  completed: "2026-05-06"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 01 Plan 2: Wire Mutation Hooks into Workspace Page Summary

Refactored $patientId.tsx to delegate all four mutations to TanStack Query hooks, eliminating raw fetch() calls and manual cache invalidation.

## What Changed

### Task 1: Wire mutation hooks into WorkspacePage (ff96620)

Replaced all four inline `fetch()` blocks in `$patientId.tsx` with hook calls:

- `handleNewVisit()` now calls `createVisitMutation.mutate()` instead of `fetch()`
- `handleSharePMD()` now calls `sharePMDMutation.mutate()` instead of `fetch()`
- `handleSaveToothData()` now calls `saveChartMutation.mutate()` and `saveTreatmentMutation.mutate()` instead of two `fetch()` calls
- Removed `apiBaseUrl` import, `const API` declaration, and `useQueryClient` import
- Removed unused `refetchChart` and `refetchTreatments` destructured variables (invalidation now handled inside hooks' `onSuccess`)

## Verification Results

- `grep -c "fetch(" $patientId.tsx` = 0 (no raw fetch calls)
- `grep -c "apiBaseUrl" $patientId.tsx` = 0 (no config import)
- Hook imports + instantiations = 8 occurrences (4 imports + 4 uses)
- typecheck: bun-types resolution error in worktree (pre-existing env issue, not caused by this change)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Cleanup] Removed unused refetchChart/refetchTreatments destructuring**
- **Found during:** Task 1
- **Issue:** After removing the fetch calls, `refetchChart` and `refetchTreatments` were still destructured from hooks but no longer referenced anywhere in the file
- **Fix:** Removed from destructuring assignments
- **Files modified:** apps/dentalemon/src/routes/_workspace/$patientId.tsx
- **Commit:** ff96620

## Commits

| Task | Commit  | Message                                                            |
| ---- | ------- | ------------------------------------------------------------------ |
| 1    | ff96620 | refactor(01-plan2): wire mutation hooks, remove inline fetch calls |

## Self-Check: PASSED
