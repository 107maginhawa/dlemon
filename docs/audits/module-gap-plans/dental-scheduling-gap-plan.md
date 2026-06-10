# dental-scheduling — Proposed Fix Plan

**Module:** dental-scheduling · **Date:** 2026-06-09 · **Status:** plan only (no fixes implemented)
**Method:** static FE↔BE wiring + workflow audit (10-area lens). Live-drive scoped to static verification — every gap below is *absence of a UI affordance* (code-certain), and the happy path was already driven GREEN twice (`runs/dental-scheduling/REPORT.md`, sweep dry-run).
**Prior audits (carry-forward):** `docs/audits/modules/MODULE_dental-scheduling_AUDIT_2026-06-08.md` (READY — backend traceability), `docs/audits/workflow-verification/runs/dental-scheduling/REPORT.md` (GREEN — SCH-DRIFT-001 fixed).
**Standards:** Vertical TDD (tests RED → impl GREEN), `docs/development/VERTICAL_TDD.md`. Every fix lists its required failing test first. Wire-shape changes go TypeSpec → regen → handler → SDK → FE (never hand-edit generated files).

---

## 1. Audit Decision

**PARTIAL PASS.** The patient-care critical path — **book / walk-in → check-in → linked Visit** — is solid, RBAC-sound, and well-tested (the one real RBAC bypass, PATCH-cancel, was already fixed; the one real contract drift, SCH-DRIFT-001, was already fixed). The backend surface is unusually complete: appointments, public/online booking, holds, waitlist, chairside queue, recall, reminders all exist and pass tests.

The gap is at the **FE seam**: several operationally-important workflows have a fully-built, tested backend with **zero frontend consumer**, and the front desk has **no way to cancel or no-show an appointment at all**. None is a security bypass, so this is not a FAIL — but the missing cancellation path and the unenforced working-hours surface make it not yet production-ready.

---

## 2. Gaps by Severity

### P0 — blocks safe V1
_None._ Core book→check-in→visit works; RBAC gate protects every endpoint (prior audit verified); no authz bypass remains open.

### P1 — fix before production
| ID | Gap | Area | Evidence | Decision |
|----|-----|------|----------|----------|
| **SCH-G1** | **No appointment cancellation in the entire FE.** `cancelAppointment` (DELETE, reason-required, RBAC owner/staff_full) has **0 FE consumers**; there is also no PATCH `status=cancelled` affordance. The only "Cancel" in `appointment-modal.tsx:406` is the dialog **close** button. WF-059 (P1 spec workflow), AC-SCH-004/005 have no UI. Calendars render `cancelled` styling (`calendar-week.tsx:71`, `appointment-card.tsx:86`) that nothing in-product can ever produce. BR-SCH-003 (reason required) is moot — no cancel path exists. | 2,3,4 | App-wide grep: `cancelAppointment` → NONE; calendar affordances = new/walk-in/check-in/confirm/reschedule only. | Direction clear — wire the reason-required DELETE. |
| **SCH-G3** | **Working hours configured in Settings are never enforced (split-brain, cross-module).** Scheduling correctly *reads* the dedicated `dental_branch.working_hours` column for BR-SCH-004 (`createAppointment.ts:59-67` via `org-scheduling.facade.ts`), but the dental-org Settings UI writes a `settings.workingHours` **blob** the column-writer ignores; the column is seed/default only. Result: a clinic edits hours, sees "saved", and out-of-hours bookings are still validated against the *unchanged* default. | 5,7,8 | This is **dental-org G1** (`dental-org-gap-plan.md`) whose **enforcement seam lives here**. `updateWorkingHours` endpoint exists with 0 FE consumers. | Owned by dental-org FE; **proof is a scheduling E2E**. Coordinate single source of truth = the column. |

### P2 — recommended before prod
| ID | Gap | Area | Evidence |
|----|-----|------|----------|
| **SCH-G2** | **No "mark no-show" affordance.** FSM supports `scheduled\|confirmed → no_show`; calendars render no-show styling (`calendar-week.tsx:72`); but no FE triggers the transition. No-show tracking (front-desk + no_show metrics) is impossible from the UI. Pairs with SCH-G1 as "missing terminal-status actions" — likely the same fix surface (an appointment actions menu). | 2,3 | Grep: `noShow`/`no_show` in FE = styling only, no mutation. |
| **SCH-G4** | **Chairside queue board has no enqueue path.** `createQueueItem` has **0 FE consumers**; nothing — not check-in, not walk-in — adds a patient to the queue. The board (`/queue-board`, `use-queue-board.ts`) can only *list* + *advance/cancel* existing items, so it is populated by seed/API only → non-functional as a real chairside tool. | 2,4 | `use-queue-board.ts` calls `listQueueBoard`+`updateQueueItemStatus` only; `createQueueItem` grep → NONE. |
| **SCH-G5** | **Waitlist feature is fully unwired.** `createWaitlistEntry` / `listWaitlist` / `promoteWaitlistEntry` (built + tested, FIFO promote) have **0 FE consumers**. The booking wizard's no-slots branch says *"Please call the clinic"* (`BookingWizard.tsx:201`) instead of offering to join the waitlist — the exact seam the feature was built for. | 2,4 | grep all three ops → NONE; `BookingWizard.tsx:201` `no-slots` copy. |
| **SCH-G6** | **Online-booking confirmation lookup unwired.** `getOnlineBooking` (`GET /dental/bookings/:confirmationCode`) has 0 FE consumers — a patient who books online cannot look their booking back up by code. | 4 | grep `getOnlineBooking` → NONE. |

### P3 — polish / deferred
| ID | Gap |
|----|-----|
| **SCH-G7** | **Reminder self-confirm token has no FE landing page.** `confirmAppointmentByToken` (`POST /dental/appointments/:id/confirm/:token`) has no route — a reminder email's confirm link lands nowhere. Gated behind the **flag-off** `dental_scheduling_sms_reminder` (phase-2), so deferred with the reminder workstream. |
| **SCH-G8** | **Portal patient appointment view is read-only.** `my-appointments-view.tsx` only displays status; patients cannot self-cancel or self-reschedule. May be intended for V1 (online booking is the only patient write path). `[NEEDS CONFIRMATION]` |
| **SCH-G9** | **Recall "due" endpoint default silently drops OVERDUE recalls** (defaults `from`=today). The FE *works around* it with a `2000-01-01` floor (`use-recall-due-list.ts`), but a different consumer would miss exactly the patients who most need outreach. Tighten the backend default or document the contract. |
| **SCH-G10** | **BR-SCH-003 PATCH-cancel reason asymmetry** (carry-forward). DELETE requires reason (422); PATCH `status=cancelled` accepts blank (200, an existing test encodes this). Becomes **moot/auto-resolved** when SCH-G1 wires the reason-required DELETE as the FE cancel path — fold the decision into G1. |
| **SCH-G11** | **Seed emits free-text `visitType`** (e.g. "Sensitivity follow-up") violating the `VisitType` enum the create handler correctly enforces (V-SCH-007 → 400). Seed-coherence, not a handler bug. |
| **SCH-G12** | **Backend adversarial test-depth gaps** (carry-forward, presence-verified only): online-booking `source='online'`+`pending` provenance, queue illegal-transition 4xx, waitlist FIFO tie-break, hold-expiry race, and the PATCH-reschedule **outside-working-hours 422** path (create path is covered; PATCH re-validation is not). |

> **DO-NOT-FIX (phase-2, default-false flags):** automated SMS/email reminders (WF-080/WF-081, `dental_scheduling_sms_reminder`) and pg-boss slot generation (WF-061, `dental_scheduling_slot_generation`, G-001). Out of scope per MODULE_SPEC §18.

---

## 3. Recommended Fix Order

Safest, highest-trust-value first. Honesty-of-affordance before building new backend wiring.

1. **SCH-G1 — wire appointment cancellation** (reason-required DELETE) into the calendar/modal as an explicit action. Closes WF-059 + AC-SCH-004/005, makes the existing `cancelled` styling reachable, and **auto-resolves SCH-G10** (use the path that mandates the reason). Highest operational value, self-contained in scheduling FE.
2. **SCH-G2 — add "mark no-show"** on the same appointment-actions surface introduced in step 1 (cheap once the menu exists).
3. **SCH-G3 — working-hours enforcement** (cross-module with dental-org). Make the `dental_branch.working_hours` column the single source of truth: point Settings at `updateWorkingHours`, seed the column, and prove enforcement with an out-of-hours booking E2E from the scheduling side. Coordinate via `dental-org-gap-plan.md` G1.
4. **SCH-G4 — queue enqueue.** Add a "Send to queue" affordance (from check-in and/or walk-in) calling `createQueueItem`, so the board has a real entry point.
5. **SCH-G5 — waitlist wiring.** Surface "Join waitlist" in the booking wizard's no-slots branch + a staff waitlist panel with FIFO promote.
6. **SCH-G6 → SCH-G8 → SCH-G9** — confirmation lookup, portal self-service (pending product decision), recall-default tightening.
7. **SCH-G12** — backend adversarial test-depth pass (no behavior change; pure coverage).
8. **SCH-G7** — reminder token landing page (deferred with the phase-2 reminder workstream).
9. **SCH-G11** — seed enum hygiene (route seeded appointments through the validator or constrain the seed).

---

## 4. Dependencies on Other Modules

| Fix | Depends on / touches | Note |
|-----|----------------------|------|
| **SCH-G1** | **dental-visit** (BR-004: cancel must NOT delete a linked visit — AC-SCH-005) | Cancel UI is scheduling-local; the invariant it must preserve lives in dental-visit. |
| **SCH-G3** | **dental-org** (Settings FE + `updateWorkingHours`) + **seed** | This is dental-org G1; enforcement seam is `createAppointment`/`org-scheduling.facade`. Single source of truth = the column. |
| **SCH-G4** | **dental-visit** (check-in is the natural enqueue trigger) + **dental-patient** (patient lookup for queue display) | Decide whether enqueue is automatic at check-in or an explicit action. |
| **SCH-G5** | **notifs** (promote → notify patient a slot opened) | Promote-from-waitlist is most useful with a notification; can ship without and add later. |
| **SCH-G6 / SCH-G8** | **portal** + **person** | Patient-facing surfaces; G8 needs a product decision before building. |
| **SCH-G7** | **notifs / email** + reminder flag | Token landing page only matters once reminders are enabled. |

Spec-first reminder: SCH-G1/G3/G4/G5 that alter request/response shapes must regenerate the SDK and re-gate the full typecheck + contract suite (the 8-file MinIO/Mailpit infra baseline is expected-fail and unrelated).

---

## 5. Tests Required Before "Fixed"

A gap is not closed until its named test goes RED-before / GREEN-after and the full gate stays green (`bun test` per-file via `scripts/test-with-db.ts` + api-ts `bunx tsc` + contract + FE unit + lint/boundaries).

| Gap | Required tests (write failing first) |
|-----|--------------------------------------|
| **SCH-G1** | (a) **FE unit/E2E**: a scheduled appointment exposes a Cancel action → entering a reason calls `cancelAppointment` (DELETE) → row renders `cancelled`. (b) **FE unit**: cancel **without** a reason is blocked client-side (mirrors 422 REASON_REQUIRED). (c) **Integration** (regression of AC-SCH-005): after cancel, the linked Visit is still accessible (BR-004). |
| **SCH-G2** | **FE unit/E2E**: scheduled/confirmed appointment → "Mark no-show" → `updateAppointment {status:'no_show'}` → no-show styling; assert a checked-in appointment cannot be marked no-show via the UI (FSM). |
| **SCH-G3** | (a) **E2E**: owner sets working hours in Settings → a non-walk-in booking outside those hours is rejected `OUTSIDE_WORKING_HOURS`; a walk-in bypasses (BR-SCH-002). (b) **FE unit**: Working Hours save calls the dedicated mutation, not the settings-blob mutation. (c) **Seed test**: demo branch `working_hours` column is populated. (shared with dental-org G1) |
| **SCH-G4** | (a) **FE unit/E2E**: "Send to queue" calls `createQueueItem`; item appears on the board in `waiting`. (b) **Contract**: enqueue → list round-trip is branch-scoped. |
| **SCH-G5** | (a) **FE unit/E2E**: no-slots branch offers "Join waitlist" → `createWaitlistEntry`; staff panel lists + FIFO-promotes (`promoteWaitlistEntry`). (b) **Contract**: promote respects FIFO order + branch scope. |
| **SCH-G6** | **FE unit**: confirmation-code lookup renders the booking via `getOnlineBooking`; unknown code → not-found state. |
| **SCH-G9** | **Contract**: `listDueRecalls` with no `from` returns overdue recalls (or the contract documents the today-floor and the FE floor is the agreed mitigation). |
| **SCH-G10** | Auto-resolved by SCH-G1; otherwise a contract test asserting PATCH `status=cancelled` requires a reason (and the two transition tests at `dental-scheduling-transitions.test.ts:370,383` are updated to pass a reason). |
| **SCH-G12** | Backend adversarial: online booking lands `source='online'`+`confirmationState='pending'`; queue illegal transition → 4xx; waitlist FIFO tie-break; **PATCH-reschedule outside working hours → 422**. |

Regression guard: extend `apps/dentalemon/tests/smoke/dental-scheduling_smoke.py` (or add one) so a future pass cannot regress the cancellation/no-show affordances or re-introduce a "saved-but-not-enforced" working-hours surface (assert the downstream effect, not just a toast).

---

## 6. Open `[NEEDS CONFIRMATION]` Items (block the relevant fixes)

1. **SCH-G2 cancellation vs no-show semantics** — confirm the front desk needs both a Cancel (with reason) and a separate Mark-no-show action on the calendar (assumed yes; both are in the FSM).
2. **SCH-G4 queue enqueue trigger** — automatic at check-in, or an explicit "Send to queue" action, or both? Determines whether dental-visit's check-in handler changes.
3. **SCH-G5 waitlist scope for V1** — ship patient self-join in the booking wizard, staff-only management, or both?
4. **SCH-G8 portal self-service** — are patients allowed to cancel/reschedule their own appointments from the portal in V1, or is online booking the only patient write path (current behavior)?
5. **SCH-G9 recall default** — change the backend `listDueRecalls` `from` default to include overdue, or ratify the today-floor + the FE `2000-01-01` workaround as the contract?
6. **Pass scope** — P1 only (G1, G3) / P1+P2 (G1–G6) / everything wireable (G1–G9, +G11/G12 hygiene).

---

## 7. Evidence Index
- Backend traceability (READY): `docs/audits/modules/MODULE_dental-scheduling_AUDIT_2026-06-08.md`
- Workflow-verification (GREEN, SCH-DRIFT-001): `docs/audits/workflow-verification/runs/dental-scheduling/REPORT.md`
- FE wiring map (this audit): calendar `routes/_dashboard/calendar.tsx` (book/walk-in/check-in/confirm/reschedule/recare — no cancel/no-show); `features/scheduling/components/appointment-modal.tsx` (create/reschedule + double-booking warning; "Cancel" = dialog close); `features/scheduling/hooks/use-queue-board.ts` (list+advance, no enqueue); `features/booking/BookingWizard.tsx:201` (no-slots → "call the clinic", no waitlist); `features/portal/components/my-appointments-view.tsx` (read-only).
- Unwired backend ops (0 FE consumers): `cancelAppointment`, `confirmAppointmentByToken`, `getOnlineBooking`, `createWaitlistEntry`, `listWaitlist`, `promoteWaitlistEntry`, `createQueueItem`, `getAppointment`, `updateWorkingHours`.
- Cross-module: `docs/audits/module-gap-plans/dental-org-gap-plan.md` (G1 working hours).

---

## 8. Test Coverage Review (TDD addendum, 2026-06-09)

> Deepens §5. Adds the per-layer test inventory, the missing-test matrix, and the test-dependency-driven order changes. Method: full test inventory (KG/Explore) + ground-truth greps. Nothing in §1–§7 is removed; uncertain items are flagged `[NEEDS CONFIRMATION]`.

### 8.1 Existing Tests Found

**Backend (21 files — unusually deep, near-complete surface):**
- FSM/transitions: `appointment.fsm.property.test.ts`, `dental-scheduling-transitions.test.ts`, `appointment-confirm.test.ts`
- Acceptance workflows: `acceptance.scheduling-workflows.test.ts` — **AC-SCHED-01** notif fires, **AC-SCHED-02** check-in→draft visit (patientId+branchId), **AC-SCHED-03 cancel preserves linked visit (BR-004)**, AC-SCHED-04 walk-in, AC-SCHED-05 date filter
- RBAC: `rbac-scheduling.test.ts` (role gates per endpoint)
- Online/public booking: `online-booking.test.ts` — availability (subtracts appts+holds), hold lifecycle, double-book block, **outside-working-hours on CREATE**, requirePatientAuth gate, match-or-create, concurrency, lookup, check-in→draft visit
- Working hours/timezone: `dental-scheduling.working-hours.test.ts`; availability units: `availability.unit.test.ts`
- Waitlist/queue: `dental-waitlist.test.ts`, `dental-queue.test.ts`
- Notif/reminders: `createAppointment.notif.test.ts`, `confirmAppointmentByToken.test.ts`, `jobs/reminderArmer.test.ts`, `utils/resolve-reminder-channels.test.ts`, `domain-events.test.ts`
- Repo: `repos/dental-appointment.test.ts`
- **Real-wiring guards** (per `feedback_test_verification`): `*-route-registration.test.ts` (public-booking, queue, reminders, waitlist)

**Contract:** `specs/api/tests/contract/dental-scheduling.hurl` — create / get / update / check-in / cancel(DELETE) / list / walk-in.

**Frontend (12 files):** `calendar-day|week|month.test.ts`, `appointment-card.test.ts`, `appointment-modal.test.ts`, `queue-board.test.ts`, `check-in-flow.test.ts`, `recall-due-list.test.ts`, hooks `use-appointments|use-queue-board|use-recall-due-list.test.ts`, util `appointment-layout.test.ts`.

**E2E (10):** `journeys/17-scheduling-booking.journey.spec.ts` (J17 — front-desk books through calendar UI + independent API read), `calendar.spec.ts`, `walk-in.spec.ts`, `online-booking.spec.ts`, `role-gates-scheduling.spec.ts`, `recall-due-list.spec.ts`, `ipad-calendar.spec.ts`, `calendar-overlap.spec.ts`, `patient-checkin.spec.ts`, `calendar-riley.spec.ts`.

**Shape of the hole:** backend is well-covered; gaps are FE-affordance-absent (cancel/no-show/enqueue/waitlist/lookup) + one cross-module split-brain (working hours) + a small backend adversarial tail + **one piece of test-debt that currently locks in a bug** (G10).

### 8.2 Missing Backend Tests
| Gap | Missing test | Priority |
|-----|--------------|----------|
| **G10** | **Revise** `dental-scheduling-transitions.test.ts:370,383` — they currently assert PATCH `status=cancelled` *without* reason → **200** (verified). Decide reason policy, re-encode RED→GREEN. | **P0** |
| **G3/G12** | PATCH-reschedule **into** outside-working-hours → 422 (CREATE path covered in `online-booking.test.ts`; PATCH re-validation is not). | P1 |
| **G3** | Demo branch `working_hours` **column** populated (not null/default-only) — source-of-truth seed test. | P2 |
| **G12** | Online booking lands `source='online'`+`confirmationState='pending'` (provenance); queue illegal-transition → 4xx; hold-expiry race; waitlist FIFO **tie-break** (presence-verified only). | P1/P2 |
| **G11** | Seed-coherence: seeded appointments' `visitType` ∈ `VisitType` enum (route seed through validator). | P2 |

### 8.3 Missing Frontend Tests
| Gap | Missing test | Priority |
|-----|--------------|----------|
| **G1** | Scheduled appt → Cancel action → reason entry → `cancelAppointment` (DELETE) called → row renders `cancelled` on refetch. | **P0** |
| **G1** | Cancel with **blank reason blocked client-side** (mirrors 422 `REASON_REQUIRED`). | P1 |
| **G1** | Cancel action **hidden/blocked for scheduling-only role** (FE side of `rbac-scheduling`). | P1 |
| **G2** | Scheduled/confirmed → "Mark no-show" → `updateAppointment {status:'no_show'}` → no-show styling. | P1 |
| **G2** | Checked-in appt **cannot** be marked no-show from UI (action hidden). | P2 |
| **G3** | Settings Working Hours save calls `updateWorkingHours` (column), **not** the `settings.workingHours` blob. | P1 |
| **G6** | Confirmation-code lookup renders booking via `getOnlineBooking`; unknown code → not-found state. | P2 |
| **G9** | `useRecallDueList` applies far-past floor (`use-recall-due-list.ts:36`) so overdue recalls surface — lock the workaround. | P2 |

### 8.4 Missing Integration / API (Contract) Tests
| Gap | Missing test | Priority |
|-----|--------------|----------|
| **G4** | Enqueue (`createQueueItem`) → list round-trip is **branch-scoped**. | P2 |
| **G5** | `promoteWaitlistEntry` respects **FIFO + branch scope**. | P2 |
| **G9** | `listDueRecalls` with no `from` returns **overdue** (or contract ratifies the today-floor + FE floor as the agreed mitigation). | P2 |

### 8.5 Missing E2E Tests
| Gap | Missing test | Priority |
|-----|--------------|----------|
| **G3** | **(THE big one)** Owner sets Working Hours in Settings → out-of-hours **non-walk-in** booking rejected `OUTSIDE_WORKING_HOURS`; walk-in bypasses (BR-SCH-002). Spans dental-org; proof lives here. | **P0** |
| **G1** | Cancel **from the calendar UI** → linked Visit still reachable (BR-004 downstream — backend AC-SCHED-03 exists, UI→data path untested). | P1 |
| **G1** | Cancel action absent for scheduling-only role (E2E RBAC). | P1 |
| **G2** | Mark-no-show through the UI → status + styling round-trip. | P1 |
| **G4** | "Send to queue" → `createQueueItem` → item appears on board in `waiting`. | P1 |
| **G5** | No-slots branch → "Join waitlist" → `createWaitlistEntry`; staff panel FIFO-promote. | P1 |
| **G7** | Confirm-by-token link lands on a page → `confirmAppointmentByToken` (deferred w/ `dental_scheduling_sms_reminder` flag-off). | P3 |
| **G8** | `[NEEDS CONFIRMATION]` Portal self-cancel/reschedule, pending product decision. | P3 |

### 8.6 Regression Tests Required Per Gap
- **G1:** keep AC-SCHED-03 (cancel→visit preserved) green; add the UI-driven cancel→visit-reachable E2E; **revise the G10 transitions tests** so reason policy is enforced not contradicted.
- **G2:** FSM guard — UI cannot drive an illegal `→ no_show`.
- **G3:** the §8.5 E2E becomes the permanent anti-split-brain guard (assert the *rejection*, not a toast); plus the column-populated seed test.
- **G4/G5:** branch-scope contract tests prevent cross-tenant leakage on the newly-wired write paths.
- **G9:** FE-floor unit test locks the overdue-recall workaround against refactors.
- **Infra:** **new `apps/dentalemon/tests/smoke/dental-scheduling_smoke.py`** (none exists today — verified) asserting cancel + no-show affordances and working-hours-enforced downstream, so a future sweep cannot silently regress them.

### 8.7 Updated Test-First Fix Sequence
1. **G3 (RED gate, first):** write the failing out-of-hours-enforcement E2E (§8.5). Leave RED — it gates the cross-module fix.
2. **G10/G1(a):** revise `transitions.test.ts:370,383` to the chosen reason policy (RED) → smallest API change → GREEN.
3. **G1(b):** FE Cancel-action test (RED) → wire reason-required DELETE → GREEN; add blank-reason-blocked unit, cancel→visit E2E, RBAC-hidden test.
4. **G2:** no-show FE/E2E (RED) → add to same actions menu → GREEN; add checked-in guard.
5. **G3 (finish):** FE mutation-swap unit (RED) → point Settings at `updateWorkingHours` + seed column → step-1 E2E flips GREEN; add PATCH-reschedule-outside-hours 422 backend test.
6. **G4:** enqueue FE/E2E + branch-scope contract (RED→GREEN).
7. **G5:** waitlist FE/E2E + FIFO contract (RED→GREEN).
8. **G6/G9:** confirmation-lookup FE unit; recall-overdue contract + FE-floor regression.
9. **G12:** backend adversarial depth (provenance, queue illegal-transition, hold-expiry race).
10. **Smoke:** add `dental-scheduling_smoke.py`.
11. **G11/G7/G8:** seed enum hygiene; token landing (deferred); portal self-service (`[NEEDS CONFIRMATION]`).

### 8.8 Fix-Order Adjustments (vs §3)
1. **G10 is promoted from "auto-resolved later" to a P0 step inside G1.** The two transitions tests at `:370/:383` *pass today* while asserting blank-reason PATCH-cancel → 200; they protect the exact asymmetry G1 removes. Decide the policy and revise them RED→GREEN **before** building the FE, or G1's "reason-required" intent is silently contradicted at the API.
2. **G3 enforcement E2E moves to position #1** as a standing RED gate (highest-risk: saved-but-not-enforced; cross-module — write the failing test now so the dental-org fix is verifiable from here).
3. **G12's PATCH-reschedule-outside-hours test co-locates with G3** (step 5), not at the tail — same surface, cheap, closes the create/PATCH re-validation asymmetry in one pass.
4. Remainder of §3 order is unchanged.

---

## 9. Knowledge Graph Validation (2026-06-09)

> Validates §1–§8 against actual code relationships. No re-audit, no re-TDD, no fixes. Nothing above is removed; uncertain items flagged `[NEEDS CONFIRMATION]`.

### 9.1 Knowledge Graph Validation Summary

**Graph used:** existing `.understand-anything/knowledge-graph.json` (4,570 nodes / 10,336 edges) **was not rebuilt.** Its `meta.json` baseline is commit `1196799b` — **89 commits stale** vs HEAD `e49e411d`, with >30 structurally-changed scheduling source files. That is unambiguously the auto-update hook's `FULL_UPDATE` class (the hook recommends `/understand --full` then stops; it does not incrementally rebuild a change set this large). A full rebuild was previously measured at ~12M tokens / 60–90 min and was declined for poor ROI; a *validation* pass does not warrant it, and the staleness is type-import-edge drift, **not** the FE→BE wiring this review needs.

**Authoritative oracle used instead:** `.understand-anything/contract-spine.json` — **regenerated at HEAD (Jun 9 12:24)**, `generatedFrom: [openapi.json, registry.ts, react-query.gen.ts, sdk.gen.ts, apps/dentalemon/src/**]`, 357 operations / 135 with FE consumers. This is the purpose-built `operationId → handler → sdkHooks → FE-consumer` map — exactly the wiring evidence §2/§7 asserts. Every negative ("0 FE consumers") claim was additionally **ground-truthed by grep** (most reliable evidence for absence). Result: **every wiring claim in the saved plan is confirmed; two are refined; four new KG-discovered items are added.**

### 9.2 Confirmed / Adjusted Findings

| Finding | Status | KG Evidence Summary | Action |
|---------|--------|---------------------|--------|
| **SCH-G1** (no cancel in FE) | **Confirmed** | Spine: `cancelAppointment` DELETE → **0 consumers**. Grep `cancelAppointment` in app-src (excl tests) → none. `appointment-modal.tsx:406` "Cancel" = `variant="ghost" onClick={handleClose}` (dialog close). | Proceed as written. |
| **SCH-G2** (no "mark no-show") | **Adjusted (cheaper)** | Spine: `updateAppointment` PATCH already has **2 consumers** (`appointment-modal.tsx`, `routes/_dashboard/calendar.tsx`). Grep `no_show`/`noShow` in FE = **styling/badge only**, no mutation. | Gap confirmed, but the SDK mutation is **already wired** — only the `status:'no_show'` *trigger* is missing, not endpoint plumbing. Pure affordance on G1's actions menu. |
| **SCH-G3** (working hours split-brain) | **Confirmed + deepened** | `createAppointment.ts:59-67` reads the **column** (`branch.workingHours` via `getBranchSchedulingConfig`) for `OUTSIDE_WORKING_HOURS`. `working-hours.tsx:101/118` reads+writes the **`settings.workingHours` blob** via `updateBranchSettingsMutation` (`use-branch-settings.ts:78`), never the column. Spine: **both** `updateWorkingHours` (PUT) **and `getWorkingHours` (GET) = 0 consumers.** | See 9.3 #1 — the fix is a **parallel read+write** redirect, not a write-only swap; fold in dental-org **G1-shape**. |
| **SCH-G4** (queue has no enqueue) | **Confirmed** | Spine: `createQueueItem` POST → **0 consumers**. `use-queue-board.ts` imports `listQueueBoardOptions` + `updateQueueItemStatusMutation` only. | Proceed as written. |
| **SCH-G5** (waitlist fully unwired) | **Confirmed** | Spine: `createWaitlistEntry` / `listWaitlist` / `promoteWaitlistEntry` all **0 consumers**. `BookingWizard.tsx:201` no-slots → "Please call the clinic" (`data-testid="no-slots"`). | Proceed as written. |
| **SCH-G6** (confirmation lookup unwired) | **Confirmed** | Spine: `getOnlineBooking` GET → **0 consumers**. | Proceed as written. |
| **SCH-G7** (token landing page) | **Confirmed** | Spine: `confirmAppointmentByToken` POST → **0 consumers**. Deferred behind flag-off `dental_scheduling_sms_reminder`. | Proceed (P3, deferred). |
| **SCH-G8** (portal read-only) | **Needs Confirmation** | `my-appointments-view.tsx` confirmed display-only (status `case` mapping, no write hooks). Gates on a product decision, not code. | Keep `[NEEDS CONFIRMATION]`. |
| **SCH-G9** (recall overdue floor) | **Confirmed** | `use-recall-due-list.ts:36` `RECARE_DUE_FROM_FLOOR = '2000-01-01'` applied as `from ?? FLOOR` (line 43). Spine: `listDueRecalls` ✅1 consumer. | Proceed as written. |
| **SCH-G10** (PATCH-cancel reason asymmetry) | **Confirmed + blast-radius** | The PATCH path is `updateAppointment` — spine shows its **2 FE consumers** (`appointment-modal` reschedule, `calendar`). A reason-required policy change touches that surface. | See 9.4 — verify time-only reschedule isn't forced to send a cancel reason. |
| **SCH-G11** (seed free-text visitType) | **Needs Confirmation (not KG-checkable)** | Seed runtime values aren't represented in the static graph; carry-forward from seed-coherence. | Verify at seed-run, not via KG. |
| **SCH-G12** (backend adversarial depth) | **Confirmed presence-only** | KG/spine confirm the *endpoints/tests exist*; they cannot assess assertion depth. Carry-forward. | Unchanged. |

### 9.3 New KG-Discovered Risks

1. **`getWorkingHours` (GET) is *also* 0-consumer — G3 is a parallel read+write split, not just a wrong writer.** Settings both reads and writes the `settings.workingHours` blob; the dedicated column endpoints (`getWorkingHours` + `updateWorkingHours`) are *both* dark. A write-only fix (point save at `updateWorkingHours`) would still leave Settings *displaying* the stale blob. The G3 fix must redirect **both** sides (or seed the column and abandon the blob) — and must reconcile with **dental-org G1-shape** (`dental-org-gap-plan.md §8.0`): the blob serializes `{open, start:"HH:mm", end:"HH:mm"}`, which must match the shape `parseWorkingHours`/`isWithinWorkingHours` consume off the column, or enforcement silently no-ops after the swap.
2. **A full parallel generic `booking` module scheduling surface exists and is almost entirely unwired** — `cancelBooking`, `confirmBooking`, `markNoShowBooking`, `rejectBooking`, `getBooking`, `listBookings`, plus `bookingEvents`/`scheduleExceptions`/`timeSlots` all show **0 consumers** in the spine. This is the vertical-neutral template module, **not** a dental-scheduling duplicate to fix — but it confirms the dental stack deliberately models terminal states via dental endpoints (DELETE `cancelAppointment`, PATCH `status:'no_show'`). **G1/G2 must wire the *dental* endpoints, not these generic verbs** (avoids mis-wiring to a parallel table).
3. **`[NEEDS CONFIRMATION]` `BookingWizard.tsx` consumes *both* dental `createOnlineBooking` *and* generic `createBooking`.** The spine lists `BookingWizard.tsx` as the sole consumer of both ops (alongside the dental `getPublicAvailability`/`getPublicBookingConfig`/`createBookingHold`). The public wizard may be double-wired with a dead/parallel generic call — a possible "UI control with no real downstream effect" (area #5) / duplicate path (area #8). Verify which booking path the wizard actually submits before any G5/G6 work touches this file.
4. **"Tests green, workflow absent" (area #6).** `cancelAppointment` has a contract test (`dental-scheduling.hurl` DELETE) **and** a backend AC test (AC-SCHED-03 cancel-preserves-visit), yet **0 FE/E2E** — because no FE path exists to drive. Green backend+contract layers give false confidence the *cancel workflow* is covered. This is precisely why §8.6's `dental-scheduling_smoke.py` (none exists today) is load-bearing, not optional.

### 9.4 Cross-Module Dependencies / Blast Radius (KG-confirmed)

- **G3 ↔ dental-org G1 + G1-shape.** The dental-org plan is *ahead* on this seam: its §8.0 already promotes G1 to a two-part (endpoint **and** shape) fix. Enforcement lives in `createAppointment.ts` (this module); the FE fix lives in dental-org Settings; **the proof E2E lives here.** Single source of truth must be the column, and its serialized shape must satisfy `parseWorkingHours`. Coordinate so the dental-org fix and the scheduling step-1 RED E2E converge.
- **G10 ↔ updateAppointment's 2 consumers.** A reason-required PATCH policy change has a concrete blast radius: `appointment-modal.tsx` (reschedule) and `calendar.tsx`. Confirm a **time-only reschedule** is not forced to supply a *cancellation* reason when the policy lands.
- **G1 ↔ dental-visit AC-SCHED-03** (cancel must not delete linked visit) — unchanged; backend invariant already tested, UI→data path still untested (§8.5).
- **G2/G1 must not bleed into the generic `booking` module** (risk 9.3 #2).

### 9.5 Fix Order Adjustments

**The §8.7/§8.8 sequence stands.** Two KG-driven refinements:

1. **G2 ranks cheaper than written.** `updateAppointment` is already a consumed mutation (2 FE consumers) — the no-show fix is a *pure UI affordance* with ~zero new plumbing. It rightly piggybacks on G1's actions menu (already step 4 in §8.7); no reorder, but scope it as trivial.
2. **G3 is slightly *bigger* than "point Settings at `updateWorkingHours`."** Because `getWorkingHours` is *also* unwired and the blob/column **shapes differ**, the §8.7 step-5 G3 work must (a) redirect the read too (or seed column + drop blob) and (b) absorb dental-org **G1-shape**. Otherwise the step-1 RED enforcement E2E stays RED after a write-only change. No position change — just enlarged scope on the same step.

*(Validation method: contract-spine.json @ HEAD + ground-truth grep; existing KG consulted for node coverage but not rebuilt — see 9.1.)*
