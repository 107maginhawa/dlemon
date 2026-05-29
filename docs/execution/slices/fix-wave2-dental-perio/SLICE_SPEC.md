# Slice Spec: fix-wave2-dental-perio

## Finding

**EF-PER-002** — `staff_scheduling` incorrectly included in `assertBranchRole` allowed-roles list for read endpoints in the `dental-perio` module.

## Affected Files

| File | Location |
|------|----------|
| `getVisitPerioChart.ts` | `services/api-ts/src/handlers/dental-perio/getVisitPerioChart.ts` |
| `getPerioChart.ts` | `services/api-ts/src/handlers/dental-perio/getPerioChart.ts` |
| `dental-perio-coverage.test.ts` | `services/api-ts/src/handlers/dental-perio/dental-perio-coverage.test.ts` |

## Root Cause

MODULE_SPEC Section 6 (Permissions) defines:

| Action | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|--------|:---:|:---:|:---:|:---:|
| View chart | ✅ | ✅ | ✅ | ❌ |

Both `getVisitPerioChart` and `getPerioChart` pass `'staff_scheduling'` in the `assertBranchRole` allowed-roles array, granting read access that the spec explicitly forbids.

## Fix

Remove `'staff_scheduling'` from the `assertBranchRole` call in both handler files.

Allowed roles after fix:
```typescript
['dentist_owner', 'dentist_associate', 'hygienist', 'staff_full']
```

Note: `hygienist` is retained — it is a clinical role that legitimately reads perio data (as a treating clinician). The MODULE_SPEC table does not enumerate every role; `hygienist` is granted the same read access as `staff_full` because perio charting is a core hygienist workflow.

## Tests Added / Updated

Test file: `dental-perio-coverage.test.ts`

New test in `describe('getVisitPerioChart')`:
- `returns 403 for staff_scheduling role` — verifies `staff_scheduling` member receives 403 on `GET /dental/visits/:visitId/perio-chart`.

New test in `describe('getPerioChart')`:
- `returns 403 for staff_scheduling role` — verifies `staff_scheduling` member receives 403 on `GET /dental/perio-charts/:chartId`.

The `NON_DENTIST` fixture (already seeded with `staff_scheduling` role) is reused for both new tests.

## Commit

`fix(dental-perio): EF-PER-002 — remove staff_scheduling from read endpoint allowed roles`
