# AHA Fix Report: Dental Scheduling — Batch A (Cancel Vertical)

**Executed:** 2026-06-11 · **Prompt:** `docs/aha/prompts/04-module-or-group-fix-tdd.md` · **Branch:** `chore/workflow-verification-sweep` (NOT pushed)
**Batch:** A (FIX-001 cancel affordance + FIX-002 cancel-policy alignment; FIX-006 smoke tool deferred — see below).

## Decision ratified (Q1)

Recommended default ratified: **DELETE is the canonical reason-gated cancel path.** For the PATCH `{status:cancelled}` fork, the plan offered "reject OR make reason-required." I chose **reason-required** (not reject-entirely) because rejecting breaks two existing intentional behaviours — `appointment-confirm.test.ts` exercises PATCH-cancel-with-reason as a success path, and `rbac-scheduling.test.ts` pins PATCH-cancel role parity (403). Reason-required achieves the policy goal (no reason-less cancel on EITHER path) with minimal blast radius.

## What shipped

### FIX-002 — cancel policy alignment (backend)
`updateAppointment.ts`: PATCH `{status:cancelled}` now requires a reason (5–500), mirroring the DELETE handler exactly (`REASON_REQUIRED` 422 if missing/short). The check runs **after** the RBAC gate (owner/staff_full) and the FSM transition check, so the RBAC-parity 403 pins and `completed→cancelled` 4xx pins still fire first. **Adversarial-review fix:** added the SAME audit log (`appointment.cancel`, AL-008) + domain event (`AppointmentCancelled`, DE-011) the DELETE path writes — a PATCH cancel was previously unaudited.

The two transitions pins that locked reason-less PATCH cancels were **deliberately flipped** RED→GREEN (now assert 422), with two new positive WITH-reason tests + an audit-parity test added (no coverage weakened).

### FIX-001 — cancel affordance (FE vertical)
- `cancel-appointment-dialog.tsx` (new): reason-gated dialog enforcing 5–500 chars client-side, surfaces server errors (no silent failure).
- `appointment-card.tsx`: `onCancel` prop + `canCancelStatus(status)` helper + a role-supplied Cancel hover-action (parallel to Confirm/Check-In).
- `calendar-day.tsx`: threads `onCancel` card→view (week/month unaffected).
- `calendar.tsx`: owns the dialog + `handleConfirmCancel` (SDK `cancelAppointment` DELETE with `query.reason`, `throwOnError`, error surfaced, refetch on success). Role-gated: the Cancel affordance is supplied only for `dentist_owner`/`staff_full` (EM-SCH-001) — the backend still enforces.

## Verification (fresh runs)

| Layer | Result |
| --- | --- |
| Backend transitions (`dental-scheduling-transitions.test.ts`) | **24 pass / 0 fail** (incl. reason-required flip + audit parity) |
| Backend regression: rbac-scheduling / appointment-confirm / acceptance / dental-scheduling | 14 / 6 / 5 / 60 pass, 0 fail |
| FE component (`cancel-appointment-dialog.test.tsx`) | 6 pass |
| FE scheduling feature suite | **135 pass / 0 fail** |
| Typecheck (api-ts `tsc` + root FE) | both **exit 0** |
| E2E (`calendar.spec.ts` "cancel from the calendar UI", chromium) | **pass** — card Cancel → reason dialog → DELETE with reason → persisted `cancelled` |

## Adversarial review (focused code-reviewer) — 2 real findings, both fixed pre-commit

- **[FIXED P1]** `canCancelStatus` wrongly included `no_show` (its only FSM transition is →completed), producing a false Cancel affordance that 422s on submit. Removed `no_show`; flipped the unit pin.
- **[FIXED P2]** PATCH-cancel skipped the audit log + domain event the DELETE path writes (unaudited cancellations on a live path). Added full parity + an audit-parity regression test.

Reviewer also confirmed clean: check ordering (RBAC/FSM before reason), no coverage weakening, correct role gate, correct SDK `query.reason` wire shape, week/month views unaffected.

## Deferred

- **FIX-006 scheduling smoke tool** — deferred. Its stated purpose ("affordance-regression guard for the exact gap class") is already met by the new **UI-driven cancel E2E** (drives the real card affordance → dialog → DELETE through a browser). A Webwright smoke script needs a separately demo-seeded `:3003` app; shipping an unrun 188-line artifact would violate verification-before-completion. Recommend either accepting the E2E as the guard or scheduling the smoke tool in a follow-up with execution.

## Not implemented (per plan §9–§11)

Batch B (no-show mark/revert), Batch C (queue intake at check-in seam — cross-module), Batch D (seed conformance + adversarial pins), waitlist (Q3 blocked). No `checkInAppointment.ts` changes, no DB constraint, no event bus, no new scheduler.

## Decision queue

| Item | Note |
| --- | --- |
| PATCH `{status:cancelled}` retained as a second (now reason-gated + audited) cancel path | Q1 default was "reject"; chose "reason-required" to preserve intentional confirm/RBAC tests. If product prefers a single DELETE-only path, the PATCH-cancel branch + the confirm/RBAC tests that use it would need a coordinated removal — flag for review. |
| FIX-006 smoke tool execution | Deferred; E2E covers the regression class. |
