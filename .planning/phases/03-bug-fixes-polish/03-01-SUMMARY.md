---
phase: 03-bug-fixes-polish
plan: "01"
subsystem: workspace
tags: [bug-fix, dead-code, zustand, stale-closure]
dependency_graph:
  requires: []
  provides: [reactive-org-store-reads, clean-workspace-hooks]
  affects: [WorkspacePage, useTreatmentPlan]
tech_stack:
  added: []
  patterns: [zustand-selector-pattern]
key_files:
  created: []
  modified:
    - apps/dentalemon/src/features/workspace/hooks/use-treatment-plan.ts
    - apps/dentalemon/src/routes/_workspace/$patientId.tsx
  deleted:
    - apps/dentalemon/src/features/workspace/components/workspace-tabs.tsx
    - apps/dentalemon/src/features/workspace/components/workspace-tabs.test.ts
decisions:
  - "Event handler getState() at line 130 preserved — intentionally non-reactive (called on user action, not render)"
  - "useRef removed from React import after both usages replaced"
metrics:
  duration: "5m"
  completed: "2026-05-11"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 03 Plan 01: BFIX-02 + BFIX-05 + BFIX-06 Summary

**One-liner:** Eliminated stale-closure org store reads in WorkspacePage via Zustand selector pattern; deleted dead WorkspaceTabs component and tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | BFIX-02 + BFIX-06: Document raw fetch intent + delete WorkspaceTabs | d5b6fa8 | use-treatment-plan.ts (+1 line), workspace-tabs.tsx (deleted), workspace-tabs.test.ts (deleted) |
| 2 | BFIX-05: Replace stale org store captures with reactive selectors | 404919b | $patientId.tsx |

## Changes Made

### BFIX-02: useTreatmentPlan pattern documented
Added `// No SDK react-query option exists for this endpoint — intentional raw fetch` comment above the fetch call. Hook already used correct pattern (TanStack Query + raw fetch + credentials: 'include').

### BFIX-06: WorkspaceTabs dead code deleted
Deleted `workspace-tabs.tsx` and `workspace-tabs.test.ts`. Zero import references remained — confirmed clean deletion.

### BFIX-05: Reactive org store selectors
Replaced two stale-closure captures in `WorkspacePage` render body:
- `React.useRef(useOrgContextStore.getState().memberId ?? '').current` → `useOrgContextStore(s => s.memberId) ?? ''`
- `React.useRef(useOrgContextStore.getState().branchId).current` → `useOrgContextStore(s => s.branchId)`

Removed `useRef` from React import (no longer needed). Event handler at line 130 (`handleNewVisit`) left unchanged — `.getState()` is correct in event handlers.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `grep -r "workspace-tabs" apps/dentalemon/src` → 0 results
- `grep "useOrgContextStore.getState" $patientId.tsx` → 1 result (event handler only)
- `grep "useOrgContextStore(s =>" $patientId.tsx` → 2 results
- `bun run typecheck` → exit 0, no errors

## Self-Check: PASSED

- d5b6fa8 exists in git log
- 404919b exists in git log
- workspace-tabs.tsx deleted from disk
- workspace-tabs.test.ts deleted from disk
- use-treatment-plan.ts contains "intentional raw fetch"
- $patientId.tsx has 2 reactive selectors, 1 event-handler getState()
