# Notifications (`notifs`) — Module Gap Plan

**Audited:** 2026-06-09
**Module:** `notifs` (base platform module; the dental app's notification layer)
**Audit decision:** **PARTIAL PASS**
**V1 readiness:** Yellow — backend is solid and tested; the module is **not usable end-to-end** because there is no frontend surface to read in-app notifications, and the settings UI is misleading.

---

## 0. Scope & Method

- Backend handler: `services/api-ts/src/handlers/notifs/`
- Core service/delivery: `services/api-ts/src/core/notifs.ts`, `handlers/notifs/repos/notification.repo.ts`
- TypeSpec: `specs/api/src/modules/notifs.tsp`
- Producers (cross-module): booking, comms, billing, `dental-scheduling/jobs/reminderArmer.ts`, `dental-patient/jobs/recallDispatch.ts`
- Frontend: `apps/dentalemon/src/features/notifications/onesignal.ts`, `hooks/use-onesignal.ts`, `features/settings/components/notification-settings.tsx`
- Verified statically (wiring graph + grep + reads). **No live browser drive was possible** — there is no notification UI in the app to exercise; the absence is established by code (zero consumers of the 4 endpoints / generated SDK hooks).

---

## 1. Expected vs Actual

| Dimension | Expected (IDEAL standard §3.12 / general product) | Actual |
|---|---|---|
| In-app notifications visible to users | Bell/inbox with unread badge; user can read appointment reminders, recall due, billing events | **No UI at all.** 4 endpoints + generated SDK hooks exist but have **zero** frontend consumers. Rows are created and stored but never surfaced. |
| Notification producers | Key events fire notifications | **Wired** — booking, comms, billing webhooks, appointment-reminder armer, recall dispatch all create/enqueue rows. |
| Multi-channel (in-app / email / push / SMS) | Channels send | in-app ✓; email ✓ wired (SMTP/Postmark + template mapping, env-gated); push ✓ wired server+client (OneSignal, env-gated) but **no opt-in UX**; SMS = intentional deferred no-op (marked `failed`). |
| Consent gating | Patient consent respected before outbound send | **Wired & tested** — reminder/recall jobs gate per-channel on per-patient `PersonConsent` + `preferredChannel`, audit-log suppressions. |
| User notification settings | Toggles are enforced | **Write-only.** `notification-settings.tsx` saves `branch.settings.notificationPreferences`; **no backend code reads it.** Misleading. |
| Contract fidelity | Wire shape matches TypeSpec | `deliveredAt` declared in TypeSpec `Notification` but **absent from the Drizzle table + `NotificationResponse`** — can never be returned. |

---

## 2. Critical Gaps

| # | Gap | Area | Severity | Why It Matters | Recommended Fix |
|---|---|---|---|---|---|
| G1 | **No in-app notification UI.** 4 person-scoped, tested endpoints + generated SDK hooks (`listNotificationsOptions`, `markNotificationAsReadMutation`, …) have **zero** consumers. No bell, no inbox, no route, no unread badge. | FE / UX | **P1** | In-app `appointment.reminder`, `recall.due`, `billing`, `booking.confirmed` rows are created on every relevant event but the clinic user can **never see them** in the app. The whole in-app channel is invisible. | Build a notification bell + dropdown/inbox in the app shell using the existing SDK hooks (`listNotifications` w/ `status=unread`, `markNotificationAsRead`, `markAllNotificationsAsRead`, unread count). Add a `/notifications` route for full history. |
| G2 | **Settings save but are never enforced.** `notification-settings.tsx` toggles (`appointmentReminders`, `treatmentFollowUp`, `paymentReceipts`, `marketing/email/sms/push`) persist to `branch.settings.notificationPreferences`; **no backend path reads them**. | FE↔BE / trust | **P1** | A user who turns "Appointment Reminders" off still gets them. Misleading control = broken trust. The *real* gating is per-patient `PersonConsent` (separate system), not these branch toggles. | Decide ownership: either (a) make the reminder/recall jobs + immediate producers read `branch.settings.notificationPreferences` as a clinic-level master switch, or (b) relabel/repurpose the panel to edit what it actually controls (and surface per-patient consent where it belongs). Add an enforcement test. |
| G3 | **Push has no opt-in UX.** OneSignal is initialized and the user external-id is linked (`use-onesignal.ts`), but `requestNotificationPermission()` / `optIn` / `onNotificationClick` are defined and **never called/registered**. | FE / push | **P2** | The browser never prompts for push permission, so web push effectively never delivers, and clicks don't deep-link — despite the server push path being fully built. | Wire a permission prompt (e.g. after login or from settings) and register the click handler to deep-link into the relevant entity. |
| G4 | ✅ **FIXED 2026-06-09 (Batch 3) — DROPPED from TypeSpec** (smaller safe change). Verified: `notification` table (snapshot 0091) has no `delivered_at` column, `NotificationResponse` never returned it, no delivery path produces a delivery timestamp (the `delivered` *status* already represents delivery). Removed `deliveredAt` from `model Notification` (notifs.tsp) + regen; removed the dead `deliveredAt: new Date()` from `notification.repo.ts` push path (wrote a non-existent column under `as any`). `notifs.test.ts` asserts the response omits `deliveredAt`; OpenAPI/SDK `Notification` no longer declares it (remaining `deliveredAt` is the unrelated `LabOrder` FSM field). ~~Contract drift: `deliveredAt`.~~ | Contract / data | **P2** | (was) clients reading `deliveredAt` per the contract always got `undefined`. | (done) |
| G5 | **Email delivery depends on un-verified templates.** Repo maps `type → templateTag` (`appointment.reminder` → `appointment.reminder`, etc.); whether the email service has those templates registered is unconfirmed. | BE / email | **P3** `[NEEDS CONFIRMATION]` | If template tags are unregistered, email rows may fail or send empty even when SMTP/Postmark is configured. | Confirm template bodies exist for each mapped tag; add a test that delivery for a mapped type resolves a template. |
| G6 | **No full enqueue→cron→deliver pipeline test.** Job unit tests exist (`reminderArmer.test.ts`, `recallDispatch.test.ts`) but nothing exercises `enqueueScheduledIfAbsent → processScheduledNotifications (5-min cron) → deliverNotification` end to end. | Test | **P3** | Regression in the scheduled-delivery handoff would pass all current tests. | Add an integration test that enqueues a scheduled row and runs `processScheduledNotifications`, asserting status transition + (mocked) channel send. |

No **P0** found: endpoints are correctly person-scoped (recipient = authenticated user), no cross-tenant leak, producers/consent gating are sound.

---

## 3. Broken / Misleading Journeys

- **"I'll check my notifications."** — No surface exists. Dead journey. (G1)
- **"Turn off appointment reminders in Settings."** — Saves successfully, changes nothing. Misleading. (G2)
- **"Enable push notifications."** — `pushNotifications` toggle saves, but no permission prompt is ever shown and the toggle isn't read; web push never arrives. (G2 + G3)
- **Push click** — even if a push is delivered, clicking it does nothing (no registered handler). (G3)

---

## 4. Unused / Unwired Implementation

- **Endpoints with zero FE consumers:** `GET /notifs`, `GET /notifs/{notif}`, `POST /notifs/{notif}/read`, `POST /notifs/read-all` — all built, auth-guarded, tested, **unused by the app**.
- **Generated SDK hooks** for all four ops (`@tanstack/react-query.gen.ts`) — exported, never imported.
- **`onesignal.ts` exports** `requestNotificationPermission`, `optInToNotifications`, `optOutOfNotifications`, `onNotificationClick`, `onNotificationReceived` — defined, never called.
- **`branch.settings.notificationPreferences`** — written by UI, read by nobody.

---

## 5. Test Gaps

**Existing (good):**
- `handlers/notifs/notifs.test.ts`, `markNotificationAsRead.test.ts` — list/get/markRead/markAll, auth, ownership, filters, pagination.
- `dental-scheduling/jobs/reminderArmer.test.ts`, `dental-patient/jobs/recallDispatch.test.ts` — consent gating, suppression, idempotent enqueue.
- `dental-scheduling/createAppointment.notif.test.ts`, `billing/finalizeInvoice.notif.test.ts` — producer triggers.
- `services/api-ts/tests/e2e/notifs/notifs.test.ts` — backend integration flow.
- `specs/api/tests/contract/notifs.hurl` — contract.
- `apps/dentalemon/src/features/settings/components/notification-settings.test.ts` — preference parsing/toggle (FE only, **not** enforcement).

**Missing:**
- FE: notification bell/inbox component tests (no component yet). **(blocks G1 verification)**
- Enforcement test: branch `notificationPreferences` actually gates a send. **(G2)**
- Contract assertion for `deliveredAt` (currently un-asserted because un-persisted). **(G4)**
- Push opt-in / permission-prompt FE test. **(G3)**
- Email template-resolution test per mapped type. **(G5)**
- Full enqueue→cron→deliver integration test. **(G6)**

---

## 6. Knowledge Graph / Wiring Findings

- **Producers → table:** 6 modules write notifications. Immediate path = `notifs.createNotification` (booking/comms/billing, status `sent`). Scheduled path = `enqueueScheduledIfAbsent` (reminderArmer + recallDispatch, status `queued`) → `processScheduledNotifications` cron (every 5 min) → `deliverNotification`.
- **Delivery construction:** `app.ts:85` `createNotificationService(db, logger, config.notifs, ws, email)` → `NotificationRepository(db, logger, oneSignalConfig, emailService)`. So email + push are **injected in prod** and activate when `ONESIGNAL_APP_ID`/`ONESIGNAL_API_KEY` + SMTP/Postmark env are set. The read-side handlers construct `new NotificationRepository(db, logger)` (no channels) — correct, they only read.
- **Consumer side:** dead-ends at the SDK. Generated hooks exist; no React component imports them.
- **Blast radius of fixes:** G1 (inbox UI) is additive/FE-only — low risk. G2 (enforce settings) touches the reminder/recall jobs + immediate producers — **medium** blast radius across scheduling/patient/billing; needs a single shared gate helper to avoid drift. G4 (`deliveredAt`) is a schema migration + contract regen — contained but touches generated artifacts.

---

## 7. Recommended Fix Order

1. **G4 — `deliveredAt` contract drift** (smallest, unblocks honest delivery state).
   - *Test first:* contract assertion that a delivered notification returns `deliveredAt`; repo unit test that delivery sets it. Then add column/migration + response mapper (or drop from TypeSpec).
2. **G1 — Notification bell + inbox UI** (highest user impact).
   - *Test first:* FE component test driving `listNotifications(status=unread)` + `markNotificationAsRead` via mocked SDK; unread-badge count test. Then build bell in app shell + `/notifications` route.
3. **G2 — Enforce or relabel settings** (requires a product decision — see §10).
   - *Test first:* backend test asserting a disabled preference suppresses the corresponding send; then implement a shared `isChannelEnabledForBranch` gate read by reminder/recall + immediate producers. If relabel route chosen, update copy + FE test instead.
4. **G3 — Push opt-in UX + click handler.**
   - *Test first:* FE test that the settings/push toggle triggers `requestNotificationPermission`; handler registration test. Then wire prompt + `onNotificationClick` deep-link.
5. **G6 — enqueue→cron→deliver integration test** (lock the pipeline before further change).
6. **G5 — confirm email templates** `[NEEDS CONFIRMATION]`; add resolution test.

---

## 8. Dependencies on Other Modules

- **dental-scheduling** (`reminderArmer`) and **dental-patient** (`recallDispatch`) own the scheduled producers and the per-patient consent gate — G2 enforcement must coordinate with them.
- **billing / booking / comms** are immediate producers — G2's shared gate must cover them too.
- **dental-org** owns `branchSettings` (where `notificationPreferences` live) — G2 storage/ownership lives here.
- **person/consent** — the real per-patient consent system (`PersonConsent`) is adjacent to and must not be conflated with the branch-level toggles.
- **email** core service + **OneSignal** config — delivery dependencies (env/config + templates).

---

## 9. Items Marked `[NEEDS CONFIRMATION]`

- **G5:** Whether the email service has registered template bodies for `appointment.reminder`, `recall.due`, `appointment.confirmation-request`, `recall.reminder`, billing, etc.
- **G2 product decision:** Should `branch.settings.notificationPreferences` be a real clinic-level master switch (enforced), or is per-patient `PersonConsent` the intended sole gate (making the settings panel decorative and in need of relabel/removal)?
- **Push target platform:** Whether web push (needs the missing permission prompt) is in scope for V1, or push is intended only for the Tauri/mobile wrapper.

---

## 10. Audit Decision

**PARTIAL PASS.** Backend producers, endpoints, consent gating, scheduled jobs, and delivery infrastructure are well-built and tested with no P0/security gaps. The module fails the "usable end-to-end" bar: **(P1)** no frontend surface to read in-app notifications, and **(P1)** a settings panel that saves preferences the backend ignores. Resolve G1 and G2 (with the §9 product decision) to reach a full pass.
