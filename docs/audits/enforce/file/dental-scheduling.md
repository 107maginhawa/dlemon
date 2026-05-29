<!-- oli-version: 1.1 | generated: 2026-05-29 | skill: oli-enforce-file -->
<!-- module: dental-scheduling | file-count: 29 | batch: 1/1 (≤30 files) -->

# Enforce-File Report — dental-scheduling

**Generated:** 2026-05-29
**Spec version:** MODULE_SPEC 1.0 (2026-05-24)
**Files inspected:** 29
**Findings:** 8 (P0=0 P1=4 P2=3 P3=1)

---

## File Inventory & Classification

| # | File | Type | Specs Loaded |
|---|------|------|-------------|
| 1 | `createAppointment.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 2 | `cancelAppointment.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 3 | `checkInAppointment.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 4 | `updateAppointment.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 5 | `listAppointments.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 6 | `getAppointment.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 7 | `createQueueItem.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 8 | `updateQueueItemStatus.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 9 | `listQueueBoard.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 10 | `workingHours.ts` | Handler/Utils | MODULE_SPEC + API_CONTRACTS |
| 11 | `queue-item-validators.ts` | DTO/Validation | MODULE_SPEC + API_CONTRACTS |
| 12 | `domain-events.ts` | Utils/Events | MODULE_SPEC only |
| 13 | `utils/assert-branch-access.ts` | Utils | MODULE_SPEC only |
| 14 | `repos/dental-appointment.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 15 | `repos/dental-appointment.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 16 | `repos/appointment-patient.facade.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 17 | `repos/queue-item.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 18 | `repos/queue-item.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 19 | `repos/operatory.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 20 | `dental-scheduling.test.ts` | Test | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 21 | `dental-scheduling-transitions.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 22 | `dental-scheduling.working-hours.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 23 | `dental-queue.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 24 | `rbac-scheduling.test.ts` | Test | MODULE_SPEC + ROLE_PERMISSION_MATRIX |
| 25 | `acceptance.scheduling-workflows.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 26 | `createAppointment.notif.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 27 | `domain-events.test.ts` | Test | MODULE_SPEC |
| 28 | `appointment.fsm.property.test.ts` | Test | MODULE_SPEC |
| 29 | `repos/dental-appointment.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |

---

## Findings

### P1 Findings

---

#### EF-SCH-001
**Severity:** P1
**Confidence:** HIGH
**Title:** `cancelAppointment` returns HTTP 204 (no body) — spec requires 200 `{data: {ok: true}}`
**File:** `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts`
**Line:** 66
**Check type:** Data shapes / API contract
**Spec source:** API_CONTRACTS.md — DELETE /api/v1/dental/appointments/:id → Response 200: `{ data: { ok: true } }`

**Description:**
The handler returns `ctx.body(null, 204)` — a null body with HTTP 204 No Content. The API contract explicitly mandates HTTP 200 with response body `{ data: { ok: true } }`. Clients that check the status code or parse the response body will behave incorrectly. This is a wire-level contract violation.

```typescript
// Line 66 — actual:
return ctx.body(null, 204);

// Required per API_CONTRACTS.md:
return ctx.json({ data: { ok: true } }, 200);
```

---

#### EF-SCH-002
**Severity:** P1
**Confidence:** HIGH
**Title:** `cancelAppointment` missing reason raises `ValidationError` (400) instead of `REASON_REQUIRED` (422)
**File:** `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts`
**Lines:** 47, 52
**Check type:** Error taxonomy
**Spec source:** ERROR_TAXONOMY.md — `REASON_REQUIRED | 422 | Cancel without cancellation reason`; MODULE_SPEC BR-SCH-003; API_CONTRACTS.md — `REASON_REQUIRED(422)`

**Description:**
When `cancellationReason` is absent or empty, the handler throws `new ValidationError(...)` which maps to HTTP 400 with code `VALIDATION_ERROR`. The error taxonomy defines `REASON_REQUIRED` at HTTP 422 for this exact scenario. Both the error code and HTTP status are wrong.

```typescript
// Lines 47/52 — actual:
throw new ValidationError('cancellationReason is required and must be a non-empty string');
// result: HTTP 400, code: VALIDATION_ERROR

// Required per ERROR_TAXONOMY.md + API_CONTRACTS.md:
throw new BusinessLogicError('Cancellation reason is required', 'REASON_REQUIRED');
// result: HTTP 422, code: REASON_REQUIRED
```

---

#### EF-SCH-003
**Severity:** P1
**Confidence:** HIGH
**Title:** `cancelAppointment` permits `dentist_associate` and `staff_scheduling` — MODULE_SPEC restricts cancel to `staff_full` and `dentist_owner` only
**File:** `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts`
**Lines:** 33–35
**Check type:** Permissions / access control
**Spec source:** MODULE_SPEC §6 Permissions — Cancel: `staff_full, dentist_owner`

**Description:**
The handler's `assertBranchRole` call includes `['dentist_owner', 'dentist_associate', 'staff_full', 'staff_scheduling']`. Per MODULE_SPEC §6, cancellation is restricted to `staff_full` and `dentist_owner`. `dentist_associate` should not be able to cancel appointments. `staff_scheduling` permission is ambiguous between MODULE_SPEC (excluded) and API_CONTRACTS (included in DELETE auth list) — MODULE_SPEC is the normative authority.

```typescript
// Lines 33–35 — actual (too permissive):
await assertBranchRole(db, user.id, existing.branchId, [
  'dentist_owner', 'dentist_associate', 'staff_full', 'staff_scheduling',
]);

// Required per MODULE_SPEC §6:
await assertBranchRole(db, user.id, existing.branchId, [
  'dentist_owner', 'staff_full',
]);
```

---

#### EF-SCH-004
**Severity:** P1
**Confidence:** HIGH
**Title:** `updateAppointment` throws generic `ConflictError` (code `CONFLICT`) on reschedule overlap — spec requires `RESCHEDULE_CONFLICT`
**File:** `services/api-ts/src/handlers/dental-scheduling/updateAppointment.ts`
**Line:** 98
**Check type:** Error taxonomy
**Spec source:** ERROR_TAXONOMY.md — `RESCHEDULE_CONFLICT | 409 | New slot also conflicts`; API_CONTRACTS.md — Errors: `RESCHEDULE_CONFLICT(409)`

**Description:**
When a reschedule attempt finds an overlapping appointment, the handler throws `new ConflictError(...)`. `ConflictError` has hardcoded code `'CONFLICT'` (HTTP 409). The error taxonomy defines `RESCHEDULE_CONFLICT` specifically for this case. The HTTP status is correct (409) but the code string is wrong, which breaks client-side error discrimination.

```typescript
// Line 98 — actual:
throw new ConflictError('Scheduling conflict: dentist already has an appointment at this time');
// result: HTTP 409, code: CONFLICT

// Required per ERROR_TAXONOMY.md:
throw new BusinessLogicError('Scheduling conflict: dentist already has an appointment at this time', 'RESCHEDULE_CONFLICT');
// result: HTTP 409, code: RESCHEDULE_CONFLICT
```

---

### P2 Findings

---

#### EF-SCH-005
**Severity:** P2
**Confidence:** HIGH
**Title:** `checkInAppointment` permits `staff_scheduling` for check-in and is missing `dentist_associate` — MODULE_SPEC excludes `staff_scheduling`
**File:** `services/api-ts/src/handlers/dental-scheduling/checkInAppointment.ts`
**Lines:** 38–40
**Check type:** Permissions / access control
**Spec source:** MODULE_SPEC §6 — Check-in: `staff_full, dentist_owner, dentist_associate` (Not staff_scheduling)

**Description:**
The handler allows `['dentist_owner', 'staff_full', 'staff_scheduling']` for check-in. MODULE_SPEC explicitly notes that `staff_scheduling` cannot perform check-in. The spec-allowed set is `staff_full`, `dentist_owner`, and `dentist_associate`. `dentist_associate` is missing from the allowlist while `staff_scheduling` is incorrectly included.

```typescript
// Lines 38–40 — actual:
await assertBranchRole(db, user.id, appointment.branchId, [
  'dentist_owner', 'staff_full', 'staff_scheduling',
]);

// Required per MODULE_SPEC §6:
await assertBranchRole(db, user.id, appointment.branchId, [
  'dentist_owner', 'staff_full', 'dentist_associate',
]);
```

---

#### EF-SCH-006
**Severity:** P2
**Confidence:** HIGH
**Title:** `checkInAppointment` throws `ConflictError` (code `CONFLICT`) on active visit — spec requires `CHECKIN_ACTIVE_VISIT`
**File:** `services/api-ts/src/handlers/dental-scheduling/checkInAppointment.ts`
**Line:** 50
**Check type:** Error taxonomy
**Spec source:** ERROR_TAXONOMY.md — `CHECKIN_ACTIVE_VISIT | 409 | Check-in when active visit already exists`; API_CONTRACTS.md — Errors: `CHECKIN_ACTIVE_VISIT(409)`

**Description:**
When an active visit exists for the patient during check-in (BR-001 violation), the handler throws `new ConflictError(...)` which emits code `CONFLICT`. The taxonomy specifies `CHECKIN_ACTIVE_VISIT`. HTTP 409 is correct but the error code string is wrong.

```typescript
// Line 50 — actual:
throw new ConflictError('Visit already active for this patient. Complete or cancel the existing visit first.');
// result: HTTP 409, code: CONFLICT

// Required per ERROR_TAXONOMY.md:
throw new BusinessLogicError('Visit already active for this patient', 'CHECKIN_ACTIVE_VISIT');
// result: HTTP 409, code: CHECKIN_ACTIVE_VISIT
```

---

#### EF-SCH-007
**Severity:** P2
**Confidence:** MEDIUM
**Title:** Schema field `checkInTime` / column `check_in_time` diverges from MODULE_SPEC field name `checked_in_at`
**File:** `services/api-ts/src/handlers/dental-scheduling/repos/dental-appointment.schema.ts`
**Line:** 36
**Check type:** Domain terms / data shapes
**Spec source:** MODULE_SPEC §7 Data Requirements — `checked_in_at` (timestamp for check-in)

**Description:**
MODULE_SPEC §7 specifies `checked_in_at` as the timestamp field captured when an appointment is checked in. The schema uses `checkInTime` (column: `check_in_time`). While semantically equivalent, the spec-declared canonical name is `checked_in_at`. The column name divergence creates a documentation mismatch that may cause confusion during migrations or cross-team coordination.

```typescript
// Line 36 — actual:
checkInTime: timestamp('check_in_time', { withTimezone: true }),

// MODULE_SPEC §7 declares: checked_in_at
```

---

### P3 Findings

---

#### EF-SCH-008
**Severity:** P3
**Confidence:** LOW
**Title:** Queue handlers typed as `ctx: any` instead of project-standard `HandlerContext`
**Files:** `createQueueItem.ts:13`, `updateQueueItemStatus.ts:15`, `listQueueBoard.ts:12`
**Check type:** Naming conventions
**Spec source:** MODULE_SPEC (handler signature pattern — all appointment handlers use `HandlerContext`)

**Description:**
The three queue handlers declare `ctx: any` instead of the project-standard `HandlerContext` type used by all appointment handlers. This bypasses TypeScript's safety guarantees and diverges from the module's own naming convention. Not a runtime bug but erodes refactoring confidence. Advisory only.

---

## Review Required (LOW confidence findings)

No additional LOW-confidence findings beyond EF-SCH-008 listed above.

---

## Per-File Compliance Scores

| File | P0 | P1 | P2 | P3 | Score |
|------|----|----|----|----|-------|
| `createAppointment.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `cancelAppointment.ts` | 0 | 3 | 0 | 0 | 3/6 ⚠️ |
| `checkInAppointment.ts` | 0 | 0 | 2 | 0 | 4/6 ⚠️ |
| `updateAppointment.ts` | 0 | 1 | 0 | 0 | 5/6 ⚠️ |
| `listAppointments.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `getAppointment.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `createQueueItem.ts` | 0 | 0 | 0 | 1 | 5/6 ✅ |
| `updateQueueItemStatus.ts` | 0 | 0 | 0 | 1 | 5/6 ✅ |
| `listQueueBoard.ts` | 0 | 0 | 0 | 1 | 5/6 ✅ |
| `workingHours.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `queue-item-validators.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `domain-events.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `utils/assert-branch-access.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `repos/dental-appointment.schema.ts` | 0 | 0 | 1 | 0 | 5/6 ✅ |
| `repos/dental-appointment.repo.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `repos/appointment-patient.facade.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `repos/queue-item.schema.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `repos/queue-item.repo.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `repos/operatory.schema.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `dental-scheduling.test.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `dental-scheduling-transitions.test.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `dental-scheduling.working-hours.test.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `dental-queue.test.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `rbac-scheduling.test.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `acceptance.scheduling-workflows.test.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `createAppointment.notif.test.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `domain-events.test.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `appointment.fsm.property.test.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |
| `repos/dental-appointment.test.ts` | 0 | 0 | 0 | 0 | 6/6 ✅ |

---

## Module-Level Summary

| Metric | Value |
|--------|-------|
| Files inspected | 29 |
| Files with 0 P0/P1 findings | 25/29 (86%) |
| Total findings | 8 |
| P0 (security) | 0 |
| P1 (spec-declared violations) | 4 |
| P2 (domain term / naming drift) | 3 |
| P3 (advisory) | 1 |
| Module traceability score | 86% |

### Finding Index

| ID | Severity | Confidence | File | Title |
|----|----------|------------|------|-------|
| EF-SCH-001 | P1 | HIGH | `cancelAppointment.ts:66` | 204 No Content vs required 200 + body |
| EF-SCH-002 | P1 | HIGH | `cancelAppointment.ts:47,52` | Wrong error code VALIDATION_ERROR vs REASON_REQUIRED |
| EF-SCH-003 | P1 | HIGH | `cancelAppointment.ts:33–35` | Cancel allows dentist_associate + staff_scheduling; spec: staff_full + dentist_owner only |
| EF-SCH-004 | P1 | HIGH | `updateAppointment.ts:98` | Wrong error code CONFLICT vs RESCHEDULE_CONFLICT |
| EF-SCH-005 | P2 | HIGH | `checkInAppointment.ts:38–40` | Check-in allows staff_scheduling; missing dentist_associate |
| EF-SCH-006 | P2 | HIGH | `checkInAppointment.ts:50` | Wrong error code CONFLICT vs CHECKIN_ACTIVE_VISIT |
| EF-SCH-007 | P2 | MEDIUM | `repos/dental-appointment.schema.ts:36` | Field checkInTime vs spec-declared checked_in_at |
| EF-SCH-008 | P3 | LOW | `createQueueItem.ts:13`, `updateQueueItemStatus.ts:15`, `listQueueBoard.ts:12` | ctx typed as `any` |

---

## What's Next

P1 findings exist — resolve spec-declared contract gaps before merge:

1. **EF-SCH-001** (P1): Fix `cancelAppointment` to return `ctx.json({ data: { ok: true } }, 200)`.
2. **EF-SCH-002** (P1): Replace `new ValidationError(...)` with `new BusinessLogicError(..., 'REASON_REQUIRED')` for missing cancellation reason.
3. **EF-SCH-003** (P1): Restrict `cancelAppointment` role list to `['dentist_owner', 'staff_full']` per MODULE_SPEC §6.
4. **EF-SCH-004** (P1): Replace `new ConflictError(...)` in `updateAppointment` with `new BusinessLogicError(..., 'RESCHEDULE_CONFLICT')`.
5. **EF-SCH-005** (P2): Correct `checkInAppointment` role list to `['dentist_owner', 'staff_full', 'dentist_associate']`.
6. **EF-SCH-006** (P2): Replace `new ConflictError(...)` in `checkInAppointment` with `new BusinessLogicError(..., 'CHECKIN_ACTIVE_VISIT')`.
7. **EF-SCH-007** (P2): Consider renaming schema field `checkInTime` → `checkedInAt` (column: `checked_in_at`) with migration.
8. **EF-SCH-008** (P3): Type queue handler contexts as `HandlerContext` (advisory).
