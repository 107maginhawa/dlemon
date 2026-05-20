---
phase: 03-bug-fixes-polish
plan: "03"
subsystem: workspace
tags: [bug-fix, price-cents, billing, tdd]
dependency_graph:
  requires: [03-01]
  provides: [correct-cents-conversion, price-contract-documented]
  affects: [useSaveTreatment, TreatmentTable, WorkspacePaymentModal, ToothSlideout]
tech_stack:
  added: []
  patterns: [cents-dollars-boundary, tdd-red-green]
key_files:
  created: []
  modified:
    - apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts
    - apps/dentalemon/src/features/workspace/hooks/use-save-treatment.test.ts
    - apps/dentalemon/src/features/workspace/components/treatment-table.tsx
    - apps/dentalemon/src/features/workspace/components/workspace-payment-modal.tsx
    - apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx
decisions:
  - "priceAmount field on Treatment type is dollars (already divided by 100 from API); treatment-table.tsx correctly reads it as dollars"
  - "Old rounding test was flawed (tested 1500.7→1501 which passed even with bug); replaced with explicit dollar→cents test (15.00→1500)"
metrics:
  duration: "12m"
  completed: "2026-05-11"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 03 Plan 03: BFIX-01 Price ×100 Boundary Fix Summary

**One-liner:** Fixed 100× undercharging bug in useSaveTreatment (dollars sent as cents); audited and documented price contract at all 3 display sites.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing test for BFIX-01 cents conversion | 7a6c619 | use-save-treatment.test.ts |
| 1 (GREEN) | Fix cents conversion in use-save-treatment.ts | c125a3d | use-save-treatment.ts, use-save-treatment.test.ts |
| 2 | Audit all price display sites | 1fe3478 | treatment-table.tsx, workspace-payment-modal.tsx, tooth-slideout.tsx |

## Changes Made

### BFIX-01: Fix cents conversion (use-save-treatment.ts)

Before:
```typescript
priceCents: BigInt(Math.round(priceAmount)),  // priceAmount=1500 → sends 1500 cents = $15 (wrong)
```

After:
```typescript
priceCents: BigInt(Math.round(priceAmount * 100)), // priceAmount is dollars; multiply by 100 for cents
// priceAmount=1500 → sends 150000 cents = $1500 (correct)
```

### TDD Gate

- RED: Added `BFIX-01: priceAmount in dollars must be sent as priceCents (×100)` test — failed as expected (received 15, expected 1500)
- GREEN: Applied fix — all 8 tests pass including new test and corrected rounding test
- Old rounding test updated: `priceAmount: 15.007` → `Math.round(15.007 * 100) = 1501` cents (was testing wrong input)

### Price Display Audit

All 3 display sites confirmed correct:

| File | Pattern | Status |
|------|---------|--------|
| treatment-table.tsx | `t.priceAmount ?? 0` (dollars from API) for this-visit; `i.priceCents / 100` for carried-over | Correct |
| treatment-table.tsx | Inline edit save: `Math.round(parsed * 100)` | Correct |
| workspace-payment-modal.tsx | `formatCents(priceCents)` — divides by 100 internally | Correct |
| tooth-slideout.tsx review | `parseFloat(priceInput).toLocaleString()` where priceInput is a dollar string | Correct |
| tooth-slideout.tsx CDT select | `setPriceInput(String(selection.priceCents / 100))` | Correct |

"price contract" comment added to all 3 display files.

## Deviations from Plan

**1. [Rule 1 - Bug] Flawed existing rounding test**
- **Found during:** Task 1 TDD GREEN — existing test "converts priceAmount to integer cents (rounds correctly)" was passing with the buggy code
- **Issue:** Test used `priceAmount: 1500.7` and checked body contains "1501". With bug: `Math.round(1500.7) = 1501` — passes! With fix: `Math.round(1500.7 * 100) = 150070` — would fail with wrong assertion
- **Fix:** Changed test input to `15.007` dollars (→ `Math.round(15.007 * 100) = 1501` cents) and assertion to check `Number(parsed.priceCents) === 1501`
- **Files modified:** use-save-treatment.test.ts
- **Commit:** c125a3d

## TDD Gate Compliance

- `test(03-03)` RED commit: 7a6c619
- `fix(03-03)` GREEN commit: c125a3d
- Both gates present in correct order

## Known Stubs

None.

## Threat Flags

None — no new network endpoints or auth paths introduced.

## Verification

```bash
grep -n "Math.round(priceAmount \* 100)" apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts
# → 1 result at line 36

grep -n "price contract" apps/dentalemon/src/features/workspace/components/treatment-table.tsx apps/dentalemon/src/features/workspace/components/workspace-payment-modal.tsx apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx
# → 4 results across 3 files

bun run typecheck
# → exit 0
```

## Self-Check: PASSED

- 7a6c619 exists in git log (RED test commit)
- c125a3d exists in git log (fix + updated test commit)
- 1fe3478 exists in git log (display site audit commit)
- use-save-treatment.ts line 36 contains `Math.round(priceAmount * 100)`
- "price contract" comment in all 3 display files
- bun run typecheck: exit 0
- All 8 tests pass in use-save-treatment.test.ts
