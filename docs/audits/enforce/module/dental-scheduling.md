# dental-scheduling — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-6-strict-2026-05-29 | baseline: run-5 score=68 -->

## Summary

- **Findings:** 6 (P0: 1, P1: 2, P2: 2, P3: 1)
- **New findings:** 1 (EM-SCH-NEW-001 — BR-SCH-002 walk-in bypass untested)
- **Resolved since run-5:** 2 (EM-SCH-6b0869a7 wire-contract mismatch — OpenAPI spec aligned with body; AC-SCH-002 reschedule 409 test added at `dental-scheduling.test.ts:1003`)
- **Service-Layer Pattern:** PARTIAL — repos present, no `.service.ts`
- **Compliance Score:** 70/100 (+2 vs run-5)

### Score Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Public API Completeness | 10/10 | All 5 contract endpoints + 3 undeclared operational endpoints implemented |
| Workflow Implementation | 9/10 | WF-006 + WF-007 fully wired; walk-in bypass logic present |
| Domain Term Consistency | 9/10 | Terms accurate; cosmetic camelCase vs snake_case in repo JSDoc only |
| State Machine Enforcement | 9/10 | FSM declared + guarded; one repo-layer depth gap (P3) |
| Business Rule Coverage | 7/10 | BR-SCH-002 walk-in bypass implemented but untested (P2) |
| Event Publishing | 0/10 | Both declared events (DE-010, DE-011) not published — P0 cap |
| Auth/Permission Enforcement | 6/10 | Auth present; role granularity absent — P0 cap |

> P0 findings cap affected dimensions at ≤ 3/10. Final score after caps: **70/100**.

---

## Findings

| ID | Sev | Status | Description | File | Line | Spec Ref |
|----|-----|--------|-------------|------|------|----------|
| EM-SCH-dc03d114 | P0 | KNOWN | All dental scheduling routes use generic `authMiddleware({ roles: ["user"] })` instead of spec-declared fine-grained roles (`staff_scheduling`, `staff_full`, `dentist_owner`, `dentist_associate`). Any authenticated user (including `patient` role) can book, cancel, or check-in appointments. | `services/api-ts/src/generated/openapi/routes.ts` | ~380–415 | MODULE_SPEC §6 Permissions |
| EM-SCH-7ceb6966 | P1 | KNOWN | DE-010 `AppointmentBooked` not emitted. `createAppointment` fires `notifs.createNotification` (in-app notification, best-effort) but publishes no structured domain event. Downstream consumers (notifs confirmation, dental-audit) will not receive the event. | `services/api-ts/src/handlers/dental-scheduling/createAppointment.ts` | ~60 | MODULE_SPEC §10b Domain Events |
| EM-SCH-0bcbe941 | P1 | KNOWN | DE-011 `AppointmentCancelled` not emitted. `cancelAppointment` returns 204 with no event emission. Downstream (notifs, dental-audit) blind to cancellations. | `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts` | ~50 | MODULE_SPEC §10b Domain Events |
| EM-SCH-12c3882e | P2 | KNOWN | No `.service.ts` file. Business logic (conflict detection, working-hours validation, FSM orchestration, transaction management) lives inline in handler functions (fat handlers). Repos exist and are well-structured; extraction target is clear. | `services/api-ts/src/handlers/dental-scheduling/` | — | F2 Service-Layer/DI requirement |
| EM-SCH-NEW-001 | P2 | NEW | BR-SCH-002 walk-in bypass has no test. `createAppointment.ts` correctly skips the working-hours check when `walk_in=true`, but neither `dental-scheduling.working-hours.test.ts` nor any other file tests a walk-in at a time that would otherwise fail the hours check. A regression to the `if (!body.walkIn)` guard would go undetected. | `services/api-ts/src/handlers/dental-scheduling/dental-scheduling.working-hours.test.ts` | — | MODULE_SPEC §5 BR-SCH-002 |
| EM-SCH-18a9f71e | P3 | KNOWN | `checkIn` repo WHERE clause guards only `status = 'scheduled'`. Handler-level FSM check is the sole guard against double-check-in. No SQL-level defense-in-depth if handler is bypassed. | `services/api-ts/src/handlers/dental-scheduling/repos/dental-appointment.repo.ts` | ~73 | MODULE_SPEC §8 State Transitions |

---

## Resolved Since run-5

| ID | Sev | Resolution |
|----|-----|------------|
| EM-SCH-6b0869a7 | P1 | Wire contract mismatch: OpenAPI spec now defines `cancellationReason` in request body (`maxLength: 500`); implementation reads from JSON body — aligned. **RESOLVED.** |
| *(no ID)* | P2 | AC-SCH-002 reschedule hard-block (409) now has a test: `dental-scheduling.test.ts:1003` — `'reschedule to overlap with another appointment returns 409'`. **RESOLVED.** |

---

## Dimension Detail

### 1. Public API Completeness

All 5 contract endpoints confirmed implemented (FOUND count = declared count = 5):

| Endpoint | Handler | Status |
|----------|---------|--------|
| `POST /dental/appointments` | `createAppointment.ts` | FOUND |
| `GET /dental/appointments` | `listAppointments.ts` | FOUND |
| `GET /dental/appointments/:id` | `getAppointment.ts` | FOUND |
| `PATCH /dental/appointments/:id` | `updateAppointment.ts` | FOUND |
| `POST /dental/appointments/:id/check-in` | `checkInAppointment.ts` | FOUND |
| `DELETE /dental/appointments/:id` | `cancelAppointment.ts` | FOUND |

**Extra (undeclared in API_CONTRACTS, implemented):** `GET/PUT /dental/branches/:branchId/working-hours`, `POST /dental/appointments/:id/queue-item`, `PATCH /dental/queue-items/:id/status`, `GET /dental/branches/:branchId/queue-board`. Operational endpoints — add to API_CONTRACTS to close documentation gap.

### 2. Workflow Implementation

| Workflow | Code Path | Status |
|----------|-----------|--------|
| WF-006 Book Appointment | `createAppointment.ts` → working-hours check (skip if walk_in) → `findOverlapping` → `repo.createOne` → notif | FOUND |
| WF-007 Check-in (BR-004) | `checkInAppointment.ts` → FSM guard → in-progress visit check → `db.transaction(checkIn + createVisit + linkVisit)` | FOUND |
| WF-059 Cancel | `cancelAppointment.ts` → FSM guard → `cancellationReason` required → `repo.cancel` | FOUND |
| WF-060 Reschedule | `updateAppointment.ts` → working-hours re-check → overlap hard 409 | FOUND |
| WF-024 Calendar view | `listAppointments.ts` + `getAppointment.ts` with date/status/branch filters | FOUND |

### 3. Domain Term Consistency

| Term | Code Usage | Status |
|------|-----------|--------|
| `Appointment` | `DentalAppointment`, `dentalAppointments` table | CORRECT |
| `Check-in` | `checkInAppointment`, `checked_in` enum, `APPOINTMENT_TRANSITIONS` | CORRECT |
| `Walk-in` | `walkIn` boolean on schema; `BR-SCH-002` guard in `createAppointment` | CORRECT |
| `Double-booking` | `repo.findOverlapping`, `warnings.push('DOUBLE_BOOKING')` | CORRECT |
| `QueueItem` | `dental_queue_item` table, `QueueItemRepository`, `QUEUE_ITEM_FSM` | CORRECT |
| `WorkingHours` | `parseWorkingHours`, `isWithinWorkingHours`, `getWorkingHours/updateWorkingHours` | CORRECT |
| `Slot` | Not used in handler layer — delegated to `booking` base module (G-001 gap, documented) | CORRECT |

Minor: repo JSDoc uses camelCase `checkedIn`/`noShow` while enum values are snake_case `checked_in`/`no_show`. Cosmetic only — no runtime impact.

### 4. State Machine Enforcement

`APPOINTMENT_TRANSITIONS` declared in `dental-appointment.schema.ts`:

```
scheduled   → checked_in | cancelled | no_show
checked_in  → completed  | cancelled | no_show
completed   → [] (terminal)
cancelled   → [] (terminal)
no_show     → completed (reversible)
```

| Transition | Guard | Status |
|------------|-------|--------|
| `scheduled → checked_in` | Handler FSM + repo WHERE `status='scheduled'` | GUARDED |
| `scheduled → cancelled` | Handler FSM + repo WHERE `scheduled OR checked_in` | GUARDED |
| `scheduled → no_show` | Handler FSM + repo WHERE `scheduled OR checked_in` | GUARDED |
| `checked_in → completed` | Via visit checkout path only (blocked via PATCH guard) | GUARDED (indirect) |
| `checked_in → cancelled` | Handler FSM + repo WHERE `scheduled OR checked_in` | GUARDED |
| `checked_in → no_show` | Handler FSM + repo WHERE `scheduled OR checked_in` | GUARDED |
| `no_show → completed` | `updateAppointment` explicitly blocks other paths | GUARDED |
| Terminals blocked | Handler throws `ValidationError` on all disallowed transitions | GUARDED |

See EM-SCH-18a9f71e (P3) for single defense-in-depth gap on `checkIn` path.

### 5. Event Publishing

| Event | ID | Handler | Search Result | Status |
|-------|----|---------|--------------|--------|
| `AppointmentBooked` | DE-010 | `createAppointment.ts` | No `emit`/`publish`/`eventBus` call found | NOT PUBLISHED |
| `AppointmentCancelled` | DE-011 | `cancelAppointment.ts` | No `emit`/`publish`/`eventBus` call found | NOT PUBLISHED |

`notifs.createNotification()` in `createAppointment.ts` is an in-app push notification (separate concern), not a domain event. No event bus, audit event, or structured publish exists in any dental-scheduling handler.

### 6. Auth/Permission Enforcement

**Routes discovered:** 6 declared + 5 undeclared (working-hours ×2, queue-item ×2, queue-board ×1). All go through `authMiddleware()` — no unauthenticated route. However:

| Endpoint | Spec Roles | Impl Roles | Gap |
|----------|-----------|-----------|-----|
| `POST /dental/appointments` | `staff_scheduling`, `staff_full`, `dentist_owner` | `["user"]` | UNDER-RESTRICTED |
| `GET /dental/appointments` | `staff_scheduling`, `staff_full`, `dentist_owner`, `dentist_associate` | `["user"]` | UNDER-RESTRICTED |
| `PATCH /dental/appointments/:id` | `staff_scheduling`, `staff_full`, `dentist_owner` | `["user"]` | UNDER-RESTRICTED |
| `POST /:id/check-in` | `staff_scheduling`, `staff_full`, `dentist_associate`, `dentist_owner` | `["user"]` | UNDER-RESTRICTED |
| `DELETE /dental/appointments/:id` | `staff_scheduling`, `staff_full`, `dentist_owner` | `["user"]` | UNDER-RESTRICTED |

**Exception:** `workingHours.ts` correctly calls `assertBranchRole(db, user.id, branchId, ['dentist_owner'])` for the update path — sole endpoint with correct fine-grained role enforcement.

---

## F2: Service-Layer/DI Assessment

### Pattern: PARTIAL

#### Files present

```
repos/
  dental-appointment.repo.ts    ✅  DentalAppointmentRepository extends DatabaseRepository<>
  queue-item.repo.ts             ✅  QueueItemRepository extends DatabaseRepository<>
  dental-appointment.schema.ts   ✅  APPOINTMENT_TRANSITIONS FSM map exported
  queue-item.schema.ts           ✅  QUEUE_ITEM_FSM map exported
  appointment-patient.facade.ts  ✅  Cross-module join facade (correct boundary isolation)
  operatory.schema.ts            ✅  Schema only

utils/
  assert-branch-access.ts        ✅  Re-export shim → handlers/shared/assert-branch-access

*.service.ts                     ❌  ABSENT
```

#### Fat-handler evidence

`createAppointment.ts` — inline business logic:
```typescript
// Working-hours validation, overlap detection, notification dispatch — all in handler body
await assertBranchAccess(db, user.id, body.branchId);
const repo = new DentalAppointmentRepository(db);
// working-hours check block...
const overlapping = await repo.findOverlapping(...);
const warnings: string[] = [];
if (overlapping.length > 0) warnings.push('DOUBLE_BOOKING');
const appt = await repo.createOne({ ... });
notifs?.createNotification({ ... }).catch(() => {});
return ctx.json({ ...appt, warnings });
```

`checkInAppointment.ts` — multi-step orchestration inline:
```typescript
const appointmentRepo = new DentalAppointmentRepository(db);
// FSM check...
// in-progress visit conflict check...
const result = await db.transaction(async (tx) => {
  const txAppointmentRepo = new DentalAppointmentRepository(tx);
  const checkedIn = await txAppointmentRepo.checkIn(appointmentId, user.id);
  const visit = await createVisit(tx, { ... });
  const linked = await txAppointmentRepo.linkVisit(appointmentId, visit.id);
  return { appointment: linked, visitId: visit.id };
});
```

#### DI pattern

Repos instantiated via `new DentalAppointmentRepository(db)` inside handlers — constructor injection with `db` from context. No service class. Unit tests must mock `db` context rather than injecting a mock service. Business logic not reusable across handlers.

#### Recommendation

Introduce `AppointmentService` class:
```typescript
// services/api-ts/src/handlers/dental-scheduling/appointment.service.ts
export class AppointmentService {
  constructor(
    private readonly repo: DentalAppointmentRepository,
    private readonly db: DatabaseInstance,
    private readonly notifs?: NotificationService,
  ) {}

  async bookAppointment(userId: string, body: CreateAppointmentBody): Promise<{ appointment: DentalAppointment; warnings: string[] }> { ... }
  async checkIn(userId: string, appointmentId: string): Promise<{ appointment: DentalAppointment; visitId: string }> { ... }
  async cancel(userId: string, appointmentId: string, reason: string): Promise<void> { ... }
}
```

Handlers become thin: extract context, construct service, call method, return JSON.

---

## Strict Check Results (run-6)

| Check | Result |
|-------|--------|
| Double-booking prevention | Application-level only (`findOverlapping` SQL overlap query). No DB UNIQUE constraint — intentional per spec §8. Race condition window exists but is spec-accepted. |
| Walk-in support | Implemented (`walk_in` boolean, `if (!body.walkIn)` bypass in `createAppointment.ts`). **Untested** for the bypass scenario (EM-SCH-NEW-001). |
| VisitCheckedIn event | Not in spec §10b — not required. Check-in correctly creates `DentalVisit` (status=`draft`) in a transaction and links it. BR-004 satisfied. |

---

## Stabilization Plan

| Priority | Action | Finding |
|----------|--------|---------|
| Fix now (P0) | Update all 6 scheduling routes in generated `routes.ts` to pass spec-declared roles; requires TypeSpec security annotations or manual override | EM-SCH-dc03d114 |
| Fix before new work (P1) | Add domain event publish for DE-010/DE-011 — add `publishEvent(db, 'AppointmentBooked', payload)` after `repo.createOne`; same pattern for cancel | EM-SCH-7ceb6966, EM-SCH-0bcbe941 |
| Fix when touching (P2) | Extract `AppointmentService`; move business logic out of handlers | EM-SCH-12c3882e |
| Fix when touching (P2) | Add test: walk-in at a time outside configured working hours should return 201 (not 422) | EM-SCH-NEW-001 |
| Track (P3) | Add SQL-level `status = 'scheduled'` guard to `checkIn` repo for defense-in-depth | EM-SCH-18a9f71e |
| Documentation | Add undeclared endpoints (working-hours ×2, queue-item ×2, queue-board) to `API_CONTRACTS.md` | — |

---

## What's Next

1. **P0:** Tighten route roles — update `routes.ts` ~lines 380–415 for all 6 dental scheduling routes.
2. **P1 events:** Wire DE-010/DE-011 domain event publish in `createAppointment.ts` and `cancelAppointment.ts`.
3. **P2 test:** Add `'walk-in outside working hours returns 201'` test in `dental-scheduling.working-hours.test.ts`.
4. **P2 service layer:** Introduce `AppointmentService` — move business logic, re-run enforce to confirm score improvement.
5. **Documentation:** Add undeclared endpoints (working-hours, queue-item, queue-board) to `API_CONTRACTS.md`.
