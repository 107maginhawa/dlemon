# Module Audit — dental-scheduling

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure (adversarial; verified against source)
**Verdict:** ✅ **READY** — 1 real RBAC bypass fixed (TDD), 1 factually-wrong FSM doc note corrected, registry/contract/spec drift reconciled, 1 adversarial test gap closed; gates green.

---

## STEP 0 — Artifacts & /module-review

| Artifact | Location | Status |
|----------|----------|--------|
| Handler dir | `services/api-ts/src/handlers/dental-scheduling/` | ✅ present (appointments, check-in, cancel, confirm, public/online booking, holds, waitlist, queue, reminder jobs, repos, utils) |
| TypeSpec | `dental-scheduling.tsp` (appointments + public booking) + `dental-ops-extras.tsp` (waitlist/queue) | ✅ present |
| MODULE_SPEC / API_CONTRACTS | `docs/product/modules/dental-scheduling/` | ✅ present (was materially under-documenting the shipped surface — reconciled) |
| Tests | 21 `*.test.ts` (18 top-level + 3 in `repos/`,`utils/`,`jobs/`) | ✅ present |

**/module-review result:** **PASS** — no `test.skip`/`xtest`/`xdescribe`, no `Not implemented` stubs, no TODO/FIXME/HACK in handler code, 0 unsafe `as any` in non-test code, 21 test files. Audit-logging present on create (`appointment.book`) and cancel (`appointment.cancel`).

---

## STEP 3 — KG mapping (query-only)

Unlike dental-patient (NONE), the domain graph **does** carry scheduling nodes:
`domain:scheduling-appointments`, `flow:book-appointment`, `flow:queue-waitlist`, plus
`Book/Confirm/Create Appointment`, `List My Appointments`. Flow summaries accurately describe
staff + online booking, slot holds, confirmation, check-in, FIFO waitlist promotion, and queue.

**OVER-CLAIM flagged (KG-projection, not a blocker):** one node summary states *"Appointments carry a
`visitType` ('general'|'hygiene')"*. That conflates the **visit** type (dental-visit: `general`|`hygiene`)
with the **appointment's** service-type enum, which is `checkup`|`treatment`|`emergency`|`recall`|`hygiene`
(5 values, `appointment-wire.ts:18`). The appointment does not carry a `general`/`hygiene` field; check-in
*derives* the visit type from `serviceType === 'hygiene'`. KG-backlog note.

---

## STEP 6 — Traceability Matrix

| Item | Spec? | Impl? | KG | Test (file:line) | Strength | Verdict |
|------|-------|-------|----|-----------------|----------|---------|
| **FR3.7** double-booking soft-warn @create → 201 + `warnings:[DOUBLE_BOOKING]` | ✅ | ✅ createAppointment.ts:72-86 | ✅ flow:book-appointment | dental-scheduling.test.ts:631; :618 (empty warnings) | VERIFIED | 🟢 |
| **FR3.7 / AC-SCH-002** reschedule hard-block → 409 RESCHEDULE_CONFLICT | ✅ | ✅ updateAppointment.ts:132-146 | ✅ | dental-scheduling.test.ts:1056-1090 (code asserted) | VERIFIED | 🟢 |
| **BR-004 / AC-SCH-005** check-in creates visit; cancel ≠ visit delete | ✅ | ✅ checkInAppointment.ts:74-91 | ✅ | acceptance.scheduling-workflows.test.ts:182 (AC-SCHED-03); dental-scheduling.test.ts:548 | VERIFIED | 🟢 |
| **AC-SCH-003** check-in w/ active visit → 409 CHECKIN_ACTIVE_VISIT | ✅ | ✅ checkInAppointment.ts:63-71 | ✅ | dental-scheduling.test.ts:668-693 (code asserted) | VERIFIED | 🟢 |
| **BR-SCH-004 / AC** outside working hours → 422 OUTSIDE_WORKING_HOURS (tz-aware) | ✅ | ✅ createAppointment.ts:59-67; updateAppointment.ts:123-131 | NONE | working-hours.test.ts:296-350 (close-exceed/closed-day/boundary/timezone) | VERIFIED | 🟢 |
| **BR-SCH-002** walk-in bypasses working hours | ✅ | ✅ createAppointment.ts:59 | NONE | working-hours.test.ts (**NEW** closed-day walk-in → 201) | VERIFIED (added this round) | 🟢 |
| **BR-SCH-003 / AC-SCH-004** cancel w/o reason → 422 REASON_REQUIRED (DELETE) | ✅ | ✅ cancelAppointment.ts:46-50 | NONE | transitions.test.ts:249,258 (missing + blank) | VERIFIED | 🟢 |
| **Appointment FSM** illegal transitions rejected (4xx) incl. `confirmed` node | ✅ | ✅ APPOINTMENT_TRANSITIONS (schema) | NONE | transitions.test.ts (22 cases); appointment.fsm.property.test.ts (11) | VERIFIED | 🟢 |
| **BR-SCH-001** branch-scope; no-membership → 403 | ✅ | ✅ all 4 write handlers assertBranchRole/Access | ✅ | rbac-scheduling.test.ts:366 (no-membership 403) | VERIFIED | 🟢 |
| **RBAC** create/reschedule: read_only → 403; staff_scheduling allowed | ✅ | ✅ createAppointment.ts:34; updateAppointment.ts:45 | NONE | rbac-scheduling.test.ts:200-246,271-284 | VERIFIED | 🟢 |
| **RBAC** check-in: staff_scheduling excluded; associate allowed; hygienist only for hygiene appt | ✅ | ✅ checkInAppointment.ts:51-55 | NONE | rbac-scheduling.test.ts:308-322 | VERIFIED | 🟢 |
| **RBAC** cancel (DELETE): scheduling + associate → 403; owner allowed | ✅ | ✅ cancelAppointment.ts:36 | NONE | rbac-scheduling.test.ts:329-359 | VERIFIED | 🟢 |
| **RBAC** cancel (PATCH status=cancelled): scheduling + associate → 403 | ✅ (§6 intent) | ✅ **FIXED** updateAppointment.ts (cancel-branch narrow) | NONE | rbac-scheduling.test.ts (**NEW** 3 cases) | VERIFIED (after fix) | 🟢 |
| **Appointment confirmation** (`/confirm`, `/confirm/:token`) | ✅(4b) | ✅ confirmAppointment.ts; confirmAppointmentByToken.ts | ✅ Confirm Appointment | appointment-confirm.test.ts (6); confirmAppointmentByToken.test.ts (4) | VERIFIED (presence; not line-audited) | 🟢 |
| **Public/online booking + holds** | ✅(4b) | ✅ getPublicAvailability/createBookingHold/createOnlineBooking | ✅ | online-booking.test.ts (18); public-booking-route-registration.test.ts (5) | VERIFIED (presence) | 🟢 |
| **Waitlist** (FIFO promote) | ✅(4b) | ✅ create/list/promoteWaitlistEntry | ✅ flow:queue-waitlist | dental-waitlist.test.ts (10); waitlist-route-registration.test.ts (3) | VERIFIED (presence) | 🟢 |
| **Queue board** (`dental_queue_item` FSM waiting→called→in_progress→completed/cancelled) | ⚠ §8 note was wrong | ✅ queue-item.schema.ts; create/list/updateQueueItemStatus | ✅ | dental-queue.test.ts (10); queue-route-registration.test.ts (3) | VERIFIED (presence); **doc corrected** | 🟢 |
| **Reminder arming** (pg-boss, flag-gated) | ✅(§18) | ✅ jobs/reminderArmer | NONE | jobs/reminderArmer.test.ts (5); reminders-route-registration.test.ts (4) | VERIFIED (presence) | 🟢 |

---

## STEP 7 — Gaps Closed This Round

### REAL bug fixed (TDD: RED proven by source, GREEN verified)

| # | Bug | Class | Fix |
|---|-----|-------|-----|
| 1 | **PATCH-cancel RBAC bypass** — the dedicated `DELETE /appointments/:id` restricts cancel to `dentist_owner`/`staff_full` (an explicit RBAC test asserts `staff_scheduling` AND `dentist_associate` → 403). But `updateAppointment` cancels via `PATCH {status:'cancelled'}` under the broad **4-role** write gate (incl. `staff_scheduling`, `dentist_associate`), so those roles could cancel through PATCH — bypassing the tested cancel restriction. Reachable: 4-role assert at updateAppointment.ts:45 admits them, then the cancel branch called `repo.cancel` directly. | RBAC bypass | Narrowed the cancel branch with a second `assertBranchRole(…, ['dentist_owner','staff_full'])` (parity with DELETE). Transitions tests run as `dentist_owner` → stay green. |

New adversarial tests (RED→GREEN): `staff_scheduling` + `dentist_associate` `PATCH status=cancelled` → 403, `dentist_owner` → not 403 (`rbac-scheduling.test.ts`).

### Adversarial test gap closed
- **BR-SCH-002 walk-in bypass** — impl skipped working-hours when `walkIn`, but no test asserted it. Added: a closed-day (Sunday) appointment with `walkIn:true` → **201** (the same time as a non-walk-in 422), asserting `walkIn:true` in the body (`dental-scheduling.working-hours.test.ts`).

### Stale comment fixed
- `updateAppointment.ts:100` visitType error message listed only 4 enum values — added `hygiene` (the 5th, shipped with the hygienist workflow).

### Doc / registry / contract drift reconciled

| # | Drift | Fix |
|---|-------|-----|
| 2 | **QueueItem deviation note (§8) was factually WRONG** — claimed *"no standalone `dental_queue_item` table exists; queue state is derived from appointment+visit"* and that the enum values are `with_provider`/`ready_for_checkout`. Reality: `dental_queue_item` is a real table (`queue-item.schema.ts`) with FSM `waiting → called → in_progress → completed \| cancelled`. | Rewrote the note to reflect the real table + FSM; kept the (true) IDEAL-naming deviation. |
| 3 | **br-registry** listed only **BR-004**; BR-SCH-001/002/003/004 + FR3.7 were implemented+tested but unregistered. | Added all five with `source` + `test` refs. |
| 4 | **MODULE_SPEC §8 FSM omitted `confirmed`** (schema has `scheduled→confirmed→checked_in`; transitions test covers it). | Added `confirmed` to the diagram + a V-SCH-011 clarification. |
| 5 | **MODULE_SPEC §7 visitType enum** listed 4 values; impl/TypeSpec ship 5 (`+hygiene`). | Added `hygiene` + the hygiene-derivation note. |
| 6 | **MODULE_SPEC under-documented the shipped surface** — confirmation, public/online booking, holds, waitlist, queue, reminders are built+codegen'd+tested but absent from the workflow/contract tables. | Added **§4b Extended Workflows** coverage table (capability → endpoints → handlers → TypeSpec). |
| 7 | **API_CONTRACTS used snake_case field names** while the real wire (TypeSpec/validators) is **camelCase** — a client following the doc literally would 400. | Added an authoritative camelCase banner with the full field map. |
| 8 | **API_CONTRACTS FSM header** said `scheduled → checked_in \| cancelled` only; **DELETE** documented `200 {ok:true}` (actual `204`); **PATCH** auth omitted `dentist_associate` and listed a non-returned `DOUBLE_BOOKING(409)`; visitType enum missing `hygiene`. | Corrected the FSM header, DELETE→204, PATCH auth (+associate + cancel-narrowing note), removed stray `DOUBLE_BOOKING(409)`, added `hygiene`/`status` rows. |

---

## Ranked Remaining Gaps (surfaced, NOT closed — out of safe scope)

**Latent inconsistency (product/test decision — not unilaterally changed):**
1. **BR-SCH-003 not enforced on the PATCH-cancel path.** `DELETE` requires a reason (min:5) → 422; `PATCH {status:'cancelled'}` accepts an absent/blank `cancellationReason` (persists `NULL`). An **existing test encodes this**: `dental-scheduling-transitions.test.ts:370,383` asserts PATCH-cancel **without** reason → 200. Reconciling (require reason on PATCH-cancel) would churn that passing test and risks unverified FE wiring → CHECKPOINT before changing. The RBAC fix already narrowed this path to owner/staff_full, shrinking the blast radius. *Recommendation:* either require the reason on PATCH-cancel (and update the two transition tests to pass a reason) or document the two-path asymmetry as intentional.

**REAL test gaps (impl present, adversarial assertion not line-verified this round):**
2. **Confirmation, public/online booking, holds, waitlist, queue, reminders** each have a dedicated passing test file, but I verified *presence + green*, not that every BR/edge (hold-expiry race, queue illegal-transition 4xx, online-booking `pending` provenance, FIFO tie-break) is adversarially asserted. A future pass should line-audit `online-booking.test.ts`, `dental-queue.test.ts`, `dental-waitlist.test.ts`, `confirmAppointmentByToken.test.ts` for negative-path strength.
3. **`source='online'` + `confirmationState='pending'` provenance** (schema P1-25) — no asserted test that an online booking lands `pending` (vs staff-confirmed). 
4. **Reschedule (PATCH time-move) double-booking + working-hours** — create-path is well covered; the PATCH re-validation (updateAppointment.ts:123-147) has the 409 reschedule test but no explicit PATCH outside-working-hours 422 test.

**KG-backlog:** the `visitType ('general'|'hygiene')` node summary over-claims (see STEP 3) — fix on next KG regeneration.

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors |
| dental-scheduling module suite (`test-with-db.ts`, 21 files) | ✅ **262 pass / 0 fail** (214 top-level + 48 subdir) |
| `eslint` (changed files) | ✅ 0 errors |
| `check:boundaries:dental-scheduling` | ✅ no cross-module repo violations |
| Contract suite (fresh `:7213`) | ✅ **43/46 files**; `dental-scheduling.hurl` (20 req) + `online-booking.hurl` (14 req) + booking-*/visit/revenue-cycle all Success. 3 failures are **pre-existing environmental, outside this module**: auth-verification + auth-password-reset (mailpit:8025 down), billing-lifecycle (Stripe 500). Identical to the dental-patient round. |

---

## Files Changed

- `services/api-ts/src/handlers/dental-scheduling/updateAppointment.ts` — PATCH-cancel RBAC narrow + stale visitType message
- `services/api-ts/src/handlers/dental-scheduling/rbac-scheduling.test.ts` — +3 PATCH-cancel bypass tests
- `services/api-ts/src/handlers/dental-scheduling/dental-scheduling.working-hours.test.ts` — +1 BR-SCH-002 walk-in bypass test
- `specs/api/docs/standards/br-registry.json` — added BR-SCH-001/002/003/004 + FR3.7; test refs on BR-004
- `docs/product/modules/dental-scheduling/MODULE_SPEC.md` — confirmed FSM state, hygiene enum, corrected QueueItem note, §4b extended workflows
- `docs/product/modules/dental-scheduling/API_CONTRACTS.md` — camelCase banner, FSM header, DELETE 204, PATCH auth, visitType, removed stray DOUBLE_BOOKING(409)
- `docs/audits/modules/MODULE_dental-scheduling_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — rollup entry
