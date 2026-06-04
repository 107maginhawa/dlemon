# P1-25 — Online / Self-Service Patient Booking — Design Plan

> Status: PLAN (no code) · Author: scheduling review follow-up · Date 2026-06-02
> Source gaps: `docs/reviews/modules/scheduling-review.md` §2 (P1 "Online / self-service booking"), `docs/reviews/research/light-pass.md` §Scheduling
> Module home: `services/api-ts/src/handlers/dental-scheduling/` (new public sub-surface) · TypeSpec: `specs/api/src/modules/dental-scheduling.tsp`

---

## 1. Problem & current state

**Today scheduling is 100% staff-only.** Every write path requires an authenticated staff member with a scheduling-capable branch role:

- `createAppointment.ts` calls `assertBranchRole(db, user.id, branchId, ['dentist_owner','dentist_associate','staff_full','staff_scheduling'])` before it will create anything. There is no path for a patient (or an unauthenticated prospect) to create an appointment.
- `listAppointments.ts` requires `assertBranchAccess` and exposes full appointment rows (patient name joined, notes, etc.) — not safe to expose to patients.
- Working-hours config exists (`workingHours.ts` → `isWithinWorkingHours`) and overlap detection exists (`dental-appointment.repo.ts#findOverlapping`), but both are only consumed inside the staff create flow. **There is no endpoint that turns working-hours + existing appointments into a list of bookable slots.**
- Overlap on staff create is **non-blocking** (soft `DOUBLE_BOOKING` warning) — acceptable for staff who can intentionally double-book, but unacceptable for self-service.
- A separate **legacy `booking/` module** (`listEventSlots.ts`, `getTimeSlot.ts`, `utils/slotGeneration.ts`, `jobs/slotGenerator.ts`, `timeSlot.repo.ts`) implements a generic event→slot→hold→confirm model with materialized `time_slots` rows, a `confirmationTimer` job, and a `slotCleanup` job. It is vertical-neutral and **not wired to the dental calendar** (`dental_appointment`). It is a useful reference for slot-hold/expiry mechanics but is a parallel data model.

**Net:** a prospective or existing patient cannot see real availability or book after hours; the front desk is the only way in. This is the single most-cited differentiating table-stake we are missing in scheduling (research §Scheduling).

---

## 2. Target

After-hours, low-friction self-service booking that is **trustworthy** (only shows truly-bookable times) and **safe** (cannot corrupt the staff calendar):

1. A patient-facing surface lists a branch's services, providers, and **real open slots** computed live from working hours minus existing appointments (and operatory capacity).
2. Selecting a slot **holds** it briefly, collects contact details (or uses a light authenticated patient identity), and **books a real `dental_appointment` in `scheduled` status** that immediately appears on the staff calendar — no separate "online booking inbox" to reconcile.
3. Patient receives a confirmation (in-app/email/SMS via `notifs`) and the booking participates in the existing lifecycle: it can be checked in (`checkInAppointment.ts` → draft visit), cancelled, or marked no-show exactly like a staff-created appointment.
4. **Double-booking is hard-blocked** on the self-service path (unlike staff).
5. Practice controls what is bookable online: which branches, which providers, which visit types, lead-time, and horizon — configured per branch (extend the existing scheduling config).

Non-goals (this slice): payment-at-booking, insurance verification, ASAP/waitlist auto-fill (separate P2), recall-driven auto-booking (depends on the reminder/recall P1).

---

## 3. Proposed design

### 3.1 Availability computation (reuse, don't fork)

Compute availability **on-read from existing data** rather than materializing slot rows. This avoids the dual-source-of-truth problem the legacy `booking` module has (materialized `time_slots` that can drift from the real calendar).

Algorithm (`computeAvailability(branchId, providerId?, visitType, dateFrom, dateTo)`):

1. Load branch scheduling config via `getBranchSchedulingConfig` → `parseWorkingHours` (already used by `createAppointment`). Resolve branch timezone.
2. Determine candidate providers: a single `providerId` if supplied, else all online-bookable providers for the branch. Determine operatory count for capacity (`dental_operatory` rows where `active = true`).
3. For each day in range, walk working-hours open→close in fixed step increments (e.g. 15-min grid), slot length = visit-type duration (config-driven default, e.g. checkup 30, treatment 60). Reuse the time-grid math style from `booking/utils/slotGeneration.ts#generateSlotsForDay` (the day-walking + timezone conversion logic is directly portable) but emit **ephemeral** candidate slots, not DB rows.
4. Subtract conflicts: a candidate slot for provider P is open only if `findOverlapping(P, branchId, slotStart, duration)` returns empty (reuse the existing interval SQL in `dental-appointment.repo.ts`; extend to also count active **holds** — see 3.4). Optionally enforce operatory capacity (open if at least one operatory free).
5. Apply policy filters: drop slots inside the **minimum lead-time** (e.g. no booking < 2h out) and beyond the **booking horizon** (e.g. ≤ 60 days); cap range like `listAppointments` (≤ 31 days) to bound cost.
6. Return slots grouped by day with `{ start, end, providerId, visitType }` — **no patient PII, no existing-appointment detail** (only "free/not-free").

This is read-only and idempotent, so it can be a **public** endpoint with rate-limiting.

### 3.2 Patient-facing surface & identity

Two-tier identity, both supported, choose per-practice config (default = light auth):

- **Unauthenticated (prospect) booking:** form collects name + phone + email + DOB. On book, we **match-or-create** a `dental_patient` via the existing `findDuplicateDentalPatients` / `createPatientForRegistration` facade (`patient-dental-patient.facade.ts`). New self-booked patients are flagged `source = 'online'` and `unverified = true` so staff can review. Contact info lands in `patient-contact.schema.ts` (phone/email already exist).
- **Light patient auth (preferred for existing patients):** a short-lived booking token. Two viable mechanisms — pick in eng review: (a) magic-link / OTP to a known phone/email that resolves to an existing `dental_patient`; (b) Better-Auth patient session. Authenticated patients skip the match-or-create and book against their own `patientId` only (enforced server-side).

Frontend lives in `apps/dentalemon/src/features/booking/` (new public route group, e.g. `/book/:branchId`), unauthenticated-reachable, separate from the staff `features/scheduling/`. Steps: pick branch → service/visit-type → provider (or "any") → slot grid (from `GET …/availability`) → contact/identity → confirm. Uses generated SDK hooks once TypeSpec is added.

### 3.3 Booking → appointment → check-in flow

A booked slot creates a **real `dental_appointment`** through a dedicated public handler (`createOnlineBooking.ts`), NOT the staff `createAppointment`. It reuses the same repo (`DentalAppointmentRepository.createOne`) so the row is identical and flows through the existing lifecycle untouched:

```
patient picks slot
  → POST /dental/public/branches/:branchId/bookings  (public, rate-limited)
  → server: resolve/validate patient identity (3.2)
  → server: re-validate slot is still open (hard overlap check + hold check, in a tx)
  → repo.createOne({ status:'scheduled', walkIn:false, serviceType:visitType,
                     createdBy: <system/online actor>, source:'online', confirmationState:'pending' })
  → logAuditEvent(action:'appointment.book', metadata.channel:'online')
  → notifs: booking.created confirmation (existing) + emit AppointmentBooked domain event (existing)
  → 201 { confirmationCode, startAt, branch, provider }
```

From there the appointment is indistinguishable to staff: it appears in `listAppointments`, can be **checked in** (`checkInAppointment.ts` → creates the draft `dental_visit` and links it) and proceeds to the visit/charting flow exactly as a staff booking. No new visit plumbing is required — we deliberately reuse the check-in→visit path.

### 3.4 Double-booking prevention (hard, unlike staff)

Staff create is intentionally soft-warn; self-service must be hard:

1. **Slot holds.** Add a lightweight `dental_appointment_hold` table: `{ id, branchId, providerId, startAt, durationMinutes, expiresAt, sessionToken }`. When a patient selects a slot, create a hold with a short TTL (e.g. 5 min). Availability (3.1) treats active (non-expired) holds as occupied. A `holdCleanup` job sweeps expired holds (mirror `booking/jobs/slotCleanup.ts`).
2. **Commit under a transaction with a final overlap check.** On `createOnlineBooking`, inside a DB transaction: re-run `findOverlapping(providerId, branchId, start, duration)`; if non-empty → `409 SLOT_TAKEN` (taxonomy code), release nothing, return fresh availability hint. This closes the read-then-write race (two patients holding/booking the same slot).
3. **DB guard rail.** Add a partial unique / exclusion constraint to make true overlap impossible at the storage layer (Postgres `EXCLUDE USING gist` on `(provider, tstzrange(scheduled_at, scheduled_at+duration))` filtered to active statuses), so even a concurrency bug cannot produce a real conflict. The application 409 is the friendly path; the constraint is the backstop.

### 3.5 Branch / provider / operatory & online-bookability config

Extend the branch scheduling config (alongside `workingHours` JSON on the branch, via `org-scheduling.facade.ts`) with an `onlineBooking` block:

```
onlineBooking: {
  enabled: boolean,
  bookableVisitTypes: ['checkup','recall'],      // restrict; never 'emergency' online
  bookableProviderMemberIds: [...] | 'all',
  leadTimeMinutes: 120,
  horizonDays: 60,
  slotStepMinutes: 15,
  requirePatientAuth: boolean,
}
```

Provider/operatory selection in availability honors this config. Operatory is assigned at book time (first free active operatory) or left null for staff to assign — config-driven; defaults to null to keep slice small.

---

## 4. API + data model

### 4.1 New endpoints (TypeSpec → `dental-scheduling.tsp`, public namespace)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/dental/public/branches/:branchId/booking-config` | public | Bookable services, providers, policy (drives the form). |
| GET | `/dental/public/branches/:branchId/availability?providerId&visitType&date_from&date_to` | public, rate-limited | Computed open slots (3.1). |
| POST | `/dental/public/branches/:branchId/holds` | public, rate-limited | Create a slot hold (3.4.1) → returns hold token + expiry. |
| POST | `/dental/public/branches/:branchId/bookings` | public/light-auth, rate-limited | Commit booking → real `dental_appointment` (3.3). |
| GET | `/dental/public/bookings/:confirmationCode` | public (code = bearer) | Confirmation lookup / "your appointment". |

All `public` routes go through a dedicated middleware that skips the staff auth guard but applies rate-limiting + (optional) patient-token verification. Staff endpoints are unchanged.

### 4.2 Data model

- **`dental_appointment` (extend):** add `source text default 'staff'` (`'staff'|'online'|'walk_in'`) and `confirmation_state text default 'confirmed'` (`'pending'|'confirmed'`) — this also resolves the scheduling-review §2 P2 "no explicit confirmed state". `confirmationCode` (random, unguessable) for the lookup endpoint. No change to the status FSM.
- **`dental_appointment_hold` (new):** `{ id, branchId, providerId, startAt, durationMinutes, expiresAt, sessionToken, createdAt }`, indexed on `(branchId, providerId, startAt)`; swept by a cleanup job.
- **Postgres exclusion constraint** on active-status appointment time ranges per provider (3.4.3).
- **Patient linkage:** reuse existing `dental_patient` + `patient_contact`; add `source`/`unverified` flags on the patient identity for online-created records.

Migration via `bun run db:generate` (schema-first), reviewed in `src/generated/migrations/`.

---

## 5. Vertical-TDD test plan (per `docs/development/VERTICAL_TDD.md`)

One vertical slice end-to-end; tests RED before impl at each layer.

1. **TypeSpec** — add public booking ops to `dental-scheduling.tsp`; `bun run build` (specs) → `bun run generate` (api-ts) for validators/routes. (No code committed in this plan.)
2. **Backend unit (RED→GREEN)** in `dental-scheduling/`:
   - `availability.test.ts` — slot math: respects working hours + timezone, subtracts existing appointments, subtracts active holds, ignores expired holds, applies lead-time/horizon, excludes disabled days, emits no PII.
   - `createOnlineBooking.test.ts` — creates `scheduled` appointment with `source='online'`; hard-blocks overlap (`409 SLOT_TAKEN`); rejects non-bookable visit type (`emergency`); rejects slot outside working hours; honors `requirePatientAuth`; match-or-create patient path.
   - `holds.test.ts` — hold creation, TTL expiry, availability excludes held slots, cleanup job sweeps expired.
   - **Concurrency** — property/race test: two simultaneous commits for the same slot → exactly one 201, one 409 (and the exclusion constraint backstops it).
   - Verify online bookings flow through existing `checkInAppointment` → draft visit (reuse existing check-in test fixtures).
3. **Contract (RED→GREEN)** — add Hurl scenarios to `specs/api/tests/contract/`: availability shape, hold lifecycle, book happy-path (201 + confirmationCode), double-book (409), unauthenticated reach of public routes, staff routes still 401 without auth.
4. **Frontend unit (RED→GREEN)** — `apps/dentalemon/src/features/booking/`: availability grid renders/empties correctly, hold timer/expiry UX, confirm step, error states (slot taken → re-fetch availability).
5. **E2E (Playwright)** — prospect books after-hours: pick branch→service→provider→slot→details→confirm; appointment then visible on the staff calendar; staff checks it in. (Per memory `feedback_playwright_over_human_checkpoint.md`, use Playwright not human checkpoints.)
6. **Verify gate** — `bun run test` + `bun run typecheck` + **`bun run check:boundaries`** (per memory `feedback_verify_gate_boundaries.md`) green, no regressions; never `bun test <path>` (template pollution per `feedback_test_db_template_pollution.md`).

---

## 6. Phasing & effort

Overall effort: **L** (new public auth surface + new table + concurrency-correct write path + new frontend route group).

- **Phase 1 — Availability (read-only).** `booking-config` + `availability` endpoints + slot math (port from `slotGeneration.ts`) + backend/contract tests. Ships value immediately (embeddable "see our availability"). ~M.
- **Phase 2 — Holds + commit.** `dental_appointment_hold` table, exclusion constraint, `createOnlineBooking`, hard double-book block, confirmation + `source`/`confirmation_state` columns, cleanup job. ~M.
- **Phase 3 — Patient-facing UI + identity.** `features/booking/` route group, match-or-create vs light-auth, confirmation page, E2E. ~M.

Phases 1–2 are backend-complete and independently testable; Phase 3 is the frontend slice. Each phase is its own vertical (TypeSpec→…→verify) before the next.

---

## 7. Dependencies

- **Reminders (scheduling-review §2 P1, separate plan):** confirmation at booking uses the existing `notifs` `booking.created` path (no dependency to ship), but the **value** of online booking compounds with the reminder cadence (confirm/remind/no-show). Build online booking first; it feeds the reminder engine.
- **Patient auth:** the light-auth tier depends on a patient identity/OTP mechanism that does not yet exist. **Mitigation:** Phase 3 ships the unauthenticated match-or-create path first (no new auth infra); light-auth is an additive follow-up gated behind `requirePatientAuth` config.
- **Org/branch config:** reuses `org-scheduling.facade.ts` (`getBranchSchedulingConfig`) — extend its JSON schema with the `onlineBooking` block; owner-only edit (mirror `updateWorkingHours` role gate `['dentist_owner']`).
- **Operatory capacity:** reuses `dental_operatory`; capacity-aware availability is optional in Phase 1 (provider-only) and can be tightened later.

---

## 8. Risks

- **[HIGH] Race conditions on slots / double-booking.** Read-then-write between availability and commit, and concurrent commits. Mitigated by holds (3.4.1), transactional final overlap re-check (3.4.2), and a Postgres exclusion constraint as the storage backstop (3.4.3). The exclusion constraint is the load-bearing mitigation — without it, application checks alone can still race.
- **[HIGH] Spam / abuse on public endpoints.** Unauthenticated create can flood the calendar with junk patients/appointments. Mitigate: rate-limit per IP/branch, hold-before-book (caps in-flight), CAPTCHA/turnstile on the prospect form, `source='online' + unverified` flags so staff can bulk-review/purge, and `confirmation_state='pending'` so junk doesn't masquerade as confirmed. Restrict `bookableVisitTypes` (never `emergency`).
- **[MED] No-show on self-booked appointments.** Self-booked patients no-show more. Existing `markNoShow` covers tracking; real mitigation is the reminder/recall P1 (dependency §7). Consider requiring contact verification (light-auth) for higher-trust slots.
- **[MED] Availability drift / showing unbookable times.** On-read computation (not materialized) keeps availability truthful by construction — the chosen design deliberately avoids the legacy `booking` module's materialized-slot drift. Timezone correctness (branch tz, DST) is the main correctness risk; covered by unit tests reusing the proven `isWithinWorkingHours` Intl-based logic.
- **[MED] PII leakage on public reads.** Availability must expose only free/busy, never existing-appointment detail; confirmation lookup is gated by an unguessable code. Asserted in contract + boundary tests.
- **[LOW] Two parallel booking models.** We are reusing legacy `booking/` mechanics (slot-gen math, hold/cleanup jobs) as reference but writing to `dental_appointment`, not `time_slots`. Risk of confusion; document clearly that the dental calendar is the single source of truth and `booking/` is not wired here.
