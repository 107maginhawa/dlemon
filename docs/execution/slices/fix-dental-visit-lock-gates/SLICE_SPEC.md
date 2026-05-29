# SLICE SPEC: fix-dental-visit-lock-gates

## Findings Addressed

| ID | Handler | Gap |
|----|---------|-----|
| EF-VIS-001 | `updateDentalTreatment` | Missing lock gate — no check for `completed` or `locked` visit status |
| EF-VIS-002 | `updateTooth` | Missing lock gate — no check for `completed` or `locked` visit status |
| EF-VIS-003 | `upsertDentalChart` | Missing lock gate — no check for `completed` or `locked` visit status |
| EM-VIS-007 | `upsertVisitNotes` | Partial gate — checked `locked` only, did not check `completed` |

All four are P0: data integrity violations allow chart/treatment/notes writes on sealed visits.

## Business Rule

FR1.16 — Immutability: once a dental visit reaches `completed` or `locked` status, no child resources (treatments, chart teeth, chart upsert, visit notes) may be written. Any such attempt must return `422 VISIT_IMMUTABLE`.

## Fix Pattern

Fetch the parent visit (already present in each handler for branch auth), then immediately after the branch role assertion:

```typescript
if (visit.status === 'completed' || visit.status === 'locked') {
  throw new BusinessLogicError('Visit is immutable and cannot be modified', 'VISIT_IMMUTABLE');
}
```

This mirrors the existing gate in `updateDentalVisit.ts` (lines 39-41, 55-57) and the pre-existing locked-only check in `upsertVisitNotes.ts`.

## Files Changed

| File | Change |
|------|--------|
| `services/api-ts/src/handlers/dental-visit/treatments/updateDentalTreatment.ts` | Add `completed \|\| locked` gate after branch auth |
| `services/api-ts/src/handlers/dental-visit/chart/updateTooth.ts` | Import `BusinessLogicError`; add gate after branch auth |
| `services/api-ts/src/handlers/dental-visit/chart/upsertDentalChart.ts` | Import `BusinessLogicError`; add gate after branch auth |
| `services/api-ts/src/handlers/dental-visit/notes/upsertVisitNotes.ts` | Extend existing `locked`-only check to include `completed`; use `VISIT_IMMUTABLE` code |
| `services/api-ts/src/handlers/dental-visit/dental-visit.test.ts` | Add 8 new tests (2 per finding: completed + locked) |

## Test Strategy

Each finding gets two tests:

1. Write to a `completed` visit — expect `422 VISIT_IMMUTABLE`
2. Write to a `locked` visit — expect `422 VISIT_IMMUTABLE`

Helper `seedLockedVisit()` added: creates visit, completes it, then locks it.

## Acceptance Criteria

- All 4 write handlers return `422` with `code: VISIT_IMMUTABLE` on completed visits.
- All 4 write handlers return `422` with `code: VISIT_IMMUTABLE` on locked visits.
- Existing happy-path tests remain green (no regressions).
- `bun test dental-visit.test.ts` passes all 62 tests, 0 failures.
- No new TypeScript errors in dental-visit source files.
