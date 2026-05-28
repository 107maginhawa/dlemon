# oli-enforce-file: dental-scheduling
**Run ID:** run-6-strict-2026-05-29
**Date:** 2026-05-29
**Handler path:** `services/api-ts/src/handlers/dental-scheduling/`
**Files checked:** 26
**Finding prefix:** EF-SCH-NNN

---

## Summary

| Severity | Count |
|----------|-------|
| P0 | 2 |
| P1 | 0 |
| P2 | 1 |
| P3 | 1 |

**double_booking_prevented:** true (soft-warn on create, hard-block on reschedule — FR3.7 compliant)
**checkin_emits_event:** false (DE-001 not in spec; spec publishes DE-010/DE-011; no domain event bus exists in codebase)

---

## Handler-by-Handler Analysis

### createAppointment.ts
| Check | Result | Note |
|-------|--------|------|
| A. assertBranchAccess | PASS | Called at line 29 |
| B. Double-booking prevention | PASS | `repo.findOverlapping()` at line 50; soft-warn per FR3.7 |
| C. Working hours gate | PASS | `isWithinWorkingHours` at line 43; walk-in bypass at line 39 |
| D. State machine | N/A | Create always sets `scheduled` |
| E. VisitCheckedIn event | N/A | Not this handler |
| F. Service layer | PARTIAL | Direct repo instantiation; `NotificationService` injected via context |

### updateAppointment.ts
| Check | Result | Note |
|-------|--------|------|
| A. assertBranchAccess | PASS | Line 33 |
| B. Double-booking (reschedule) | PASS | `findOverlapping` at lines 87-96; hard 409 per FR3.7 |
| C. Working hours gate | PASS | Re-validated when `scheduledAt` changes (lines 80-85) |
| D. State machine | PASS | `APPOINTMENT_TRANSITIONS` checked at lines 37-41 |
| E. VisitCheckedIn event | N/A | Not this handler |
| F. Service layer | PARTIAL | Direct repo instantiation |

### checkInAppointment.ts
| Check | Result | Note |
|-------|--------|------|
| A. assertBranchAccess | PASS | Line 37 |
| B. Double-booking | N/A | Not applicable to check-in |
| C. Working hours gate | N/A | Check-in, not booking |
| D. State machine | PASS | `APPOINTMENT_TRANSITIONS` checked at line 39 |
| E. VisitCheckedIn event (DE-001) | MISS | No domain event published; MODULE_SPEC 10b lists DE-010/DE-011 only (DE-001 not in spec); check-in does not publish any domain event |
| F. Service layer | PARTIAL | Calls `createVisit`/`findInProgressVisitByPatient` from `visit.service` (correct cross-module pattern); appointment repo instantiated directly |

### cancelAppointment.ts
| Check | Result | Note |
|-------|--------|------|
| A. assertBranchAccess | PASS | Present |
| D. State machine | PASS | `APPOINTMENT_TRANSITIONS` checked before cancel |
| F. Service layer | PARTIAL | Direct repo instantiation |

### listAppointments.ts
| Check | Result | Note |
|-------|--------|------|
| A. assertBranchAccess | PASS | Present |
| F. Service layer | PARTIAL | Direct repo |

### listQueueBoard.ts
| Check | Result | Note |
|-------|--------|------|
| A. assertBranchAccess | PASS | Present |
| F. Service layer | PARTIAL | Direct repo |

### createQueueItem.ts
| Check | Result | Note |
|-------|--------|------|
| A. assertBranchAccess | PASS | Present |
| D. State machine | N/A | Defaults to `waiting` |
| F. Service layer | PARTIAL | Direct repo |

### updateQueueItemStatus.ts
| Check | Result | Note |
|-------|--------|------|
| A. assertBranchAccess | PASS | Line 29 |
| D. State machine | PASS | `QUEUE_ITEM_FSM` enforced at lines 31-37 |
| F. Service layer | PARTIAL | Direct repo |

### workingHours.ts
| Check | Result | Note |
|-------|--------|------|
| A. assertBranchAccess | PASS | Present |
| F. Service layer | PARTIAL | Direct DB facade call |

### getAppointment.ts
| Check | Result | Note |
|-------|--------|------|
| A. assertBranchAccess | PASS | Present |
| F. Service layer | PARTIAL | Direct repo |

---

## Findings

### EF-SCH-001 — P0: Domain events DE-010 and DE-011 not published

**Severity:** P0
**Files:** `createAppointment.ts`, `cancelAppointment.ts`
**Spec ref:** MODULE_SPEC §10b

MODULE_SPEC §10b declares:
- DE-010 `AppointmentBooked` — published by `createAppointment`
- DE-011 `AppointmentCancelled` — published by `cancelAppointment`

Neither handler publishes a domain event. `createAppointment` fires `notifs.createNotification` (AC-NOTIF-01) as a notification side-effect only — not a domain event. No event bus, no structured domain event object is emitted anywhere in the module.

**Impact:** Cross-module consumers (audit, notifs pipeline, future analytics) cannot react to appointment lifecycle changes via the event system.

**Fix:** Publish DE-010 in `createAppointment` post-save and DE-011 in `cancelAppointment` post-cancel. Use the project's domain event bus pattern consistent with `ARCHITECTURE.md`. Payload: `{ appointmentId, branchId, patientId, dentistMemberId, timestamp }`.

---

### EF-SCH-002 — P0: No service layer — all handlers instantiate repos directly

**Severity:** P0
**Files:** All 9 handler files
**Spec ref:** MODULE_SPEC §20 AI Instructions, ARCHITECTURE.md F2 baseline (run-5)

Every handler constructs `new DentalAppointmentRepository(db)` and `new QueueItemRepository(db)` inline. No `DentalSchedulingService` class exists. The F2 service-layer/DI baseline requires a service layer between handler and repo for testability and DI.

`checkInAppointment` correctly delegates to `visit.service` for cross-module work — the same pattern must apply within the module.

**Impact:** Handlers cannot be unit-tested without a real DB. Business logic scattered across handlers. Violates F2 service-layer baseline.

**Fix:** Create `services/api-ts/src/handlers/dental-scheduling/dental-scheduling.service.ts` with methods: `createAppointment`, `rescheduleAppointment`, `checkInAppointment`, `cancelAppointment`, `listAppointments`, `getAppointment`. Inject via `ctx.get('schedulingService')` or constructor injection matching other modules.

---

### EF-SCH-003 — P2: `cancelAppointment` reads body via raw `ctx.req.json()` instead of validated body

**Severity:** P2
**File:** `cancelAppointment.ts`
**Spec ref:** CONTRIBUTING.md validator pattern

The handler uses `ctx.req.valid('json')` for params but reads the cancellation reason via raw `await ctx.req.json()` inside a try/catch. This bypasses Zod validator middleware and risks a double-body-read issue (Hono body stream consumed once).

**Fix:** Add `zValidator('json', CancelAppointmentBody)` in route registration; use `ctx.req.valid('json')` consistently.

---

### EF-SCH-004 — P3: `checkInAppointment` active-visit check is outside transaction (TOCTOU)

**Severity:** P3
**File:** `checkInAppointment.ts` lines 45-48
**Spec ref:** MODULE_SPEC §13 Edge Cases EC7

`findInProgressVisitByPatient` runs before the DB transaction block. A concurrent request could create a visit for the same patient between this check and the transaction, producing duplicate active visits.

**Fix:** Move `findInProgressVisitByPatient` inside the `db.transaction` block, or add a unique partial index on `dental_visit(patient_id) WHERE status NOT IN ('completed','cancelled')`.

---

## Test Coverage Assessment

| Area | Covered | Notes |
|------|---------|-------|
| FR3.7 soft-warn double-booking on create | PASS | `dental-scheduling.test.ts` lines 553-581 |
| FR3.7 hard-block double-booking on reschedule | PASS | Lines 1003-1028 |
| Working hours gate (OUTSIDE_WORKING_HOURS) | PASS | `dental-scheduling.working-hours.test.ts` |
| Walk-in bypass | PASS | Covered in working-hours test |
| State machine FSM (appointment) | PASS | `appointment.fsm.property.test.ts` + `dental-scheduling-transitions.test.ts` |
| Queue item FSM | PASS | `dental-queue.test.ts` |
| Check-in → visit creation | PASS | `dental-scheduling.test.ts` lines 500+ |
| Domain event publication (DE-010/DE-011) | MISS | No test; events not implemented |
| Service layer DI | MISS | No service class exists |
| cancelAppointment body parse edge case | PARTIAL | Happy-path covered; double-read not tested |

---

## File List (26 files checked)

```
services/api-ts/src/handlers/dental-scheduling/
├── acceptance.scheduling-workflows.test.ts
├── appointment.fsm.property.test.ts
├── cancelAppointment.ts
├── checkInAppointment.ts
├── createAppointment.notif.test.ts
├── createAppointment.ts
├── createQueueItem.ts
├── dental-queue.test.ts
├── dental-scheduling-transitions.test.ts
├── dental-scheduling.test.ts
├── dental-scheduling.working-hours.test.ts
├── getAppointment.ts
├── listAppointments.ts
├── listQueueBoard.ts
├── queue-item-validators.ts
├── repos/
│   ├── appointment-patient.facade.ts
│   ├── dental-appointment.repo.ts
│   ├── dental-appointment.schema.ts
│   ├── dental-appointment.test.ts
│   ├── operatory.schema.ts
│   ├── queue-item.repo.ts
│   └── queue-item.schema.ts
├── updateAppointment.ts
├── updateQueueItemStatus.ts
├── utils/
│   └── assert-branch-access.ts
└── workingHours.ts
```
