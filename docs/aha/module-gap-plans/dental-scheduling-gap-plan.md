# AHA Module/Group Gap Plan: Dental Scheduling

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Dental Scheduling |
| Module slug | dental-scheduling |
| Type | Business Module |
| Output file | `docs/aha/module-gap-plans/dental-scheduling-gap-plan.md` |
| Primary PRD/spec used | `docs/prd/v3-dentalemon.md` §6.3 (FR3.1–FR3.10) |
| Supporting PRDs/specs used | `docs/prd/BUSINESS_RULES.md` BR-001/004, BR-SCH-001..004; `docs/prd/ACCEPTANCE_CRITERIA.md` AC-SCHED-01..05, AC-SETTINGS-01; `docs/product/modules/dental-scheduling/MODULE_SPEC.md` + `API_CONTRACTS.md`; `docs/product/WORKFLOW_MAP.md` WF-006/007/024/059/060/080/081/089 |
| PRD/spec coverage quality | Strong |
| Paths inspected | `services/api-ts/src/handlers/dental-scheduling/` (19 ops, 31 files, 21 test files); `apps/dentalemon/src/features/scheduling/` + `routes/_dashboard/calendar.tsx` + public `BookingWizard.tsx`; `specs/api/tests/contract/dental-scheduling.hurl` + `online-booking.hurl` |
| PRDs/specs inspected | All above; 43-item requirement checklist extracted |
| KG used | Yes — `contract-spine.json` (2026-06-10); zero-consumer claims grep-verified (cancel + no-show re-verified by orchestrator) |
| KG refreshed | No |
| `/understand-domain` used | Yes (cross-check only) |
| `/understand-domain` refreshed | No |
| Webwright used | No — affordance-absence is statically conclusive; calendar/booking surfaces live-driven in prior smoke (golden path 2026-06-07) |
| Playwright/E2E inspected | Yes (inspected, not run): calendar, walk-in, online-booking, calendar-overlap, ipad-calendar, journeys/17-booking |
| Existing tests inspected | 21 backend files (10.7K LOC, ~262 tests), `dental-scheduling.hurl` (20 req), 12 FE files, 6+ E2E |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | No tests executed; G12 adversarial-depth rows are presence-verified, not line-audited |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| v3 PRD §6.3 | `docs/prd/v3-dentalemon.md` | PRD | Current | FR3.1–3.10: calendar, create/reschedule/cancel, FSM, double-booking policy, walk-in, check-in handoff, working hours |
| Business rules | `docs/prd/BUSINESS_RULES.md` | business rules | Current | BR-001 (no concurrent visits), BR-004 (cancel ≠ visit delete), BR-SCH-001..004 |
| Acceptance criteria | `docs/prd/ACCEPTANCE_CRITERIA.md` | acceptance criteria | Current | AC-SCHED-01..05, AC-SETTINGS-01 |
| Module spec + API contracts | `docs/product/modules/dental-scheduling/` | module spec | Current (reconciled 2026-06-08; queue-FSM naming deviation documented) | FSM, wire-mapping (V-SCH-006/007), G-001 slot-gen deferred |
| Workflow map | `docs/product/WORKFLOW_MAP.md` | workflow spec | Current | WF-006/007/024 + inferred 059/060; reminders WF-080/081 Phase-2 flagged |
| Prior module audit + gap plan + matrix | `MODULE_dental-scheduling_AUDIT_2026-06-08.md`, prior gap plan, matrix rows | prior audit (pre-AHA) | Partially superseded (PATCH-cancel RBAC + working-hours G3 fixed; G1/G2/G4/G5 re-verified open) | row-by-row §3 |

## 3. Expected vs Actual

**Expected (PRD §6.3):** day/week/month calendar with concurrent-appointment layout; create (soft-warn double-booking) / reschedule (hard 409) / **cancel with required reason (FR3.4, P0)**; status FSM incl. no-show mark + revert; walk-in bypassing hours; check-in → visit handoff (BR-001 guarded); per-branch working hours; queue board; waitlist; online self-service booking; Phase-2 reminders.

**Actual:** The backend implements all of it — 19 ops, strict FSM (`APPOINTMENT_TRANSITIONS`), wire-adapter (camelCase↔legacy columns), reason-required cancel with audit + reminder-expiry, FIFO waitlist, queue FSM, TTL booking holds, rate-limited public endpoints, and a reminder armer job (`jobs/reminderArmer.ts:37-106`, idempotent enqueue; SMS flag off per Phase-2). Verified fixed since the matrix: **PATCH-cancel RBAC bypass** (`updateAppointment.ts:45-47` + RED-proven pins `rbac-scheduling.test.ts:369-383`), **working-hours split-brain G3** (FE repointed to enforced column via `use-working-hours.ts`), **calendar branchId bug** (`use-appointments.ts:92-99` gates on branchId), **concurrent layout** (`appointment-layout.ts:38-86` + overlap E2E).

The FE wires: calendar (3 views), create/edit modal with walk-in toggle and double-booking warning surface, confirm, check-in, queue **board** (list + status advance), online BookingWizard (config→availability→hold→commit). What's missing is a cluster of **affordances for backend-complete lifecycle actions**:

1. **Cancel (FR3.4, PRD P0) has zero FE consumers** — `cancelAppointment` unreached; `cancelled` status renders but the UI can never produce it. The asymmetry pin: `dental-scheduling-transitions.test.ts:370,383` locks in that PATCH `status=cancelled` needs **no reason**, while DELETE requires one — a policy fork that must be decided when wiring.
2. **No-show mark/revert: display-only** — `no_show` styling in 4 FE files; zero mutation triggers.
3. **Queue enqueue path absent** — board consumes `listQueueBoard`/`updateQueueItemStatus` but nothing calls `createQueueItem` `[NEEDS CONFIRMATION]` whether check-in auto-enqueues; if not, the board can never gain rows from the product.
4. **Waitlist fully unwired (3 ops)** — BookingWizard's no-slots path hardcodes "Please call the clinic."
5. **Online-booking confirmation lookup (`getOnlineBooking`) + token confirm (`confirmAppointmentByToken`) orphaned** — infrastructure for reminder links/self-lookup, pending notifications Phase-2.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR3.1/WF-024 calendar views | day/week/month + filters + overlap layout | ✓ | calendar route + `appointment-layout.ts:38-86` | `listAppointments` | — | FE tests + overlap E2E | Implemented | No |
| FR3.2/AC-SCHED-01 create + soft-warn | 201 + DOUBLE_BOOKING warning | ✓ | `appointment-modal.tsx:96-100,189-191` | `createAppointment.ts:71-86` | no unique constraint (by design) | backend + hurl + E2E | Implemented | No |
| FR3.3/AC-SCHED-02 reschedule hard-block | 409 RESCHEDULE_CONFLICT | ✓ | modal + drag | `updateAppointment.ts` | — | `dental-scheduling.test.ts:1056-1090` | Implemented | No |
| FR3.4/BR-SCH-003/AC-SCHED-04 cancel + reason | soft-cancel, reason 5–500, visit preserved (BR-004) | ✓BE — **zero FE consumers** | grep `cancelAppointment` FE = 0; no cancel in modal/card | `cancelAppointment.ts:26,36-50,71-75` (reason, RBAC, reminder expiry) | status enum | DELETE hurl :142 + acceptance + RBAC pins — **all backend** | Partially Implemented | **GAP-1** |
| FR3.6/V-SCH-009 FSM incl. no-show + revert | mark no_show; revert→completed | ✓BE — **display-only FE** | `appointment-card.tsx:86` styling; 0 mutation triggers | `APPOINTMENT_TRANSITIONS` (`dental-appointment.schema.ts:96-103`) | enum | FSM property + transitions tests | Partially Implemented | **GAP-2** |
| FR3.7 double-booking policy | create soft / reschedule hard | ✓ (explicit do-not-"fix" note) | warning UI | handlers | — | tests | Implemented | No |
| FR3.8 walk-in | bypass hours; auto-flow | ✓ | modal walk-in toggle :387-395 | `createAppointment.ts:58-67` | walk_in flag | walk-in tests + E2E | Implemented | No |
| FR3.9/WF-007/BR-001 check-in handoff | status→checked_in; create visit; 409 on active | ✓ | calendar check-in | `checkInAppointment.ts` (+ hygienist E3 path) | visit_id FK | AC-SCHED-03 + E2E | Implemented | No |
| FR3.10/AC-SETTINGS-01 working hours | per-branch config drives 422 | ✓ (G3 repoint fixed) | `use-working-hours.ts:22,40` | `workingHours.ts:97-137` (owner-only PUT) | branch column | tz-aware tests :296-350 | Implemented | residual E2E (§20) |
| Queue board | enqueue → called → in_progress → completed | Board ✓; **enqueue path missing** | `queue-board.tsx` + `use-queue-board.ts` (list/status only) | `createQueueItem` 0 consumers | `dental_queue_item` FSM | `dental-queue.test.ts` (10) | Partially Implemented | **GAP-3** |
| Waitlist FIFO | join when full → promote | ✓BE — **zero FE** | `BookingWizard.tsx:201` hardcoded "call the clinic" | 3 ops 0 consumers | `dental_waitlist_entry` | `dental-waitlist.test.ts` (10) | Partially Implemented | **GAP-4** |
| Online booking | public config→availability→hold→book | ✓ | `BookingWizard.tsx` + `use-online-booking.ts` | public handlers + ratelimit + holds | booking_hold TTL | `online-booking.test.ts` + hurl | Implemented | No |
| Booking self-lookup + token confirm | patient revisits via confirmationCode; reminder-link confirm | ✓BE — zero FE | grep = 0 | `getOnlineBooking`, `confirmAppointmentByToken` | — | backend presence | Partially Implemented | GAP-5 (P3, Phase-2-coupled) |
| WF-080/081 reminders | enqueue/expiry cycle; SMS Phase-2 | ✓ armer + expiry-on-change; send-side flag off | — | `reminderArmer.ts:37-106`; expiry in update/cancel | notif rows | reminder tests | Implemented (within phase) | No |
| G-001 slot generation | pg-boss slot gen | Not built — spec-declared deferred (flag default false) | — | — | — | — | Not Required for V1 | No |
| Seed visitType conformance | seeded appts use enum | Seed emits free-text visitType | — | `appointment-wire.ts:18` enum | — | no conformance assert | Partially Implemented | GAP-7 (P3) |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| FR3.4 cancel | **GAP-1**: no cancel affordance anywhere — PRD-P0 lifecycle action unreachable; `cancelled` filter/styling misleading | P1 | V1 REQUIRED | grep = 0; backend complete + RBAC-pinned | Cancel action (card/modal) w/ reason dialog → DELETE path; RED-first FE test; resolve GAP-6 policy in same change |
| FR3.6 no-show | **GAP-2**: no mark-no-show / revert affordance — front-desk daily ritual missing; styling implies feature exists | P2 | V1 REQUIRED | 0 mutation triggers; FSM ready | "No show" action on past-due appointments + revert; FE RED |
| Queue intake | **GAP-3**: `createQueueItem` zero consumers — board may be unfillable from product `[NEEDS CONFIRMATION]` whether check-in auto-enqueues | P2 | V1 REQUIRED (if no auto-enqueue) | spine + grep; `use-queue-board.ts` lacks create | Confirm intake path; if absent, enqueue on check-in (or explicit button) |
| Waitlist | **GAP-4**: 3 ops unwired; BookingWizard dead-ends with hardcoded text | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` (wire vs park) | `BookingWizard.tsx:201` | If wire: waitlist join on no-slots + staff list/promote view; if park: keep honest text, document dormant |
| Cancel policy fork | **GAP-6**: PATCH `status=cancelled` requires no reason (test-pinned) while DELETE does — contradictory policy | P2 | V1 REQUIRED (decide with GAP-1) | `dental-scheduling-transitions.test.ts:370,383` vs `cancelAppointment.ts:46-50` | Pick one canonical cancel path; align tests RED→GREEN |
| Self-lookup/token confirm | **GAP-5**: `getOnlineBooking` + `confirmAppointmentByToken` orphans | P3 | V2 DEFERRED (needs reminder sends, Phase-2) | grep = 0 | Park; wire with notifications phase |
| Seed integrity | **GAP-7**: seed bypasses visitType enum | P3 | V1 RECOMMENDED | SCH-G11 | Fix seed values + conformance assert |
| Test depth | **GAP-8**: adversarial edges unpinned (hold-expiry race, queue illegal-transition 4xx, PATCH-reschedule outside-hours re-validation); no scheduling smoke tool | P3 | V1 RECOMMENDED `[TEST GAP]` | prior audit G12; `/smoke/` lacks scheduling | Add pins during related fixes; smoke tool with GAP-1/2 |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Online booking pipeline (public config/availability/holds/book) | wired + tested | PRD lists online booking; phase ambiguity minor | Low — live and working | Keep |
| Waitlist backend | 10 tests | PRD mentions waitlist thinly | seeded-orphan class | GAP-4 decision; do not expand `[DO NOT OVERBUILD]` |
| Queue board | wired (board) | spec'd with naming deviation documented | intake gap | GAP-3 |
| Token-confirm infrastructure | handler only | Phase-2 reminder links | none | Park (GAP-5) |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Book → calendar (WF-006) | staff | call/walk-in | search → create (soft-warn) → slot | Implemented | No | E2E |
| Check-in → visit (WF-007) | staff | arrival | check-in → visit active → workspace | Implemented | No | AC-SCHED-03 |
| Cancel w/ reason (WF-059) | staff_full/owner | patient cancels | cancel + reason → slot freed → visit preserved | Backend only | **GAP-1** | 0 consumers |
| No-show day-end sweep | staff | patient absent | mark no_show → (revert if wrong) | Backend only | **GAP-2** | display-only |
| Chairside queue | staff | check-in | enqueue → called → in progress | Board only (intake unclear) | **GAP-3** | 0 create consumers |
| Full-day waitlist | patient/staff | no slots | join → promote on opening | Backend only | **GAP-4** | hardcoded dead-end |
| Online self-booking | patient | website | wizard → hold → pending booking → staff confirm | Implemented | No | wizard + tests |
| Reminder cycle | system | T-24h | arm → send (flag off) → token confirm | Armed; send Phase-2 | No (in-phase) | armer job |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Soft-warn on create overlap | 201 + warning surfaced | Implemented | modal warning | V1 REQUIRED | done |
| Hard-block on reschedule | 409 | Implemented | tests | V1 REQUIRED | done |
| Cancel + reason + audit + reminder expiry | DELETE path | Implemented (BE) / Missing (FE) | GAP-1 | V1 REQUIRED | |
| No-show mark + revert | FSM actions | Implemented (BE) / Missing (FE) | GAP-2 | V1 REQUIRED | |
| Check-in → BR-001 guard → visit | 409 w/ device context | Implemented | checkIn handler | V1 REQUIRED | done |
| Queue intake | enqueue on check-in or button | Unclear | GAP-3 | V1 REQUIRED | confirm |
| Waitlist join/promote | FIFO | Implemented (BE) / Missing (FE) | GAP-4 | V1 RECOMMENDED | decision |
| Working-hours validation + walk-in bypass | 422 / bypass | Implemented | tz tests | V1 REQUIRED | done |
| Booking hold TTL cleanup | expire holds | Implemented | `jobs/holdCleanup.ts` | V1 REQUIRED | done |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| See today/week at a glance | all roles | calendar w/ overlaps | Implemented | No | V1 REQUIRED | E2E |
| Book/reschedule | staff | modal flows | Implemented | No | V1 REQUIRED | E2E |
| Cancel an appointment | staff_full/owner | reason-gated cancel | Missing (BE ready) | GAP-1 | V1 REQUIRED | 0 consumers |
| Track no-shows | staff | mark + revert | Missing (BE ready) | GAP-2 | V1 REQUIRED | display-only |
| Run the chairside queue | staff | enqueue + advance | Partially | GAP-3 | V1 REQUIRED | board only |
| Handle full days | staff/patient | waitlist | Missing (BE ready) | GAP-4 | V1 RECOMMENDED | dead-end text |
| Patient books online | patient | wizard | Implemented | No | V1 REQUIRED | wizard tests |
| Walk-in off-hours | staff | bypass | Implemented | No | V1 REQUIRED | tests |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-1 cancel affordance | FE affordance | P1 | V1 REQUIRED | grep = 0 | PRD-P0 lifecycle action; staff must use API or leave ghost appointments; cancelled-status UI is a fiction | Cancel action + reason dialog; bundle GAP-6 policy decision |
| GAP-2 no-show affordance | FE affordance | P2 | V1 REQUIRED | display-only | No-show tracking drives recall/follow-up trust | Mark/revert actions |
| GAP-3 queue intake | FE/flow wiring | P2 | V1 REQUIRED | 0 create consumers | Board that can't gain rows = misleading surface | Confirm/auto-enqueue on check-in |
| GAP-6 cancel policy fork | API consistency | P2 | V1 REQUIRED | contradictory tests | Wiring GAP-1 against the wrong path bakes in reason-less cancels | Decide DELETE-canonical (likely) + align |
| GAP-4 waitlist | FE affordance | P2 | V1 RECOMMENDED (decision) | dead-end text | Lost bookings on full days | wire-or-park |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Patient calls to cancel | Staff cancels w/ reason | No affordance; ghost appointment persists | GAP-1 | P1 | FE-unit + E2E cancel |
| Day-end no-show sweep | Mark absentees | Impossible from UI | GAP-2 | P2 | FE-unit mark/revert |
| Patient checked in → appears on queue board | Row appears | `[NEEDS CONFIRMATION]` — likely never | GAP-3 | P2 | E2E check-in → board |
| Full day → offer waitlist | Join waitlist | "Please call the clinic" | GAP-4 | P2 | decision-dependent |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `cancelAppointment` | API, 0 FE | spine+grep | P1 gap | Wire (GAP-1) |
| no-show mutation path | FE trigger absent | grep | P2 gap | Wire (GAP-2) |
| `createQueueItem` | API, 0 FE | same | board intake | GAP-3 |
| `createWaitlistEntry`/`listWaitlist`/`promoteWaitlistEntry` | API ×3, 0 FE | same | decision | GAP-4 |
| `getAppointment` | API, 0 FE | same | none (list covers) | document |
| `getOnlineBooking`, `confirmAppointmentByToken` | API ×2, 0 FE (public infra) | same | Phase-2 coupled | Park (GAP-5) |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Wire-adapter dual naming managed (`appointment-wire.ts`) | API | docs + code | — | none (documented design) |
| No DB unique constraint on dentist+time — intentional (FR3.7) | schema | spec note "do not add" | — | none `[DO NOT OVERBUILD]` |
| Booking holds TTL + cleanup job | schema/job | `holdCleanup.ts` | — | none |
| Seed visitType free-text vs enum | seed data | SCH-G11 | P3 | GAP-7 |
| PATCH vs DELETE cancel asymmetry | API | transitions tests | P2 | GAP-6 |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| PATCH-cancel RBAC bypass FIXED + RED-proven pins | write guards | `updateAppointment.ts:45-47`; `rbac-scheduling.test.ts:369-383` | — | none — do not re-litigate |
| Cancel restricted owner/staff_full (EM-SCH-001) | write guards | `cancelAppointment.ts:36-38` | — | none |
| Public endpoints rate-limited, unguessable confirmation codes | public surface | `public-booking-ratelimit.ts` | — | none |
| Branch scoping uniform | tenancy | per-handler asserts | — | none |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Cancel preserves visit (BR-004) + reason audited | appointment history | acceptance test | — | none |
| DE-010/011 audit markers on book/cancel | event trail | handlers | — | none |
| Reminder expiry on reschedule/cancel prevents stale sends | notification integrity | `updateAppointment.ts:156-160`, `cancelAppointment.ts:71-75` | — | none (good) |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| 12/19 ops wired; 7 orphans = exactly the lifecycle-affordance cluster (cancel, queue-create, waitlist×3, self-lookup×2) | spine + grep | Gap class identical to billing/clinical: backend-complete affordances | §5 |
| Check-in handoff crosses into dental-visit (`visitService.createVisit`) | WF-089 | BR-001 conflict UX owned jointly | no change needed |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Cancellations + no-shows are the front desk's highest-frequency exception flow | PRD §5.4/J-flows | GAP-1/2 hit daily operations | P1/P2 |
| PH clinics run on walk-ins + phone; online booking is growth surface | personas | wizard already live — good | none |
| Queue board mirrors physical whiteboard ritual | queue spec | GAP-3 intake makes-or-breaks it | confirm |

## 18. Webwright / Playwright Findings

Not used this round — affordance absence is statically proven; calendar/booking surfaces were live-driven in golden-path smoke (2026-06-07) and overlap E2E. No new evidence saved.

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `appointment.fsm.property.test.ts` + `dental-scheduling-transitions.test.ts` | backend | FSM strictness (note: encodes GAP-6 asymmetry) | High |
| `rbac-scheduling.test.ts` | backend/security | cancel RBAC incl. RED-proven PATCH pins | High |
| `dental-scheduling.working-hours.test.ts` | backend | tz-aware boundaries, walk-in bypass | High |
| `dental-queue.test.ts` (10), `dental-waitlist.test.ts` (10), `online-booking.test.ts` | backend | unreachable/partially-reachable surfaces | High (backend reach) |
| reminder armer/expiry tests | backend | enqueue idempotency, expiry | High |
| `dental-scheduling.hurl` (20 req) + `online-booking.hurl` | contract | CRUD, check-in, cancel DELETE, booking | High |
| FE: modal, card, calendar-day/week/month, check-in-flow, queue-board, hooks, `appointment-layout` | frontend | wired surfaces | Medium-High |
| E2E: calendar, walk-in, online-booking, calendar-overlap, ipad, journeys/17 | E2E | core journeys; **no cancel/no-show/queue/waitlist E2E** | High for covered |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Cancel FE: action visible (role-gated), reason required, slot freed, visit preserved | frontend/component + E2E | GAP-1 RED-first | Before |
| No-show FE: mark on past appointment; revert | frontend/component | GAP-2 RED-first | Before |
| Check-in → queue-board row appears | E2E | GAP-3 intake proof | Before/during |
| Cancel-policy alignment (PATCH vs DELETE) RED→GREEN | backend | GAP-6 | With GAP-1 |
| Waitlist join/promote FE (if wired) | frontend + E2E | GAP-4 | Post-decision |
| Hold-expiry race; queue illegal-transition 4xx; PATCH-reschedule outside-hours re-validation | backend adversarial | GAP-8 depth | During related work |
| Seed visitType conformance assert | seed-coherence | GAP-7 | Anytime |
| Working-hours full FE→422 E2E (settings save → booking rejected) | E2E | G3 residual | Anytime |
| `dental-scheduling` smoke tool | smoke | affordance regression guard (prior audit: "load-bearing") | With GAP-1/2 |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| Check-in → dental-visit createVisit (WF-089, BR-001) | cross-module | `checkInAppointment.ts` | queue intake (GAP-3) likely belongs at this seam | coordinate with dental-visit; no FSM changes |
| Working hours owned by dental-org (branch column) | cross-module | `workingHours.ts` in scheduling, column on branch | G3 repoint done; org audit re-checks settings side | note for dental-org round |
| Reminder sends → notifications module (flag off) | cross-module | armer enqueues notif rows | notifications audit owns delivery/inbox | park GAP-5 with it |
| Recall due-list feeds booking (`use-recall-due-list.ts`) | cross-module | wired | healthy seam | none |
| Cancel policy decision | product decision | GAP-6 | blocks GAP-1 shape | decide in fix batch |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Cancel action (card + modal) w/ reason dialog → DELETE path; deprecate reason-less PATCH cancel | GAP-1+6 | P1 | V1 REQUIRED | FE RED + E2E + backend policy alignment | one batch |
| No-show mark/revert actions on past-due appointments | GAP-2 | P2 | V1 REQUIRED | FE RED | small |
| Queue intake: auto-enqueue on check-in (after confirmation) | GAP-3 | P2 | V1 REQUIRED | E2E | seam w/ dental-visit |
| Waitlist wire-or-park | GAP-4 | P2 | `[NEEDS PRODUCT DECISION]` | FE + E2E if wired | |
| Seed visitType fix + assert | GAP-7 | P3 | V1 RECOMMENDED | seed-coherence | quick |
| Scheduling smoke tool | GAP-8 | P3 | V1 RECOMMENDED | smoke | with batch A |
| Adversarial pins (hold race, queue 4xx, reschedule re-validation) | GAP-8 | P3 | V1 RECOMMENDED | backend | opportunistic |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Slot-generation job (G-001) | V2 DEFERRED | spec-declared; flag default false |
| SMS/email reminder sends + token-confirm + self-lookup UIs | V2 DEFERRED | Phase-2 notifications; armer infra already in place |
| Recurring appointments | V2 DEFERRED | PRD Phase-2 |
| DB unique constraint on dentist+time | DO NOT ADD | FR3.7 explicitly soft-warn by design |
| Event bus for DE-010/011 | DO NOT ADD | ADR-006 audit-log-only |
| Queue FSM renaming to IDEAL names | DO NOT ADD | deviation documented; churn without value `[DO NOT OVERBUILD]` |

## 24. Audit Decision

**PARTIAL PASS.**

The booking core is solid and live: calendar with correct concurrent layout, create/reschedule with the PRD's exact double-booking policy, walk-ins, check-in→visit handoff under BR-001, branch working hours (split-brain fixed), a working public online-booking pipeline, and a reminder-arming job — all on a strictly FSM-guarded, RBAC-pinned backend (262 tests; the prior PATCH-cancel RBAC hole is verified fixed).

It is not a PASS because the exception-handling half of the front desk's day is undeliverable: **cancellation (PRD P0, FR3.4) has no UI**, no-show marking is display-only, the queue board has no confirmed intake path, and the waitlist dead-ends in hardcoded text. These are all wiring gaps onto tested backends; nothing is data-unsafe.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Canonical cancel path — DELETE (reason-required) with PATCH-cancel removed/aligned? | `[NEEDS PRODUCT DECISION]` (lightweight) | GAP-1/6 shape | Eng/Product |
| Q2: Does check-in auto-enqueue to the queue board today? If not, should it? | `[NEEDS CONFIRMATION]` → likely yes-wire | GAP-3 | Eng then Product |
| Q3: Waitlist — wire join/promote now or park? | `[NEEDS PRODUCT DECISION]` | GAP-4 | Product |
| Q4: No-show marking — staff-any or staff_full+? | `[NEEDS CONFIRMATION]` | GAP-2 role gate | Product |

## 26. Notes for Gap Plan Organizer

- **Truly V1 (decision-light):** GAP-1+6 (cancel affordance + policy alignment — one batch), GAP-2 (no-show), GAP-3 (queue intake, after 1 confirmation), GAP-7 (seed), GAP-8 pins + smoke tool.
- **Likely batch shape:** Batch A = cancel (FE + policy + E2E + smoke tool); Batch B = no-show; Batch C = queue intake at check-in seam; Batch D = pins/seed. Waitlist awaits Q3.
- **Blocked until decided:** GAP-4 (Q3); GAP-5 parked with notifications Phase-2.
- **Must NOT implement:** unique time constraint, event bus, slot-gen, queue renaming, recurring appts.
- **Tests first:** cancel FE RED + policy backend RED; no-show FE RED; check-in→board E2E.
- **Cross-module:** queue intake touches check-in handler (dental-visit seam); working-hours settings side re-checked in dental-org round; reminder delivery owned by notifications round.
- **Do not re-litigate:** PATCH-cancel RBAC fix, working-hours repoint, calendar branchId, overlap layout, double-booking policy.

---

Next recommended step:
Module/group: Dental Scheduling
Module slug: dental-scheduling
Primary PRD/spec: docs/prd/v3-dentalemon.md §6.3 + docs/product/modules/dental-scheduling/
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/dental-scheduling-gap-plan.md
