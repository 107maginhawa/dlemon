# SLICE SPEC: fix-ef-per-001

## Finding Addressed

| ID | Handler | Gap |
|----|---------|-----|
| EF-PER-001 | `upsertToothReading` | Missing parent-visit lock gate — chart fetch checks chart status but never fetches the parent visit to check `completed` or `locked` |

This is P0: a `completed` or `locked` visit's perio chart readings can be silently overwritten, violating the visit immutability invariant (FR1.16).

## Business Rule

FR1.16 — Immutability: once a dental visit reaches `completed` or `locked` status, no child resources (treatments, chart teeth, chart upsert, visit notes, **perio tooth readings**) may be written. Any such attempt must return `422 VISIT_IMMUTABLE`.

The existing chart-level guard (BR-P02: `chart.status !== 'draft'` → `PERIO_CHART_LOCKED`) is necessary but insufficient. A visit can be `completed` or `locked` while its perio chart is still `draft` (e.g. the visit was closed before the chart was completed). In that case, the chart-level guard passes but reads should still be blocked because the parent visit is sealed.

## Fix Pattern

The reference implementation is the dental-visit lock gate used in `updateTooth.ts` and `upsertVisitNotes.ts`:

```typescript
// After fetching the chart, fetch the parent visit and check lock status
const visitRepo = new VisitRepository(db);
const visit = await visitRepo.findOneById(chart.visitId);
if (!visit) throw new NotFoundError('Dental visit');

// EF-PER-001: parent visit must not be completed or locked
if (visit.status === 'completed' || visit.status === 'locked') {
  throw new BusinessLogicError('Visit is immutable and cannot be modified', 'VISIT_IMMUTABLE');
}
```

The check is inserted **after** the chart is fetched and validated (not-found + draft guard) and **before** the branch role assertion (to fail fast before any DB auth query on a locked visit).

## Files Changed

| File | Change |
|------|--------|
| `services/api-ts/src/handlers/dental-perio/upsertToothReading.ts` | Import `VisitRepository`; add visit fetch + `VISIT_IMMUTABLE` lock gate after chart draft check |
| `services/api-ts/src/handlers/dental-perio/dental-perio-coverage.test.ts` | Add 2 new tests: upsertToothReading on completed visit → 422, on locked visit → 422 |

## Test Strategy

Two new tests under the existing `upsertToothReading` describe block:

1. Attempt to write a reading when the parent visit is `completed` → expect `422` with `code: VISIT_IMMUTABLE`
2. Attempt to write a reading when the parent visit is `locked` → expect `422` with `code: VISIT_IMMUTABLE`

A helper `LOCKED_VISIT_ID` fixture is seeded in `beforeAll` using `status: 'completed'` and `status: 'locked'` variants. Perio charts are created for each locked visit so the chart-level guard does not trigger first.

## Acceptance Criteria

- `upsertToothReading` returns `422` with `code: VISIT_IMMUTABLE` when parent visit is `completed`.
- `upsertToothReading` returns `422` with `code: VISIT_IMMUTABLE` when parent visit is `locked`.
- Existing happy-path tests (draft visit) remain green.
- `bun test dental-perio-coverage.test.ts` passes all tests, 0 failures.
- No new TypeScript errors in dental-perio source files.
