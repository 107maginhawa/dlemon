# AHA Fix-Ready Plan: Notifications

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/03-organize-gap-plan-for-fixing.md`

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Notifications (in-app/push/email delivery + UI) |
| Module slug | notifications |
| Source gap plan | `docs/aha/module-gap-plans/notifications-gap-plan.md` |
| Output file | `docs/aha/module-fix-plans/notifications-fix-ready-plan.md` |
| Audit decision | PARTIAL PASS |
| Superpowers used | No — organizer discipline applied via shared rules (§19 Gap Organizer Rules); no Superpowers skill invoked for this organizing pass |
| Organizer decision | READY |
| Reason | The two material gaps (GAP-1 inbox, GAP-2 push opt-in) are additive frontend work against a verified-frozen backend; SDK hooks are already generated (`packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` exports `listNotifications`/mark-read operations — verified). No schema, TypeSpec, or shared-platform change is required for any active fix. Open questions Q1/Q2 are UX-shape confirmations resolvable with conservative defaults, not implementation blockers. |
| Limitations | Tests not executed during organizing; OneSignal live delivery remains `[BLOCKED BY ENVIRONMENT]` for end-to-end push verification (fail-closed behavior already pinned in backend). Organizer verified file existence/wiring claims via direct source checks (handlers dir, SDK generated hooks, `onesignal.ts`, `_dashboard.tsx` header, `docs/product/modules/*/MODULE_SPEC.md` convention). |

## 2. Fix Strategy Summary

- **Fix first:** GAP-1 (FIX-001) — the in-app surface (bell + unread badge + inbox panel). It is the single unlock that gives all 10 producers, the recall journey, and FR10.9 staff alerts their user-facing value. Backend is frozen; this is FE-only consumption of 4 already-tested, already-generated operations.
- **Then:** GAP-2 (FIX-002) push opt-in prompt + click routing — small, independent, FE-only.
- **Then:** low-risk pins and hygiene (FIX-003/004/005/006) in one quick batch.
- **Do not fix:** SMS provider, invoice-overdue emails (upstream billing dependency), websocket push, new notification types, anything in the delivery pipeline / consent resolver / settings relabel (all verified working — gap plan §26 "do not re-litigate").
- **Major risks:** (a) touching the dashboard shell header (`routes/_dashboard.tsx:142-144`) — shared UI surface, keep the bell additive and test-id'd; (b) E2E journey test needs a real producer event — reuse existing seeded booking/billing flows rather than new fixtures; (c) push verification is environment-gated — assert prompt invocation and click-routing logic, not live OneSignal delivery.
- **Batching:** three batches (A inbox, B push opt-in, C pins/spec). Multiple small `04` passes, not one combined pass. No shared/platform/database work required. No product decision hard-blocks; two `[NEEDS CONFIRMATION]` UX defaults are pre-resolved below with conservative recommendations.

## 3. Active Fix Scope

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-1: zero in-app surface — bell + unread badge + inbox panel (list / mark-read / mark-all) | P1 | V1 REQUIRED | A | Every in-app producer writes into a void; FR10.9 unmet; recall/booking/billing journeys dead-end. 4 read ops + SDK hooks exist with 0 consumers. | Gap plan §5/§10/§12; contract-spine `consumers: []` grep-verified; handlers `services/api-ts/src/handlers/notifs/` (listNotifications/getNotification/markNotificationAsRead/markAllNotificationsAsRead) |
| FIX-002 | GAP-2: push opt-in UX missing — `requestNotificationPermission()` / `onNotificationClick` never called | P2 | V1 RECOMMENDED | B | Wired OneSignal path has zero real reach; FR10.7 cross-device unreachable for actual users. Low-risk, additive. | Gap plan §5/§10; `apps/dentalemon/src/features/notifications/onesignal.ts:51-64`, 0 callers (grep) |
| FIX-003 | GAP-3: email type→template tag mapping unverified against email module registry | P3 | V1 RECOMMENDED `[TEST GAP]` | C | Cheap assertion test guards a silent-failure seam in reminder delivery. | Gap plan §5; `notification.repo.ts:559-571` mapping untested |
| FIX-004 | GAP-4: `isMedicalNotification()` hardcoded false → dead medical-priority branch | P3 | V1 RECOMMENDED | C | Dead code misleads readers about behavior; remove (smallest correct fix) with a unit pin. | Gap plan §5/§12; `notification.repo.ts:553` |
| FIX-005 | GAP-5: no notifications MODULE_SPEC | P3 | V1 RECOMMENDED | C | Spec coverage is "Weak"; author after inbox ships so the spec documents real shipped behavior, not aspiration. Doc-only. | Gap plan §5; convention `docs/product/modules/[module]/MODULE_SPEC.md` (verified exists for other modules) |
| FIX-006 | Settings enforcement coherence test (defaults panel vs actual consent gate) | P3 | V1 RECOMMENDED `[TEST GAP]` | C | Existing FE settings test covers parsing only (Medium confidence); this pins the Batch-4 relabel honesty against regression. | Gap plan §19/§20; `notification-settings.test.ts` (parsing-only), resolver `resolve-reminder-channels.ts:74-117` |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A — P1 in-app surface | Bell + unread badge + inbox panel in dashboard shell; FE RED-first + one E2E journey | FIX-001 | Medium (touches shared dashboard shell header; new FE feature components; E2E needs seeded producer event) | run in current `04` pass |
| Batch B — push opt-in UX | Permission prompt at settings (+ recommended soft first-login entry point) + notification click deep-link routing | FIX-002 | Low (FE-only; OneSignal live delivery not assertable — test prompt/routing logic, mock the SDK) | split into separate `04` pass, after Batch A |
| Batch C — pins + hygiene + spec | Template-registration assertion, dead-branch removal + pin, settings-coherence integration test, MODULE_SPEC authoring | FIX-003, FIX-004, FIX-005, FIX-006 | Low (test-only + one tiny backend deletion + doc) | split into separate `04` pass, anytime after Batch A (FIX-005 explicitly after A so the spec documents the shipped inbox) |

No Batch E (shared/platform) or Batch F (database/schema) is needed — verified no schema/TypeSpec/migration change in scope.

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | Bell renders unread badge count from `listNotifications` (unread filter); inbox list renders rows; mark-read updates row state + decrements badge; mark-all clears badge; empty state honest | frontend/component (RED first) | UI and API agree: rows surface, read-state round-trips through the real SDK hook shapes (use `makeSdkError`-style real-envelope mocks, not self-consistent fictions) | New: `apps/dentalemon/src/features/notifications/__tests__/notification-bell.test.tsx` (or sibling `*.test.tsx` per app convention) |
| FIX-001 | Producer event → bell badge → open inbox → row visible → mark read → badge decrements | E2E/Playwright (during fix, after FE green) | Journey completion: the FR10.9/recall dead-end is actually closed end-to-end against the real API | New: `apps/dentalemon/e2e/` notification-inbox journey spec (reuse existing seeded booking/billing event; follow existing journey-spec conventions) |
| FIX-002 | Opt-in control invokes `requestNotificationPermission()` on user gesture; `onNotificationClick` payload routes to the expected deep-link; unconfigured OneSignal → control hidden/disabled honestly | frontend/component (RED first) | Browser permission is actually requested via the exported fn; click routing resolves to a real route; no fake affordance when push is unavailable | Extend `apps/dentalemon/src/features/settings/` notification-settings tests + new test alongside `features/notifications/onesignal.ts` consumer |
| FIX-003 | Every type→template tag in `notification.repo.ts:559-571` is registered in the email module template registry | backend/unit (assertion pin) | No reminder email silently fails on an unregistered template tag | New: `services/api-ts/src/handlers/notifs/` test (e.g., `notificationTemplates.test.ts`) cross-asserting against email module registry |
| FIX-004 | After removal: no medical-priority branch remains / priority output is the documented constant path | backend/unit (regression pin) | Dead branch removed without behavior change to delivered notifications | Extend `services/api-ts/src/handlers/notifs/notifs.test.ts` or repo-level test |
| FIX-006 | Defaults panel toggles do NOT override per-patient consent gate; resolver remains the single enforced gate | integration | Batch-4 relabel honesty: what settings claims matches what `resolve-reminder-channels.ts` enforces | Extend backend resolver/armer tests (`reminderArmer.test.ts`) + FE `notification-settings.test.ts` |

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | New: `apps/dentalemon/src/features/notifications/notification-bell.tsx`, inbox panel component(s) + tests. Edit: `apps/dentalemon/src/routes/_dashboard.tsx` (header at :142-144, add bell next to `SidebarTrigger`). Consume existing generated hooks from `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` (no regeneration). | module-local (FE) + one additive edit to shared dashboard shell | Shell header is rendered on every dashboard route — keep change additive, test-id'd; existing `app-sidebar.test.tsx` must stay green |
| FIX-002 | `apps/dentalemon/src/features/notifications/onesignal.ts` (consume existing exports, no rewrite); `apps/dentalemon/src/features/settings/` notification-settings component; possibly `_dashboard.tsx` mount for click-listener registration | module-local (FE) | Low — additive callers of existing exports |
| FIX-003 | New backend test file under `services/api-ts/src/handlers/notifs/`; read-only reference to email module template registry | module-local (test-only; cross-module read) | None (no source change) |
| FIX-004 | `services/api-ts/src/handlers/notifs/repos/notification.repo.ts` (~:553) — remove dead branch + helper; pin test | module-local (backend) | Low — deletion of provably-dead code |
| FIX-005 | New: `docs/product/modules/notifications/MODULE_SPEC.md` | module-local (doc) | None |
| FIX-006 | Backend resolver/armer tests; FE `notification-settings.test.ts` | module-local (test-only) | None |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001 | cross-module | Dashboard shell (`routes/_dashboard.tsx`) hosts the bell | Placement touches a surface shared by all dashboard routes | No — additive edit within Batch A; keep isolated and pinned |
| FIX-001 | cross-module | Producers in booking/billing/scheduling/patient generate the rows the E2E asserts | E2E journey needs a real seeded event | No — producers already shipped + tested; reuse existing seeds |
| FIX-002 | environment/tooling | OneSignal env config (`core/notifs.ts:20-31`, FE app id) | Live push undeliverable without env; backend fails closed (status=failed, pinned) | No — implement prompt/routing with SDK mocked; live delivery verification stays `[BLOCKED BY ENVIRONMENT]`; document in FIX-005 spec |
| FIX-003 | cross-module | Email module template registry | Assertion target lives in `handlers/email/` | No — read-only assertion |
| (none) | cross-module `[CROSS-MODULE RISK]` | dental-patient GAP-4 (silent comms-consent save) corrupts the consent gate notifications relies on | Send correctness depends on patient consent persisting honestly | Owned by dental-patient module fix plan — list-only here; do NOT expand into it during notifications `04` passes |
| (none) | cross-module `[CROSS-MODULE RISK]` | Billing GAP-1 (overdue status never fires) blocks WF-083 overdue emails | Overdue producer impossible until billing's overdue cron lands | Owned by billing module — sequenced after billing batch; deferred here (see §9/§10) |
| (none) | shared/platform | Any future scheduled dispatch work must register on the existing `core/jobs.ts` scheduler (reminder/recall jobs already do) | Prevents reinventing a scheduler `[DO NOT OVERBUILD]` | N/A — no new scheduled work in active scope; constraint recorded for `04` |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1: Inbox shape — bell-popover only vs dedicated route too | `[NEEDS CONFIRMATION]` | FIX-001 | Scopes Batch A size | **Proceed with conservative default:** bell + popover/panel only, no dedicated route for V1 (smallest surface that completes the journeys). Add a route only if popover list proves insufficient. Does not block Batch A. |
| Q2: Push opt-in moment — first login vs settings-only | `[NEEDS CONFIRMATION]` | FIX-002 | UX placement | **Proceed with conservative default:** explicit opt-in control in notification settings (user-gesture-driven, browser-compliant); optionally a dismissible nudge after login. No auto-prompt on load. Does not block Batch B. |
| Q3: Do notification titles/messages embed PHI today? | `[NEEDS CONFIRMATION]` | FIX-001 (display) | Inbox renders title/message to staff; PHI hygiene must hold once visible | Spot-check the 10 producers' title/message construction during Batch A (checklist step, not a code task unless a violation is found — then escalate as a new finding) |
| FIX-004 direction: remove vs implement medical-priority | `[NEEDS CONFIRMATION]` (engineering-level) | FIX-004 | Gap plan offered "implement or remove" | **Default: remove** — no producer sets medical priority and no requirement cites it; implementing would be `[DO NOT OVERBUILD]`. |

No `[NEEDS PRODUCT DECISION]` hard-blocks exist for the active scope — nothing for the cross-module decision queue from this module.

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| WF-083 invoice-overdue notification emails | `[CROSS-MODULE RISK]` + declared Phase-2 (WFG-010) | Upstream billing GAP-1: overdue status never fires; producer has nothing to react to | Billing module fix batch lands the overdue cron (on existing `core/jobs.ts` scheduler); then revisit as a notifications producer item |
| Live OneSignal push delivery verification | `[BLOCKED BY ENVIRONMENT]` | Requires configured OneSignal app id + real browser permission grant | Env provisioning; until then FIX-002 asserts prompt/routing logic with mocked SDK, backend fail-closed behavior already pinned |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| SMS provider integration | §23 (channel enum-only, repo `:524-531` logs+fails) | V2 DEFERRED | Declared P4; provider decision later; enum-ready when needed |
| Invoice-overdue emails (WF-083) | §4/§23 | V2 DEFERRED | Declared gap + upstream billing dependency (see §9) |
| Appointment confirmation-request flow | §23 | V2 DEFERRED | Enum-only; no workflow defined in any spec |
| Notifications MODULE_SPEC *before* inbox ships | GAP-5 ordering | (active in Batch C, sequenced) | Deliberately after Batch A so the spec documents shipped behavior — not deferred out of scope, just ordered last |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Real-time websocket push for the in-app inbox | §23 | `DO NOT ADD` — unprompted; TanStack Query polling/refetch on the bell suffices for V1 `[DO NOT OVERBUILD]` |
| New notification types without producers | §6/§23 | `DO NOT ADD` — 19-type taxonomy already ahead of dental workflows `[DO NOT OVERBUILD]` |
| Any new scheduler/dispatch framework | erratum + §16 | `DO NOT ADD` — `core/jobs.ts` scheduler exists and already runs the notifs cron jobs; new scheduled work must register there |
| Public notification-create endpoint | §3 | `DO NOT ADD` — creation is intentionally service-internal (`notifsService`); exposing it would break the producer model |
| Rework of delivery pipeline, consent resolver, settings relabel, or deliveredAt contract | §26 "do not re-litigate" | Verified working and pinned (G2/G4 fixed; resolver fail-closed; pipeline tested) — touching them is regression risk with zero gap evidence |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | The module was built backend-first and the FE consumption layer was never started — classic write-only subsystem (KG: producer fan-in from 6+ modules, consumer fan-out zero). Wiring the surface is the root fix, not a patch. |
| FIX-002 | Root cause | Opt-in functions were exported but never given a UI entry point; calling them at a sensible moment is the complete fix. |
| FIX-003 | Root cause (of a latent risk) | Untested cross-module seam; an assertion pin removes the silent-failure mode at its source. |
| FIX-004 | Root cause | Helper hardcoded `false` — branch was speculative from day one; removal eliminates the misleading code rather than papering over it. |
| FIX-006 | Root cause (test gap) | Settings test asserts parsing, not enforcement coherence — the honesty property fixed in Batch 4 has no regression guard. |

## 13. Recommended First Fix Batch

- **Batch name:** Batch A — P1 in-app surface (FIX-001)
- **Included Fix IDs:** FIX-001
- **Why first:** Highest severity (the only P1); single unlock that makes 10 producers, FR10.9 staff alerts, and the recall→notification→action journey actually function; FE-only against a frozen, well-tested backend with SDK hooks already generated — lowest-risk path to the largest value.
- **Tests to write first (RED):** frontend/component tests for bell unread-badge count, inbox list render, mark-read round-trip + badge decrement, mark-all, empty state (new test file beside the new components in `apps/dentalemon/src/features/notifications/`). Then, after FE green, one E2E journey: seeded producer event → bell badge → inbox → mark read.
- **Explicit out-of-scope for Batch A:** push opt-in (Batch B); all Batch C pins; any backend/TypeSpec/SDK regeneration; dedicated inbox route (popover default per Q1); websockets; new notification types; touching delivery pipeline/consent resolver/settings panel; dental-patient or billing cross-module fixes.

## 14. Instructions for 04 Fix Prompt

- **Module/group:** Notifications
- **Module slug:** `notifications`
- **Fix-ready plan:** `docs/aha/module-fix-plans/notifications-fix-ready-plan.md`
- **Raw gap plan (context only):** `docs/aha/module-gap-plans/notifications-gap-plan.md`
- **Execute first:** Batch A (FIX-001) only. Do not continue to Batch B/C in the same pass unless explicitly instructed.
- **Tests to prioritize:** FE component RED tests for bell/badge/inbox/mark-read (use real SDK error-envelope shapes in mocks, per the established `SdkError` pattern); one Playwright E2E journey after FE green. Follow Vertical TDD (`docs/development/VERTICAL_TDD.md`).
- **Files likely to touch:** new components + tests under `apps/dentalemon/src/features/notifications/`; one additive edit to `apps/dentalemon/src/routes/_dashboard.tsx` header (:142-144). Consume hooks from `@monobase/sdk-ts` generated react-query exports — do not regenerate the SDK, do not touch TypeSpec.
- **Shared/database cautions:** zero schema/migration/TypeSpec work in scope. The dashboard shell is shared by all dashboard routes — keep the bell additive, test-id'd, and keep `app-sidebar.test.tsx` and existing shell-dependent specs green. Any scheduled work (none expected) must register on the existing `core/jobs.ts` scheduler — never a new scheduler.
- **Do not implement:** FIX-002..006 (later batches); SMS provider; WF-083 overdue emails (blocked by billing); websockets; new notification types; public create endpoint; dedicated inbox route (Q1 default = popover only); any change to the delivery pipeline, consent resolver, notification settings relabel, or deliveredAt contract pins.
- **During Batch A also:** run the Q3 PHI spot-check on producer titles/messages (checklist; escalate as a new finding only if a violation is found — do not silently fix unrelated producers).

---

Next recommended step:
Module/group: Notifications
Module slug: notifications
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/notifications-fix-ready-plan.md
Recommended batch: Batch A — P1 in-app surface (FIX-001)
