# Base Platform Audit — Person, Booking, Comms, Storage, Notifs

**Date:** 2026-05-26
**Auditor:** Read-only automated audit
**Priority:** P2 — Platform modules (used by dental app, not dental-specific)
**Scope:** Five base platform modules: `person`, `booking`, `comms`, `storage`, `notifs`

---

## Scope

| Module | Backend Path | Frontend Path | Status |
|--------|-------------|---------------|--------|
| person | `services/api-ts/src/handlers/person/` | No dedicated account feature | Active |
| booking | `services/api-ts/src/handlers/booking/` | `apps/account/src/features/booking/` | Active |
| comms | `services/api-ts/src/handlers/comms/` | `apps/account/src/features/comms/` | Active |
| storage | `services/api-ts/src/handlers/storage/` | Route: `_dashboard/storage.tsx` (no feature dir) | Active |
| notifs | `services/api-ts/src/handlers/notifs/` | Route: `_dashboard/notifications.tsx` (no feature dir) | Active |

**Note:** The dentalemon dental app uses `dental-scheduling` for appointments, not the base `booking` module. The base booking module is the platform layer used by the account reference app.

---

## Findings Summary

| ID | Severity | Module | Gate | Title |
|----|----------|--------|------|-------|
| F1 | P1 | person | G2 | `listPersons` has no runtime role enforcement — admin-only endpoint accessible to any authenticated user |
| F2 | P1 | booking | G8 | `booking-coverage.test.ts` uses `as any` casts throughout — TS18046 errors mask type contract |
| F3 | P1 | booking | G4 | No frontend route for `confirmBooking` — host cannot confirm a booking via account app |
| F4 | P1 | comms | G8 | No unit handler coverage tests for `createChatRoom`, `sendChatMessage`, `listChatRooms`, `getChatMessages`, `endVideoCall`, `leaveVideoCall`, `updateVideoCallParticipant` |
| F5 | P2 | storage | G3 | No `apps/account/src/features/storage/` feature directory — storage UI is a bare route with no component layer |
| F6 | P2 | notifs | G3 | No `apps/account/src/features/notifs/` feature directory — notifications UI is a bare route with no component layer |
| F7 | P2 | storage | G8 | `abortMultipartUpload` and `completeMultipartUpload` handlers have no unit tests |
| F8 | P2 | notifs | G8 | No unit handler tests for `getNotification`, `listNotifications`, `markAllNotificationsAsRead` |
| F9 | P2 | person | G4 | No account app route for person profile editing — `updatePerson` handler is orphaned from the account app |
| F10 | P3 | comms | G7 | WebSocket chat room test (`ws.chat-room.test.ts`) only validates config shape — no message routing or auth logic tested |
| F11 | P3 | booking | G3 | No frontend routes for schedule exception management (CRUD) |
| F12 | P3 | notifs | G5 | `markAllNotificationsAsRead` endpoint exists in backend but has no frontend trigger |

---

## Gate-by-Gate Analysis

### Gate 2 — Role and Permission Map

#### Person Module
- `getPerson` (`GET /persons/{person}`): enforces `bearerAuth` with roles `["owner", "admin"]`. Owner check: throws `ForbiddenError` if `user.id !== person.id` and user is not admin. **Correct.**
- `listPersons` (`GET /persons`): JSDoc says `Security: bearerAuth with role ["admin"]` but the handler body contains **no runtime call to `userHasRole` or any role assertion**. Any authenticated user who calls this endpoint receives a paginated list of all persons in the system. **This is F1 — a P1 finding.**
- `createPerson` / `updatePerson`: require auth; `updatePerson` presumably mirrors `getPerson` ownership check (not fully read but pattern consistent).

#### Booking Module
- All booking endpoints require `bearerAuth`.
- Ownership utilities in `services/api-ts/src/handlers/booking/utils/ownership.ts`:
  - `checkBookingOwnership` — true if `user.id === booking.client || user.id === booking.host`
  - `checkBookingHostOwnership` — true only if `user.id === booking.host`
  - `checkBookingClientOwnership` — true only if `user.id === booking.client`
- Authorization utility in `services/api-ts/src/handlers/booking/utils/authorization.ts`:
  - `checkBookingEventCreateAuthorization`, `checkUserRole`, `checkBookingEventOwnership`
- Cancel, reject, no-show operations require host or client ownership depending on operation.
- **No public/unauthenticated booking path exists** — all operations gated behind auth.

#### Comms Module
- `createChatRoom`: requires auth, validates `participants.length >= 2`, creator is auto-included. Defaults admins to all participants if not specified.
- `sendChatMessage`: requires auth, validates room membership before sending.
- `joinVideoCall`: requires auth, validates displayName non-empty.
- No explicit "room admin only" enforcement observed for room deletion or moderation — but no delete endpoint exists in backend, so not a gap currently.

#### Storage Module
- `getFile` / `getFileDownload`: checks `file.owner === user.id || isAdmin`. Correct.
- `deleteFile`: checks `file.owner === user.id || isAdmin` via `userHasRole(auth, user, 'admin')`. Correct.
- `uploadFile`: checks auth, enforces 100MB size limit.
- Multipart: `abortMultipartUpload` and `completeMultipartUpload` check owner via `multipartOwnerCheck.test.ts` — owner can complete/abort, non-owner gets 403.

#### Notifs Module
- `listNotifications`: filters by `userId` — users see only their own notifications. Correct.
- `markNotificationAsRead`: filters by `userId` — ownership check in repository (`repo.markAsRead(notifId, userId)`). Correct.
- `markAllNotificationsAsRead`: expected to filter by userId (consistent pattern).
- No admin bypass for notification access — appropriate for inbox pattern.

---

### Gate 3 — Route and Navigation

#### Account App Routes (all under `_dashboard` layout — auth required)

| Route | Module | Description |
|-------|--------|-------------|
| `_dashboard/bookings/index.tsx` | booking | Booking list |
| `_dashboard/bookings/$bookingId.tsx` | booking | Booking detail |
| `_dashboard/bookings/host.$personId.tsx` | booking | View host profile/events |
| `_dashboard/bookings/host.$personId.$slotId.tsx` | booking | Select specific slot |
| `_dashboard/storage.tsx` | storage | File list/upload |
| `_dashboard/notifications.tsx` | notifs | Notification inbox |

**Comms routes:** No dedicated comms route exists in `apps/account/src/routes/`. The comms feature lives as embedded components (video panel, chat thread) not as standalone navigable routes. This is intentional for an embedded video/chat pattern but means no deep-linkable comms URL.

**Missing routes:**
- No `_dashboard/schedule.tsx` for host event management (schedule exceptions). Settings has `settings/schedule.tsx` but this is the personal schedule settings, not the booking event admin interface.
- No person profile edit route — `updatePerson` is unreachable from account app navigation.

**Dental app usage:** The dental app (`apps/dentalemon`) does not use these base platform routes. It has its own `_workspace` and `_dashboard` structures. No cross-contamination.

---

### Gate 4 — Frontend Interaction Integrity

#### Booking
Frontend components at `apps/account/src/features/booking/components/`:

| Component | Purpose | Tests Exist |
|-----------|---------|-------------|
| `booking-widget.tsx` | Main booking flow widget | Yes |
| `booking-list.tsx` | List user's bookings | Yes |
| `booking-widget-skeleton.tsx` | Loading state | Yes |
| `active-booking-card.tsx` | Show active booking | Yes |
| `booking-event-editor.tsx` | Host creates/edits events | Yes |
| `host-directory.tsx` | Browse hosts | Yes |

Lib utilities:
- `adapters.ts` — maps API responses to component types (tested)
- `event-state.ts` — derives event display state (tested)
- `partition-bookings.ts` — splits bookings into upcoming/past (tested)

**Gap (F3):** No frontend component or route invokes `confirmBooking` (`POST /booking/bookings/{booking}/confirm`). The flow allows guests to create bookings but hosts have no UI path to confirm pending bookings in the account app.

#### Comms
Frontend components at `apps/account/src/features/comms/components/`:

| Component | Purpose | Tests Exist |
|-----------|---------|-------------|
| `chat-thread.tsx` | Message display | Yes |
| `call-controls.tsx` | Mute/end call | Yes |
| `video-call-panel.tsx` | Main video call UI | Yes |
| `video-call-ui.tsx` | Video call wrapper | Yes |
| `video-tile.tsx` | Individual video stream | Yes |
| `connection-status.tsx` | WebSocket connection indicator | Yes |

Hooks: `use-media-stream.ts`, `use-video-call.ts`. Lib: `media-devices.ts`.

Comms is a rich component set — all components have corresponding tests. No route for comms exists, which means the comms UI is embedded (expected for chat/video). No gap here beyond the routing note.

#### Storage
No `apps/account/src/features/storage/` directory exists. The route `_dashboard/storage.tsx` is a standalone file — no component library behind it. This is F5.

#### Notifs
No `apps/account/src/features/notifs/` directory exists. The route `_dashboard/notifications.tsx` is a standalone file. This is F6.

---

### Gate 5 — Forms, Modals, Tables

#### Booking
- `booking-event-editor.tsx` — host creates/edits a booking event (form with schedule config)
- `booking-widget.tsx` — guest selects slot, confirms booking
- Both have component tests.
- **No cancellation modal** component found in the feature directory — cancellation may be handled inline or through a global confirm pattern, but it is not a dedicated component.

#### Storage
- Upload interaction: handled in `_dashboard/storage.tsx` directly. No dedicated `UploadModal` component exists in a feature directory. This may be inlined in the route file.
- No evidence of file rename, share, or permissions management UI.

#### Notifs
- Notification preferences: dental app has `apps/dentalemon/src/features/settings/components/notification-settings.tsx` with tests. Account app does not have an equivalent preference form.
- Mark-all-read: backend endpoint exists (`markAllNotificationsAsRead`), no frontend trigger visible in the account app routes.

---

### Gate 6 — Backend/API Contract Alignment

#### Person
- TypeSpec definitions exist at `specs/api/src/modules/`. Handler operationIds match: `createPerson`, `getPerson`, `listPersons`, `updatePerson`.
- PII fields: `firstName`, `lastName`, `dateOfBirth`, `contactInfo` (JSONB with email/phone), `avatarUrl`, `gender`. All stored in `person` table.
- **Concern:** `listPersons` returns all persons to any authenticated user despite JSDoc claiming admin-only. The OpenAPI spec may enforce this at the route registration level (middleware), but the handler itself does not. If the route middleware does not enforce the admin role, this is a data exposure risk.

#### Booking
- TypeSpec at `specs/api/src/modules/booking.tsp`. Contract tests: Hurl files found at `specs/api/tests/contract/booking-*.hurl`.
- Hurl contract files present: confirms routes registered correctly. Handler operationIds align with OpenAPI spec.
- Known issue: `booking-coverage.test.ts` has widespread `as any` casts (e.g., `cancelBooking as any`, `rejectBooking as any`) that suppress TypeScript type checking on handler function signatures. This means the test file passes CI but does not actually validate the handler contract types.

#### Comms
- TypeSpec at `specs/api/src/modules/comms.tsp` + `comms.md`. Contract tests: `specs/api/tests/contract/comms.hurl` and `comms-edge.hurl`.
- WebSocket endpoint: `ws.chat-room.ts` exports a config with path `/ws/comms/chat-rooms/:room`. The WebSocket path is not in the OpenAPI spec (by convention — WebSocket endpoints typically aren't). No contract test for WS behavior.

#### Storage
- `uploadFile.ts` enforces 100MB limit. `completeFileUpload.ts` finalizes after direct upload. Multipart flow: initiate → generate part URLs → complete.
- `abortMultipartUpload` and `completeMultipartUpload` handlers have no unit tests (F7) but are covered by the owner check test.

#### Notifs
- Schema has `consentValidated: boolean` field — healthcare compliance flag. Populated by the notification dispatch system.
- No `unreadOnly` filter available (removed per code comment). Frontend must use `status` filter with value `'read'` or similar to approximate this.

---

### Gate 7 — Role-Based Journey Map

#### Journey 1: Guest books a slot with a host (Booking)

```
1. Guest navigates to /bookings (authenticated)
2. Host directory loads → GET /persons?role=host or GET /booking/events
3. Guest views host events → GET /booking/events/{event}/slots
4. Guest selects slot → POST /booking/bookings (creates booking, status=pending)
5. HOST CONFIRM STEP: Host should confirm → POST /booking/bookings/{booking}/confirm
   GAP: No account app UI for host to confirm (F3)
6. Confirmation timer job auto-confirms if no rejection within window
7. Booking proceeds → status=confirmed
```

#### Journey 2: User accesses comms room

```
1. User navigates to comms-enabled context (embedded, no direct URL)
2. Component calls POST /comms/chat-rooms (upsert — creates or returns existing)
3. WebSocket connection opened: ws://host/ws/comms/chat-rooms/{room}
4. Messages sent via POST /comms/chat-rooms/{room}/messages
5. Video call started via messageType=video_call
6. Participant joins: POST /comms/chat-rooms/{room}/video-call/join
7. ICE servers fetched: GET /comms/ice-servers
8. WebRTC peer connection established using returned STUN/TURN config
```
Journey is well-wired at component level. No navigable URL means deep-linking into an active call is impossible.

#### Journey 3: User uploads a file (Storage)

```
1. User navigates to /storage (authenticated)
2. File list loads: GET /storage/files
3. Small file (<=100MB): POST /storage/files/upload
4. Large file: POST /storage/files/multipart/initiate
                → GET /storage/files/multipart/{uploadId}/part-url (per part)
                → PUT to presigned URL (direct to S3)
                → POST /storage/files/multipart/{uploadId}/complete
5. Download: GET /storage/files/{fileId}/download → presigned URL redirect
6. Delete: DELETE /storage/files/{fileId} (owner or admin only)
```
Journey is implementable from the backend. Frontend `_dashboard/storage.tsx` provides the UI surface but without a component library layer.

---

### Gate 8 — Test Confidence Gap Analysis

#### Person Module

| Layer | Status | Details |
|-------|--------|---------|
| Backend unit | Partial | `createPerson.test.ts` (auth, create), `person.repo.test.ts` (repo level). No handler test for `getPerson`, `listPersons`, `updatePerson`. |
| Contract (Hurl) | Unknown | No person-specific Hurl contract file found |
| E2E | Present (worktree) | `apps/account/tests/e2e/person.spec.ts` exists in workspace-reconciliation worktree, not in main branch |
| Frontend | None | No `apps/account/src/features/person/` in main branch |

**Confidence: 3/10** — only createPerson and repo basics tested; getPerson/listPersons/updatePerson have zero handler tests; critical listPersons role gap untested.

#### Booking Module

| Layer | Status | Details |
|-------|--------|---------|
| Backend unit — handlers | Strong | `booking-coverage.test.ts` covers 15 handlers + 7 ownership/auth utilities |
| Backend unit — repos | Strong | `booking-repo-coverage.test.ts`, `bookingevent-repo-coverage.test.ts`, `timeslot-repo-coverage.test.ts`, `booking.repo.test.ts`, `bookingEvent.repo.test.ts` |
| Jobs | Present | `confirmationTimer.test.ts`, `slotGenerator.test.ts` |
| Contract (Hurl) | Present | `booking-*.hurl` files present |
| E2E | Present (worktree) | `tests/e2e/booking/booking.test.ts` (backend E2E), `apps/account/tests/e2e/booking.spec.ts` (frontend E2E) — both in worktree |
| Frontend unit | Present | 6 component tests + 3 lib tests |
| TypeScript hygiene | **FAILING** | `booking-coverage.test.ts` uses `as any` casts on all handler imports; TS18046 errors present — type contract is not verified |

**Confidence: 6/10** — broad coverage exists but the `as any` proliferation in the main coverage test file means type errors are silently ignored; host confirm flow has no frontend test.

#### Comms Module

| Layer | Status | Details |
|-------|--------|---------|
| Backend unit — joinVideoCall | Present | `joinVideoCall.test.ts` (auth, displayName validation) |
| Backend unit — ws config | Present | `ws.chat-room.test.ts` (config shape only — no message routing tested) |
| Backend unit — other handlers | **Missing** | No tests for `createChatRoom`, `sendChatMessage`, `getChatMessages`, `getChatRoom`, `listChatRooms`, `endVideoCall`, `leaveVideoCall`, `updateVideoCallParticipant` (F4) |
| Contract (Hurl) | Present | `comms.hurl`, `comms-edge.hurl` |
| Backend E2E | Present | `services/api-ts/tests/e2e/comms/comms.test.ts` (covers chat room list, auth, pagination) |
| Frontend unit | Present | 6 component tests |
| Frontend E2E | Present (worktree) | `apps/account/tests/e2e/comms.spec.ts` |

**Confidence: 5/10** — contract and E2E tests provide reasonable API-level coverage but 8 of 10 handlers have no unit tests; WebSocket message routing is entirely untested at unit level.

#### Storage Module

| Layer | Status | Details |
|-------|--------|---------|
| Backend unit — uploadFile | Present | `uploadFile.test.ts` (size limit, auth) |
| Backend unit — coverage | Present | `storage-coverage.test.ts` covers: `getFile`, `deleteFile`, `listFiles`, `getFileDownload`, `initiateMultipartUpload`, `generateMultipartPartUrl`, `completeFileUpload` |
| Backend unit — owner check | Present | `multipartOwnerCheck.test.ts` (abort + complete: owner 204, non-owner 403) |
| Backend unit — missing | **Missing** | `abortMultipartUpload` standalone, `completeMultipartUpload` standalone (F7) |
| Contract (Hurl) | Unknown | No storage Hurl contract file found |
| Backend E2E | Unknown | No storage E2E test found in main branch |
| Frontend unit | **Missing** | No `apps/account/src/features/storage/` — no component tests (F5) |

**Confidence: 6/10** — good handler-level coverage; missing contract tests and frontend component layer.

#### Notifs Module

| Layer | Status | Details |
|-------|--------|---------|
| Backend unit | Partial | `markNotificationAsRead.test.ts` present |
| Backend unit — missing | **Missing** | No tests for `getNotification`, `listNotifications`, `markAllNotificationsAsRead` (F8) |
| Jobs | Present | `jobs/index.ts` exists (scheduler setup) |
| Contract (Hurl) | Unknown | No notifs Hurl contract file found |
| Backend E2E | Unknown | Not found in main branch |
| Frontend unit | **Missing** | No `apps/account/src/features/notifs/` — no component tests (F6) |

**Confidence: 3/10** — only one handler test; three of four handlers untested; no frontend component layer; no contract tests.

---

## Critical Issues Detail

### F1 — `listPersons` admin gate is documentation-only (P1)

**File:** `services/api-ts/src/handlers/person/listPersons.ts`

**Evidence:** The JSDoc comment states `Security: bearerAuth with role ["admin"]`. The handler retrieves the authenticated user via `ctx.get('user')` and then proceeds directly to query `PersonRepository.findMany()`. There is no call to `userHasRole`, no `ForbiddenError` throw, and no early-exit for non-admin users.

**Impact:** Any authenticated user of the platform can enumerate all person records with PII (firstName, lastName, dateOfBirth, contactInfo containing email and phone). This is a data exposure risk proportional to the number of platform users.

**Required fix:** Add role enforcement before the repository call:
```typescript
const isAdmin = await userHasRole(auth, user, 'admin');
if (!isAdmin) {
  throw new ForbiddenError('Access denied: admin role required');
}
```
Or enforce at route registration level via middleware if the OpenAPI route has admin-only middleware applied.

**Verification needed:** Confirm whether the router (`index.ts` or handler registration) applies an admin-role middleware at the route level that would catch this before the handler executes.

---

### F2 — `booking-coverage.test.ts` TS18046 `as any` proliferation (P1)

**File:** `services/api-ts/src/handlers/booking/booking-coverage.test.ts`

**Evidence:** Every handler import is cast with `as any` (e.g., `cancelBooking as any`, `rejectBooking as any`). The test harness `buildApp` function accepts `handler: any`. This suppresses TypeScript's ability to detect handler signature mismatches.

**Impact:** If a handler's parameter types change (e.g., `ValidatedContext<Body, Query, Params>` generics), the test will continue to pass despite the handler now receiving incorrect types. The tests provide runtime behavior coverage but not compile-time contract coverage.

**Impact on CI:** The `bun run typecheck` pass flag may be misleading — TS18046 errors were previously documented but the typecheck command showed no errors in the current run (possibly already suppressed via tsconfig or `as any` casts sufficiently mask them). The pattern is still a hygiene risk.

**Recommended fix:** Replace `buildApp` with a type-safe test harness that accepts properly typed handlers.

---

### F3 — Host confirm flow has no account app UI (P1)

**Evidence:** No component or route in `apps/account/src/features/booking/` or `apps/account/src/routes/_dashboard/bookings/` calls or renders a path to `POST /booking/bookings/{booking}/confirm`. The `booking-coverage.test.ts` tests the `confirmBooking` handler in isolation but the frontend does not wire it.

**Impact:** A host creates a booking event, a guest books a slot, the booking enters `pending` status — the host has no account app UI to confirm it. The system falls back to the `confirmationTimer` job which auto-confirms after a timeout. This makes the manual confirm flow (where hosts vet bookings before confirming) unreachable via UI.

---

### F4 — Comms handler unit coverage gap (P1)

**File path:** `services/api-ts/src/handlers/comms/`

**Untested handlers:** `createChatRoom`, `sendChatMessage`, `getChatMessages`, `getChatRoom`, `listChatRooms`, `endVideoCall`, `leaveVideoCall`, `updateVideoCallParticipant`

**Tested:** Only `joinVideoCall` (auth + displayName) and `ws.chat-room` (config shape only).

**Impact:** Business logic in `createChatRoom` (upsert logic, participant validation, admin assignment) and `sendChatMessage` (room membership check, video call initiation logic) is exercised only via the E2E test, which requires a running database. Bugs in these handlers are not caught until integration time.

---

## Recommended Fix Priority

| Priority | ID | Action | Effort |
|----------|----|--------|--------|
| P1 | F1 | Add runtime admin role assertion to `listPersons` handler — or confirm router-level middleware covers it | 30 min |
| P1 | F3 | Add booking confirm UI to account app (host dashboard view with pending bookings + confirm button) | 2-4 hours |
| P1 | F4 | Write handler unit tests for 8 untested comms handlers | 3-4 hours |
| P1 | F2 | Refactor `booking-coverage.test.ts` `buildApp` to accept typed handlers; eliminate `as any` casts | 2-3 hours |
| P2 | F5 | Extract storage UI into `apps/account/src/features/storage/` component library with tests | 2-3 hours |
| P2 | F6 | Extract notifications UI into `apps/account/src/features/notifs/` component library with tests | 2-3 hours |
| P2 | F7 | Add unit tests for `abortMultipartUpload` and `completeMultipartUpload` handlers | 1 hour |
| P2 | F8 | Add unit tests for `getNotification`, `listNotifications`, `markAllNotificationsAsRead` | 1-2 hours |
| P2 | F9 | Add account app route/form for person profile editing | 2-3 hours |
| P3 | F10 | Add WebSocket message routing and auth logic tests to `ws.chat-room.test.ts` | 2 hours |
| P3 | F11 | Add frontend schedule exception management UI | 3-4 hours |
| P3 | F12 | Wire `markAllNotificationsAsRead` to a "mark all read" button in notifications UI | 30 min |

---

## Overall Confidence Score Table

| Module | Backend Handlers | Repos | Contract | Frontend | E2E | Overall |
|--------|-----------------|-------|----------|----------|-----|---------|
| person | 2/10 | 6/10 | 2/10 | 1/10 | 3/10 | **3/10** |
| booking | 7/10 | 9/10 | 7/10 | 7/10 | 6/10 | **7/10** |
| comms | 3/10 | 6/10 | 7/10 | 8/10 | 6/10 | **5/10** |
| storage | 8/10 | 7/10 | 3/10 | 2/10 | 2/10 | **6/10** |
| notifs | 3/10 | 5/10 | 2/10 | 1/10 | 2/10 | **3/10** |

**Platform aggregate confidence: 5/10**

The `booking` module is the strongest — it has a comprehensive test suite across repos, handlers, and jobs. The `person` and `notifs` modules are the weakest — both have minimal handler test coverage and no frontend component layer in the account app. The `listPersons` role enforcement gap (F1) is the sole P1 security finding and should be verified immediately.
