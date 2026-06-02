# Scheduling — Standards & Experience Review
> Review date 2026-06-02 · Depth: LIGHT (table-stakes)

## 1. What we have
Appointment CRUD with a clean lifecycle FSM `scheduled → checked_in → completed | cancelled | no_show` (`dental-appointment.schema.ts`, `appointment.fsm.property.test.ts`); operatory assignment (`operatoryId` FK on appointment, `operatory.schema.ts`); provider + branch scoping with `assert-branch-access`; working-hours config (`workingHours.ts`, `updateWorkingHours.ts`); visit types `checkup|treatment|emergency|recall`; check-in (`checkInAppointment.ts`); no-show marking (`markNoShow`, reversible). A front-desk **queue board** exists (`listQueueBoard.ts`, `createQueueItem.ts`, queue FSM `waiting→called→in_progress→completed|cancelled`). Booking fires a best-effort `booking.created` patient notification (`createAppointment.ts`). Recall (continuing-care) lives in the patient module (`dental-patient/recalls/`). Frontend: `apps/dentalemon/src/features/scheduling/{components,hooks}` with `use-appointments.ts` (correct day/week window).

## 2. Table-stakes gaps
| Capability | Industry table-stakes | Our status | Evidence | Severity |
|---|---|---|---|---|
| Multi-provider / multi-operatory | Appt assigned to provider AND operatory; multi-column views | ✅ | `dental-appointment.schema.ts` (`operatoryId`, `providerId`) | — |
| Status lifecycle / no-show | Scheduled→checked-in→completed, no-show flags, confirmations | ⚠️ | FSM present incl. `no_show`; **no explicit "confirmed" state** between scheduled and check-in | P2 |
| Check-in / queue | Arrived→seated→checkout front-desk flow | ✅ | `listQueueBoard.ts` + queue-item FSM | — |
| Drag-and-drop reschedule | Move/resize on grid | ❓ | `updateAppointment.ts` supports reschedule server-side; grid DnD UX not verified | P2 |
| Online / self-service booking | Patient-facing after-hours booking syncing to calendar | ❌ | No patient-facing booking endpoint/route found | P1 |
| Automated reminders | SMS/email reminder cadence (primary no-show lever) | ❌ | Only one `booking.created` notif at create time; no scheduled reminder job (cron in `core/jobs.ts` / `retention/jobs` only) | P1 |
| Recall (continuing-care) engine | Recare due tracking auto-feeding scheduling | ⚠️ | `dental-patient/recalls/` tracks type/dueDate/status manually (`pending→sent→completed`); **no automated due-date generation or reminder dispatch** | P1 |
| Waitlist / ASAP fill | Short-notice fill of cancellations | ❌ | Queue board is in-office waiting room, not a cancellation waitlist/ASAP matcher | P2 |

## 3. Notable findings
- **[P1] Dashboard appointment fetch 400s — client/server contract drift.** `GET /dental/appointments?date=…&branchId=…` returns 400; the API requires `date_from`/`date_to`. Root cause is frontend: `apps/dentalemon/src/features/dashboard/hooks/use-dashboard-summary.ts:69-70` sends `date=${today}`. The calendar hook (`use-appointments.ts:79`) correctly sends `date_from`/`date_to`, so only the **dashboard morning briefing** is broken (renders empty with a graceful red banner). Backend `listAppointments.ts:33-36` already accepts the window. Fix: change the dashboard hook to send a same-day `date_from`/`date_to` window (or add a `date` alias on the endpoint). Evidence: `LIVE_AUDIT_NOTES.md` CC-1, `screenshots/01-dashboard.png`.
- **[P1] No automated reminders / recall dispatch.** Reminders are the biggest no-show lever per the research; we fire one notification at booking and have no scheduled reminder/recall cadence. Recall rows exist but `status='sent'` must be set manually. Recommend a reminder/recall job feeding `notifs`.
- **[P1] No online/self-service booking.** No patient-facing booking surface.
- **[P2] No waitlist/ASAP matcher** and **[P2] no explicit "confirmed" status** between scheduled and check-in.

## 4. Carousel relevance
Moderate. Recall **history** (sent/completed over time) and a patient's appointment/no-show pattern are longitudinal, but scheduling is primarily a present/future operational surface — weaker fit than billing or clinical for the timeline-comparison model.
