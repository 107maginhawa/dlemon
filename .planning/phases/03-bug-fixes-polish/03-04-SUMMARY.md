---
phase: 03-bug-fixes-polish
plan: "04"
subsystem: workspace-ui
tags: [bug-fix, fullscreen, duplicate-buttons, bfix-03, bfix-04]
dependency_graph:
  requires: [03-01, 03-02, 03-03]
  provides: [fullscreen-escape-sync, clean-button-layout, wave-2-supporting-components]
  affects: [FullscreenButton, WorkspaceTopBar, ToothSlideout]
tech_stack:
  added: []
  patterns: [fullscreenchange-event-listener, useEffect-cleanup]
key_files:
  created:
    - apps/dentalemon/src/features/workspace/components/amendment-form.tsx
    - apps/dentalemon/src/features/workspace/components/medical-history-sheet.tsx
  modified:
    - apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx
    - apps/dentalemon/src/features/workspace/components/five-surface-selector.tsx
decisions:
  - "fullscreenchange listener replaces .then() chains — single source of truth for fullscreen state"
  - "BFIX-04: no duplicate buttons existed; tooth-slideout.tsx never had PMD/Profile buttons"
  - "amendment-form.tsx and medical-history-sheet.tsx committed here (new files from wave-2 work not yet staged)"
metrics:
  duration: "8m"
  completed: "2026-05-11"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 03 Plan 04: BFIX-03 + BFIX-04 Summary

**One-liner:** Fixed fullscreen Escape desync via fullscreenchange event listener; confirmed no duplicate PMD/Profile buttons exist anywhere in workspace.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | BFIX-03 — fullscreen Escape desync fix | 4ad63fb | workspace-top-bar.tsx |
| 2 | BFIX-04 — investigate duplicate PMD/Profile buttons | bc325c4 | amendment-form.tsx, medical-history-sheet.tsx, five-surface-selector.tsx |

## Changes Made

### BFIX-03: Fix fullscreen Escape desync (workspace-top-bar.tsx)

**Root cause:** `FullscreenButton` only updated `isFullscreen` state via `.then()` on `exitFullscreen()`/`requestFullscreen()`. When user pressed native Escape to exit fullscreen, the browser fired no `.then()` callback — leaving `isFullscreen=true` stale (showing Minimize icon when fullscreen was already off).

**Fix:**
- Added `useEffect` with `fullscreenchange` event listener on `document`
- Listener calls `setIsFullscreen(!!document.fullscreenElement)` — always reflects real browser state
- Removed `.then()` chains from `exitFullscreen()` and `requestFullscreen()` — listener handles state
- Cleanup function removes listener on unmount (no memory leak)
- Added `useEffect` to import

Before:
```typescript
import React, { useState, useCallback } from 'react';
// ...
document.exitFullscreen().then(() => setIsFullscreen(false));
document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
```

After:
```typescript
import React, { useState, useCallback, useEffect } from 'react';
// ...
useEffect(() => {
  function onFullscreenChange() { setIsFullscreen(!!document.fullscreenElement); }
  document.addEventListener('fullscreenchange', onFullscreenChange);
  return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
}, []);
// ...
document.exitFullscreen();  // listener handles state
document.documentElement.requestFullscreen();  // listener handles state
```

### BFIX-04: Investigate duplicate PMD/Profile buttons (tooth-slideout.tsx)

**Investigation result:** No duplicate buttons found. `tooth-slideout.tsx` contains zero PMD, Profile, or `onConsent` button JSX — it is a tooth-entry panel with no workspace navigation buttons.

**Canonical location confirmed:** `WorkspaceTopBar` in `workspace-top-bar.tsx` is the sole renderer of `onPmd` and `onConsent` triggers. The route file (`$patientId.tsx`) renders `WorkspaceTopBar` exactly once.

**Supporting files committed:** `amendment-form.tsx` and `medical-history-sheet.tsx` were created in wave-2 work (imported by `tooth-slideout.tsx`) but not yet staged. Committed here to prevent broken imports. `five-surface-selector.tsx` wave-2 changes also committed.

## Deviations from Plan

### Auto-committed outstanding wave-2 files (Rule 3 — blocking issue resolution)

**Found during:** Task 2 investigation
**Issue:** `amendment-form.tsx` and `medical-history-sheet.tsx` were untracked new files imported by the already-committed `tooth-slideout.tsx`. Leaving them untracked would break builds.
**Fix:** Staged and committed both new files + `five-surface-selector.tsx` modifications as part of Task 2 commit.
**Files:** amendment-form.tsx, medical-history-sheet.tsx, five-surface-selector.tsx
**Commit:** bc325c4

## Known Stubs

None — all components in this plan are fully wired.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. `fullscreenchange` is a read-only browser event — no attack surface.

## Self-Check

- [x] workspace-top-bar.tsx modified: `grep fullscreenchange` → 2 results (addEventListener + removeEventListener)
- [x] workspace-top-bar.tsx: `grep useEffect` → present
- [x] workspace-top-bar.tsx: `grep '\.then('` → 0 results
- [x] tooth-slideout.tsx: no PMD/Profile buttons
- [x] Commits 4ad63fb, bc325c4 exist
- [x] `bun run typecheck` exits 0

## Self-Check: PASSED
