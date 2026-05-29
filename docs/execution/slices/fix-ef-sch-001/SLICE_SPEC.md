# SLICE_SPEC: fix-ef-sch-001

## Finding
**EF-SCH-001 (P0)** — DE-010 AppointmentBooked + DE-011 AppointmentCancelled never emitted.

## Problem
The `createAppointment` and `cancelAppointment` handlers completed their DB operations successfully but never enqueued any domain events. Downstream consumers (audit, notifications, analytics) that depend on DE-010 / DE-011 were starved.

## Solution

### New file
`services/api-ts/src/handlers/dental-scheduling/domain-events.ts`
- Declares `DENTAL_SCHEDULING_EVENTS_QUEUE = 'dental.scheduling.domain-events'`
- Exports `DENTAL_SCHEDULING_EVENT_TYPES` (`AppointmentBooked`, `AppointmentCancelled`)
- Exports typed payload interfaces (`AppointmentBookedPayload`, `AppointmentCancelledPayload`)
- Exports `emitAppointmentBooked(scheduler, payload)` — enqueues DE-010
- Exports `emitAppointmentCancelled(scheduler, payload)` — enqueues DE-011

### Modified: createAppointment.ts
- Reads `scheduler = ctx.get('jobs') as JobScheduler | undefined`
- After `repo.createOne()` succeeds, calls `emitAppointmentBooked` with `{ appointmentId, patientId, branchId }` — best-effort, non-blocking (`.catch(() => {})`)

### Modified: cancelAppointment.ts
- After `repo.cancel()` returns a non-null result, reads `scheduler = ctx.get('jobs') as JobScheduler | undefined`
- Calls `emitAppointmentCancelled` with `{ appointmentId, patientId, branchId }` from the returned row — best-effort, non-blocking

## Design decisions
- **Best-effort only**: event emission never blocks or throws; handler response is unaffected by scheduler failures
- **Optional scheduler**: when `ctx.get('jobs')` is undefined (e.g. stripped test contexts), code is a no-op — existing tests continue to pass unchanged
- **Separate queue**: `dental.scheduling.domain-events` is distinct from `dental.audit.domain-events` so scheduling events can be consumed independently
- **Payload shape**: `{ event, appointmentId, patientId, branchId }` — minimal discriminated union, sufficient for all downstream consumers

## Files changed
- `services/api-ts/src/handlers/dental-scheduling/domain-events.ts` (new)
- `services/api-ts/src/handlers/dental-scheduling/createAppointment.ts` (emit DE-010)
- `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts` (emit DE-011)
- `services/api-ts/src/handlers/dental-scheduling/domain-events.test.ts` (new — 8 tests)
