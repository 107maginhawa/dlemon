# AHA Fix-Ready Plan: Dental Scheduling

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/03-organize-gap-plan-for-fixing.md`

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Dental Scheduling |
| Module slug | dental-scheduling |
| Source gap plan | `docs/aha/module-gap-plans/dental-scheduling-gap-plan.md` |
| Output file | `docs/aha/module-fix-plans/dental-scheduling-fix-ready-plan.md` |
| Audit decision | PARTIAL PASS |
| Superpowers used | No — organizer discipline applied via shared rules (§19 Gap Organizer Rules); no Superpowers invocation was needed for sequencing this small, well-shaped gap set |
| Organizer decision | READY |
| Reason | The gap set is a coherent "backend-complete, FE-affordance-missing" cluster on a heavily tested backend (262 backend tests, RBAC pins, FSM property tests). Gap plan §26 already provided organizer-grade batch shapes; all active fixes trace to exact files/greps. Only one true product decision (waitlist wire-or-park, Q3) exists and it is cleanly separable into a blocked item. |
| Limitations | Organizer did not run tests. One new source verification performed (see §2 correction): `checkInAppointment.ts` contains no `createQueueItem` call — gap plan's `[NEEDS CONFIRMATION]` on auto-enqueue is now resolved as **confirmed absent**. Webwright not used (affordance absence is statically proven). |

### Organizer corrections / clarifications to the raw gap plan

1. **Q2 first half resolved (CONFIRMED):** check-in does NOT auto-enqueue today. Grep of `services/api-ts/src/handlers/dental-scheduling/checkInAppointment.ts` shows no `createQueueItem`/queue write (only reminder-expiry at :93). Per the gap plan's own rule ("V1 REQUIRED if no auto-enqueue"), GAP-3 is therefore **V1 REQUIRED and active** (FIX-004). The remaining design choice (auto-enqueue on check-in vs explicit button) is lightweight with a recommended default — see §8.
2. **Smoke tool location:** scheduling smoke tool belongs in `apps/dentalemon/tests/smoke/` (existing pattern: `golden_path_smoke.py`, `patient_registration_smoke.py`, etc.), not a root `/smoke/` dir.
3. **Scheduler/cron note (errata compliance):** no fix in this plan requires any new scheduled job. The reminder armer and hold cleanup already run on the existing scheduler (`services/api-ts/src/core/jobs.ts` registrations). Do not plan or build any scheduler work. `[DO NOT OVERBUILD]`

## 2. Fix Strategy Summary

- **What to fix first:** Batch A — the cancel affordance (GAP-1, the only P1, PRD-P0 requirement FR3.4) bundled with the cancel-policy alignment (GAP-6), because wiring the FE before resolving the PATCH-vs-DELETE fork would bake in reason-less cancels. The scheduling smoke tool rides with Batch A as its regression guard.
- **Then:** Batch B (no-show mark/revert, GAP-2) — small, module-local, same affordance pattern as Batch A. Batch C (queue intake at the check-in seam, GAP-4 fix = GAP-3 gap) — touches the cross-module check-in handler, so isolated into its own batch. Batch D (seed conformance + adversarial test pins, GAP-7/GAP-8 remainder) — low-risk hardening, anytime after A.
- **What not to fix:** waitlist FE (GAP-4 — blocked on product decision Q3), self-lookup/token-confirm UIs (GAP-5 — parked with notifications Phase-2), and everything in §11 Do Not Build (DB unique constraint, event bus, slot-gen job, queue FSM renaming, recurring appointments).
- **Major risks:** (a) FIX-002 changes pinned backend behavior (`dental-scheduling-transitions.test.ts:370,383` currently locks in reason-less PATCH cancel) — tests must be flipped RED→GREEN deliberately, not weakened; (b) FIX-004 touches `checkInAppointment.ts`, which is the BR-001 cross-module seam into dental-visit — enqueue must be additive, with zero FSM or visit-creation changes; (c) do not re-litigate the already-fixed items (PATCH-cancel RBAC, working-hours repoint, calendar branchId, overlap layout, double-booking policy).
- **One pass or multiple:** multiple batches (A → B → C → D), each independently green-gated. A+B could share a `04` pass if Batch A lands cleanly; C must stay separate because of the cross-module seam.
- **Shared/platform/database work:** none. No schema changes, no migrations, no shared-platform files. FIX-004 is cross-module (handler seam) but not shared-platform.
- **Product decisions / environment blockers:** one real product decision (Q3 waitlist) blocks only the deferred GAP-4. Two lightweight ratifications (Q1 cancel-path canonical shape, Q4 no-show role gate) have recommended defaults and can be ratified at batch start. No environment blockers.

## 3. Active Fix Scope

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-1: cancel affordance absent — PRD-P0 lifecycle action (FR3.4) unreachable from UI; `cancelled` status renders but UI can never produce it | P1 | V1 REQUIRED | A | Front desk's highest-frequency exception flow (gap plan §17); ghost appointments persist; backend complete + RBAC-pinned (`cancelAppointment.ts:26,36-50,71-75`) | grep `cancelAppointment` in FE = 0; contract-spine orphan; gap plan §5/§10/§11 |
| FIX-002 | GAP-6: cancel policy fork — PATCH `status=cancelled` requires no reason (test-pinned) while DELETE requires reason 5–500 | P2 | V1 REQUIRED | A (must land with/before FIX-001 FE wiring) | Wiring GAP-1 against the wrong path bakes in reason-less cancels; contradictory policy is an API-consistency trust gap | `dental-scheduling-transitions.test.ts:370,383` vs `cancelAppointment.ts:46-50` |
| FIX-003 | GAP-2: no-show mark/revert affordance absent — display-only styling implies feature exists | P2 | V1 REQUIRED | B | Daily front-desk ritual (day-end sweep); FSM + transitions backend ready (`APPOINTMENT_TRANSITIONS`, `dental-appointment.schema.ts:96-103`) | `appointment-card.tsx:86` styling; 0 mutation triggers (grep) |
| FIX-004 | GAP-3: queue intake path absent — `createQueueItem` has zero consumers; board can never gain rows from product flow | P2 | V1 REQUIRED (confirmation resolved — see §1 correction 1) | C | Queue board mirrors the physical whiteboard ritual; a board that can't fill is a misleading surface | spine + grep; `use-queue-board.ts` lacks create; organizer-verified `checkInAppointment.ts` has no enqueue |
| FIX-005 | GAP-7: seed emits free-text `visitType` bypassing the wire enum | P3 | V1 RECOMMENDED | D | Cheap; prevents seed-vs-contract drift; conformance assert guards regression | `appointment-wire.ts:18` enum vs `scripts/seed-demo.ts`; SCH-G11 |
| FIX-006 | GAP-8a: scheduling smoke tool missing | P3 | V1 RECOMMENDED `[TEST GAP]` | A (rides with cancel work) | Prior audit called affordance smoke "load-bearing"; guards the exact regression class this module suffers from (silent affordance loss) | `apps/dentalemon/tests/smoke/` has 7 tools, none for scheduling |
| FIX-007 | GAP-8b: adversarial backend pins — hold-expiry race, queue illegal-transition 4xx, PATCH-reschedule outside-hours re-validation | P3 | V1 RECOMMENDED `[TEST GAP]` | D (queue 4xx pin may ride with C) | Unpinned edges adjacent to the code being touched in A/C; cheap insurance while context is loaded | prior audit G12; gap plan §20 |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A — Cancel vertical (P1) | Wire cancel affordance end-to-end + align PATCH/DELETE cancel policy + scheduling smoke tool | FIX-001, FIX-002, FIX-006 | Medium — flips two pinned backend tests deliberately; FE + backend + E2E in one vertical | Run in current `04` pass, first. Ratify Q1 recommended default at batch start (lightweight — see §8). |
| Batch B — No-show affordance | Mark no-show on past-due appointments + revert | FIX-003 | Low — FE-only mutation wiring onto existing PATCH FSM path | Run in current or immediately-next `04` pass, after A. Ratify Q4 default at batch start. |
| Batch C — Queue intake at check-in seam | Auto-enqueue on check-in (recommended default) so the queue board fills from the product flow | FIX-004 | Medium — touches `checkInAppointment.ts` (BR-001 cross-module seam into dental-visit); must be additive only | Separate `04` pass (do not bundle with A/B). No FSM changes, no visit-creation changes. |
| Batch D — Hardening (seed + pins) | Seed visitType conformance + adversarial backend pins | FIX-005, FIX-007 | Low — tests + seed data only | Run anytime after Batch A; can trail as cleanup pass. |
| (Blocked) Waitlist | GAP-4 wire-or-park | — | — | Only after product decision Q3 (see §9). Do not start. |

Batch ordering rationale: A first (only P1 + the policy fork must be resolved before any FE cancel wiring exists to copy); B second (same pattern, smallest); C isolated (cross-module seam); D opportunistic.

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-002 | RED: PATCH `status=cancelled` without reason is rejected (or requires reason — per ratified Q1 shape); DELETE remains the reason-gated canonical path | backend/unit + regression | Single canonical cancel policy; the two existing pins at :370,:383 are deliberately flipped, not deleted | UPDATE `services/api-ts/src/handlers/dental-scheduling/dental-scheduling-transitions.test.ts:370,383`; cancel acceptance stays green in `acceptance.scheduling-workflows.test.ts` |
| FIX-001 | RED: appointment card/modal exposes role-gated Cancel action; reason dialog enforces 5–500 chars; submit calls DELETE path; cancelled state renders; visit preserved (BR-004) | frontend/component, then E2E/Playwright | UI can actually produce `cancelled`; reason validation enforced client-side; API and UI agree | NEW `apps/dentalemon/src/features/scheduling/components/cancel-appointment-dialog.test.tsx` (or extend `appointment-card.test.ts` / modal tests); NEW E2E cancel spec alongside existing calendar specs |
| FIX-001 | Contract: DELETE cancel already covered (`dental-scheduling.hurl:142`) — extend only if FIX-002 changes PATCH semantics | contract | Wire contract reflects ratified policy | `specs/api/tests/contract/dental-scheduling.hurl` |
| FIX-006 | Smoke tool asserting cancel + no-show affordances exist and complete (self-cleaning, re-runnable) | smoke (Webwright tool) | Affordance-regression guard for the exact gap class found | NEW `apps/dentalemon/tests/smoke/dental-scheduling_smoke.py` (pattern: `patient_registration_smoke.py`) |
| FIX-003 | RED: past-due scheduled/confirmed appointment shows "No show" action; marking sets `no_show`; revert path works (per FSM) | frontend/component | Mutation triggers exist; FSM transitions surfaced honestly | EXTEND `apps/dentalemon/src/features/scheduling/components/appointment-card.test.ts` (+ modal test if action lives there) |
| FIX-004 | RED backend: check-in creates a queue item (idempotent — re-check-in must not duplicate); then E2E: check-in → row appears on queue board | backend/unit + E2E/Playwright | Board gains rows from the real product flow; downstream effect occurs; BR-001/visit behavior unchanged | EXTEND `services/api-ts/src/handlers/dental-scheduling/dental-queue.test.ts` + check-in tests; NEW/EXTEND E2E check-in→board spec |
| FIX-005 | RED: seed conformance assert — every seeded appointment `visitType` ∈ wire enum | data/schema (seed-coherence) | Seed cannot drift from `appointment-wire.ts` enum | NEW assert near seed tests or in `scripts/seed-demo.ts` validation; enum source `appointment-wire.ts:18` |
| FIX-007 | RED pins: (a) expired hold cannot be committed (race), (b) queue illegal transition → 4xx, (c) PATCH-reschedule outside working hours → 422 re-validation | backend/unit (adversarial) | Edges stay guarded under future refactors | EXTEND `online-booking.test.ts` (hold race), `dental-queue.test.ts` (4xx), `dental-scheduling.working-hours.test.ts` (reschedule re-validation) |

Note: do not add E2E for every fix — E2E is limited to the two core journeys (cancel, check-in→board) per shared rules §11.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `apps/dentalemon/src/features/scheduling/components/appointment-card.tsx`, `appointment-modal.tsx`, NEW cancel-reason dialog component, scheduling hooks (new `useCancelAppointment` via existing SDK op), FE tests, new E2E spec | module-local | FE scheduling feature only; SDK op already generated — no codegen needed |
| FIX-002 | `services/api-ts/src/handlers/dental-scheduling/updateAppointment.ts` (reject/realign PATCH `status=cancelled`), `dental-scheduling-transitions.test.ts`, possibly `dental-scheduling.hurl`; TypeSpec only if error shape changes (avoid if possible) | module-local | Backend scheduling handlers + pinned tests; check FE has no existing PATCH-cancel caller (grep says none — cancelled is currently unreachable, which is why this is safe now) |
| FIX-003 | `appointment-card.tsx` (and/or modal), scheduling hooks (PATCH status mutation), FE tests | module-local | FE scheduling feature only; uses existing `updateAppointment` FSM path |
| FIX-004 | `services/api-ts/src/handlers/dental-scheduling/checkInAppointment.ts` (additive enqueue), `dental-queue.test.ts`, check-in tests, E2E spec | cross-module (seam) | Check-in is the WF-089/BR-001 seam into dental-visit (`visitService.createVisit`) — enqueue must be additive; zero changes to visit creation, FSM, or BR-001 guard |
| FIX-005 | `scripts/seed-demo.ts` (visitType values), conformance assert | module-local (seed) | Seed data only; re-seed required after change |
| FIX-006 | NEW `apps/dentalemon/tests/smoke/dental-scheduling_smoke.py` | module-local (test tooling) | None (additive tool) |
| FIX-007 | `online-booking.test.ts`, `dental-queue.test.ts`, `dental-scheduling.working-hours.test.ts` | module-local (tests) | None unless a pin finds a real bug (then stop and report, don't expand scope) |

No database/schema files are touched by any active fix. No shared/platform files are touched.

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001 | product decision (lightweight) | Q1 cancel canonical path | Determines whether FE wires DELETE-only and what happens to PATCH-cancel | Ratify default at batch start (recommended: DELETE-canonical, reason-required) |
| FIX-002 | module-local | Pinned tests at `dental-scheduling-transitions.test.ts:370,383` | Must be flipped deliberately RED→GREEN, not weakened or deleted | No — done inside the batch |
| FIX-004 | cross-module | `checkInAppointment.ts` → `visitService.createVisit` (dental-visit, WF-089, BR-001) | Enqueue rides the check-in handler; any regression here breaks the golden path | No — but enqueue must be additive; re-run golden-path smoke after |
| FIX-004 | product decision (lightweight) | Q2 second half: auto-enqueue vs explicit button | Default = auto-enqueue on check-in (gap plan recommendation; matches whiteboard ritual) | Ratify default at batch start |
| FIX-003 | confirmation (lightweight) | Q4 no-show role gate | Default = same RBAC as existing PATCH status transitions (no new role logic) | Ratify default at batch start |
| GAP-4 (blocked) | product decision | Q3 waitlist wire-or-park | Determines whether 3 backend ops get FE or stay documented-dormant | Yes — blocks entirely |
| GAP-5 (deferred) | cross-module | Notifications module Phase-2 (reminder sends, inbox) | Self-lookup/token-confirm UIs only make sense with reminder links | Yes — owned by notifications round |
| (context) | shared/platform (existing) | `services/api-ts/src/core/jobs.ts` scheduler; `jobs/reminderArmer.ts`, `jobs/holdCleanup.ts` | Already registered and working — nothing to build | N/A — do not touch `[DO NOT OVERBUILD]` |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1: Canonical cancel path — DELETE (reason-required) canonical; PATCH `status=cancelled` rejected or made reason-required? | `[NEEDS PRODUCT DECISION]` (lightweight) | FIX-001, FIX-002 | Defines the FE wiring target and the backend pin flip | Ratify at Batch A start. Recommended default: DELETE-canonical (reason 5–500, audit + reminder-expiry already there); PATCH `status=cancelled` rejected with a 4xx pointing to DELETE. Add to cross-module decision queue only for ratification, not exploration. |
| Q2 (second half): queue intake mechanism — auto-enqueue on check-in vs explicit "Add to queue" button | `[NEEDS PRODUCT DECISION]` (lightweight) | FIX-004 | Shapes the Batch C change | Ratify at Batch C start. Recommended default: auto-enqueue on check-in (matches whiteboard ritual; zero extra clicks). First half (does it auto-enqueue today?) is RESOLVED: no (organizer-verified). |
| Q4: No-show marking role gate — staff-any or staff_full+? | `[NEEDS CONFIRMATION]` | FIX-003 | Whether FE action needs role gating beyond existing PATCH RBAC | Ratify at Batch B start. Recommended default: inherit existing PATCH status-transition RBAC unchanged (no new role logic). |
| Q3: Waitlist — wire join/promote now or park? | `[NEEDS PRODUCT DECISION]` | (blocked GAP-4 — no active Fix ID) | Real scope decision: new FE surfaces (join on no-slots + staff promote view) vs documented-dormant backend | Send to cross-module decision queue. Until decided, keep the honest "call the clinic" text. |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| GAP-4 waitlist FE (join on no-slots in `BookingWizard.tsx:201` + staff list/promote view) | `[NEEDS PRODUCT DECISION]` | Wire-vs-park is a genuine scope choice; wiring adds two new FE surfaces | Q3 decided. If "park": document the 3 ops as intentionally dormant (small doc note, no code). If "wire": new batch with FE + E2E tests-first. |
| GAP-5 self-lookup (`getOnlineBooking`) + token confirm (`confirmAppointmentByToken`) UIs | V2 DEFERRED (cross-module) | Only useful once reminder sends exist; notifications module owns Phase-2 delivery | Notifications Phase-2 lands (reminder sends on). Backend handlers stay as-is. |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Waitlist FE wiring | GAP-4 | `[NEEDS PRODUCT DECISION]` | Q3 unresolved; backend tested and safe to leave dormant |
| Booking self-lookup + reminder token-confirm UIs | GAP-5 | V2 DEFERRED | Phase-2 notifications-coupled; armer infra already in place |
| Slot-generation job (G-001) | gap plan §4/§23 | V2 DEFERRED | Spec-declared deferred; feature flag default false |
| SMS/email reminder sends | gap plan §23 | V2 DEFERRED | Phase-2; send-side flag off by design; owned by notifications round |
| Recurring appointments | gap plan §23 | V2 DEFERRED | PRD Phase-2 |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| DB unique constraint on dentist+time | gap plan §13/§23 | FR3.7 explicitly soft-warn-on-create by design; constraint would break the documented double-booking policy `[DO NOT OVERBUILD]` |
| Event bus for DE-010/011 domain events | gap plan §23 | ADR-006: audit-log-only; bus duplicates existing behavior |
| Queue FSM renaming to spec's IDEAL names | gap plan §23 | Deviation already documented; churn without value `[DO NOT OVERBUILD]` |
| Any new scheduler/cron framework | orchestrator errata | Scheduler exists at `services/api-ts/src/core/jobs.ts`; reminder armer + hold cleanup already registered. Nothing in this plan needs a new job anyway. `[DO NOT OVERBUILD]` |
| Re-fixes of closed items | gap plan §26 | PATCH-cancel RBAC, working-hours repoint, calendar branchId, overlap layout, double-booking policy — all verified fixed/by-design; do not re-litigate |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | Backend-first build pattern left lifecycle affordances unwired (same gap class as billing/clinical per KG finding §16). Fix is the missing FE vertical, not a patch. |
| FIX-002 | Root cause | Two cancel paths evolved independently; tests pinned the asymmetry instead of a policy. Fix collapses to one canonical policy. |
| FIX-003 | Root cause | Same affordance-cluster root cause as FIX-001; styling shipped before mutation wiring. |
| FIX-004 | Root cause | Queue intake was never wired at the natural seam (check-in); board read-side shipped alone. Organizer-verified absent — not a misconfiguration. |
| FIX-005 | Root cause | Seed written against free-text before wire enum existed; no conformance assert to catch drift. |
| FIX-006 / FIX-007 | Root cause (of test blindness) | Suite proves backend reach but nothing asserts FE affordance existence or adversarial edges; smoke tool + pins close the detection gap that let GAP-1/2/3 persist. |

## 13. Recommended First Fix Batch

**Batch A — Cancel vertical (FIX-001, FIX-002, FIX-006).**

- **Why first:** contains the module's only P1 (PRD-P0 FR3.4); FIX-002 must precede/accompany FIX-001 so the FE wires the canonical reason-gated path, and the smoke tool (FIX-006) pins the affordance class as soon as it exists. Highest daily-operations impact (cancellations are the front desk's most frequent exception flow).
- **Tests to write first (RED):**
  1. Backend: flip `dental-scheduling-transitions.test.ts:370,383` to assert PATCH `status=cancelled` is rejected (or reason-required, per ratified Q1) — RED against current behavior.
  2. FE component: cancel action visible (role-gated per `cancelAppointment.ts:36-38` — owner/staff_full), reason dialog enforces 5–500, submit hits DELETE path, cancelled renders.
  3. E2E: staff cancels with reason → slot freed → visit preserved (BR-004).
  4. Smoke: `dental-scheduling_smoke.py` drives cancel end-to-end (self-cleaning).
- **Explicit out-of-scope:** no-show (Batch B), queue intake (Batch C), waitlist (blocked Q3), seed/pins (Batch D), anything in §11, any change to double-booking policy, FSM table, check-in handler, RBAC beyond reusing existing guards, TypeSpec changes unless the rejected-PATCH error shape demands one.
- **Precondition:** ratify Q1 recommended default (DELETE-canonical) at batch start — one-line decision, do not block the batch on a meeting.

## 14. Instructions for 04 Fix Prompt

- **Module/group:** Dental Scheduling
- **Module slug:** dental-scheduling
- **Fix-ready plan:** `docs/aha/module-fix-plans/dental-scheduling-fix-ready-plan.md`
- **Raw gap plan (context only):** `docs/aha/module-gap-plans/dental-scheduling-gap-plan.md`
- **Execute first:** Batch A (FIX-001 + FIX-002 + FIX-006) only. Do not continue to Batch B/C/D without explicit instruction.
- **Tests to prioritize (RED first):** flip transitions pins (:370,:383) for the canonical cancel policy → FE cancel-dialog component test → cancel E2E → scheduling smoke tool.
- **Files likely touched:** `services/api-ts/src/handlers/dental-scheduling/updateAppointment.ts`, `dental-scheduling-transitions.test.ts`; `apps/dentalemon/src/features/scheduling/components/appointment-card.tsx`, `appointment-modal.tsx`, new cancel-reason dialog + hook + tests; new E2E spec; `apps/dentalemon/tests/smoke/dental-scheduling_smoke.py`; possibly `specs/api/tests/contract/dental-scheduling.hurl`.
- **Cautions:** no schema/migration changes; no shared-platform files; do not touch `checkInAppointment.ts` in Batch A; do not weaken or delete the RBAC pins in `rbac-scheduling.test.ts:369-383`; `cancelAppointment.ts` backend (reason validation, RBAC, reminder expiry, BR-004 visit preservation) should not need changes — the work is FE wiring + PATCH-policy alignment; restart the API server before running contract tests (stale server masks drift); never run server/contract/E2E against `monobase_test`.
- **Do not implement:** GAP-4 waitlist (blocked Q3), GAP-5 self-lookup/token-confirm UIs (V2), slot-gen job, SMS sends, recurring appointments, DB unique time constraint, event bus, queue renaming, any new scheduler/cron (use existing `core/jobs.ts` only — and nothing in Batch A needs it).

---

Next recommended step:
Module/group: Dental Scheduling
Module slug: dental-scheduling
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/dental-scheduling-fix-ready-plan.md
Recommended batch: Batch A — Cancel vertical (FIX-001, FIX-002, FIX-006)
