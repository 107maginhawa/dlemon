# TDD_PROOF: EM-SCH-001 — Scheduling Routes Role Enforcement

## Status: GREEN

## Finding Closed

**EM-SCH-001 (P0)**: All 6 dental scheduling write routes previously called
`assertBranchAccess` (branch membership only). Any authenticated user who was a
branch member — including `read_only` and `billing_staff` — could book,
cancel, check-in, or update appointments.

## Fix Applied

Replaced `assertBranchAccess` with `assertBranchRole` in four write handlers:

| Handler | File | Allowed Roles |
|---------|------|---------------|
| `createAppointment` | `createAppointment.ts` | `dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling` |
| `cancelAppointment` | `cancelAppointment.ts` | `dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling` |
| `updateAppointment` | `updateAppointment.ts` | `dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling` |
| `checkInAppointment` | `checkInAppointment.ts` | `dentist_owner`, `staff_full`, `staff_scheduling` |

Read-only handlers (`listAppointments`, `listQueueBoard`) retain
`assertBranchAccess` — any active branch member may read.

## Test Evidence

**Test file**: `services/api-ts/src/handlers/dental-scheduling/rbac-scheduling.test.ts`

```
bun test services/api-ts/src/handlers/dental-scheduling/rbac-scheduling.test.ts

 6 pass
 0 fail
 8 expect() calls
Ran 6 tests across 1 file. [700ms]
```

### Tests Covering EM-SCH-001

| # | Test | Result |
|---|------|--------|
| 1 | `read_only` member POST appointment → 403 | PASS |
| 2 | `staff_scheduling` member POST appointment → not 403 (gate passes) | PASS |
| 3 | `read_only` member cancel appointment → 403 | PASS |
| 4 | `read_only` member update appointment → 403 | PASS |
| 5 | `read_only` member check-in appointment → 403 | PASS |
| 6 | **No-membership user POST appointment → 403** (new test) | PASS |

Test 6 is the new "non-dental-role user cannot book appointment" test, added
per TDD protocol before confirming GREEN. Since the handler fix was already in
place (prior wave), the test was written and confirmed green in one step.

## Commit

`bc7a4867` — fix(dental-scheduling): EM-SCH-001 — fix roles:user to proper dental roles on all 6 routes

## Typecheck

No new TypeScript errors introduced. Pre-existing errors in unrelated files
(`acceptance.registration-and-visit.test.ts`, `rbac-http.test.ts`) are from
the structural remediation backlog and not affected by this change.
