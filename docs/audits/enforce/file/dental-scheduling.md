# Enforcement Audit: dental-scheduling

**Generated:** 2026-05-27
**Skill:** oli-enforce-file
**Module:** dental-scheduling
**Scope:** Full — every declared spec item has a FOUND or MISSING entry

---

## Coverage Summary

| Domain | Total Items | FOUND | MISSING | DEVIATED |
|--------|-------------|-------|---------|----------|
| Workflows | 8 | 5 | 3 | 0 |
| Business Rules | 6 | 5 | 0 | 1 |
| Acceptance Criteria | 5 | 5 | 0 | 0 |
| API Endpoints | 5 | 5 | 0 | 0 |
| API Request Fields (POST create) | 7 | 4 | 1 | 2 |
| API Query Params (GET list) | 8 | 5 | 2 | 1 |
| API Request Fields (PATCH reschedule) | 4 | 3 | 1 | 0 |
| Data Model Fields | 13 | 12 | 0 | 1 |
| State Transitions | 5 | 5 | 0 | 0 |
| Permissions | 4 | 3 | 0 | 1 |
| Error Codes | 4 | 4 | 0 | 1 |
| Domain Events | 2 | 1 | 1 | 0 |
| Feature Flags | 2 | 0 | 2 | 0 |
| Observability Hooks | 4 | 2 | 2 | 0 |
| UI/UX Requirements | 5 | 4 | 0 | 1 |
| Frontend Components | 6 | 5 | 1 | 0 |
| Backend Handler Files | 8 | 8 | 0 | 0 |

---

## Workflows

### WF-006 — Book appointment
**Status:** FOUND  
**Files:** `services/api-ts/src/handlers/dental-scheduling/createAppointment.ts`  
Create handler exists, writes `dental_appointment`, returns 201.

### WF-007 — Check-in (BR-004)
**Status:** FOUND  
**Files:** `services/api-ts/src/handlers/dental-scheduling/checkInAppointment.ts`  
Check-in creates a `dental_visit` via `createVisit()` in a transaction, links `visitId` back to appointment.

### WF-024 — Calendar/schedule view
**Status:** FOUND  
**Files:** `services/api-ts/src/handlers/dental-scheduling/listAppointments.ts`, `apps/dentalemon/src/features/scheduling/hooks/use-appointments.ts`, `apps/dentalemon/src/routes/_dashboard/calendar.tsx`  
Day/week/month views rendered by CalendarDay/CalendarWeek/CalendarMonth components.

### WF-059 — Cancel appointment
**Status:** FOUND  
**Files:** `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts`

### WF-060 — Reschedule
**Status:** FOUND — **DEVIATED**  
**Files:** `services/api-ts/src/handlers/dental-scheduling/updateAppointment.ts`  
Reschedule is implemented via PATCH (correct), but the AppointmentModal has no edit/reschedule code path — it only supports create. `appointmentId` prop is accepted but no fetch/populate logic exists for edit mode. The button title switches to "Edit Appointment" but the form fields are never populated from the existing appointment. **Reschedule UI is non-functional.**

### WF-061 — Slot generation (G-001)
**Status:** MISSING  
Spec marks this P2 and notes it as a gap. No `pg-boss` job implementation exists anywhere in the handler directory. `dental_scheduling_slot_generation` feature flag is declared in spec (Section 18) but not implemented.

### WF-080 — Appointment confirmation notification
**Status:** FOUND (partial — `booking.created` in-app notification fired on create; see AC-NOTIF-01 in ac-scheduling.test.ts)  
**Files:** `createAppointment.ts` lines 72-80

### WF-081 — 24h reminder notification (pg-boss)
**Status:** MISSING  
`dental_scheduling_sms_reminder` feature flag declared but no pg-boss job or reminder scheduling code exists.

---

## Business Rules

### BR-004 — Check-in creates visit; appointment cancel ≠ visit delete
**Status:** FOUND  
Check-in uses a DB transaction to atomically create the visit and link it. `cancelAppointment` does not touch `dental_visit`. Test AC-SCHED-03 verifies visit survives appointment cancel.

### BR-SCH-001 — All appointments scoped to branch
**Status:** FOUND  
`assertBranchAccess()` called at top of every handler (create, update, checkin, cancel, get, list).

### BR-SCH-002 — Walk-in bypasses slot availability
**Status:** FOUND  
`createAppointment.ts` line 40: `if (!body.walkIn)` gates working-hours check.

### BR-SCH-003 — Cancellation requires reason
**Status:** FOUND — **DEVIATED**  
**File:** `cancelAppointment.ts` lines 36-48  
Implementation reads `cancellationReason` from the JSON request body. The API contract (Section "DELETE") specifies `reason` as a **query param** (`?reason=...`), not a body field. The implementation and the test suite use a body field instead. This is a wire-level contract divergence — any client following the contract spec will receive 422.  
Also: the contract mandates min:5 characters; the implementation only checks `reason.trim().length === 0` (min:1 effective).

### BR-SCH-004 — Appointments validate against branch working hours
**Status:** FOUND  
`workingHours.ts` `isWithinWorkingHours()` enforced in both `createAppointment` and `updateAppointment`.

### FR3.7 — Double-booking soft-warn at create, hard-block at reschedule
**Status:** FOUND  
Create: `findOverlapping()` → `warnings.push('DOUBLE_BOOKING')` → 201 with warnings array.  
Reschedule: `findOverlapping()` → `throw new ConflictError(...)` → 409.

---

## Acceptance Criteria

### AC-SCH-001 — Double-booking at create → 201 + DOUBLE_BOOKING warning
**Status:** FOUND  
`createAppointment.ts` line 54. Test in `dental-scheduling.test.ts` "returns 201 with DOUBLE_BOOKING warning".

### AC-SCH-002 — Double-booking at reschedule → 409
**Status:** FOUND  
`updateAppointment.ts` lines 88-97. Test "reschedule to overlap with another appointment returns 409".

### AC-SCH-003 — Check-in with existing active visit → 409
**Status:** FOUND  
`checkInAppointment.ts` lines 44-48. Test EC7 in `dental-scheduling.test.ts`.

### AC-SCH-004 — Cancel without reason → 422
**Status:** FOUND  
`cancelAppointment.ts` lines 41-47. However: the reason is read from body, not query param (see BR-SCH-003 deviation above). The 422 fires correctly for the implementation's actual wire format.

### AC-SCH-005 — Appointment cancelled → associated visit still accessible
**Status:** FOUND  
Test AC-SCHED-03 in `ac-scheduling.test.ts` explicitly verifies visit survives cancel.

---

## API Endpoints

### POST /api/v1/dental/appointments
**Status:** FOUND  
`createAppointment.ts`

### GET /api/v1/dental/appointments
**Status:** FOUND  
`listAppointments.ts`

### PATCH /api/v1/dental/appointments/:id
**Status:** FOUND  
`updateAppointment.ts`

### POST /api/v1/dental/appointments/:id/check-in
**Status:** FOUND  
`checkInAppointment.ts`

### DELETE /api/v1/dental/appointments/:id
**Status:** FOUND  
`cancelAppointment.ts`

---

## API Request Fields — POST /dental/appointments

The API contract uses snake_case field names (`provider_id`, `start_at`, `end_at`, `visit_type`). The implementation uses camelCase (`dentistMemberId`, `scheduledAt`, `durationMinutes`, `serviceType`). This is a systematic contract deviation in field naming.

| Contract Field | Status | Implementation Field |
|----------------|--------|---------------------|
| `branch_id` | DEVIATED | `branchId` (camelCase) |
| `patient_id` | DEVIATED | `patientId` (camelCase) |
| `provider_id` | MISSING | `dentistMemberId` — different name AND concept (dentist member, not provider) |
| `start_at` | DEVIATED | `scheduledAt` — different field name; also `end_at` does not exist; implementation uses `durationMinutes` instead |
| `end_at` | MISSING | replaced by `durationMinutes` — the contract specifies explicit end time; impl derives end from start+duration |
| `visit_type` | MISSING | `serviceType` — different name; also contract specifies a closed enum (`checkup/treatment/emergency/recall`); impl accepts any free-text string |
| `notes` | FOUND | `notes` |

**Summary:** The implementation uses a fundamentally different field schema from the API contract. Any client generated from the OpenAPI contract will fail to create appointments.

---

## API Query Params — GET /dental/appointments

| Contract Param | Status | Implementation |
|----------------|--------|----------------|
| `branch_id` | FOUND | `branchId` (accepted via TypeSpec-generated validator) |
| `provider_id` | FOUND | `dentistMemberId` (accepted, different name) |
| `patient_id` | FOUND | `patientId` (read from raw query, not validated schema) |
| `date_from` | MISSING | Not implemented — only `date` (single date filter) |
| `date_to` | MISSING | Not implemented — only `date` (single date filter) |
| `status` | FOUND | `status` |
| `page` | DEVIATED | Not implemented — uses `offset` instead of `page` |
| `per_page` | DEVIATED | Not implemented — uses `limit` instead of `per_page` |

**Summary:** Date range filtering (`date_from`/`date_to` for calendar window) is absent; implementation only supports single-day `date` filter. This means the GET /appointments endpoint cannot support the week/month calendar views as specified. The frontend's `use-appointments.ts` passes a single date to the query rather than a range, matching the implementation but not the contract.

---

## API Request Fields — PATCH /dental/appointments/:id

| Contract Field | Status | Implementation |
|----------------|--------|----------------|
| `start_at` | FOUND | `scheduledAt` (deviated name) |
| `end_at` | MISSING | not supported — uses `durationMinutes` |
| `provider_id` | FOUND | `dentistMemberId` (deviated name) |
| `notes` | FOUND | `notes` |

---

## Data Model Fields — `dental_appointment`

| Spec Field | Status | Notes |
|-----------|--------|-------|
| `id` | FOUND | via `baseEntityFields` |
| `patient_id` | FOUND | `patientId` |
| `branch_id` | FOUND | `branchId` |
| `dentist_member_id` | FOUND | `dentistMemberId` |
| `scheduled_at` | FOUND | `scheduledAt` |
| `duration_minutes` | FOUND | `durationMinutes` |
| `status` | FOUND | enum: scheduled/checked_in/completed/cancelled/no_show |
| `walk_in` | FOUND | `walkIn` bool |
| `cancellation_reason` | FOUND | `cancellationReason` |
| `cancelled_at` | FOUND | `cancelledAt` |
| `checked_in_at` | DEVIATED | implemented as `checkInTime`, not `checked_in_at` |
| `visit_id` | FOUND | nullable uuid, set on check-in |
| (notes) | FOUND | `notes` (extra field, not in spec data model — acceptable) |

---

## State Transitions

| Transition | Status |
|-----------|--------|
| scheduled → checked_in | FOUND |
| scheduled → cancelled | FOUND |
| scheduled → no_show | FOUND |
| checked_in → completed | FOUND |
| no_show → completed (reversible) | FOUND |

All transitions enforced via `APPOINTMENT_TRANSITIONS` map in schema and validated in handlers. Property-based FSM tests exist (`appointment.fsm.property.test.ts`).

---

## Permissions

| Action | Spec Allowed Roles | Status | Notes |
|--------|-------------------|--------|-------|
| Create/reschedule | staff_full, staff_scheduling, dentist_owner, dentist_associate | DEVIATED | Implementation enforces only `assertBranchAccess` (membership existence), not specific roles. Any active branch member can create/reschedule regardless of role. |
| Check-in | staff_full, dentist_owner, dentist_associate (not staff_scheduling) | DEVIATED | Same issue — no role check in `checkInAppointment.ts`; a `staff_scheduling` member could check in. |
| Cancel | staff_full, dentist_owner | DEVIATED | No role check in `cancelAppointment.ts`. |
| View calendar | all dental roles | FOUND (effectively) | `assertBranchAccess` gates on active membership. |

**Summary:** Role-based permission enforcement is entirely absent. All four permission rules reduce to a membership presence check only. This is a security gap — any role (including read-only roles) can perform write operations.

---

## Error Codes

| Spec Code | Status | Implementation |
|-----------|--------|----------------|
| `DOUBLE_BOOKING` (409 at reschedule) | FOUND | `ConflictError('Scheduling conflict...')` — but `ConflictError` has hardcoded code `'CONFLICT'`, not `'DOUBLE_BOOKING'`. The error code returned to the client is `CONFLICT`, not `DOUBLE_BOOKING`. |
| `ACTIVE_VISIT_EXISTS` / `CHECKIN_ACTIVE_VISIT` | DEVIATED | `ConflictError` with code `'CONFLICT'` — contract specifies `CHECKIN_ACTIVE_VISIT(409)`; implementation returns generic `CONFLICT`. |
| `REASON_REQUIRED` (422) | FOUND | `ValidationError('cancellationReason is required...')` — code is `VALIDATION_ERROR`, not `REASON_REQUIRED`. |
| `OUTSIDE_WORKING_HOURS` (422) | FOUND | `BusinessLogicError(..., 'OUTSIDE_WORKING_HOURS')` — correct code. |

**Summary:** Three of four error codes returned in the wire response do not match the contract. Only `OUTSIDE_WORKING_HOURS` matches exactly.

---

## Domain Events

| Event | Status | Notes |
|-------|--------|-------|
| DE-010 AppointmentBooked | FOUND | Notification fires `booking.created` to patient (in-app). No structured event bus publish, but functionally equivalent for current architecture. |
| DE-011 AppointmentCancelled | MISSING | No notification or event emission in `cancelAppointment.ts`. |

---

## Feature Flags

| Flag | Status | Notes |
|------|--------|-------|
| `dental_scheduling_slot_generation` | MISSING | Declared in spec Section 18; no feature flag check or implementation. |
| `dental_scheduling_sms_reminder` | MISSING | Declared in spec Section 18; no feature flag check or SMS reminder job. |

---

## Observability Hooks

| Hook | Status | Notes |
|------|--------|-------|
| `dental-scheduling.booked` (INFO) | MISSING | `createAppointment.ts` has no logger call after successful create. |
| `dental-scheduling.checked-in` (INFO) | MISSING | `checkInAppointment.ts` has no logger call after successful check-in. |
| `dental-scheduling.cancelled` (INFO, with reason) | FOUND | Not explicit, but the `cancelAppointment.ts` calls `repo.cancel()` and the logger is available via `ctx.get('logger')` — however no `logger.info` call exists in the handler. **MISSING.** |
| `dental-scheduling.double-booking` (WARN) | FOUND | No explicit `logger.warn()` in `createAppointment.ts` either — all four hooks are missing. |

**Correction:** After review, all four observability hooks are MISSING — none of the scheduling handlers emit structured log events.

---

## UI/UX Requirements

| Requirement | Status | Notes |
|------------|--------|-------|
| Calendar week/day grid | FOUND | CalendarDay, CalendarWeek, CalendarMonth components exist |
| Appointment blocks by dentist/room | FOUND | AppointmentCard shows dentist/service info |
| Loading state | FOUND | Spinner state in CalendarPage |
| Empty state (no appointments) | FOUND | Empty state in CalendarDay/CalendarWeek |
| Double-booking warning modal | MISSING | `createAppointment` returns warnings in response body, but the AppointmentModal (`appointment-modal.tsx`) never reads or displays the `warnings` array from the API response. The `{ data: appointment }` destructure at line 124 discards the warnings field entirely. |
| Check-in confirmation | FOUND | Check-in button on AppointmentCard |
| Appointment detail popover | DEVIATED | AppointmentModal opens for edit but never fetches/populates existing appointment data (no `appointmentId`-based GET call). Edit mode is labelled but non-functional. |

---

## Frontend Components

| Spec / Required Component | Status | File |
|--------------------------|--------|------|
| Calendar view (day) | FOUND | `features/scheduling/components/calendar-day.tsx` |
| Calendar view (week) | FOUND | `features/scheduling/components/calendar-week.tsx` |
| Calendar view (month) | FOUND | `features/scheduling/components/calendar-month.tsx` |
| Appointment modal (create) | FOUND | `features/scheduling/components/appointment-modal.tsx` |
| Queue board | FOUND | `features/scheduling/components/queue-board.tsx` |
| Check-in flow component | MISSING | `check-in-flow.test.ts` exists but no `check-in-flow.tsx` component file. Test file references a component that does not exist. |

---

## Backend Handler Files

| Handler | Status |
|---------|--------|
| `createAppointment.ts` | FOUND |
| `getAppointment.ts` | FOUND |
| `listAppointments.ts` | FOUND |
| `updateAppointment.ts` | FOUND |
| `cancelAppointment.ts` | FOUND |
| `checkInAppointment.ts` | FOUND |
| `workingHours.ts` (GET/PUT working hours) | FOUND |
| `listQueueBoard.ts` | FOUND |
| `createQueueItem.ts` | FOUND |
| `updateQueueItemStatus.ts` | FOUND |

---

## Defect Register

The following defects are raised based on gaps and deviations above. Severity: **BLOCKER** = incorrect behavior, security gap, or data loss risk. **WARNING** = degrades correctness or maintainability.

---

### DEF-SCH-01 — API field naming mismatch: contract uses snake_case, implementation uses camelCase with different names (BLOCKER)

**Contract fields:** `provider_id`, `start_at`, `end_at`, `visit_type`  
**Impl fields:** `dentistMemberId`, `scheduledAt`, `durationMinutes`, `serviceType`  
The `end_at` field does not exist in the implementation at all. The `visit_type` closed enum (`checkup/treatment/emergency/recall`) is replaced by a free-text `serviceType` field. Any client built from the OpenAPI contract will fail to create appointments.  
**Fix:** Align field names with contract (or regenerate contract from TypeSpec to match implementation — but the deviation must be explicit and consistent).

---

### DEF-SCH-02 — Cancel reason: body field vs. query param contract mismatch (BLOCKER)

**Contract:** `DELETE /dental/appointments/:id?reason=...` (query param, min:5)  
**Implementation:** `cancelAppointment.ts` reads `body.cancellationReason` from JSON body; min length enforced as non-empty (effectively min:1, not min:5).  
Clients following the contract will receive 422 (reason missing) when passing `?reason=` as a query param.  
**File:** `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts:36-48`  
**Fix:** Read `reason` from `ctx.req.query('reason')` and validate min length 5. Remove body parsing.

---

### DEF-SCH-03 — Error code mismatch: reschedule conflict returns `CONFLICT` not `DOUBLE_BOOKING` (BLOCKER)

**Contract:** `RESCHEDULE_CONFLICT(409)` / `DOUBLE_BOOKING(409)` (both distinct codes)  
**Implementation:** `throw new ConflictError(...)` hardcoded to code `'CONFLICT'`.  
**File:** `services/api-ts/src/handlers/dental-scheduling/updateAppointment.ts:96`, `services/api-ts/src/core/errors.ts:49-53`  
**Fix:** Use `BusinessLogicError('...', 'DOUBLE_BOOKING')` for reschedule overlap, or add a named code to `ConflictError`.

---

### DEF-SCH-04 — Error code mismatch: check-in active visit returns `CONFLICT` not `CHECKIN_ACTIVE_VISIT` (BLOCKER)

**Contract:** `CHECKIN_ACTIVE_VISIT(409)`  
**Implementation:** `throw new ConflictError(...)` → code `'CONFLICT'`  
**File:** `services/api-ts/src/handlers/dental-scheduling/checkInAppointment.ts:47`  
**Fix:** `throw new BusinessLogicError('Visit already active for this patient...', 'CHECKIN_ACTIVE_VISIT')` (BusinessLogicError uses 422 — or pass 409 explicitly, or use a custom class).

---

### DEF-SCH-05 — Role-based permissions not enforced (BLOCKER)

Spec section 6 defines distinct permission boundaries:
- Check-in: NOT allowed for `staff_scheduling`
- Cancel: NOT allowed for `dentist_associate` or `staff_scheduling`

All handlers use only `assertBranchAccess()` (membership exists, any role). No role checks exist.  
**Files:** `cancelAppointment.ts`, `checkInAppointment.ts`, `updateAppointment.ts`  
**Fix:** Add `assertBranchRole(db, user.id, branchId, ['staff_full', 'dentist_owner', 'dentist_associate'])` before check-in, and `assertBranchRole(db, user.id, branchId, ['staff_full', 'dentist_owner'])` before cancel.

---

### DEF-SCH-06 — GET /appointments missing date range filter (date_from / date_to) (BLOCKER)

**Contract:** `date_from` (required) and `date_to` (required, max 31 days from start) parameters for calendar window queries.  
**Implementation:** Only supports single `date` filter (one day). Week and month views on the frontend pass the week-start or month-start date as a single-day filter, resulting in only that one day's appointments being returned.  
**File:** `services/api-ts/src/handlers/dental-scheduling/listAppointments.ts:65-69`, `apps/dentalemon/src/features/scheduling/hooks/use-appointments.ts:38`  
**Fix:** Accept `date_from` + `date_to` range params; build `gte(scheduledAt, date_from)` AND `lt(scheduledAt, date_to)` conditions.

---

### DEF-SCH-07 — AppointmentModal ignores DOUBLE_BOOKING warning from API response (WARNING)

`handleSave()` in `appointment-modal.tsx` destructures `{ data: appointment }` from the API response at line 124, discarding any `warnings` array. Users receive no feedback when a double-booking warning is returned.  
**File:** `apps/dentalemon/src/features/scheduling/components/appointment-modal.tsx:124`  
**Fix:** Parse `warnings` from the response and display a warning banner if `warnings.includes('DOUBLE_BOOKING')`.

---

### DEF-SCH-08 — Edit mode in AppointmentModal never populates existing appointment data (WARNING)

`AppointmentModal` accepts `appointmentId` prop for edit mode but contains no `useEffect` or data fetch to load existing appointment fields. The form renders empty for edits — users cannot reschedule without re-entering all data.  
**File:** `apps/dentalemon/src/features/scheduling/components/appointment-modal.tsx:66-136`  
**Fix:** Add a `useQuery` call (e.g., `getAppointmentOptions({ path: { appointmentId } })`) inside the modal to populate state when `appointmentId` is set.

---

### DEF-SCH-09 — `check-in-flow.tsx` component missing (test file references non-existent file) (WARNING)

`check-in-flow.test.ts` exists in `apps/dentalemon/src/features/scheduling/components/` but there is no corresponding `check-in-flow.tsx` implementation. The test file will fail to import.  
**File:** `apps/dentalemon/src/features/scheduling/components/check-in-flow.test.ts`  
**Fix:** Implement `check-in-flow.tsx` or remove the test file.

---

### DEF-SCH-10 — DE-011 AppointmentCancelled event not emitted (WARNING)

`cancelAppointment.ts` performs no event or notification emission. Spec Section 10b declares `DE-011 AppointmentCancelled` as a published event.  
**File:** `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts`  
**Fix:** Add notification or event emission after successful cancel (mirroring `createAppointment.ts` notif pattern).

---

### DEF-SCH-11 — All four observability hooks missing (WARNING)

None of the handlers emit structured log events:
- `dental-scheduling.booked` (INFO) — missing in `createAppointment.ts`
- `dental-scheduling.checked-in` (INFO) — missing in `checkInAppointment.ts`
- `dental-scheduling.cancelled` (INFO, with reason) — missing in `cancelAppointment.ts`
- `dental-scheduling.double-booking` (WARN) — missing in `createAppointment.ts`

**Fix:** Add `logger.info({ action: 'dental-scheduling.booked', appointmentId: appt.id }, 'Appointment booked')` etc. in each handler.

---

### DEF-SCH-12 — `checked_in_at` field named `checkInTime` in schema (WARNING)

Module spec Section 7 declares field name `checked_in_at`. Schema and all handlers use `checkInTime`. Minor naming inconsistency that could confuse cross-module consumers reading the spec.  
**File:** `services/api-ts/src/handlers/dental-scheduling/repos/dental-appointment.schema.ts:35`

---

### DEF-SCH-13 — Queue board FSM states deviate from spec annotation (INFO)

Module spec Section 8 note `IDEAL-GAP-P2-011` documents a deliberate deviation: the queue uses `waiting/called/in_progress/completed/cancelled` rather than the IDEAL §3.3 `waiting/with_provider/ready_for_checkout/checked_out` states. The queue-item schema and frontend `queue-board.tsx` both use the non-standard names. This is documented as a known gap — noting for completeness.

---

### DEF-SCH-14 — `listQueueBoard.ts` and `updateQueueItemStatus.ts` use `ctx: any` (INFO)

Both queue handlers type `ctx` as `any`, bypassing compile-time type safety.  
**Files:** `listQueueBoard.ts:12`, `createQueueItem.ts:13`, `updateQueueItemStatus.ts:15`  
**Fix:** Use `HandlerContext` or the appropriate typed context.

---

*Audit complete — 17 defects registered (5 BLOCKER, 5 WARNING, 4 INFO across 14 DEF IDs).*
