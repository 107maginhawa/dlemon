# TDD_PROOF: EF-IMG-001-005 — assertBranchRole on 5 Ceph Handlers

## Outcome: CLOSED (GREEN)

## Pre-flight Discovery

Audit findings EF-IMG-001-005 were generated from a pre-fix snapshot. Upon inspection
all 5 canonical handlers already contained `assertBranchRole`:

| Finding | File | Line | Status |
|---------|------|------|--------|
| EF-IMG-001 | `createCephReport.ts` | 43 | already present |
| EF-IMG-002 | `batchUpsertCephLandmarks.ts` | 49 | already present |
| EF-IMG-003 | `recomputeCephAnalysis.ts` | 39 | already present |
| EF-IMG-004 | `deleteCephLandmark.ts` | 36 | already present |
| EF-IMG-005 | `updateCephLandmark.ts` | 45 | already present |

## Real Gap Identified and Fixed

The branch-isolation test coverage was incomplete. The `catch → throw new NotFoundError('Image not found')`
path (the "non-member gets 404, not 403" security property) was only tested for `batchUpsertCephLandmarks`
and `getCephAnalysis`. Four handlers had those paths uncovered.

## Tests Added (RED→GREEN verified)

File: `services/api-ts/src/handlers/dental-imaging/ceph.test.ts`

Added to `describe('Branch isolation — non-member → 404 not 403')`:

| Test | Handler | Finding |
|------|---------|---------|
| `createCephReport by non-member returns 404 not 403 (EF-IMG-001)` | `CephMgmt_createCephReport` | EF-IMG-001 |
| `recomputeCephAnalysis by non-member returns 404 not 403 (EF-IMG-003)` | `CephMgmt_recomputeCephAnalysis` | EF-IMG-003 |
| `deleteCephLandmark by non-member returns 404 not 403 (EF-IMG-004)` | `CephMgmt_deleteCephLandmark` | EF-IMG-004 |
| `updateCephLandmark by non-member returns 404 not 403 (EF-IMG-005)` | `CephMgmt_updateCephLandmark` | EF-IMG-005 |

Each test:
- Sets `hasMembership: false` in `makeCephDb`
- Asserts `res.status === 404`
- Asserts `res.status !== 403` (information-leak guard)

## Test Run Results

```
56 pass
0 fail
109 expect() calls  →  (was 52 pass / 0 fail before this slice)
```

Command: `DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase_test bun test src/handlers/dental-imaging/ceph.test.ts`

## Coverage Before / After

| Handler | Before (branch-catch line) | After |
|---------|---------------------------|-------|
| `createCephReport.ts` | line 44 uncovered | covered |
| `recomputeCephAnalysis.ts` | line 40 uncovered | covered |
| `deleteCephLandmark.ts` | line 37 uncovered | covered |
| `updateCephLandmark.ts` | line 45 uncovered | 100.00% |
| `batchUpsertCephLandmarks.ts` | already covered | 100.00% |

## Commit

`0251d010` — `fix(dental-imaging): EF-IMG-001-005 — add assertBranchRole to 5 ceph handlers`
