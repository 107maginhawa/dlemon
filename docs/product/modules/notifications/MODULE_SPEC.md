<!-- authored: 2026-06-12 | notifications FIX-005 (documents SHIPPED behavior, not aspiration) -->

# Module Specification: notifications

---
Spec Version: 1.0 | Last Updated: 2026-06-12
---

> Authored **after** the in-app surface shipped (FIX-001) so it documents real,
> shipped behavior. The notifications backend was built backend-first with a
> producer fan-in from 6+ modules and zero consumers; FIX-001 (in-app bell/inbox)
> and FIX-002 (push opt-in + click routing) wired the user-facing surfaces.

## 1. Module Overview
**Purpose:** Multi-channel notification delivery (in-app, push, email; SMS enum-only) plus the in-app surface that lets recipients read and clear their notifications. Producers across the platform (booking, billing, scheduling, patient recall, comms) emit notifications; this module persists, routes by channel, and surfaces them.

**Users:** Every authenticated member (in-app inbox — recipient-scoped); patients (outbound reminder/recall channels). Creation is **service-internal** (`notifsService.createNotification`) — there is no public create endpoint.

**Related:** booking / billing / dental-scheduling / dental-patient (recall) / comms (event producers); email module (template-tag delivery); person module (consent + recipient lookup facade); `core/jobs.ts` (reminder/recall scheduler).

---

## 2. Domain Terms
| Term | Definition |
|------|-----------|
| Notification | A persisted message for one recipient: `{ recipient, type, channel, title, message, status, relatedEntityType?, relatedEntity? }` |
| Channel | Delivery medium: `in-app`, `push`, `email`, `sms` (sms is enum-only — no provider in V1) |
| Recipient-scoped | The list endpoint filters by the authenticated user's id; a member only ever sees their own rows |
| Producer | Any module that calls `notifsService.createNotification` (best-effort, non-blocking) |

---

## 3. Workflows
- **WF (in-app inbox, FIX-001):** bell + unread badge + inbox panel in the dashboard shell; list unread / mark one read / mark all read. Single unread query feeds BOTH the badge count (`pagination.totalCount`) and the rows (`data`) — they cannot diverge.
- **WF (push opt-in, FIX-002):** at the first relevant clinical action (opening a patient workspace), a dismissible nudge requests push permission on a user gesture; renders nothing when push is unconfigured. A clicked push routes to an in-app deep link.
- **WF (reminders/recall):** `reminderArmer` / `recallDispatch` jobs (on `core/jobs.ts`) enqueue per-channel notifications, gated by per-patient consent.

---

## 5. Business Rules
- **Recipient isolation:** the list endpoint returns only the caller's notifications.
- **Immediate in-app:** an immediate `in-app` notification is created with status `sent` (and `sentAt`); scheduled/other-channel notifications are created `queued`.
- **Consent gate (transactional reminders):** outbound channels (`sms`/`push`/`email`) require **explicit** per-patient consent — `undefined` fails closed; `in-app` is always allowed. `marketing` consent is NOT required for transactional reminders, but a global opt-out suppresses all outbound channels. Enforced solely by `resolve-reminder-channels.ts` (FIX-006).
- **Settings panel = defaults, not a gate (FIX-006):** the clinic-wide Notification Settings toggles store DEFAULT preferences; no send path reads them. Whether a patient is actually contacted is governed only by that patient's communication consent.
- **Medical fail-open (FIX-004):** medical/safety-critical notifications must fail open (bypass any quiet-hours/batching) and get elevated push priority. V1 ships **no** quiet-hours/batching (so fail-open is already satisfied for every notification) and **no** medical notification types; the classifier (`isMedicalNotificationType`) is live and ready, with an empty type set.

---

## 6. Permissions
Create: System / producers only (`notifsService`, service-internal — no public endpoint). | Read + mark-read: the authenticated recipient, own rows only. | No cross-user read; no delete from the surface.

---

## 7. Data Requirements
**`notification`**: id, recipient (person id), type (enum, 18 types: `billing`, `security`, `system`, `booking.*` ×6, `comms.*` ×5, `appointment.reminder`, `appointment.confirmation-request`, `recall.due`, `recall.reminder`), channel (enum: `email`/`push`/`in-app`/`sms`), title, message, status (enum: `queued`/`sent`/`delivered`/`failed`/`read`…), scheduledAt?, sentAt?, relatedEntityType?, relatedEntity?, consentValidated.

---

## 10. API Expectations
- `GET /notifications` — list the caller's notifications; query filters `status`, `channel`, `type`, `startDate`, `endDate`; returns `{ data, pagination }`. (consumed by the in-app bell with `status=unread&channel=in-app`)
- `GET /notifications/{notif}` — get one (recipient-scoped).
- `POST /notifications/{notif}/read` — mark one read.
- `POST /notifications/read-all` — mark all read.

---

## 10b. Channels (delivery detail)
- **in-app:** persisted; read via the surface above (FIX-001). Badge stays live via 60s polling (no websockets — see §11).
- **push (OneSignal):** targets `include_aliases.external_id = [recipient]`; data payload `{ notificationId, type, relatedEntity }` drives click routing (FIX-002). Fails closed when unconfigured (status `failed`); live delivery is environment-gated.
- **email:** queued via the email module by template tag. `security`→`auth.password-reset`, `system`→`auth.welcome` are REGISTERED. Reminder/recall email templates (`appointment.reminder`, `appointment.confirmation-request`, `recall.due`, `recall.reminder`) are **Phase-2 — not yet authored** (the tag is absent from `EmailTemplateTags`). For an email-consented patient those reminders DO queue an email-channel row, but it **fails at process time** (`resolveTemplateByTags` → no template → `markAsFailed`; graceful, no malformed send) — so email-reminder delivery is effectively dormant until a template lands, while the in-app/push channels for the same reminders work today (FIX-003).
- **sms:** enum-only; no provider in V1 (V2).

---

## 11. Do Not Build
- Real-time websocket push for the in-app inbox — polling suffices for V1.
- New notification types without producers (taxonomy already ahead of workflows).
- A new scheduler/dispatch framework — `core/jobs.ts` already runs the notifs cron jobs.
- A public notification-create endpoint — creation is intentionally service-internal.
- SMS provider integration (V2); invoice-overdue emails (Phase-2, blocked by billing overdue cron).

---

## 14. Dependencies
person (recipient lookup facade + consent), email module (template delivery), `core/jobs.ts` (scheduler), OneSignal (push; environment-gated), booking/billing/dental-scheduling/dental-patient/comms (producers).

---

## 20. AI Instructions
- Do not add a public create endpoint or new scheduler. Producers call `notifsService.createNotification` best-effort.
- Keep the badge count and panel rows sourced from one query (coherence invariant).
- Outbound consent is enforced ONLY by `resolve-reminder-channels.ts`; never gate on the clinic settings panel.
- New email-channel notification types MUST have a registered `EmailTemplateTags` template (FIX-003 test guards against phantom tags).
- Medical types (when introduced) go in `MEDICAL_NOTIFICATION_TYPES` and must fail open.
