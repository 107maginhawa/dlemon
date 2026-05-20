# Dental Scheduling Module Specification

**Module:** `dental-scheduling`
**Version:** 1.0
**Status:** Implemented

## Overview

The dental-scheduling module manages appointment lifecycle for dental branches. It supports creating, rescheduling, checking in, and cancelling appointments, with soft double-booking detection at create time and hard conflict blocking at reschedule time. Check-in creates a linked visit record; the visit survives appointment cancellation.

## Schema

### Tables

| Table | Purpose |
|-------|---------|
| `dental_appointment` | Single appointment row: patient, dentist, branch, time slot, status, visit linkage |

### `dental_appointment` Columns

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | No | gen | `baseEntityFields` |
| `patient_id` | uuid | No | — | FK → `patients` |
| `dentist_member_id` | uuid | No | — | FK → `dental_memberships` |
| `branch_id` | uuid | No | — | FK → `dental_branches` |
| `scheduled_at` | timestamptz | No | — | Start time of appointment |
| `duration_minutes` | integer | No | 30 | Slot length in minutes |
| `service_type` | text | No | — | Free-text service description |
| `operatory_id` | uuid | Yes | NULL | Optional operatory assignment |
| `walk_in` | boolean | No | false | True for same-day walk-ins |
| `status` | enum | No | `scheduled` | See status enum below |
| `check_in_time` | timestamptz | Yes | NULL | Set on check-in |
| `visit_id` | uuid | Yes | NULL | FK → `dental_visits`; set on check-in |
| `notes` | text | Yes | NULL | Free-text clinical notes |
| `cancelled_at` | timestamptz | Yes | NULL | Set on cancellation |
| `cancellation_reason` | text | Yes | NULL | Staff-supplied reason |
| `no_show_at` | timestamptz | Yes | NULL | Set when marked no-show |

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `dental_appointment_branch_id_idx` | `branch_id` | Branch-scoped list queries |
| `dental_appointment_dentist_member_id_idx` | `dentist_member_id` | Dentist schedule lookups |
| `dental_appointment_patient_id_idx` | `patient_id` | Patient appointment history |
| `dental_appointment_scheduled_at_idx` | `scheduled_at` | Time-range queries |

### Status Enum

`scheduled` | `checked_in` | `completed` | `cancelled` | `no_show`

## State Machine

### SM-01: Appointment Status

```
                ┌──────────────┐
           ┌───▶│  checked_in  │───▶ completed (terminal)
           │    └──────────────┘
           │           │
           │           ▼
scheduled ─┤         cancelled (terminal)
           │
           │    ┌──────────────┐
           ├───▶│   cancelled  │ (terminal)
           │    └──────────────┘
           │
           │    ┌──────────────┐
           └───▶│   no_show    │───▶ completed (terminal)
                └──────────────┘
```

**Transition table (`APPOINTMENT_TRANSITIONS`):**

| From | To (allowed) | Notes |
|------|-------------|-------|
| `scheduled` | `checked_in`, `cancelled`, `no_show` | Normal progression or early exit |
| `checked_in` | `completed`, `cancelled`, `no_show` | |
| `completed` | — (terminal) | |
| `cancelled` | — (terminal) | |
| `no_show` | `completed` | Reversible — late arrival can be completed |

Invalid transitions throw `422 INVALID_STATUS_TRANSITION`.

**Enforced in:** `updateAppointment.ts` and `cancelAppointment.ts` via `APPOINTMENT_TRANSITIONS` constant in `dental-appointment.schema.ts`.

## Business Rules

### BR-004: Check-in creates a visit; visit outlives the appointment

**Rule:** When an appointment is checked in, a `dental_visit` record is created and linked via `dental_appointment.visit_id`. If the appointment is subsequently cancelled or deleted, the visit record is **not** deleted — it has its own independent lifecycle.

**Implementation:** `checkInAppointment.ts` creates the visit, sets `check_in_time`, and writes `visit_id`. No cascade delete is defined between `dental_appointment` and `dental_visits`.

---

### FR3.7: Soft double-booking warning (create) vs. hard block (reschedule)

**Rule:** The system intentionally permits double-booking at create time but surfaces a visible warning to staff. Rescheduling into a conflicting slot is a hard 409 block.

| Operation | Conflict behaviour |
|-----------|-------------------|
| `POST /dental/appointments` (create) | `201 Created` + `DOUBLE_BOOKING` warning in response body |
| `PATCH /dental/appointments/:id` (reschedule) | `409 Conflict` — hard block, no appointment written |

**Rationale:** Dental practices frequently need to over-book specific dentists (emergency patients, extended procedures that slip). Blocking at create time would require staff to use a workaround. The warning is prominent enough to catch accidental double-booking while allowing intentional override.

**No DB constraint:** Migrations `0027` (CREATE UNIQUE INDEX on `dentist_member_id + scheduled_at`) and `0028` (DROP that same index) are both in the journal and cancel each other out. **No unique constraint exists in the live database.** The soft-warn/hard-block split is the sole enforcement mechanism.

**Implementation:** `createAppointment.ts` queries for overlapping appointments for the same dentist in the same time window; if found, it proceeds with the insert and appends `{ warnings: [{ code: 'DOUBLE_BOOKING', ... }] }` to the `201` response. `updateAppointment.ts` performs the same overlap check but throws `ConflictError` on any hit.

---

### BR-SCH-001: Branch isolation

**Rule:** All scheduling endpoints enforce branch-level access. Callers without an active membership in the appointment's branch receive 403.

**Implementation:** All handlers call `assertBranchAccess(db, user.id, branchId)` from `@/handlers/shared/assert-branch-access`. The `branchId` is read from the appointment record (not user-supplied) for single-resource operations.

---

### BR-SCH-002: Walk-in appointments bypass slot availability

**Rule:** Appointments created with `walk_in: true` are treated as same-day ad-hoc entries. They still trigger the double-booking soft-warn (FR3.7) but are not subject to working-hours validation.

**Implementation:** `createAppointment.ts` skips the working-hours window check when `walkIn === true`.

---

### BR-SCH-003: Cancellation requires a reason

**Rule:** `POST /dental/appointments/:id/cancel` requires a `cancellation_reason` field. Omitting it returns 422.

**Implementation:** `cancelAppointment.ts` input schema requires `cancellationReason: z.string().min(1)`. On success, writes `cancelled_at = now()` and `cancellation_reason`.

---

### BR-SCH-004: Working hours are branch-scoped

**Rule:** Working hours are defined per branch (not per dentist). The `GET /dental/branches/:branchId/working-hours` endpoint returns the branch's weekly schedule. Appointment creation may validate against these hours (see BR-SCH-002 walk-in exception).

**Implementation:** `workingHours.ts` reads from the branch record. No per-dentist override in v1.

---

## Permission Matrix

| Operation | Dentist | Associate | Hygienist | Front Desk |
|-----------|---------|-----------|-----------|------------|
| Create appointment | Yes | Yes | Yes | Yes |
| List appointments | Yes | Yes | Yes | Yes |
| Get appointment | Yes | Yes | Yes | Yes |
| Update / reschedule | Yes | Yes | Yes | Yes |
| Cancel appointment | Yes | Yes | Yes | Yes |
| Check in appointment | Yes | Yes | Yes | Yes |
| View working hours | Yes | Yes | Yes | Yes |

All operations require an active branch membership. Non-members receive 403.

## API Endpoints

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| POST | `/dental/appointments` | `createAppointment` | FR3.7 soft double-booking warn |
| GET | `/dental/appointments` | `listAppointments` | Branch-scoped; filterable by date, dentist, status |
| GET | `/dental/appointments/:appointmentId` | `getAppointment` | |
| PATCH | `/dental/appointments/:appointmentId` | `updateAppointment` | Reschedule + notes; FR3.7 hard conflict block |
| POST | `/dental/appointments/:appointmentId/cancel` | `cancelAppointment` | BR-SCH-003 reason required |
| POST | `/dental/appointments/:appointmentId/check-in` | `checkInAppointment` | BR-004 creates visit |
| GET | `/dental/branches/:branchId/working-hours` | `workingHours` | BR-SCH-004 |

## TypeSpec Source

`specs/api/src/modules/dental-scheduling.tsp`

## Dependencies

- `@/handlers/shared/assert-branch-access` — branch isolation (BR-SCH-001)
- `dental_visit` schema — visit created on check-in (BR-004)
- `dental_membership` schema — dentist member FK + branch access
- `dental_branch` schema — branch FK + working hours
- `patient` schema — patient FK

## Known Gaps

None — all documented business rules are implemented.

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-19 | 1.0 | Initial spec (SM-01, BR-004, FR3.7, BR-SCH-001–004) |
