# TDD Proof: fix-wave2-dental-perio

## Finding Fixed

**EF-PER-002** — `staff_scheduling` incorrectly allowed to read perio chart data.

## Red Phase (Before Fix)

Prior to the fix, both `getVisitPerioChart.ts` and `getPerioChart.ts` contained:

```typescript
await assertBranchRole(db, user.id, ..., [
  'dentist_owner',
  'dentist_associate',
  'hygienist',
  'staff_full',
  'staff_scheduling',   // ← WRONG: MODULE_SPEC §6 forbids this
]);
```

The test `returns 403 for staff_scheduling role` (added to both `getVisitPerioChart` and `getPerioChart` describe blocks) would have returned 200, not 403, before the fix — demonstrating the RED state.

## Green Phase (After Fix)

Both handlers now use:

```typescript
await assertBranchRole(db, user.id, ..., [
  'dentist_owner',
  'dentist_associate',
  'hygienist',
  'staff_full',
]);
```

## Test Run Output

```
bun test src/handlers/dental-perio/dental-perio-coverage.test.ts

 17 pass
 0 fail
 62 expect() calls
Ran 17 tests across 1 file. [2.10s]
```

## Test Cases Added (EF-PER-002 coverage)

| Describe Block | Test | Expected | Result |
|----------------|------|----------|--------|
| `getVisitPerioChart` | `returns 403 for staff_scheduling role` | 403 | PASS |
| `getPerioChart` | `returns 403 for staff_scheduling role` | 403 | PASS |
| `getPerioChart` | `returns 200 with chart and readings for dentist` | 200 | PASS |

## Pre-existing Tests (no regressions)

All 14 pre-existing tests continue to pass:

| Describe Block | Count | Status |
|----------------|-------|--------|
| `createPerioChart` | 3 | PASS |
| `upsertToothReading` | 5 | PASS |
| `completePerioChart` | 3 | PASS |
| `getVisitPerioChart` | 3 (pre-existing) | PASS |

## Files Changed

| File | Change |
|------|--------|
| `services/api-ts/src/handlers/dental-perio/getVisitPerioChart.ts` | Remove `'staff_scheduling'` from allowed roles |
| `services/api-ts/src/handlers/dental-perio/getPerioChart.ts` | Remove `'staff_scheduling'` from allowed roles; update comment |
| `services/api-ts/src/handlers/dental-perio/dental-perio-coverage.test.ts` | Import `getPerioChart` + `GetPerioChartParams`; wire route; add 3 new tests |

## Commit

`9745ba50` — `fix(dental-perio): EF-PER-002 — remove staff_scheduling from read endpoint allowed roles`

## Typecheck

No dental-perio TypeScript errors introduced. Pre-existing errors in unrelated modules (structural remediation work in progress) are unchanged.
