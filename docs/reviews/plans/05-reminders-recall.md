# P1-24 — Automated Appointment Reminders + Recall (Continuing-Care) Engine

> Implementation **design plan** (no code). Source: `docs/reviews/modules/scheduling-review.md`, `docs/reviews/research/light-pass.md` (Scheduling).
> Backlog: `IMPROVEMENT_BACKLOG.md` P1-24 (Scheduling · Engagement · effort **L**).
> Date: 2026-06-02 · Branch target: a fresh `feat/p1-24-reminders-recall` off `main`.

---

## 1. Problem & current state

Reminders are cited by the research as **the single biggest no-show reduction lever**, and they are absent. Today:

- **One notification, ever.** `createAppointment.ts:120-129` fires a single best-effort `booking.created` **in-app** notification at booking time. There is no pre-appointment cadence (no T-7d / T-1d / T-2h reminder), no SMS, and email/push are not wired for appointments.
- **Recall rows are inert.** `dental-patient/recalls/` (`createRecall` / `updateRecall` / `listPatientRecalls`) persists `type`, `dueDate` (a `text` date string), and a manual FSM `pending → sent → completed | cancelled` (`recall.repo.ts`, `recall.schema.ts`). **Nothing computes due dates, nothing dispatches outreach, and `status='sent'` must be flipped by hand.** No recare due-list endpoint exists.
- **No confirmation lifecycle.** The appointment FSM (`dental-appointment.schema.ts:66-72`) is `scheduled → checked_in → completed | cancelled | no_show`. There is **no `confirmed` state** between `scheduled` and `checked_in`, so a reminder has nowhere to record "patient replied YES" (scheduling-review §2, P2). No-show is already modelled and reversible.
- **Consent now exists but is unused for dispatch.** P1-28 just landed per-channel consent on `PersonConsent.channels` (`sms/email/phone/marketing`, individually revocable; `person.schema.ts:79-91`) with read/write handlers (`getPatientCommunicationConsent` / `updatePatientCommunicationConsent`). Nothing reads it yet.

### What we can reuse (no greenfield infra)

- **Job scheduler** — `core/jobs.ts` (pg-boss behind a provider-agnostic `JobScheduler` interface) with `registerCron` / `registerInterval`, wired in `app.ts:276-280`. Five modules already register jobs (`notifs.processScheduled` every 5m, `retention.enforcement` nightly, `booking.confirmationTimer` every 60s). **The booking module already has a commented-out `booking.reminderSender` every-15-min precedent** (`booking/jobs/index.ts:35`) — we follow that exact shape.
- **Notification dispatch** — `NotificationService.createNotification` + `processScheduledNotifications` (`core/notifs.ts`, `notifs/repos/notification.repo.ts`). The repo **already delivers** `in-app` (WebSocket), `email` (via `EmailService.queueEmail` + template tag), and `push` (OneSignal `external_id` targeting). It honors `scheduledAt` (status `queued` → delivered when due). **We get multi-channel delivery for free by writing scheduled notification rows.**
- **Domain events** — `dental-scheduling/domain-events.ts` already emits `AppointmentBooked`; we add reminder-relevant hooks here.

The architectural insight: **reminders and recall outreach are just `notification` rows with a future `scheduledAt` and the right `channel`.** The new code is the *scheduling/computation/consent-gating layer* that decides *which* rows to write and *when to cancel them* — not a new delivery pipeline.

---

## 2. Target

1. **Appointment reminders** at configurable lead times before `scheduledAt` (default cadence: **T-72h, T-24h, T-2h**), per branch, across **SMS / email / push / in-app**, honoring per-channel consent. Reminders auto-cancel if the appointment is cancelled, rescheduled, checked-in, or already confirmed.
2. **Confirmation lifecycle** — a reminder can move an appointment `scheduled → confirmed` (new state) via a staff action or an inbound confirm link/endpoint; `confirmed` still flows to `checked_in / cancelled / no_show`. Confirmation status is visible on the calendar (closes scheduling-review §2 P2).
3. **Recall / recare due engine** — automated due-date computation from a recall **interval** + last-completed visit, a **due-list endpoint** (`GET /dental/recalls/due`) feeding front desk and (later) scheduling, and **automated outreach** that flips recall `pending → sent` by writing a scheduled notification, with re-attempt cadence.
4. **Reuse-first**: zero new delivery infra; new cron/interval jobs + thin repos + consent gate + minimal schema deltas.

Out of scope (note, don't build): inbound SMS two-way parsing beyond a single confirm token, voice/IVR reminders, ASAP/waitlist auto-fill (P2, separate item), patient-facing self-service booking (P1, separate item).

---

## 3. Proposed design

### 3.1 Data model deltas

**A. Appointment — confirmation state + reminder bookkeeping** (`dental-appointment.schema.ts`)
- Add `confirmed` to `appointmentStatusEnum` and to `APPOINTMENT_TRANSITIONS`:
  - `scheduled → [confirmed, checked_in, cancelled, no_show]`
  - `confirmed → [checked_in, cancelled, no_show]` (and `confirmed → scheduled` is *not* needed; reschedule replaces the row's time and re-arms reminders).
  - This is additive; existing `scheduled → checked_in` stays legal (walk-ins skip confirmation).
- Add columns: `confirmedAt timestamptz NULL`, `confirmedVia text NULL` (`'sms'|'email'|'staff'|'link'`), `confirmationToken uuid NULL` (random, single-use, for the public confirm link).
- **Reminder rows are NOT stored on the appointment** — they live as `notification` rows linked by `relatedEntityType='appointment'` + `relatedEntity=appt.id`. This is what lets us cancel them with a single `WHERE relatedEntity = … AND status='queued'` update.

**B. Notification — appointment/recall types + a `sms` channel** (`notifs/repos/notification.schema.ts`)
- Extend `notificationChannelEnum` with `'sms'`. **(Decision needed — see Risks.)** Until an SMS provider lands, `sms` channel rows are written but `deliverNotification` treats `sms` as a no-op/`failed` with a logged "no SMS provider" warning (mirrors the existing OneSignal-not-configured path). This keeps consent/cadence logic shippable and provider-pluggable.
- Extend `notificationTypeEnum` with: `'appointment.reminder'`, `'appointment.confirmation-request'`, `'recall.due'`, `'recall.reminder'`.
- No other notification schema change — `scheduledAt`, `status` FSM, `relatedEntity*`, and per-channel delivery already exist.

**C. Recall — interval + recurrence + dispatch bookkeeping** (`recall.schema.ts`)
- Add `intervalMonths integer NULL` (e.g. cleaning = 6) to drive auto-recompute.
- Add `lastSentAt timestamptz NULL` and `sendAttempts integer NOT NULL DEFAULT 0` for re-attempt cadence (distinct from the existing single `sentAt`).
- `dueDate` stays `text` (date) but the engine writes/recomputes it.
- Keep the existing `RECALL_FSM`; the dispatch job is what performs `pending → sent` (replacing the manual flip), and a completed *recall visit* (or a new same-type recall create) marks `completed` and seeds the next-cycle recall when `intervalMonths` is set.

**D. Branch reminder config** (reuse, don't add a table)
- Reminder lead-times + enabled channels are **branch-level config**. Store as a JSONB key on the existing branch scheduling config consumed by `getBranchSchedulingConfig` (`dental-org/repos/org-scheduling.facade.ts`), e.g. `reminderPolicy: { leadHours: [72,24,2], channels: ['email','sms','in-app'], recallReattemptDays: 14, recallMaxAttempts: 3 }`. Fall back to a hardcoded default policy when absent. Avoids a new migration for config.

### 3.2 Jobs (new `dental-scheduling/jobs/` + recall job in `dental-patient/jobs/`)

Register in `app.ts` alongside the existing `register*Jobs` calls. All jobs are idempotent and batch-limited (mirror `processScheduledNotifications`' `.limit(100)`).

1. **`dental-scheduling.reminderArmer`** — cron, every 15 min (mirrors the commented `booking.reminderSender:35`). For each upcoming appointment in status `scheduled|confirmed` whose reminder rows for a given lead-time don't yet exist and whose `scheduledAt - leadHours` is within the next window, **write scheduled `notification` rows** (one per enabled+consented channel, `type='appointment.reminder'`, `scheduledAt = appt.scheduledAt - leadHours`, `relatedEntity=appt.id`). Idempotency key: `(relatedEntity, type, channel, scheduledAt)` — guard with a pre-check select (or a unique partial index) so re-runs don't duplicate. **Delivery itself is handled by the existing `notifs.processScheduled` job** — we only *enqueue*.
2. **`dental-scheduling.reminderCanceller`** — runs inside the appointment cancel/reschedule/check-in/confirm handlers (synchronous, not a cron): on those transitions, `UPDATE notification SET status='expired' WHERE relatedEntity=appt.id AND type IN ('appointment.reminder','appointment.confirmation-request') AND status='queued'`. (On reschedule, also re-arm for the new time.)
3. **`dental-patient.recallDueScan`** — cron, nightly (e.g. `0 6 * * *`). Recompute `dueDate` for recalls with `intervalMonths` from the patient's last completed recall/visit; mark recalls whose `dueDate <= today` as due (no status change yet — `pending` *is* the due-but-not-sent state). Surfaces via the due-list endpoint.
4. **`dental-patient.recallDispatch`** — cron, daily (e.g. `0 7 * * *`). For `pending` recalls now due (and for `sent` recalls past `recallReattemptDays` under `recallMaxAttempts`): consent-gate, write a scheduled `notification` (`type='recall.due'`/`'recall.reminder'`), set recall `status='sent'`, bump `lastSentAt`/`sendAttempts`. This **replaces the manual `updateRecall status:'sent'` flip** as the primary path (manual remains for overrides).

### 3.3 Consent gate (shared util) — `dental-scheduling/utils/resolve-reminder-channels.ts`

Single function `resolveConsentedChannels(personConsent, branchPolicy, patient.preferredChannel)` → `Channel[]`:
- Reads `PersonConsent.channels` via the P1-28 facade (`getPatientPersonConsent`).
- A channel is eligible iff: in branch policy **AND** `channels[ch] === true`. **`channels[ch] === undefined` ("not yet captured") fails closed** for `sms`/`push` (HIPAA/TCPA-grade) but **`in-app` is always allowed** (patient owns the in-app inbox; no outbound transmission). `marketing` consent is *not* required for transactional reminders — appointment/recall reminders are transactional, not marketing (document this distinction explicitly).
- Respects `patient.preferredChannel` (`patient.schema.ts:145`) as the *primary*; falls back to other consented channels only if primary unavailable.
- Returns `[]` → no outbound row written (in-app still written). Every suppression is logged (no PII) for the compliance trail.

### 3.4 API surface deltas (TypeSpec-first — edit `.tsp`, never generated files)

Per `dental-scheduling.tsp` + `dental-patient-engagement.tsp` (recalls already live there):
- `POST /dental/appointments/{id}/confirm` — staff confirm (auth + branch role) → `scheduled→confirmed`.
- `POST /dental/appointments/{id}/confirm/{token}` — public, token-gated patient self-confirm (no auth; rate-limited; single-use token). Sets `confirmedVia='link'`.
- `GET /dental/recalls/due?branchId=&from=&to=` — recare due-list (auth + branch scope); paginated; feeds front desk.
- (Reminders need **no** new endpoint — they're driven by jobs + delivered via existing notification infra; the existing `GET /dental/notifications` already lists them.)
- Extend `updateAppointment` reschedule path to re-arm reminders (handler-internal, no new route).

### 3.5 Frontend (apps/dentalemon)

- Calendar: render `confirmed` as a distinct color/badge (closes scheduling-review §2 P2); add a "Confirm" quick action on the appointment slide-out.
- A **Recall due-list view** (`features/scheduling` or patient engagement) consuming `GET /dental/recalls/due` with "Reach out" + "Schedule" actions.
- Reminder history surfaces in the existing patient notification list (filter by `appointment.reminder`/`recall.*`).
- Use generated SDK hooks (`@monobase/sdk-ts`) after `bun run generate`; TanStack Query + shadcn only.

---

## 4. Vertical-TDD test plan

Per-module 10-step sequence (`VERTICAL_TDD.md`). **Two vertical slices**, each fully end-to-end before the next:

### Slice A — Appointment reminders + confirmation lifecycle
1. **TypeSpec**: add `confirmed` status, `/confirm` + `/confirm/{token}` ops, reminder notification types/channel → `bun run build` (specs) + `bun run generate` (api-ts).
2. **Backend unit (RED→GREEN)**:
   - FSM property test extension (`appointment.fsm.property.test.ts`): `scheduled→confirmed→checked_in` legal; `confirmed→completed` illegal (must check-in first); `completed/cancelled` terminal.
   - `reminderArmer` job: writes N scheduled notification rows for an upcoming appt; **idempotent** (second run writes 0 dupes); respects branch `leadHours`.
   - `resolveConsentedChannels`: SMS suppressed when `channels.sms !== true`; in-app always allowed; marketing-consent NOT required; preferredChannel honored; undefined fails closed for outbound. (mirror `communication-consent.test.ts` setup).
   - Canceller: cancel/reschedule/check-in/confirm `expire`s queued reminder rows; reschedule re-arms for new time.
   - Confirm handlers: staff confirm (branch-role gated, EM-SCH-001 pattern); token confirm (valid token → confirmed; reused/invalid token → 4xx; sets `confirmedVia`).
3. **Contract (RED→GREEN)**: extend `tests/contract/dental-scheduling.hurl` — confirm flow, illegal transition 422, token confirm happy + replay-rejected.
4. **Frontend unit (RED→GREEN)**: calendar `confirmed` badge; confirm quick-action mutation.
5. **E2E (Playwright)**: book → (simulate armer/clock) reminder notification appears in patient inbox → confirm → status shows `confirmed`; cancel → queued reminders gone.
6. **Verify gate**: `bun run test` + `bun run typecheck` + **`bun run check:boundaries`** (per memory: backend verify must run boundaries) green, no regressions.

### Slice B — Recall due engine + dispatch
1. **TypeSpec**: `GET /dental/recalls/due`; recall `intervalMonths` field; recall notification types.
2. **Backend unit (RED→GREEN)**:
   - `recallDueScan`: recomputes `dueDate` from `intervalMonths` + last completed; flags due correctly across timezone/date boundaries (`text` date care).
   - `recallDispatch`: due `pending` → writes scheduled notification + flips `sent` + bumps `sendAttempts`; re-attempt only after `recallReattemptDays`; stops at `recallMaxAttempts`; consent-gated identically to Slice A.
   - Due-list query: branch-scoped, paginated, excludes `completed`/`cancelled`.
   - Completing a recall with `intervalMonths` seeds the next-cycle `pending` recall.
3. **Contract**: extend `dental-patient.hurl` (recalls section) — due-list happy + branch-scope 403, dispatch idempotency observable via recall `status`/`sendAttempts`.
4. **Frontend unit**: recall due-list view + "Reach out"/"Schedule" actions.
5. **E2E**: seed an overdue recall → run dispatch → recall flips `sent`, notification enqueued, appears in due-list as actioned.
6. **Verify gate** as above.

Reminder per memory: **never run `bun test <path>` directly** (template pollution) — always `bun run test`. Job tests must hit real registration/wiring, not just `buildTestApp()`.

---

## 5. Phasing & effort

Backlog effort: **L**. Suggested order (each is a shippable vertical slice):

| Phase | Scope | Rel. size |
|---|---|---|
| **P0** | Schema deltas (appt `confirmed` + cols, notif types/`sms` channel, recall interval/dispatch cols) + migration; consent-gate util + tests | M |
| **P1** | Slice A: reminderArmer/canceller jobs + confirm handlers/endpoints + FSM; in-app+email+push delivery (reuse) | M |
| **P2** | Slice B: recallDueScan/recallDispatch jobs + due-list endpoint + recurrence seeding | M |
| **P3** | Frontend: `confirmed` calendar badge + confirm action + recall due-list view | S |
| **P4** | SMS provider integration behind the already-present `sms` channel (separate vendor decision) | S–M, deferrable |

P4 is **deferrable**: P0–P3 ship full reminder/recall value over in-app + email + push; SMS slots in without touching cadence/consent logic.

---

## 6. Dependencies

- **P1-28 per-channel consent** (✅ landed) — `PersonConsent.channels` + `getPatientPersonConsent`/`updatePatientChannelConsent`. **Hard dependency** for the consent gate.
- **notifs module** (✅) — `createNotification` + `processScheduledNotifications` + multi-channel `deliverNotification`. We enqueue; it delivers.
- **Job scheduler** (✅) — `core/jobs.ts`; pattern set by `booking`/`retention`/`notifs` jobs.
- **Scheduling status lifecycle** — adding `confirmed` must not break the existing FSM property tests, `markNoShow` reversibility, or check-in/queue flow.
- **EmailService** (✅) + **OneSignal** (✅, `external_id` targeting) — already wired in the notification repo.
- **SMS provider** (❌ absent) — gating only for the SMS channel; provider TBD (Twilio/Vonage/OneSignal-SMS). Everything else ships without it.
- **Email templates** — `mapNotificationToEmailTemplate` currently maps only `security`/`system`; needs reminder/recall template tags added (+ the email template assets).

---

## 7. Risks

- **🔴 Spam / consent compliance (biggest risk).** Automated outbound to patients without rock-solid per-channel consent is a TCPA/HIPAA/marketing-law exposure and a reputation risk. **Mitigation:** consent gate **fails closed** for outbound channels; transactional-vs-marketing distinction documented and enforced (reminders never require marketing consent, but a global opt-out must still suppress); every suppression and send is audit-logged (no PII); in-app is always safe. This is why P1-28 was a prerequisite.
- **Duplicate / storm sends.** A job re-run or a clock skew could double-send or blast a backlog. **Mitigation:** idempotency key `(relatedEntity,type,channel,scheduledAt)` with a unique partial index; batch `.limit(100)`; enqueue-only (delivery throttled by the existing notifs job); armer only looks a bounded window ahead.
- **Delivery reliability / silent failures.** Email/push/SMS can fail; `deliverNotification` already marks `failed` but nothing retries or alerts. **Mitigation:** rely on pg-boss `retryLimit`; surface `failed` reminder/recall rows in an ops view; recall re-attempt cadence is explicit (`recallReattemptDays`/`recallMaxAttempts`).
- **Reschedule/cancel races.** A reminder could fire between cancel and canceller-expire. **Mitigation:** expire queued rows *synchronously inside* the transition handlers (not via cron), and have the delivery step re-check appointment status before sending.
- **`sms` channel enum without a provider** — writing `sms` rows that no-op could confuse "delivered" reporting. **Mitigation:** explicit `failed` + "no SMS provider" log until P4; or gate `sms` out of the default branch policy until the provider lands. **(Decision: enum-now, provider-later — confirm at eng review.)**
- **Timezone correctness** on `text` `dueDate` and on `scheduledAt - leadHours` across branch timezones (branches carry `timezone`, e.g. `Asia/Manila`). **Mitigation:** compute lead times in UTC off `scheduledAt` (already `timestamptz`); compute recall due-dates against branch tz; cover both in tests.

---

## 8. Open decisions for eng review

1. **SMS now or later?** Recommend: add the `sms` channel enum + consent/cadence now (P0–P3), defer the actual provider to P4. (See risk above.)
2. **Default reminder cadence** — `[72h, 24h, 2h]` proposed; confirm per-branch override via `reminderPolicy` JSONB on branch config vs. a dedicated table. Recommend JSONB (no migration).
3. **Confirmation = a real FSM state vs. a boolean flag?** Recommend a real `confirmed` state (closes scheduling-review §2 P2 and reads cleanly on the calendar).
4. **Recall recurrence trigger** — seed next-cycle recall on recall-`completed` vs. on completed recall *visit*. Recommend on recall-completed (simpler, no cross-module visit coupling) with `intervalMonths`.
