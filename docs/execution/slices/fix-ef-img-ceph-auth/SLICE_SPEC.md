# SLICE_SPEC: EF-IMG-001-005 — Add assertBranchRole to 5 Ceph Handlers

## Finding IDs
- EF-IMG-001 · `createCephReport.ts` — P0 branch auth
- EF-IMG-002 · `batchUpsertCephLandmarks.ts` — P0 branch auth
- EF-IMG-003 · `recomputeCephAnalysis.ts` — P0 branch auth
- EF-IMG-004 · `deleteCephLandmark.ts` — P0 branch auth
- EF-IMG-005 · `updateCephLandmark.ts` — P0 branch auth

## Pre-flight Finding

Upon inspection (2026-05-29), all 5 canonical handlers **already contain** `assertBranchRole`:

| Handler | Line | Call |
|---------|------|------|
| `createCephReport.ts` | 43 | `await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate'])` |
| `batchUpsertCephLandmarks.ts` | 49 | same |
| `recomputeCephAnalysis.ts` | 39 | same |
| `deleteCephLandmark.ts` | 36 | same |
| `updateCephLandmark.ts` | 45 | same |

The audit (EF-IMG-001-005) was generated from a pre-fix snapshot.

## Gap Found: Missing Branch-Auth Tests

Coverage report shows lines 37/40/44 (the `catch → NotFoundError` branches) are uncovered for
`recomputeCephAnalysis`, `deleteCephLandmark`, and `createCephReport`. The "Branch isolation"
describe block in `ceph.test.ts` only covers `batchUpsertCephLandmarks` and `getCephAnalysis`.

**Missing tests (the real fix):**
- `createCephReport` non-member → 404
- `recomputeCephAnalysis` non-member → 404
- `deleteCephLandmark` non-member → 404
- `updateCephLandmark` non-member → 404 (partial; tests exist but not the non-member path)

## Fix Plan

1. Add branch-isolation tests to `ceph.test.ts` for the 4 uncovered handlers.
2. Tests must cover the `catch → throw new NotFoundError('Image not found')` path.
3. All 5 handlers are verified in the "Branch isolation" section.
4. Run `bun test` — all tests must pass.
5. Update audit file to reflect CLOSED status.

## Import Path for assertBranchRole
```typescript
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
```

## Roles
```typescript
['dentist_owner', 'dentist_associate']
```

## Pattern (already present — used as reference)
```typescript
try {
  await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);
} catch {
  throw new NotFoundError('Image not found');
}
```
