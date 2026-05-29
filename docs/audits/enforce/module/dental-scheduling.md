<!-- oli-version: 1.1 | generated: 2026-05-29 | skill: oli-enforce-module | run: 7 -->

# Enforcement Report: dental-scheduling

**Module:** dental-scheduling
**Run:** 7 (Wave3 post-fix verification)
**Generated:** 2026-05-29
**Skill:** oli-enforce-module v1.1

---

## Summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| Public API Completeness | 10/10 | All 5 spec endpoints + queue CRUD implemented and auth-gated |
| Workflow Implementation | 8/10 | WF-006/007/024/059/060 implemented; WF-081 (24h reminder) absent |
| Domain Term Consistency | 10/10 | All spec terms used correctly; no drift detected |
| State Machine Enforcement | 7/10 | 3 undeclared transitions in code; diagram vs implementation mismatch |
| Event Publishing | 8/10 | DE-010/011 emitted on create/delete but not on PATCH cancel path |
| Auth / Permission Enforcement | 6/10 | 2 permission mismatches vs spec section 6 (cancel + check-in role lists wrong) |
| Observability | 5/10 | None of the 4 required log hooks from section 17 are emitted |
| Audit Compliance | 6/10 | Book audit present; cancel audit absent per AUDIT_CONTRACTS.md |

**Overall Compliance Score: 72/100**
**P0 cap applied: YES (auth mismatches cap score)**

**v1_status: PARTIAL**
**service_layer_status: PRESENT** (DentalAppointmentRepository + QueueItemRepository + facade pattern)

---

## Findings

### P0 Findings (Fix Immediately — Blocks Ship)

---

#### EM-SCH-a564d893
**Severity:** P0
**Title:** cancelAppointment allows dentist_associate and staff_scheduling — spec restricts to staff_full and dentist_owner only
**Description:** The `cancelAppointment` handler calls `assertBranchRole` with `['dentist_owner', 'dentist_associate', 'staff_full', 'staff_scheduling']`. MODULE_SPEC section 6 (Permissions table, Cancel row) specifies only `staff_full, dentist_owner` are allowed to cancel. This means `dentist_associate` and `staff_scheduling` can cancel appointments they should not be able to. This is a security/permission over-grant P0.
**File:** `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts:33-35`
**Spec Section:** section 6 Permissions — Cancel row
**Confidence:** HIGH

**Fix:** Change `assertBranchRole` call to `['dentist_owner', 'staff_full']` only.

---

#### EM-SCH-4afe5eab
**Severity:** P0
**Title:** checkInAppointment role list wrong — allows staff_scheduling (not permitted), excludes dentist_associate (required)
**Description:** The `checkInAppointment` handler calls `assertBranchRole` with `['dentist_owner', 'staff_full', 'staff_scheduling']`. MODULE_SPEC section 6 specifies check-in is allowed for `staff_full, dentist_owner, dentist_associate` and explicitly states "Not staff_scheduling". The code (a) wrongly grants access to `staff_scheduling` and (b) denies access to `dentist_associate`. Both are permission enforcement errors.
**File:** `services/api-ts/src/handlers/dental-scheduling/checkInAppointment.ts:38-40`
**Spec Section:** section 6 Permissions — Check-in row ("Not staff_scheduling")
**Confidence:** HIGH

**Fix:** Change `assertBranchRole` call to `['dentist_owner', 'dentist_associate', 'staff_full']` — remove `staff_scheduling`, add `dentist_associate`.

---

### P1 Findings (Fix Before New Work)

---

#### EM-SCH-9f6305ad
**Severity:** P1
**Title:** updateAppointment cancels via PATCH but does not emit DE-011 AppointmentCancelled domain event
**Description:** `updateAppointment` handles `status === 'cancelled'` (line 62-66) which sets appointment status to cancelled via `repo.cancel()`. However, `emitAppointmentCancelled` is never called from `updateAppointment.ts` — no import of `domain-events` exists in that file. The `cancelAppointment` (DELETE) handler correctly emits DE-011, but the PATCH path for cancellation silently skips the event. Any consumer of DE-011 (e.g. notifs module) will miss cancellations triggered via PATCH.
**File:** `services/api-ts/src/handlers/dental-scheduling/updateAppointment.ts`
**Spec Section:** section 10b Domain Events — "Published: DE-011 AppointmentCancelled"
**Confidence:** HIGH

**Fix:** Import `emitAppointmentCancelled` from `./domain-events` and emit it after `repo.cancel()` succeeds in the `status === 'cancelled'` branch of `updateAppointment`.

---

#### EM-SCH-26cb6cb7
**Severity:** P1
**Title:** cancelAppointment missing audit log — AUDIT_CONTRACTS.md requires DELETED audit event for appointment cancellation
**Description:** `AUDIT_CONTRACTS.md` explicitly lists `dental-scheduling / Cancel appointment / DELETED / YES` as a required audit entry. The `cancelAppointment` handler performs no `logAuditEvent` call. Only `createAppointment` has the AL-009 audit trail. Cancellations are completely absent from the audit log, violating the compliance contract.
**File:** `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts`
**Spec Section:** section 17 Observability; AUDIT_CONTRACTS.md dental-scheduling cancel row
**Confidence:** HIGH

**Fix:** Add `logAuditEvent(db, logger, { action: 'appointment.cancel', resourceType: 'dental_appointment', resourceId: result.id, ... })` after successful cancellation, mirroring the AL-009 pattern in `createAppointment.ts`.

---

#### EM-SCH-9a7ac86b
**Severity:** P1
**Title:** WF-081 (24h SMS reminder notification) not implemented — feature flag defined but no job registered
**Description:** MODULE_SPEC section 3 lists WF-081 [INFERRED] as a System pg-boss job for 24h appointment reminders. Feature flag `dental_scheduling_sms_reminder` is declared in section 18. No job is registered or scheduled anywhere in `services/api-ts/src/handlers/dental-scheduling/`. The booking module has a commented-out `reminderSenderJob` at `handlers/booking/jobs/index.ts:35` but it is not wired to dental-scheduling appointments.
**File:** `services/api-ts/src/handlers/dental-scheduling/` (no job file present)
**Spec Section:** section 3 Workflows — WF-081; section 18 Feature Flags — dental_scheduling_sms_reminder
**Confidence:** HIGH

**Fix:** Implement a pg-boss scheduled job (guarded by the `dental_scheduling_sms_reminder` feature flag) that queries `dental_appointment` for appointments 24h out and sends notification via the notifs service. Register via the booking jobs pattern.

---

### P2 Findings (Fix When Touching)

---

#### EM-SCH-3fb0c5f0
**Severity:** P2
**Title:** Code allows checked_in to cancelled and checked_in to no_show transitions not declared in spec state diagram
**Description:** MODULE_SPEC section 8 state diagram shows only `checked_in -- completed`. The `APPOINTMENT_TRANSITIONS` map also allows `checked_in -> cancelled` and `checked_in -> no_show`. These transitions are not declared in the spec. They may be intentional for clinical workflows but are undocumented deviations.
**File:** `services/api-ts/src/handlers/dental-scheduling/repos/dental-appointment.schema.ts:62-68`
**Spec Section:** section 8 State Transitions
**Confidence:** HIGH

**Fix (document):** Update MODULE_SPEC section 8 to formally declare `checked_in -> cancelled` and `checked_in -> no_show` transitions with guards, or remove them from `APPOINTMENT_TRANSITIONS` if they are not intended.

---

#### EM-SCH-1774f683
**Severity:** P2
**Title:** Code allows no_show to completed reversal not declared in spec state machine
**Description:** `APPOINTMENT_TRANSITIONS` includes `no_show: ['completed']` enabling reversal of a no-show. MODULE_SPEC section 8 state diagram shows only `scheduled -> no_show` with no outgoing arrow from `no_show`. Edge case section 13 says "No-show appointment: status no_show; no visit created" but does not mention reversibility. This is a functional extension missing from the spec.
**File:** `services/api-ts/src/handlers/dental-scheduling/repos/dental-appointment.schema.ts:67`
**Spec Section:** section 8 State Transitions; section 13 Edge Cases
**Confidence:** HIGH

**Fix (document):** Update MODULE_SPEC section 8 to add `no_show -> completed (reversible)` and section 13 to document the no-show reversal behavior, or add as AC-SCH-006.

---

#### EM-SCH-1036b474
**Severity:** P2
**Title:** dental-scheduling.booked INFO observability hook missing from createAppointment
**Description:** MODULE_SPEC section 17 requires `dental-scheduling.booked (INFO)` log. `createAppointment.ts` emits an audit event (AL-009) via `logAuditEvent` but does not emit a structured Pino log with the `dental-scheduling.booked` event name. The logger is retrieved from context but only used indirectly via audit. The spec log hook format is absent.
**File:** `services/api-ts/src/handlers/dental-scheduling/createAppointment.ts`
**Spec Section:** section 17 Observability Hooks
**Confidence:** HIGH

---

#### EM-SCH-f4bc3753
**Severity:** P2
**Title:** dental-scheduling.checked-in INFO observability hook missing from checkInAppointment
**Description:** MODULE_SPEC section 17 requires `dental-scheduling.checked-in (INFO)` log. `checkInAppointment.ts` has no logger retrieval or structured log emission. No observability hook fires on successful check-in.
**File:** `services/api-ts/src/handlers/dental-scheduling/checkInAppointment.ts`
**Spec Section:** section 17 Observability Hooks
**Confidence:** HIGH

---

#### EM-SCH-accc8b69
**Severity:** P2
**Title:** dental-scheduling.cancelled INFO observability hook missing from cancelAppointment
**Description:** MODULE_SPEC section 17 requires `dental-scheduling.cancelled (INFO, with reason)` log. `cancelAppointment.ts` has no `logger` context extraction or structured log emission after successful cancellation. Cancellation reason (required by BR-SCH-003) is never logged in the observability stream.
**File:** `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts`
**Spec Section:** section 17 Observability Hooks
**Confidence:** HIGH

---

#### EM-SCH-d6fb7680
**Severity:** P2
**Title:** dental-scheduling.double-booking WARN observability hook missing — only response warning set
**Description:** MODULE_SPEC section 17 requires `dental-scheduling.double-booking (WARN)` log. `createAppointment.ts` detects overlap at line 56-60 and pushes `'DOUBLE_BOOKING'` to the `warnings` array returned in the response body, but does not emit `logger.warn({ event: 'dental-scheduling.double-booking', ... })`. No WARN-level observability hook fires on double-booking detection.
**File:** `services/api-ts/src/handlers/dental-scheduling/createAppointment.ts:56-60`
**Spec Section:** section 17 Observability Hooks
**Confidence:** HIGH

---

## Public API Completeness Inventory

All 5 spec-declared endpoints verified:

| Endpoint | Method | Handler | Auth | Found |
|----------|--------|---------|------|-------|
| POST /dental/appointments | POST | createAppointment.ts | authMiddleware(user) + assertBranchRole | FOUND routes.ts:365 |
| GET /dental/appointments | GET | listAppointments.ts | authMiddleware(user) + assertBranchAccess | FOUND routes.ts:372 |
| PATCH /dental/appointments/:id | PATCH | updateAppointment.ts | authMiddleware(user) + assertBranchRole | FOUND routes.ts:386 |
| POST /dental/appointments/:id/check-in | POST | checkInAppointment.ts | authMiddleware(user) + assertBranchRole | FOUND routes.ts:401 |
| DELETE /dental/appointments/:id | DELETE | cancelAppointment.ts | authMiddleware(user) + assertBranchRole | FOUND routes.ts:394 |

Additional routes (non-spec, not flagged): GET /dental/appointments/:id (getAppointment), POST /dental/appointments/:id/queue-item, GET /dental/branches/:id/queue-board, PATCH /dental/queue-items/:id/status, GET+PUT /dental/branches/:id/working-hours.

**Route discovery total: 10 routes. All 10 have authMiddleware.**

---

## Workflow Implementation Summary

| Workflow | Status | Code Path |
|----------|--------|-----------|
| WF-006 Book appointment | IMPLEMENTED | createAppointment.ts — FR3.7 soft-warn, BR-SCH-002 walk-in, BR-SCH-004 hours |
| WF-007 Check-in to Visit | IMPLEMENTED | checkInAppointment.ts — tx: checkIn + createVisit + linkVisit |
| WF-024 Calendar view | IMPLEMENTED | listAppointments.ts — branch-scoped filter, date/status/dentist filters |
| WF-059 Cancel | IMPLEMENTED | cancelAppointment.ts — BR-SCH-003 reason required, DE-011 emitted |
| WF-060 Reschedule | IMPLEMENTED | updateAppointment.ts — hard-block 409 on overlap, working hours recheck |
| WF-061 Slot generation (G-001) | NOT IMPLEMENTED | Known gap; booking module has stub; dental_scheduling_slot_generation flag defined |
| WF-080 Confirmation notification | IMPLEMENTED | createAppointment.ts:97-105 — best-effort notifs.createNotification |
| WF-081 24h SMS reminder | NOT IMPLEMENTED | Feature flag defined; no pg-boss job wired — P1 finding EM-SCH-9a7ac86b |

---

## State Machine Audit

Spec declares (section 8):
```
scheduled -> checked_in -> completed
scheduled -> cancelled
scheduled -> no_show
```

Code implements (APPOINTMENT_TRANSITIONS in dental-appointment.schema.ts):
```
scheduled   -> [checked_in, cancelled, no_show]        OK — matches spec
checked_in  -> [completed, cancelled, no_show]          P2 — extra transitions not in spec diagram
completed   -> []                                       OK — terminal
cancelled   -> []                                       OK — terminal
no_show     -> [completed]                              P2 — reversal not declared in spec
```

State guards present: YES (APPOINTMENT_TRANSITIONS checked in handlers + repo WHERE clauses with status conditions).
Undeclared transitions: 3 (checked_in->cancelled, checked_in->no_show, no_show->completed) — P2 documentation gaps.

---

## Domain Event Audit

| Event | Declared | Emitted | Where |
|-------|----------|---------|-------|
| DE-010 AppointmentBooked | YES | YES | createAppointment.ts via emitAppointmentBooked |
| DE-011 AppointmentCancelled | YES | PARTIAL | cancelAppointment.ts YES; updateAppointment.ts PATCH cancel path NO |

Undeclared events: none detected.

---

## Service Layer Status

**PRESENT**

- `DentalAppointmentRepository` — `repos/dental-appointment.repo.ts` — full CRUD + lifecycle methods (checkIn, cancel, markNoShow, revertNoShow, findOverlapping, linkVisit)
- `QueueItemRepository` — `repos/queue-item.repo.ts` — queue lifecycle + findActiveByBranch
- `appointment-patient.facade.ts` — join facade for patient name resolution
- `domain-events.ts` — DE-010/011 event emitters via pg-boss JobScheduler

---

## Stabilization Plan

### Fix Now (P0)
1. **EM-SCH-a564d893** — Fix cancelAppointment.ts:33-35 role list to `['dentist_owner', 'staff_full']`
2. **EM-SCH-4afe5eab** — Fix checkInAppointment.ts:38-40 role list to `['dentist_owner', 'dentist_associate', 'staff_full']`

### Fix Before New Work (P1)
3. **EM-SCH-9f6305ad** — Emit DE-011 in updateAppointment PATCH cancel path
4. **EM-SCH-26cb6cb7** — Add logAuditEvent to cancelAppointment (DELETED audit per AUDIT_CONTRACTS.md)
5. **EM-SCH-9a7ac86b** — Implement WF-081 24h reminder pg-boss job behind dental_scheduling_sms_reminder flag

### Fix When Touching (P2)
6. **EM-SCH-1036b474 / EM-SCH-f4bc3753 / EM-SCH-accc8b69 / EM-SCH-d6fb7680** — Add section 17 Pino observability hooks to all 4 handlers
7. **EM-SCH-3fb0c5f0 / EM-SCH-1774f683** — Document undeclared FSM transitions in MODULE_SPEC section 8 or remove them

---

## What's Next

- P0 fixes are minimal targeted edits to 2 files (2 lines each)
- After P0+P1 fixes, re-run `oli-enforce-module --module=dental-scheduling` to verify score improves to ~88+
- P2 observability hooks are a batch edit across 4 handlers
- Module will reach READY status after P0+P1 resolution

---

*Report generated by oli-enforce-module v1.1 | 2026-05-29 | enforcement run-7*
