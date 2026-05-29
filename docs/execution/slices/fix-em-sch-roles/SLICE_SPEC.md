# SLICE_SPEC: EM-SCH-001 — Fix Scheduling Routes Role Enforcement

## Finding

**ID**: EM-SCH-001  
**Severity**: P0  
**Summary**: All 6 dental scheduling routes use `assertBranchAccess` (branch membership only), which allows ANY authenticated user who is a member of a branch to book, cancel, check-in, or update appointments — regardless of their dental role.

## Root Cause

The handlers call `assertBranchAccess(db, user.id, branchId)` which only verifies active branch membership. It does not check the member's `role` column. A `read_only` or `billing_staff` member can book appointments the same as a `dentist_owner`.

## Fix

Replace `assertBranchAccess` with `assertBranchRole` (role-aware variant) in the four write handlers. Read-only handlers (`listAppointments`, `listQueueBoard`) keep `assertBranchAccess` since any branch member may read.

### Route-to-Role Mapping

| Route | Handler | Allowed Roles |
|-------|---------|--------------|
| `POST /dental/appointments` | `createAppointment` | `dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling` |
| `DELETE /dental/appointments/:id` | `cancelAppointment` | `dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling` |
| `POST /dental/appointments/:id/check-in` | `checkInAppointment` | `dentist_owner`, `staff_full`, `staff_scheduling` |
| `PATCH /dental/appointments/:id` | `updateAppointment` | `dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling` |
| `GET /dental/appointments` | `listAppointments` | all dental roles (assertBranchAccess — no change) |
| `GET /dental/branches/:id/queue-board` | `listQueueBoard` | all dental roles (assertBranchAccess — no change) |

## Files Changed

- `services/api-ts/src/handlers/dental-scheduling/createAppointment.ts`
- `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts`
- `services/api-ts/src/handlers/dental-scheduling/checkInAppointment.ts`
- `services/api-ts/src/handlers/dental-scheduling/updateAppointment.ts`

## Test File

`services/api-ts/src/handlers/dental-scheduling/rbac-scheduling.test.ts`

## TDD Sequence

1. Write failing test (RED): `read_only` role member calling `POST /dental/appointments` returns 403
2. Implement fix: swap `assertBranchAccess` → `assertBranchRole` (GREEN)
3. Verify allowed role passes through the gate (not 403)
