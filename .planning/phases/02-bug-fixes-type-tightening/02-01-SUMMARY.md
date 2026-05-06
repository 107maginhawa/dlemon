---
plan: 01
phase: 2
status: complete
---

# Summary: Plan 02-01

## Completed Tasks

1. **Tighten dental-chart.helpers.ts types (BUG-04, BUG-05)**
   - Added `import type { ToothSurface }` from five-surface-selector.helpers
   - Changed `ToothData.surfaces` from `string[]` to `ToothSurface[]`
   - Changed `buildToothMap` parameter/return from `string` to `ToothState`
   - Removed `| string` widening from `getToothColorClass` signature
   - Added `isValidFdiNumber` and `isValidUniversalNumber` guard functions

2. **Add cdtCode/description to Treatment; remove as any casts (CR-03)**
   - Added `import type { ToothSurface }` to use-treatments.ts
   - Changed `Treatment.surfaces` from `string[]` to `ToothSurface[]`
   - Added `cdtCode?: string` and `description?: string` to Treatment interface
   - Replaced two `as any` casts in `$patientId.tsx` treatment table with direct field access

## Files Modified

- `apps/dentalemon/src/features/workspace/components/dental-chart.helpers.ts`
- `apps/dentalemon/src/features/workspace/hooks/use-treatments.ts`
- `apps/dentalemon/src/routes/_workspace/$patientId.tsx`

## Verification

`bun run typecheck` (tsc --noEmit) — exited clean, no errors.

## Commit

`b1bc0ba` — fix(types): tighten ToothData surfaces, add FDI guards, extend Treatment type (#BUG-04, BUG-05, CR-03)
