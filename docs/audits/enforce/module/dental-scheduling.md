<!-- oli-enforce-module v1.0 | reviewed: 2026-05-27 | module: dental-scheduling -->

# Enforcement Report — dental-scheduling

**Reviewed:** 2026-05-27  
**Reviewer:** Claude (gsd-code-reviewer / oli-enforce-module)  
**Scope:** All declared APIs, workflows, business rules, state transitions, events, permissions, tests, frontend

---

## Executive Summary

The dental-scheduling module has a solid core: appointment CRUD, FR3.7 double-booking (soft-warn vs hard-block), BR-004 check-in→visit creation, and the queue board are all present and working.

Six issues require attention before this module can be considered production-ready. Three are BLOCKERS (incorrect behavior, security gap, silent failure). Three are WARNINGs.

---

## BLOCKER Findings

### BL-01: Cancel endpoint ignores `reason` query param — tests silently pass without a reason

**File:** `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts:38-48`  
**Contract:** `DELETE /dental/appointments/:id` — `reason` is a **query param** per API_CONTRACTS.md (min:5, max:500). The contract also names the error `REASON_REQUIRED(422)`.

**What the handler actually does:** It reads `cancellationReason` from the **request body** (`ctx.req.json()`). The API contract defines `reason` as a query param, not a body field. These are different keys (`reason` vs `cancellationReason`) and different locations (query vs body).

**Impact:** A client following the API contract (`DELETE /dental/appointments/:id?reason=Patient+cancelled`) will receive 422 because the handler reads from the body, not the query string. The test suite passes because `dental-scheduling.test.ts:530-544` calls `DELETE` with no body and no reason, yet asserts `204` — meaning the handler never actually enforced BR-SCH-003 in that test. The only test that asserts reason storage (`cancelAppointment handler returns 204...stores cancellationReason`, line 750) passes a JSON body with `cancellationReason`, not the query param `reason`.

**Fix:** Either (a) change the handler to read from query string — `const reason = ctx.req.query('reason')` — and rename field to `reason` per contract; or (b) update API_CONTRACTS.md to reflect body delivery. Either way, AC-SCH-004 ("Cancel without reason → 422") is not exercised by the current tests, since tests cancel without providing a reason and expect 204.

---

### BL-02: `checkInAppointment` returns 200 without wrapping response in `{ data }` envelope

**File:** `services/api-ts/src/handlers/dental-scheduling/checkInAppointment.ts:67`  
**Contract:** `POST /dental/appointments/:id/check-in` — Response 200: `{ data: { appointment_id: "uuid", visit_id: "uuid" } }`

**What the handler returns:** `ctx.json(result)` where `result = { appointment: <object>, visitId: "uuid" }`.

**Three deviations from the contract:**
1. Response not wrapped in `{ data }` envelope.
2. Field name is `visitId` (camelCase) not `visit_id` (snake_case).
3. `appointment_id` is not in the response — the full appointment object is returned instead.

**Impact:** Any frontend SDK or contract test consuming this endpoint by contract specification will fail field lookups. The calendar.tsx `handleCheckIn` silently discards the response, masking this at the UI layer.

---

### BL-03: `useQueueBoard` fetch has no auth headers — queue board API calls will return 401 in production

**File:** `apps/dentalemon/src/features/scheduling/hooks/use-queue-board.ts:34-36` and `52-55`

Both `fetch` calls in `useQueueBoard` use plain `fetch` without any `Authorization` header or credential attachment:
```ts
const res = await fetch(`${apiBaseUrl}/dental/branches/${branchId}/queue-board`);
// ...
const res = await fetch(`${apiBaseUrl}/dental/queue-items/${itemId}/status`, { method: 'PATCH', ... });
```

Every other data-fetching hook in this codebase (`useAppointments`) uses the SDK-generated client (`listAppointmentsOptions` from `@monobase/sdk-ts/generated/react-query`) which handles session cookies/tokens via the configured transport. `useQueueBoard` bypasses the SDK entirely with raw `fetch`, so authentication is never sent.

**Impact:** Queue board and status updates will fail with 401 in any environment where the API requires authentication (i.e., all environments). The `isError` state renders "Failed to load queue board" with no remediation. Walk-in flow and queue management are V1 Required per IDEAL §3.3.

**Fix:** Replace raw `fetch` with SDK-generated procedures, or pass the session token/cookie explicitly. Pattern: mirror `useAppointments` — use SDK client.

---

## WARNING Findings

### WR-01: `cancelAppointment` catches JSON parse error and swallows it — any non-JSON body silently gives 422 REASON_REQUIRED instead of 400 VALIDATION_ERROR

**File:** `services/api-ts/src/handlers/dental-scheduling/cancelAppointment.ts:38-48`

The outer `try/catch` catches errors from `ctx.req.json()`. When parsing fails (no body, malformed JSON), it re-throws `ValidationError('cancellationReason is required...')`. This is the correct 422 behavior _if reason enforcement is the goal_, but the error message says "cancellationReason is required" even when the body is present but malformed JSON. The distinction matters for API consumers debugging bad requests.

**Fix:** Separate the JSON parse error from the missing-reason error. Parse first; if parse fails and no body was expected, return 400 VALIDATION_ERROR.

---

### WR-02: `listAppointments` returns raw array — not wrapped in `{ data, meta }` envelope per API_CONTRACTS.md

**File:** `services/api-ts/src/handlers/dental-scheduling/listAppointments.ts:72-73`

The contract specifies "Standard paginated collection" (implying `{ data, meta }` wrapper with pagination metadata). The handler returns `ctx.json(appointments)` — a raw array. No pagination metadata (`total`, `page`, `per_page`) is returned. The `useAppointments` hook works around this at line 39 with:
```ts
select: (data) => (Array.isArray(data) ? data : (data as Record<string, unknown>).appointments ?? [])
```
This bandaid in the consumer is evidence the response shape is unstable.

**Impact:** Contract tests will fail. Clients expecting `{ data: [...], meta: { total, page, per_page } }` get a raw array. The `date_from`/`date_to` contract params are also unimplemented — the handler uses a single `date` param instead.

---

### WR-03: `buildAppointmentPayload` calls Zustand store outside React context — will throw at runtime in non-React environments and is a React hook rules violation

**File:** `apps/dentalemon/src/features/scheduling/components/appointment-modal.tsx:57`

```ts
branchId: form.branchId.trim() || useOrgContextStore.getState().branchId || '',
```

`useOrgContextStore.getState()` (the Zustand static getter) is called inside a plain function (`buildAppointmentPayload`) that is exported and used in tests. This is technically valid for Zustand's static API but is inconsistent with the hook-based access pattern everywhere else (`useOrgContextStore((s) => s.branchId)`).

More critically: `validateAppointmentForm` does not validate `branchId`. If `branchId` is empty (store not yet initialized, context not set), the API call will silently send an empty string as `branchId`, which will fail with 400 at the validator layer instead of giving the user a clear "no branch selected" error.

**Fix:** Add `branchId` to the `validateAppointmentForm` check. The `buildAppointmentPayload` function should receive `branchId` as an explicit argument and not reach into the store.

---

## Spec vs Implementation Divergences (Non-Blocking)

| ID | Spec says | Implementation has | Verdict |
|----|-----------|-------------------|---------|
| D-01 | `provider_id` (uuid, membership) in POST body | `dentistMemberId` | Field name mismatch from API_CONTRACTS.md → schema uses `dentistMemberId`, contract uses `provider_id`. |
| D-02 | `start_at` / `end_at` in POST body | `scheduledAt` + `durationMinutes` | Contract uses start/end datetime pair; schema uses start + duration. Duration-based is more practical for a dental clinic but deviates from declared API. |
| D-03 | `visit_type` enum: `checkup/treatment/emergency/recall` | `serviceType` (free-text, not enum) | Contract declares enum; implementation allows any string. No enum enforcement. |
| D-04 | `date_from` / `date_to` range on GET | `date` (single date) | Contract specifies a 31-day window range query; implementation uses single-day `date` filter. Calendar week/month views have no proper date-range query path. |
| D-05 | `staff_scheduling` not allowed for check-in (MODULE_SPEC §6) | `staff_scheduling` listed in API_CONTRACTS.md as authorized for check-in | Permission contradiction between MODULE_SPEC and API_CONTRACTS. No role check is enforced at handler level — `assertBranchAccess` only checks branch membership, not role. |
| D-06 | DE-010 `AppointmentBooked` event emitted on create | Not emitted — only `notifs?.createNotification(...)` called (best-effort in-app notif) | Domain event contract not fulfilled. |
| D-07 | DE-011 `AppointmentCancelled` event emitted on cancel | Not emitted | Domain event contract not fulfilled. |
| D-08 | `RESCHEDULE_CONFLICT(409)` in PATCH error list | `ConflictError` thrown with generic message; no `RESCHEDULE_CONFLICT` code | Error code not set. `ConflictError` uses default code, not `RESCHEDULE_CONFLICT`. |
| D-09 | `cancelled_at` field in schema | Present as `cancelledAt` | camelCase vs snake_case — consistent within codebase, camelCase is correct for Drizzle. OK. |
| D-10 | Queue board: `cancelled` column absent from `COLUMNS` in queue-board.tsx | `COLUMNS` has `waiting/called/in_progress/completed` only | Cancelled items are filtered out by `findActiveByBranch` (excluded from API response) so this is consistent, but users can never see cancelled items. No audit visibility. |

---

## Business Rule Coverage

| Rule | Implemented | Tested | Notes |
|------|:-----------:|:------:|-------|
| BR-004: Check-in creates visit; visit outlives appointment | YES | YES | Correctly transactional |
| BR-SCH-001: Branch scope | YES | YES | `assertBranchAccess` at top of every handler |
| BR-SCH-002: Walk-in bypass working hours | YES | YES (`walkIn: true` test exists) | Correct |
| BR-SCH-003: Cancellation requires reason | PARTIAL | PARTIAL | BL-01 above — wrong transport, test passes without reason |
| BR-SCH-004: Validate against working hours | YES | YES | Full suite in `dental-scheduling-module4.test.ts` |
| FR3.7: Soft-warn create, hard-block reschedule | YES | YES | Properly bifurcated |
| AC-SCH-001: Create overlap → 201+warning | YES | YES | |
| AC-SCH-002: Reschedule overlap → 409 | YES | YES | |
| AC-SCH-003: Check-in with active visit → 409 | YES | YES | |
| AC-SCH-004: Cancel without reason → 422 | BROKEN | NO | BL-01 |
| AC-SCH-005: Cancel → visit still accessible | NOT TESTED | NO | No test verifies visit survives after appointment cancel |

---

## State Machine Audit

**Declared:**
```
scheduled → checked_in → completed
scheduled → cancelled
scheduled → no_show
```

**Implemented (`APPOINTMENT_TRANSITIONS` in schema):**
```
scheduled:  → checked_in | cancelled | no_show
checked_in: → completed | cancelled | no_show
completed:  → [] (terminal)
cancelled:  → [] (terminal)
no_show:    → completed (reversible)
```

**Deviations:**
- The spec declares `checked_in → completed` but says nothing about `checked_in → cancelled`. The implementation allows `checked_in → cancelled` which is operationally correct but undocumented.
- `no_show → completed` reversal is implemented but not in MODULE_SPEC §8 (though schema comment documents it).
- Schema comment says "No-show is reversible (can revert to completed)" — the spec does not declare this. Low risk but worth documenting in MODULE_SPEC.

**Queue Item FSM:**
```
waiting → called | cancelled
called → in_progress | cancelled
in_progress → completed | cancelled
completed → [] (terminal)
cancelled → [] (terminal)
```
This is consistent with IDEAL §3.3 states. Note MODULE_SPEC §8 documented gap IDEAL-GAP-P2-011 correctly — the queue item FSM does NOT match IDEAL's `waiting → with_provider → ready_for_checkout → checked_out`; it uses a custom `called/in_progress` nomenclature. This is a declared deviation.

---

## Walk-in Flow Coverage (IDEAL §3.3 — V1 Required)

Walk-in is supported via `walkIn: true` flag on appointment creation. The `AppointmentModal` UI has a walk-in toggle. `BR-SCH-002` correctly bypasses working hours check.

**Gap:** Walk-in via the modal does NOT actually set `walkIn: true` in the API payload. `handleNewAppointment(true)` is called in calendar.tsx:238, but `AppointmentModal` does not receive a `walkIn` prop — it has its own internal `walkIn` state initialized to `false`. The Walk-In button in the top bar calls `handleNewAppointment(true)` but that value is never passed to the modal. The user must manually toggle the Walk-in checkbox inside the modal. This is a usability defect: the Walk-In button does not pre-set the walk-in flag.

---

## Permission Enforcement Audit

**`assertBranchAccess`** checks that the user has an active `dental_membership` in the target branch. It does NOT check the membership role. This means:

- Any `dental_membership` role (including `staff_scheduling`) can perform check-in, even though MODULE_SPEC §6 restricts check-in to `staff_full, dentist_owner, dentist_associate`.
- Any role can cancel an appointment, even though MODULE_SPEC §6 restricts cancel to `staff_full, dentist_owner`.

Role-level enforcement beyond branch membership is absent across all handlers. This is noted as D-05 above and is a recurring gap across the module.

---

## Missing Tests

| Gap | Priority |
|-----|----------|
| AC-SCH-005: Visit accessible after appointment cancel | P0 |
| `RESCHEDULE_CONFLICT` error code on 409 response | P1 |
| Role-based permission rejection (staff_scheduling cannot check-in) | P1 |
| Walk-in pre-selection via top-bar button | P1 |
| Queue board: `createQueueItem` endpoint test | P1 |
| Domain event emission (DE-010, DE-011) | P2 |
| `visit_type` enum validation | P2 |

---

## Positive Findings

- FR3.7 implementation is correct and well-tested (soft-warn at create, hard-block at reschedule with proper interval math via SQL interval expression).
- Check-in is transactional (creates visit + links visitId atomically); race condition guard (BL-01 pre-check) is correctly positioned before mutation.
- `isWithinWorkingHours` correctly handles timezone via `Intl.DateTimeFormat` — a subtle but important correctness point.
- Queue board FSM is fully implemented backend-to-frontend with proper column layout and action buttons.
- `findOverlapping` uses correct SQL interval math (not naive timestamp comparison).
- All handlers call `assertBranchAccess` at the top — no handler skips the branch scope check.

---

_Reviewed: 2026-05-27_  
_Reviewer: Claude (gsd-code-reviewer / oli-enforce-module)_  
_Depth: deep_
