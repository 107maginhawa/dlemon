---
phase: 01-treatment-table-visit-lifecycle
plan: "02"
subsystem: workspace-hooks
tags: [tanstack-query, mutations, hooks, data-layer]
dependency_graph:
  requires: [01-01-PLAN]
  provides: [use-update-treatment, use-update-visit, use-visit-notes]
  affects: [01-03-PLAN, 01-04-PLAN, 01-05-PLAN]
tech_stack:
  added: []
  patterns: [tanstack-query-mutation-spread, combined-query-mutation-hook]
key_files:
  created:
    - apps/dentalemon/src/features/workspace/hooks/use-update-treatment.ts
    - apps/dentalemon/src/features/workspace/hooks/use-update-visit.ts
    - apps/dentalemon/src/features/workspace/hooks/use-visit-notes.ts
  modified: []
decisions:
  - "listDentalTreatmentsQueryKey takes { path: { visitId } } — confirmed from use-treatments.ts pattern"
  - "useVisitNotes accepts string | null to safely disable query when no visit is selected"
metrics:
  duration: "5m"
  completed: "2026-05-11"
  tasks_completed: 2
  files_created: 3
---

# Phase 01 Plan 02: Data Layer Hooks Summary

Three TanStack Query mutation/query hooks for treatment and visit data operations, used by all Wave 3 components.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create useUpdateTreatment + useUpdateVisit | ec78acc, 3d6031d | use-update-treatment.ts, use-update-visit.ts |
| 2 | Create useVisitNotes | e2db1f5 | use-visit-notes.ts |

## What Was Built

- `useUpdateTreatment(visitId)` — mutation wrapping `updateDentalTreatmentMutation`, invalidates `listDentalTreatmentsQueryKey({ path: { visitId } })` on success
- `useUpdateVisit(patientId)` — mutation wrapping `updateDentalVisitMutation`, invalidates `listDentalVisitsQueryKey({ query: { patientId } })` on success
- `useVisitNotes(visitId | null)` — combined hook: query via `getVisitNotesOptions` (disabled when null) + mutation via `upsertVisitNotesMutation` with invalidation; returns `{ notes, isLoading, error, save, isSaving }`

## Deviations from Plan

None — plan executed exactly as written. The spread mutation pattern (`...updateDentalTreatmentMutation()`) used in plan spec matches existing SDK exports exactly.

## Self-Check: PASSED

- All 3 files exist at expected paths
- `bun run typecheck` exits 0 with no errors in new files
- Commits ec78acc, 3d6031d, e2db1f5 verified in git log
