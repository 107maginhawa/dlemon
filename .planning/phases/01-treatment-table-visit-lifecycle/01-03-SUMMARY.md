---
phase: 01-treatment-table-visit-lifecycle
plan: 03
subsystem: workspace/treatment-table
tags: [treatment-table, inline-edit, popover, dismiss, subtotals, notes, toggle]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [TXTBL-01, TXTBL-02, TXTBL-03, TXTBL-04, TXTBL-05]
  affects: [treatment-table.tsx, sdk-ts/types.gen.ts]
tech_stack:
  added: ["@radix-ui/react-popover (Popover/PopoverTrigger/PopoverContent)"]
  patterns: ["inline-edit toggle", "dismiss popover with min-length guard", "local-only sub-row", "dual subtotals"]
key_files:
  modified:
    - apps/dentalemon/src/features/workspace/components/treatment-table.tsx
    - packages/sdk-ts/src/generated/types.gen.ts
decisions:
  - "visitId made optional (default '') to preserve backward compat with existing tests and call sites that don't yet pass it"
  - "grandTotal now includes carried-over items (thisVisitTotal + carriedOverTotal); grand total row shown when either set is non-empty"
  - "priceCents was already in TypeSpec dental-visit.tsp but SDK types.gen.ts was stale — ran sdk-ts generate to pick it up"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-11"
  tasks_completed: 2
  files_modified: 2
---

# Phase 1 Plan 3: Treatment Table Interactions (TXTBL-01 through TXTBL-05) Summary

Extends `treatment-table.tsx` with all five TXTBL interactions: dual subtotals, inline price edit via `useUpdateTreatment`, Radix dismiss popover with min-3-char reason guard, local-only chevron notes sub-row, and View/Hide Completed toggle filtering performed|verified rows.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | State + subtotals + toggle + notes sub-row | 2b5de11 | treatment-table.tsx |
| 2 | Inline price edit + dismiss popover + SDK regen | 90dfe7d | treatment-table.tsx, sdk-ts/types.gen.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SDK types.gen.ts stale — priceCents missing from UpdateDentalTreatmentRequest**
- **Found during:** Task 2 — typecheck failed with TS2353
- **Issue:** `priceCents` was already in the TypeSpec (dental-visit.tsp line 165) but `packages/sdk-ts/src/generated/types.gen.ts` had not been regenerated, so the type was absent
- **Fix:** Ran `cd specs/api && bun run build` then `cd packages/sdk-ts && bun run generate`; added `priceCents?: number` to `UpdateDentalTreatmentRequest`
- **Files modified:** `packages/sdk-ts/src/generated/types.gen.ts`
- **Commit:** 90dfe7d

**2. [Rule 1 - Bug] grandTotal row condition widened**
- **Found during:** Task 1 — original condition was `treatments.length > 0` only
- **Issue:** Grand total should show even when only carried-over items exist
- **Fix:** Changed condition to `treatments.length > 0 || carriedOverItems.length > 0`

**3. [Rule 2 - Enhancement] colSpan updated to 8**
- **Found during:** Task 1 — adding chevron column increased total columns from 7 to 8
- **Fix:** Updated all colSpan values in subtotal/carried-over separator/grand-total rows from 6-7 to 7-8

## Known Stubs

None — all interactions are wired (price edit → priceCents mutation, dismiss → dismissed+dismissReason mutation, toggle → filter, notes → local state only by design per TXTBL-04).

## Threat Flags

None — no new network endpoints introduced. Price edit and dismiss mutations were already accounted for in the plan's threat model (T-03-01, T-03-02).

## Self-Check: PASSED

- [x] `treatment-table.tsx` exists with `editingPriceId` state
- [x] `subtotal-this-visit-row` data-testid present
- [x] `subtotal-carried-over-row` data-testid present
- [x] `useUpdateTreatment` imported and used
- [x] `Confirm Dismiss` button present in PopoverContent
- [x] `bun run typecheck` exits 0
- [x] Commits 2b5de11 and 90dfe7d exist
