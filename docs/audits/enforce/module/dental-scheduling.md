# dental-scheduling — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary

- **Findings:** 5 (P0: 1, P1: 3, P2: 1, P3: 1)
- **Service-Layer Pattern:** PARTIAL — repos present, no `.service.ts`
- **Compliance Score:** 68/100

### Score Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Public API Completeness | 10/10 | All 5 contract endpoints implemented |
| Workflow Implementation | 9/10 | WF-006 + WF-007 fully wired |
| Domain Term Consistency | 9/10 | Terms accurate; cosmetic camelCase vs snake_case in comments only |
| State Machine Enforcement | 8/10 | FSM declared + guarded; one repo-layer depth gap (P3) |
| Event Publishing | 0/10 | Both declared events (DE-010, DE-011) not published — P0 cap |
| Auth/Permission Enforcement | 6/10 | Auth present; role granularity absent — P0 cap |

> P0 findings cap affected dimensions at ≤ 3/10. Final score after caps: 68/100.

---

## Findings

| ID | Sev | Description | File | Line | Spec Ref |
|----|-----|-------------|------|------|----------|
| EM-SCH-dc03d114 | P0 | All dental scheduling routes use generic `authMiddleware({ roles: ["user"] })` instead of spec-declared fine-grained roles (`staff_scheduling`, `staff_full`, `dentist_owner`, `dentist_associate`). Any authenticated user (including `patient` role) can book, cancel, or check-in appointments. | `services/api-ts/src/generated/openapi/routes.ts` | 366, 373, 380, 387, 395, 402 | MODULE_SPEC §6 Permissions; API_CONTRACTS auth fields per endpoint |
| EM-SCH-7ceb6966 | P1 | DE-010 `AppointmentBooked` not emitted. `createAppointment` fires `notifs.createNotification` (in-app notification, best-effort) but publishes no structured domain event. Downstream consumers (notifs confirmation, dental-audit) will not receive the event. | `services/api-ts/src/handlers/dental-scheduling/createAppointment.ts` | ~60 | MODULE_SPEC §10b Domain Events |
| EM-SCH-0bcbe941 | P1 | DE-011 `AppointmentCancelled` not emitted. `cancelAppointment` returns 204 with no event emission. Downstream (notifs, dental-audit) blind to cancellations. | `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts` | ~50 | MODULE_SPEC §10b Domain Events; API_CONTRACTS DE-011 |
| EM-SCH-6b0869a7 | P1 | Wire contract mismatch on `DELETE /dental/appointments/:id`. API_CONTRACTS declares `reason` as a **query param** (min:5, max:500). Implementation reads `cancellationReason` from the **JSON request body**. SDK-generated clients and Hurl contract tests will fail. | `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts` | 33–42 | API_CONTRACTS `DELETE /api/v1/dental/appointments/:id` |
| EM-SCH-12c3882e | P2 | No `.service.ts` file. Business logic (conflict detection, working-hours validation, FSM orchestration, transaction management) lives inline in handler functions (fat handlers). Repos exist and are well-structured; extraction target is clear. | `services/api-ts/src/handlers/dental-scheduling/` | — | F2 Service-Layer/DI requirement |
| EM-SCH-18a9f71e | P3 | `checkIn` repo WHERE clause guards only `status = 'scheduled'` at the SQL level. The handler-level FSM check (`APPOINTMENT_TRANSITIONS[status].includes('checked_in')`) is the sole guard against double-check-in. No SQL-level defense-in-depth if handler is bypassed. | `services/api-ts/src/handlers/dental-scheduling/repos/dental-appointment.repo.ts` | 73 | MODULE_SPEC §8 State Transitions |

---

## Dimension Detail

### 1. Public API Completeness

All 5 contract endpoints confirmed implemented (FOUND count = declared count = 5):

| Endpoint | Handler | Status |
|----------|---------|--------|
| `POST /dental/appointments` | `createAppointment.ts` | FOUND |
| `GET /dental/appointments` | `listAppointments.ts` | FOUND |
| `PATCH /dental/appointments/:id` | `updateAppointment.ts` | FOUND |
| `POST /dental/appointments/:id/check-in` | `checkInAppointment.ts` | FOUND |
| `DELETE /dental/appointments/:id` | `cancelAppointment.ts` | FOUND |

**Extra (undeclared in API_CONTRACTS, implemented):** working-hours GET/PUT, queue-item POST/PATCH, queue-board GET. These are operational endpoints not in the contract — add them to API_CONTRACTS.md to close the documentation gap.

### 2. Workflow Implementation

| Workflow | Code Path | Status |
|----------|-----------|--------|
| WF-006 Book Appointment | `createAppointment.ts` → working-hours check → `findOverlapping` → `repo.createOne` → notification | FOUND |
| WF-007 Check-in | `checkInAppointment.ts` → FSM guard → in-progress visit check → `db.transaction(checkIn + createVisit + linkVisit)` | FOUND |

### 3. Domain Term Consistency

| Term | Code Usage | Status |
|------|-----------|--------|
| `Appointment` | `DentalAppointment`, `dentalAppointments` table | CORRECT |
| `Check-in` | `checkInAppointment`, `checked_in` enum, `APPOINTMENT_TRANSITIONS` | CORRECT |
| `Walk-in` | `walkIn` boolean on schema; `BR-SCH-002` guard in `createAppointment` | CORRECT |
| `Double-booking` | `repo.findOverlapping`, `warnings.push('DOUBLE_BOOKING')` | CORRECT |
| `Slot` | Not used in handler layer — delegated to `booking` base module | CORRECT |

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

## Stabilization Plan

| Priority | Action | Finding |
|----------|--------|---------|
| Fix now (P0) | Update all 5 scheduling routes in generated `routes.ts` to pass spec-declared roles; requires TypeSpec `@operationId` security annotations or manual override | EM-SCH-dc03d114 |
| Fix before new work (P1) | Add domain event publish for DE-010/DE-011 — add `publishEvent(db, 'AppointmentBooked', payload)` after successful `repo.createOne`; same pattern for cancel | EM-SCH-7ceb6966, EM-SCH-0bcbe941 |
| Fix before new work (P1) | Align DELETE cancel `reason` location: update TypeSpec to use JSON body (matching impl) OR change impl to read query param (matching contract) | EM-SCH-6b0869a7 |
| Fix when touching (P2) | Extract `AppointmentService`; move business logic out of handlers | EM-SCH-12c3882e |
| Track (P3) | Add SQL-level `status = 'scheduled'` guard to `checkIn` repo method for defense-in-depth | EM-SCH-18a9f71e |

---

## What's Next

1. **P0:** Tighten route roles — update `routes.ts` lines 366, 373, 380, 387, 395, 402.
2. **P1 contract:** Decide canonical location for cancel `reason` (query vs body); update TypeSpec and handler to match.
3. **P1 events:** Wire DE-010/DE-011 domain event publish in `createAppointment.ts` and `cancelAppointment.ts`.
4. **P2 service layer:** Introduce `AppointmentService` — move business logic, re-run enforce to confirm score improvement.
5. **Documentation:** Add undeclared endpoints (working-hours, queue-item, queue-board) to `API_CONTRACTS.md`.
