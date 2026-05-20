---
phase: 01-treatment-table-visit-lifecycle
plan: 05
subsystem: workspace-visit-lifecycle
tags: [workspace, visit-lifecycle, soap-notes, pre-completion, timeline-carousel, lock-visit]
dependency_graph:
  requires: [01-03, 01-04]
  provides: [complete-visit-ux, lock-visit-ux, soap-notes-wired]
  affects: [workspace-top-bar, timeline-carousel, $patientId-orchestrator]
tech_stack:
  added: []
  patterns: [prop-callback-wiring, mutation-prop-drilling, sheet-replace-pattern]
key_files:
  created: []
  modified:
    - apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx
    - apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx
    - apps/dentalemon/src/features/workspace/components/timeline-carousel.test.ts
    - apps/dentalemon/src/routes/_workspace/$patientId.tsx
decisions:
  - "Added patientId prop to TimelineCarouselProps to enable useUpdateVisit hook instantiation inside carousel"
  - "MedicalHistoryForm fully replaced by SoapNotesSheet in notes sheet; onOpenMedicalHistory wired to PMD import (existing escape hatch)"
  - "Unused lucide-react icons (Pill, FileSignature, FlaskConical, FileText, Upload) removed from $patientId.tsx imports"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-11"
  tasks_completed: 2
  files_modified: 4
---

# Phase 01 Plan 05: Wire Visit Lifecycle into Workspace — Summary

**One-liner:** Complete Visit button (disabled when not active) + SoapNotesSheet replacing MedicalHistoryForm + Lock Visit button on completed carousel cards, all wired into the live workspace orchestrator.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Wire WorkspaceTopBar + $patientId.tsx orchestration | d56031a | workspace-top-bar.tsx, $patientId.tsx |
| 2 | Add Lock Visit to TimelineCarousel | 49c07a1, e43df2b | timeline-carousel.tsx, timeline-carousel.test.ts |

## What Was Built

### WorkspaceTopBar (`workspace-top-bar.tsx`)
- Added `onCompleteVisit: () => void` and `visitStatus?: 'draft' | 'active' | 'completed' | 'locked'` props
- Added `CheckCircle2` from lucide-react
- Added "Complete visit" `IconButton` — disabled when `visitStatus !== 'active'`

### $patientId.tsx Orchestrator
- Imported `SoapNotesSheet` and `PreCompletionChecklist`
- Added `checklistOpen` state
- Replaced MedicalHistoryForm notes sheet with `SoapNotesSheet` (visitId-scoped, open controlled by `notesSheetOpen`)
- Wired `onOpenMedicalHistory` to open PMD import (preserving that escape hatch)
- Passed `onCompleteVisit={() => setChecklistOpen(true)}` and `visitStatus={currentVisit?.status}` to WorkspaceTopBar
- Rendered `PreCompletionChecklist` overlay wired to `checklistOpen`
- Passed `patientId` to `TimelineCarousel`
- Removed unused lucide-react icon imports

### TimelineCarousel (`timeline-carousel.tsx`)
- Added `patientId: string` to `TimelineCarouselProps`
- Imported `Lock` from lucide-react and `useUpdateVisit` hook
- Instantiated `lockMutation = useUpdateVisit(patientId)` in component
- Added `onLockVisit` / `lockPending` props to `VisitChartCard`
- Completed cards: show Lock Visit button with `window.confirm` guard → `lockMutation.mutate({ path: { visitId }, body: { status: 'locked' } })`
- Locked cards: show `Lock` icon, no button
- Test file updated: added `patientId: 'test-patient'` to all render calls + mocked `useUpdateVisit` and SDK mutation helpers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Test file missing patientId prop + useUpdateVisit mock**
- **Found during:** Task 2 (carousel test file review)
- **Issue:** `timeline-carousel.test.ts` called `renderCarousel` without the new required `patientId` prop and had no mock for `useUpdateVisit`, which would cause TS errors and test failures
- **Fix:** Added `patientId: 'test-patient'` to all 10 render calls; added `useUpdateVisit` module mock and SDK mutation helpers mock
- **Files modified:** `timeline-carousel.test.ts`
- **Commit:** e43df2b

**2. [Rule 2 - Cleanup] Unused imports in $patientId.tsx**
- **Found during:** Task 1 (after replacing MedicalHistoryForm)
- **Issue:** `MedicalHistoryForm`, `Upload`, `Pill`, `FileSignature`, `FlaskConical`, `FileText` imports became unused
- **Fix:** Removed all unused imports
- **Files modified:** `$patientId.tsx`
- **Commit:** d56031a

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. All changes are frontend UI wiring only.

T-05-02 mitigation confirmed: Complete Visit button is disabled client-side when `visitStatus !== 'active'`; server enforces active→completed transition.

## Known Stubs

None — all wiring connects to real components (SoapNotesSheet, PreCompletionChecklist) built in Wave 3, and real mutation hooks from Wave 2.

## Self-Check: PASSED

Files verified:
- `workspace-top-bar.tsx` — contains `onCompleteVisit`, `visitStatus`, `CheckCircle2`
- `$patientId.tsx` — contains `SoapNotesSheet`, `PreCompletionChecklist`, `checklistOpen`, `onCompleteVisit`
- `timeline-carousel.tsx` — contains `Lock Visit`, `lockMutation`, `useUpdateVisit`
- Commits: d56031a, 49c07a1, e43df2b confirmed in git log
- `bun run typecheck` — exit code 0
