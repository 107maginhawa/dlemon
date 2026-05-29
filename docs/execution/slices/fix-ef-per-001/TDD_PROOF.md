# TDD PROOF: fix-ef-per-001

## Test Run Result

```
bun test v1.2.19 (aad3abea)
 14 pass
 0 fail
 55 expect() calls
Ran 14 tests across 1 file. [398.00ms]
```

## Test Coverage — New Tests Added (EF-PER-001)

| Test | Expected | Result |
|------|----------|--------|
| `upsertToothReading` on completed visit → 422 VISIT_IMMUTABLE | 422 + code=VISIT_IMMUTABLE | PASS |
| `upsertToothReading` on locked visit → 422 VISIT_IMMUTABLE | 422 + code=VISIT_IMMUTABLE | PASS |

Both tests use fixtures seeded directly via DB insert (bypassing `createPerioChart` which itself blocks on sealed visits). The chart is in `draft` status so the chart-level guard does not fire — only the new visit lock gate triggers the 422.

## Regression Check

All 12 pre-existing tests in `dental-perio-coverage.test.ts` continue to pass. No regressions introduced.

## TypeScript Check

```
bun run typecheck 2>&1 | grep dental-perio
# (no output — zero errors in dental-perio source files)
```

Pre-existing errors in unrelated files (`dental-billing`, `dental-patient-sync`, `acceptance` tests) are not introduced by this change.

## Coverage Highlights (from test run)

| File | % Lines |
|------|---------|
| `upsertToothReading.ts` | 98.46% |
| `completePerioChart.ts` | 100.00% |
| `createPerioChart.ts` | 97.78% |
| `getVisitPerioChart.ts` | 100.00% |

## Implementation Summary

**File changed**: `services/api-ts/src/handlers/dental-perio/upsertToothReading.ts`

Added import:
```typescript
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
```

Added gate after chart draft check, before branch role assertion:
```typescript
// EF-PER-001: parent visit must not be completed or locked.
const visitRepo = new VisitRepository(db);
const visit = await visitRepo.findOneById(chart.visitId);
if (!visit) throw new NotFoundError('Dental visit');
if (visit.status === 'completed' || visit.status === 'locked') {
  throw new BusinessLogicError('Visit is immutable and cannot be modified', 'VISIT_IMMUTABLE');
}
```

**Commit**: `fffbc2f1` — `fix(dental-perio): EF-PER-001 — add visit lock propagation to upsertToothReading`
