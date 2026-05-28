# Scheduling Module Audit — Calendar, Appointments, Queue Board

**Date:** 2026-05-26
**Auditor:** Read-only automated audit
**Module:** dental-scheduling (Module 5 of 18)
**Prior global score:** Not independently scored — included in v1.5 wave

---

## Scope

| Area | Files |
|------|-------|
| Frontend routes | `apps/dentalemon/src/routes/_dashboard/calendar.tsx`, `apps/dentalemon/src/routes/_workspace/queue-board.tsx` |
| Frontend components | `apps/dentalemon/src/features/scheduling/components/` (8 files) |
| Frontend hooks | `apps/dentalemon/src/features/scheduling/hooks/use-appointments.ts`, `use-queue-board.ts` |
| Backend handlers | `services/api-ts/src/handlers/dental-scheduling/` (25 files) |
| Backend tests | 7 test files (dental-scheduling.test.ts, module4, transitions, queue, ac-scheduling, notif, fsm-property) |
| E2E tests | `apps/dentalemon/tests/e2e/calendar.spec.ts`, `ipad-calendar.spec.ts`, `patient-checkin.spec.ts` |
| TypeSpec | `specs/api/src/modules/dental-scheduling.tsp` |
| Contract tests | `specs/api/tests/contract/dental-scheduling.hurl` |
| Spec docs | `docs/product/modules/dental-scheduling/MODULE_SPEC.md`, `API_CONTRACTS.md` |

---

## Findings Summary

| # | Severity | Gate | Finding |
|---|----------|------|---------|
| F1 | P1 | G4/G5 | Appointment modal always calls `createAppointment` — edit mode sends a second CREATE instead of PATCH |
| F2 | P1 | G6 | Queue board endpoints (`/dental/branches/:branchId/queue-board`, `/dental/queue-items/:itemId/status`, `/dental/appointments/:appointmentId/queue-item`) are absent from OpenAPI spec and TypeSpec |
| F3 | P1 | G6 | `useQueueBoard` / `updateStatus` mutation sends no auth credentials (`credentials: 'include'` missing on both fetch calls) — will 401 on same-site cookie auth |
| F4 | P1 | G4 | `handleCheckIn` silently swallows all errors (bare `catch {}`) — check-in failure is invisible to staff |
| F5 | P1 | G6 | `listAppointments` date filter uses UTC midnight bounds (`T00:00:00.000Z`) — for clinics in UTC+8 (Asia/Manila), appointments after midnight UTC are excluded from the "next day" calendar view |
| F6 | P1 | G2 | Backend role model allows `staff_scheduling` to create/update appointments (`assertBranchAccess` = any member) but MODULE_SPEC.md says check-in is restricted to `staff_full`, `dentist_owner`, `dentist_associate` — this restriction has no backend enforcement |
| F7 | P1 | G6 | Cancellation has two paths: `DELETE /dental/appointments/:id` (handler: `cancelAppointment`) requires `cancellationReason` in JSON body; `PATCH /dental/appointments/:id` with `{ status: 'cancelled' }` also accepts an optional `body.cancellationReason`. The DELETE path reads body via `ctx.req.json()` directly (not validated by zod schema) — malformed JSON will swallow the error and return 422 with a misleading message |
| F8 | P2 | G3 | No navigation link from calendar to queue board — these are entirely separate route trees (`/_dashboard/calendar` vs `/_workspace/queue-board`) with no cross-link |
| F9 | P2 | G4 | `CalendarWeek` and `CalendarMonth` do not propagate `onCheckIn` — check-in is only available from the day view, not week or month view |
| F10 | P2 | G5 | `appointment-modal.test.ts` contains zero assertions (empty file output confirmed) — edit mode is not unit-tested |
| F11 | P2 | G4 | `AppointmentCard` `statusStyles` map uses camelCase keys (`checkedIn`, `noShow`) but the API returns snake_case (`checked_in`, `no_show`) — checked-in and no-show appointments render with the default grey style instead of the correct colour |
| F12 | P2 | G8 | E2E check-in test (`FR3.9`) uses `page.getByTestId('appointment-check-in')` but `AppointmentCard` has no `data-testid="appointment-check-in"` attribute — the test will always take the silent-pass branch and never actually validates the UI click path |
| F13 | P2 | G6 | `listAppointments` reads `patientId` and pagination params from raw query (`ctx.req.query()`) — these are outside the TypeSpec/OpenAPI schema, making them undocumented and untested by contract tests |
| F14 | P2 | G8 | `check-in-flow.test.ts` tests only pure helper functions (`canCheckIn`, `parseCheckInResponse`) — no component test, no hook test, no integration test for the check-in UI interaction chain |
| F15 | P2 | G7 | After successful check-in, `handleCheckIn` only calls `invalidateAppointments()` — no navigation to workspace or visit; staff must manually navigate to start the visit |
| F16 | P3 | G6 | `cancelAppointment` handler (DELETE) reads body with a raw try/catch around `ctx.req.json()` rather than using the zod validator — if the HTTP client sends no body at all (common with DELETE requests), the error message says "cancellationReason is required" with no indication that a JSON body is needed |
| F17 | P3 | G8 | Backend tests use `buildTestApp()` pattern (inline Hono app) — they do not test route registration, middleware ordering, or the actual router mount path. A handler mounted on the wrong path would pass all unit tests |
| F18 | P3 | G5 | `AppointmentModal` does not pre-populate form fields when `appointmentId` is provided (no load/fetch for existing appointment data) — the "edit" modal opens blank |
| F19 | P3 | G6 | `useAppointments` hook passes only `date` and `branchId` to `listAppointmentsOptions` — no `status` filter is passed, so the calendar always fetches all statuses including cancelled/completed appointments |

---

## Gate-by-Gate Analysis

### Gate 2 — Role and Permission Map

**Backend role enforcement model:** All scheduling endpoints use `assertBranchAccess` (any active branch member passes). There is no endpoint that calls `assertBranchRole` except `updateWorkingHours` (restricted to `dentist_owner`).

| Endpoint | Backend Guard | Effective Roles | MODULE_SPEC Role Requirement | Match? |
|----------|--------------|-----------------|------------------------------|--------|
| `POST /dental/appointments` | `assertBranchAccess` | Any branch member | `staff_full`, `staff_scheduling`, `dentist_owner`, `dentist_associate` | Partial — more permissive than spec |
| `GET /dental/appointments` | `assertBranchAccess` | Any branch member | All dental roles | Yes |
| `PATCH /dental/appointments/:id` | `assertBranchAccess` | Any branch member | `staff_full`, `staff_scheduling`, `dentist_owner` | Partial — more permissive |
| `DELETE /dental/appointments/:id` | `assertBranchAccess` | Any branch member | `staff_full`, `dentist_owner` | Partial — more permissive |
| `POST /dental/appointments/:id/check-in` | `assertBranchAccess` | Any branch member | `staff_full`, `dentist_owner`, `dentist_associate` (NOT `staff_scheduling`) | Bug — `staff_scheduling` cannot check in per spec, but backend allows it |
| `GET /dental/branches/:branchId/queue-board` | `assertBranchAccess` | Any branch member | All dental roles (view) | Yes |
| `PATCH /dental/queue-items/:itemId/status` | `assertBranchAccess` | Any branch member | Dentist roles for in-room transitions | Partial |
| `POST /dental/appointments/:id/queue-item` | `assertBranchAccess` | Any branch member | Not specified | Undocumented |
| `GET /dental/branches/:branchId/working-hours` | `assertBranchAccess` | Any branch member | — | OK |
| `PUT /dental/branches/:branchId/working-hours` | `assertBranchRole(['dentist_owner'])` | `dentist_owner` only | — | OK — most restrictive endpoint |

**Frontend enforcement:** No role-gated rendering found in calendar or queue board routes. All scheduling actions are shown to all authenticated users. Role enforcement relies entirely on backend 403s.

**Finding F6 detail:** The MODULE_SPEC.md explicitly states check-in is "Not staff_scheduling" but `checkInAppointment` only calls `assertBranchAccess`. A `staff_scheduling` member can perform check-in on the backend.

---

### Gate 3 — Route and Navigation Map

| Route | File | Accessible From | Notes |
|-------|------|-----------------|-------|
| `/_dashboard/calendar` | `routes/_dashboard/calendar.tsx` | Main dashboard nav | Day/week/month views, appointment modal |
| `/_workspace/queue-board` | `routes/_workspace/queue-board.tsx` | Direct URL only | No link from calendar or dashboard found |

**Navigation findings:**

- Appointment card `onClick` opens `AppointmentModal` in "edit" mode within the same page (does not navigate to a dedicated appointment route).
- After check-in, there is no navigation to the workspace or visit — staff stays on the calendar (F15).
- No breadcrumb or back-link from queue board to calendar.
- No navigation link from calendar header to queue board confirmed by search of `calendar.tsx` (zero results for `queue` keyword in route file).
- `queue-board` route uses `createFileRoute('/_workspace/queue-board' as any)` — the `as any` cast suppresses TypeScript route type checking, indicating it may not be registered in the router type tree.

---

### Gate 4 — Frontend Interaction Integrity

| Interaction | UI Element | Handler Function | API Call | Response Handling | Error Handling |
|-------------|-----------|-----------------|----------|-------------------|----------------|
| Create appointment | "New Appointment" button → `AppointmentModal` | `handleSave()` | `createAppointment()` (SDK) | Closes modal, calls `onSaved` | `setErrors(['Failed to create appointment'])` |
| Edit appointment | Appointment card click → `AppointmentModal` with `appointmentId` | `handleSave()` | `createAppointment()` (SDK) — NOT `updateAppointment` | Same as create | Same as create |
| Walk-in appointment | "Walk-In" button → `AppointmentModal` with `walkIn` pre-set | `handleSave()` | `createAppointment()` | Same | Same |
| Check-in | "Check In" button on `AppointmentCard` | `handleCheckIn()` | `checkInAppointment()` (SDK) | `invalidateAppointments()` | Silent catch — no error shown (F4) |
| Queue board status update | Action button in `QueueCard` | `updateStatus()` | `PATCH /dental/queue-items/:itemId/status` (raw fetch) | `qc.invalidateQueries` | No UI error shown on failure |
| Load queue board | Component mount | `useQueueBoard()` | `GET /dental/branches/:branchId/queue-board` (raw fetch) | `items` array | `isError` flag shown |
| Load appointments | Calendar mount | `useAppointments()` | `listAppointmentsOptions` (SDK) | `appointments` array | `error` banner with retry |

**F1 — Edit mode creates duplicate appointment:**

`appointment-modal.tsx` line 136: `const isEdit = !!appointmentId;` — `isEdit` sets the modal title only. `handleSave()` unconditionally calls `createAppointment(...)` regardless of `appointmentId`. No `updateAppointment` (PATCH) call exists anywhere in the component. Clicking "Save Appointment" in edit mode submits a CREATE request, producing a duplicate appointment.

Evidence:
- `appointment-modal.tsx:124`: `const { data: appointment } = await createAppointment({ body: ... })`
- `appointment-modal.tsx:136`: `const isEdit = !!appointmentId;` — only controls title string, nothing else
- No import of `updateAppointment` in `appointment-modal.tsx`

**F3 — Queue board fetch has no auth:**

`use-queue-board.ts:34-39`:
```
const res = await fetch(`${apiBaseUrl}/dental/branches/${branchId}/queue-board`);
```
No `credentials: 'include'` on this GET call. The PATCH mutation at line 47-55 also has no `credentials: 'include'`. Both will fail with 401 if the server requires session cookies and the app is not on the same origin.

**F9 — Check-in only available in day view:**

`CalendarWeek` does not accept or pass `onCheckIn` prop — searching confirms only `onAppointmentClick` and `onDayClick`. `CalendarMonth` similarly has no `onCheckIn`. Only `CalendarDay` receives and uses `onCheckIn`.

---

### Gate 5 — Forms, Modals, Tables

**Appointment Booking Form (`appointment-modal.tsx`)**

| Field | Validation | Notes |
|-------|-----------|-------|
| `patientId` | Required, non-empty | Client-side |
| `serviceType` | Required, non-empty | Client-side |
| `date` | Required, non-empty | Client-side |
| `time` | Required, HH:MM format | Client-side |
| `dentistMemberId` | Not validated client-side | Optional in form |
| `branchId` | Pulled from `useOrgContextStore` | Not shown to user |
| `durationMinutes` | Defaults to 30 | Not validated as positive |
| `notes` | No validation | Free text |
| `walkIn` | Boolean toggle | OK |

`validateAppointmentForm` is exported and present, but `isEdit` check is not wired to call `updateAppointment`.

**F18 — Edit modal opens blank:**

`AppointmentModal` receives `appointmentId` but never fetches existing appointment data to pre-populate fields. All state fields initialize to `''` / defaults. An edit flow shows the user a blank form.

**F10 — Modal test is empty:**

`appointment-modal.test.ts` — grep for assertions returned zero results. The file exists but contains no test assertions. Edit/create flow is not unit-tested at the component level.

**Queue Board Table (`queue-board.tsx`)**

- Columns: `waiting`, `called`, `in_progress`, `completed` (4 columns — `cancelled` is excluded from `COLUMNS` array, confirmed by test)
- Clicking action button calls `updateStatus` mutation
- No pagination — fetches all active items in one request
- `QueueCard` shows `patientName` or UUID fallback, `timeWaiting` relative timestamp, FSM action button

---

### Gate 6 — Backend/API Contract Alignment

**OpenAPI-documented dental scheduling endpoints (confirmed):**

```
POST   /dental/appointments
GET    /dental/appointments
GET    /dental/appointments/{appointmentId}
PATCH  /dental/appointments/{appointmentId}
DELETE /dental/appointments/{appointmentId}
POST   /dental/appointments/{appointmentId}/check-in
GET    /dental/branches/{branchId}/working-hours
PUT    /dental/branches/{branchId}/working-hours
```

**F2 — Queue board endpoints not in OpenAPI spec (confirmed):**

Python query of `specs/api/dist/openapi/openapi.json` returns only email queue paths when filtering for "queue":
```
['/email/queue', '/email/queue/{queue}', '/email/queue/{queue}/cancel', '/email/queue/{queue}/retry']
```

The following backend endpoints exist in code but are absent from OpenAPI spec:
- `GET /dental/branches/:branchId/queue-board` — implemented in `listQueueBoard.ts`
- `POST /dental/appointments/:appointmentId/queue-item` — implemented in `createQueueItem.ts`
- `PATCH /dental/queue-items/:itemId/status` — implemented in `updateQueueItemStatus.ts`

TypeSpec grep confirms: no queue-board or queue-item definitions in `specs/api/src/modules/dental-scheduling.tsp`.

The Hurl contract test file (`dental-scheduling.hurl`) covers only appointment CRUD and check-in. Queue board operations have no contract tests.

**F5 — Date filter timezone bug:**

`listAppointments.ts:66-68`:
```typescript
const dayStart = new Date(filters.date + 'T00:00:00.000Z');
const dayEnd   = new Date(filters.date + 'T23:59:59.999Z');
```
Appending `.000Z` forces UTC. For Asia/Manila (UTC+8), a Manila-local appointment at 08:00 on 2026-06-01 is stored as `2026-05-31T16:00:00Z`. Querying `date=2026-06-01` creates bounds `2026-06-01T00:00:00Z` → `2026-06-01T23:59:59Z` — the Manila-morning appointments are excluded. The calendar would appear empty until after noon local time.

The branch schema stores a `timezone` field but `listAppointments` does not use it for date filtering.

**F13 — Undocumented query params:**

```typescript
// Additional filters not in TypeSpec (read from raw query)
const rawQuery = ctx.req.query();
// patientId from rawQuery
```
`patientId` and pagination (`page`, `perPage`) are read via raw `ctx.req.query()` and are not declared in the TypeSpec or generated OpenAPI validators. These are invisible to contract tests and SDK consumers.

**Cancel endpoint body inconsistency (F7 / F16 detail):**

`cancelAppointment.ts` is mounted on `DELETE /dental/appointments/:appointmentId`. DELETE requests with JSON bodies are non-standard and many HTTP clients (including some fetch implementations) strip bodies on DELETE. The handler does `ctx.req.json()` with a raw try/catch — if no body is sent, the catch block re-throws `ValidationError('cancellationReason is required')`, which is correct but the error gives no hint that a body is needed at all.

The TypeSpec definition for `cancel` shows `@delete` with no `@body` decorator — the spec does not declare that a JSON body is required. The API_CONTRACTS doc says `reason` is a query param (not body), creating a three-way inconsistency between TypeSpec, API_CONTRACTS.md, and implementation.

---

### Gate 7 — Role-Based Journey Map

**Journey J1: Staff scheduling books appointment for patient**

| Step | UI | API | Result | Issues |
|------|----|----|--------|--------|
| 1. Open calendar | Navigate to `/_dashboard/calendar` | `GET /dental/appointments?date=...` | Calendar renders | F5: timezone bug may show empty calendar |
| 2. Click "New Appointment" | Button in toolbar | — | Modal opens | OK |
| 3. Fill form, click Save | `AppointmentModal.handleSave()` | `POST /dental/appointments` | 201 Created | OK |
| 4. Calendar refreshes | `invalidateAppointments()` | `GET /dental/appointments?date=...` | New appointment appears | OK |

**Journey J2: Staff checks in patient from calendar**

| Step | UI | API | Result | Issues |
|------|----|----|--------|--------|
| 1. Open day view | Day button in toolbar | — | Day grid renders | Only day view shows check-in button |
| 2. Hover appointment card | `AppointmentCard` hover | — | "Check In" button appears | F12: no `data-testid` so E2E test silently skips |
| 3. Click "Check In" | `handleCheckIn(appointmentId)` | `POST /dental/appointments/:id/check-in` | 200 `{ appointment, visitId }` | F4: error silently swallowed |
| 4. Calendar refreshes | `invalidateAppointments()` | `GET /dental/appointments` | Status updates | F11: `checked_in` status renders as grey (wrong CSS key) |
| 5. Navigate to visit | None | — | Staff must manually navigate | F15: no automatic redirect to workspace |

**Journey J3: Staff views today's queue board**

| Step | UI | API | Result | Issues |
|------|----|----|--------|--------|
| 1. Navigate to queue board | Direct URL `/_workspace/queue-board` | — | Queue board renders | F8: no link from calendar |
| 2. Load queue items | `useQueueBoard(branchId)` | `GET /dental/branches/:branchId/queue-board` | Items displayed | F3: fetch has no credentials |
| 3. Move patient to "Called" | Action button click | `PATCH /dental/queue-items/:itemId/status` | 200, status updates | F3: fetch has no credentials; F2: undocumented endpoint |

**Journey J4: Staff edits/reschedules appointment**

| Step | UI | API | Result | Issues |
|------|----|----|--------|--------|
| 1. Click appointment card | `handleAppointmentClick(appt)` | — | Modal opens, `isEdit=true` | F18: modal opens blank (no pre-population) |
| 2. Modify fields, click Save | `AppointmentModal.handleSave()` | `POST /dental/appointments` (CREATE) | 201 — duplicate created | F1: critical bug |

---

### Gate 8 — Test Confidence Gap

**Backend test files:**

| File | Tests Cover | Type | Uses Real Router? |
|------|-------------|------|-------------------|
| `dental-scheduling.test.ts` | Create, get, list, check-in, cancel, update — auth + validation + success paths | Integration (DB) | No — `buildTestApp()` |
| `dental-scheduling-module4.test.ts` | Working hours CRUD, outside-hours blocking | Integration (DB) | No |
| `dental-scheduling-transitions.test.ts` | All FSM transitions for all handlers | Integration (DB) | No |
| `dental-queue.test.ts` | `createQueueItem`, `listQueueBoard`, `updateQueueItemStatus` — auth + FSM | Integration (DB) | No |
| `ac-scheduling.test.ts` | AC-SCHED-01 to AC-SCHED-05 + notification trigger | Integration (DB) | No |
| `createAppointment.notif.test.ts` | Notification mock — fire-and-forget pattern | Unit (mock) | No |
| `appointment.fsm.property.test.ts` | FSM property tests via fast-check | Property | N/A |
| `repos/dental-appointment.test.ts` | Repository-level tests (not read but found) | Unit | N/A |

**Frontend test files:**

| File | Tests Cover | Type | Quality |
|------|-------------|------|---------|
| `appointment-modal.test.ts` | EMPTY — zero assertions | None | No value |
| `appointment-card.test.ts` | Not read (found) — likely pure logic | Unit | Unknown |
| `calendar-day.test.ts` | Not read (found) | Unit | Unknown |
| `calendar-month.test.ts` | Exports `generateMonthGrid`, `countAppointmentsByDate`, `isOverflowDay` | Unit | Good |
| `calendar-week.test.ts` | `getWeekDates`, `getTopPx`, `getHeightPx`, `formatChipTime`, `truncateId` | Unit | Good |
| `queue-board.test.ts` | `timeWaiting`, `PRIMARY_ACTION`, `COLUMNS` pure helpers only | Unit | Partial |
| `check-in-flow.test.ts` | `canCheckIn`, `parseCheckInResponse` pure helpers only | Unit | Partial |
| `use-appointments.test.ts` | Loading, success, error, URL params, week/month date math | Unit (mock fetch) | Good |
| `use-queue-board.test.ts` | Loading, success, error, PATCH mutation, envelope unwrapping | Unit (mock fetch) | Good |

**E2E tests:**

| File | Coverage | UI Interaction Depth | Issues |
|------|----------|---------------------|--------|
| `calendar.spec.ts` | View toggle, walk-in button, check-in button click, cancel, create, list, double-booking | Partial UI + mostly API via `page.evaluate` | F12: check-in click conditional on `data-testid` that doesn't exist |
| `ipad-calendar.spec.ts` | Calendar grid visible, day headers, no horizontal scroll at 1024px | Layout only | Tests skip silently if API unavailable |
| `patient-checkin.spec.ts` | Check-in creates visit, visit has correct IDs | API-level only | Uses hardcoded UUIDs for branch/member — fragile |

**Test confidence scores:**

| Layer | Score | Rationale |
|-------|-------|-----------|
| Backend unit (handler) | 8/10 | Strong FSM, transition, queue, AC coverage. Uses `buildTestApp` (no real router) but assertions on real DB outcomes |
| Backend property tests | 9/10 | FSM property tests with fast-check cover all state pairs |
| Backend contract (Hurl) | 3/10 | Queue board endpoints entirely absent from contract suite |
| Frontend unit (components) | 3/10 | Pure logic helpers tested; modal and card interactions not tested; `appointment-modal.test.ts` is empty |
| Frontend unit (hooks) | 7/10 | `use-appointments` and `use-queue-board` well tested with mock fetch |
| Frontend E2E | 4/10 | Most "UI" tests use `page.evaluate` API calls rather than real UI interactions; check-in click test has broken selector |
| Permission tests | 2/10 | No test confirms `staff_scheduling` cannot check in; role tests only verify 401 (unauth) not 403 (wrong role) |

---

## Critical Issues Detail

### F1 — Edit Appointment Always Creates Duplicate (P1)

**Evidence:**
- `apps/dentalemon/src/features/scheduling/components/appointment-modal.tsx:124`
  `const { data: appointment } = await createAppointment({ body: ... })`
- `apps/dentalemon/src/features/scheduling/components/appointment-modal.tsx:136`
  `const isEdit = !!appointmentId;` — only sets `title` string
- No `import { updateAppointment }` statement in `appointment-modal.tsx`

**Impact:** Every time a staff member opens an existing appointment and clicks "Save Appointment," a brand-new duplicate appointment is created. The original appointment is unchanged. Calendar will accumulate duplicate entries. Walk-in reschedules will produce infinite duplicates.

**Fix path:** Branch in `handleSave` on `isEdit`:
- If `isEdit`: call `updateAppointment({ path: { appointmentId }, body: patch })`
- Pre-populate form fields by calling `getAppointment({ path: { appointmentId } })` on modal open

---

### F2 — Queue Board Endpoints Missing from OpenAPI/TypeSpec (P1)

**Evidence:**
- `python3` query of `specs/api/dist/openapi/openapi.json`: no paths containing `queue-board` or `queue-item` in dental namespace
- `grep` of `specs/api/src/modules/dental-scheduling.tsp`: no `queue-board` or `queue-item` definitions
- Three implemented backend endpoints (`listQueueBoard.ts`, `createQueueItem.ts`, `updateQueueItemStatus.ts`) have no TypeSpec, no OpenAPI paths, no contract tests

**Impact:** SDK consumers cannot discover these endpoints. Hurl contract test suite will never catch regressions on queue board functionality. The 15s polling in `useQueueBoard` is against an undocumented API.

**Fix path:** Add queue board operations to `dental-scheduling.tsp`. Run `bun run build` in `specs/api`. Add Hurl scenarios for queue board CRUD and FSM transitions.

---

### F3 — Queue Board Fetch Has No Auth Credentials (P1)

**Evidence:**
- `apps/dentalemon/src/features/scheduling/hooks/use-queue-board.ts:34`
  `const res = await fetch(\`${apiBaseUrl}/dental/branches/${branchId}/queue-board\`);`
  No `credentials: 'include'` option
- `apps/dentalemon/src/features/scheduling/hooks/use-queue-board.ts:47`
  `const res = await fetch(\`${apiBaseUrl}/dental/queue-items/${itemId}/status\`, { method: 'PATCH', headers: {...} });`
  No `credentials: 'include'` option

**Impact:** Queue board will return 401 in production if the API uses session cookies for auth (which it does — see `credentials: 'include'` used consistently throughout all other fetch calls in E2E tests). Queue board is effectively broken in any session-cookie deployment.

**Fix path:** Add `credentials: 'include'` to both fetch calls in `use-queue-board.ts`, or migrate to SDK client which handles auth automatically.

---

### F4 — Check-In Error Silently Swallowed (P1)

**Evidence:**
- `apps/dentalemon/src/routes/_dashboard/calendar.tsx:133-138`
  ```typescript
  async function handleCheckIn(appointmentId: string) {
    try {
      await checkInAppointment({ path: { appointmentId } });
      invalidateAppointments();
    } catch {
      // Network error — ignore silently
    }
  }
  ```

**Impact:** If check-in fails (409 conflict — active visit exists, 403 forbidden, 404 not found, network error), staff sees nothing. The calendar refreshes without showing the checked-in status. Staff may attempt check-in multiple times, create confusion, or believe check-in succeeded when it did not.

**Fix path:** Surface errors to the user — set an error state and display a toast/banner with the error message.

---

### F5 — Date Filter UTC Boundary Causes Empty Calendar for UTC+ Clinics (P1)

**Evidence:**
- `services/api-ts/src/handlers/dental-scheduling/listAppointments.ts:66-68`
  ```typescript
  const dayStart = new Date(filters.date + 'T00:00:00.000Z');
  const dayEnd   = new Date(filters.date + 'T23:59:59.999Z');
  ```
  Suffix `.000Z` forces UTC interpretation regardless of branch timezone.

**Impact:** A clinic in Asia/Manila (UTC+8) that books a 09:00 appointment has it stored as `scheduledAt = 2026-06-01T01:00:00Z`. When the calendar queries `date=2026-06-01`, bounds are `2026-06-01T00:00:00Z` to `2026-06-01T23:59:59Z` — this appointment IS included. However, an 09:00 appointment from the previous local day, stored as `2026-05-31T01:00:00Z`, would be excluded from `date=2026-05-31` query (`2026-05-31T00:00:00Z` to `2026-05-31T23:59:59Z` — included, actually fine for this case).

More critically: an appointment at 23:30 Manila time (UTC+8) = `2026-06-01T15:30:00Z`. Querying `date=2026-06-01` (UTC bounds `00:00Z` to `23:59Z`) includes it. But an appointment at 01:00 Manila time = `2026-05-31T17:00:00Z`. Querying `date=2026-06-01` would miss this. The defect manifests as missing early-morning appointments in UTC+ timezones and potentially showing late-night appointments on the wrong day.

**Fix path:** Use branch `timezone` field to compute day boundaries in the branch's local timezone rather than UTC.

---

### F6 — `staff_scheduling` Can Check In Patients (Backend Enforcement Gap) (P1)

**Evidence:**
- `services/api-ts/src/handlers/dental-scheduling/checkInAppointment.ts`: only `assertBranchAccess` — any branch member
- `docs/product/modules/dental-scheduling/MODULE_SPEC.md:72`: "Check-in | staff_full, dentist_owner, dentist_associate | Not staff_scheduling"

**Impact:** `staff_scheduling` users can call `POST /dental/appointments/:id/check-in` and succeed. This creates visits that may be attributed to a non-clinical staff role. Depending on the visit workflow, this could produce visits with no treating dentist.

**Fix path:** Add `assertBranchRole(db, user.id, appointment.branchId, ['staff_full', 'dentist_owner', 'dentist_associate'])` in `checkInAppointment.ts`.

---

## Recommended Fix Priority

| Priority | Finding | Effort | Risk of Delay |
|----------|---------|--------|---------------|
| 1 | F1 — Edit creates duplicate | Medium | Every edit produces bad data |
| 2 | F3 — Queue board no auth | Low | Queue board broken in prod |
| 3 | F4 — Check-in error silent | Low | Staff confusion on failed check-ins |
| 4 | F5 — Date filter UTC bug | Medium | Calendar empty in UTC+ clinics |
| 5 | F6 — staff_scheduling can check in | Low | Security/workflow gap |
| 6 | F2 — Queue endpoints not in spec | High | Technical debt, no contract tests |
| 7 | F11 — CSS key mismatch | Low | Wrong colours for checked-in appointments |
| 8 | F18 — Edit modal opens blank | Low | UX — staff must re-enter all fields |
| 9 | F12 — E2E check-in selector broken | Low | False confidence in test suite |
| 10 | F10 — Modal test empty | Low | No regression safety on modal |

---

## Overall Confidence Score

| Layer | Score /10 | Notes |
|-------|-----------|-------|
| Backend unit | 8 | Strong transition + AC + property coverage |
| Backend contract | 3 | Queue board entirely absent; only appointment CRUD covered |
| Frontend unit (hooks) | 7 | `use-appointments` and `use-queue-board` well tested |
| Frontend unit (components) | 3 | Calendar helpers good; modal test empty; card/check-in flow untested |
| Frontend E2E | 4 | Mostly API-level via `page.evaluate`; check-in UI selector broken |
| Permission enforcement | 2 | No role-differentiated tests; `staff_scheduling` can check-in |
| API contract alignment | 4 | Edit modal calls wrong endpoint; queue endpoints undocumented |
| **Overall** | **4.4 / 10** | Core appointment CRUD is sound but edit flow is broken, queue board has auth/spec gaps, and date filtering has a timezone defect |
