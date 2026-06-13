# AHA Module/Group Gap Plan: Notifications

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Notifications (in-app/push/email delivery + UI) |
| Module slug | notifications |
| Type | Platform Capability |
| Output file | `docs/aha/module-gap-plans/notifications-gap-plan.md` |
| Primary PRD/spec used | `docs/prd/v3-dentalemon.md` FR10.7/FR10.9 (cross-device + payment-pending notifications), FR8.9 (preferences), FR2.18 (recall reminders — Phase-2 driver) |
| Supporting PRDs/specs used | AC-NOTIF-01/02; WORKFLOW_MAP §8 notification trace + WF-080/081/083 (+ gaps WFG-009..013); upstream monobase CLAUDE.md (OneSignal external_id pattern). **No module spec exists** — expectations partially `[INFERRED]` |
| PRD/spec coverage quality | Weak |
| Paths inspected | `services/api-ts/src/handlers/notifs/` (4 ops + repo + schema + 2 cron jobs); `core/notifs.ts`; producers in booking/comms/dental-scheduling (`reminderArmer.ts`)/dental-patient (`recallDispatch.ts`)/billing; FE `features/notifications/onesignal.ts` + `features/settings/notification-settings.tsx` |
| PRDs/specs inspected | All above |
| KG used | Yes — spine: all 4 notifs ops `consumers: []`, grep-verified |
| KG refreshed | No |
| `/understand-domain` used | Yes (cross-check only) |
| `/understand-domain` refreshed | No |
| Webwright used | No — absence of inbox UI is statically conclusive |
| Playwright/E2E inspected | Yes (inspected): no notification journey exists (recorded as gap) |
| Existing tests inspected | 6 backend files (ops, consent gating, producer triggers, e2e), `notifs.hurl`, 1 FE settings test |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | No tests executed; OneSignal live delivery not exercised (env-dependent) |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| PRD FR10.7/10.9, FR8.9, FR2.18 | `docs/prd/v3-dentalemon.md` | PRD | Current | cross-device alerts, payment-pending in-app, settings toggles; recall **automation labeled Phase 2** |
| AC-NOTIF-01/02 | `ACCEPTANCE_CRITERIA.md:403-417` | acceptance criteria | Current (thin — AC-NOTIF-02 channel unspecified) | booking.created + billing in-app rows |
| WORKFLOW_MAP §8 + WFG-009..013 | `docs/product/WORKFLOW_MAP.md` | workflow spec | Current | reminder/overdue sends mapped, several declared gaps/Phase-2 |
| Upstream CLAUDE.md notifs notes | repo root | platform doc | Current | OneSignal single app id + external_id targeting |
| Prior gap plan + matrix Batch 3/4 logs | `docs/audits/module-gap-plans/notifs-gap-plan.md`, matrix | prior audit (pre-AHA) | Partially superseded (G2, G4 fixed — verified) | §3 |

## 3. Expected vs Actual

**Expected ([INFERRED] from weak spec):** notification rows created on key events (booking, billing, comms, reminders, recalls), delivered per channel with consent gating, and **visible to users** — staff see in-app alerts (FR10.9 "Payment pending for [Patient]"), patients get reminder emails/push, preferences are honest.

**Actual:** The **pipeline is substantially real** — better than the matrix's framing:

- **Producers (10):** booking confirm/cancel/reject + timer, comms video-call events, billing invoice-finalize, appointment `reminderArmer` (idempotent `enqueueScheduledIfAbsent`, consent-gated, 15-min batches), recall `recallDispatch` (due/reminder + reattempt policy). Creation is service-internal (`notifsService`) — there is intentionally no public create endpoint.
- **Delivery:** `processScheduled` cron (*/5) delivers per channel (`notification.repo.ts:342-547`): email via injectable `emailService.queueEmail()` with type→template mapping (:559-571); **push via OneSignal `createNotification`** with `external_id` targeting (:437-522, config `core/notifs.ts:20-31`); in-app rows marked delivered; **SMS enum-only (deferred P4, logs+fails)**. Daily cleanup (90d).
- **Consent gating is fail-closed for outbound** (`resolve-reminder-channels.ts:74-117`): undefined consent → suppressed; in-app always allowed; global opt-out honored; preferred-channel respected. Reads dental-patient `PersonConsent`.
- **Verified fixed:** G2 settings split-brain (Batch 4 — panel relabeled "Default Notification Types" + consent notice; per-patient consent is the single enforced gate) and G4 `deliveredAt` phantom field (Batch 3 — dropped from TypeSpec/SDK with negative pin).

The gap is concentrated at the **surface**:

1. **G1 unchanged — no in-app surface at all.** All 4 read ops (`listNotifications`, `getNotification`, `markNotificationAsRead`, `markAllNotificationsAsRead`) have zero FE consumers; SDK hooks generated and unused; no bell, no inbox, no unread badge, no route. FR10.9's payment-pending alert and the recall→notification journey dead-end: rows are created, consent-gated, "delivered" — and никто never sees them in-app.
2. **G3 unchanged — push opt-in UX missing:** `requestNotificationPermission()`/`onNotificationClick` exported from `onesignal.ts:51-64`, never called — browser permission is never requested, so the wired OneSignal path can't reach real users.
3. **Minor:** email template-tag registration unverified (G5); `isMedicalNotification()` hardcoded false makes the medical-priority branch dead code.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AC-NOTIF-01 booking.created in-app | row on appointment create | ✓ | — (no surface) | `createAppointment.ts:120-129` | notifications table | `createAppointment.notif.test.ts` | Implemented (invisible) | GAP-1 |
| AC-NOTIF-02 billing notification | row on invoice finalize | ✓ | — | `finalizeInvoice.notif.test.ts` producer | — | test | Implemented (invisible) | GAP-1 |
| FR10.9 payment-pending in-app alert | staff devices see alert | Row-creation possible; **no in-app surface** | none | — | — | — | Partially Implemented | **GAP-1** |
| FR10.7 cross-device notifications | events propagate to other devices | Push path wired (OneSignal); permission never requested | `onesignal.ts` init only | repo :437-522 | — | — | Partially Implemented | **GAP-2** |
| WF-080/081 appointment reminders | armed + delivered per consent | ✓ armer + delivery (email/push); SMS deferred | — | `reminderArmer.ts` + repo | scheduledAt | armer consent tests | Implemented (within phase) | template pin GAP-3 |
| FR2.18 recall reminders (Phase-2 driver) | due/reminder sends | ✓ dispatch job + reattempts | — | `recallDispatch.ts:31-78` | — | dispatch tests | Implemented (early but consistent) | journey blocked by GAP-1 |
| FR8.9 preferences honest | toggles reflect enforcement | ✓ (Batch-4 relabel + consent notice) | `notification-settings.tsx:46-66` | consent gate | — | settings test (parsing) | Implemented | enforcement-assert test thin (§20) |
| Consent gating | outbound fail-closed; in-app always | ✓ | — | `resolve-reminder-channels.ts:74-117` | consentValidated col | armer/dispatch suppression tests | Implemented | No |
| Inbox read ops | list/get/mark-read reachable | ✓BE — zero FE | none | 4 handlers | — | `notifs.test.ts` + hurl | Partially Implemented | **GAP-1** |
| WF-083 invoice-overdue notification | email on overdue | Blocked upstream: overdue status never fires (billing GAP-1) + send not built (WFG-010, Phase-2) | — | — | — | — | Not Required for V1 (declared) | cross-ref billing |
| SMS channel | provider wired | enum-only; logs+fails | — | repo :524-531 | channel enum | — | Not Required for V1 (P4 declared) | No |
| deliveredAt contract | spec == schema | fixed (dropped) | — | `notifs.tsp:160-164` | no column | negative pin in tests | Implemented | No |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| FR10.9 + inbox | **GAP-1**: zero in-app surface — 4 ops + SDK hooks unconsumed; rows invisible; recall/booking/billing journeys dead-end | P1 | V1 REQUIRED | spine + grep; no bell/inbox/route | Bell + unread badge in dashboard shell, inbox list w/ mark-read; RED-first FE tests; E2E recall→inbox |
| FR10.7 push opt-in | **GAP-2**: permission prompt + click-routing never invoked — OneSignal path unreachable for real users | P2 | V1 RECOMMENDED | `onesignal.ts:51-64` 0 callers | Opt-in prompt at sensible moment (settings + first login); click deep-link |
| Email templates | **GAP-3**: type→template tags unverified against email module registry | P3 | V1 RECOMMENDED `[TEST GAP]` | mapping :559-571 untested | Registration assertion test |
| Dead priority branch | **GAP-4**: `isMedicalNotification()` always false → priority logic dead | P3 | V1 RECOMMENDED | repo :553 | implement or remove |
| Module spec absent | **GAP-5**: no notifications MODULE_SPEC; scope inferred | P3 | V1 RECOMMENDED `[BLOCKED BY MISSING SPEC]` | docs tree | author spec once inbox ships |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| 19-type taxonomy in schema (incl. comms.* used by base modules) | schema enums | several types ahead of dental workflows | low | Keep; don't add types without producers `[DO NOT OVERBUILD]` |
| Recall dispatch arriving before "Phase-2 automation" label | `recallDispatch.ts` | FR2.18 declares Phase-2 | Useful, consistent, consent-gated | Keep (journey completes once GAP-1 lands) |
| 90-day cleanup job | jobs | inferred ops hygiene | none | Keep |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Booking/billing event → staff awareness | system→staff | create/finalize | row → in-app surface | Row only | **GAP-1** | producers tested |
| Appointment reminder | system→patient | T-leadHours | arm → consent gate → email/push | Implemented (delivery) | GAP-2 (push reach), GAP-3 | armer tests |
| Recall due → patient → booking | system→patient→staff | recall date | dispatch → deliver → (patient acts) | Delivery ✓; in-app completion blocked | **GAP-1** | matrix journey row accurate |
| Preference management | staff | settings | defaults panel + per-patient consent | Implemented (Batch 4) | No | relabel verified |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Producer row creation | typed rows on events | Implemented | 10 producers | V1 REQUIRED | done |
| Consent-gated channel resolve | fail-closed outbound | Implemented | resolver | V1 REQUIRED | done |
| Scheduled delivery cron | per-channel send | Implemented | repo :342-547 | V1 REQUIRED | done |
| In-app visibility | bell/inbox | Missing | GAP-1 | V1 REQUIRED | |
| Push permission + click | opt-in UX | Missing | GAP-2 | V1 RECOMMENDED | |
| Read-state tracking | mark read | Implemented (unreachable) | handlers | V1 REQUIRED | rides GAP-1 |
| SMS provider | deferred | Not Required for V1 | P4 note | V2 DEFERRED | |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Assistant sees "payment pending" | staff | in-app alert | Missing surface | GAP-1 | V1 REQUIRED | FR10.9 |
| Patient gets 24h reminder | patient | email/push per consent | Implemented (email); push blocked by opt-in | GAP-2 | V1 REQUIRED | armer+delivery |
| Patient recall nudge | patient | due/reminder sends | Implemented | No (delivery) | V1 REQUIRED | dispatch |
| Staff reviews missed notifications | staff | inbox + mark read | Missing | GAP-1 | V1 REQUIRED | 0 consumers |
| Honest preferences | staff | defaults + real gate visible | Implemented | No | V1 REQUIRED | Batch 4 |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-1 no in-app surface | FE affordance | P1 | V1 REQUIRED | 4 ops 0 consumers | Every in-app producer writes into a void; FR10.9 unmet; recall journey can't complete | Bell+inbox (small, additive, backend frozen) |
| GAP-2 push opt-in | FE UX | P2 | V1 RECOMMENDED | exported fns uncalled | Wired OneSignal path has zero real reach | prompt + click routing |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Visit completes unpaid → assistant alerted | in-app alert visible | row invisible | GAP-1 | P1 | E2E: complete→bell badge→inbox row |
| Recall due → patient reminded → books | full loop | delivery yes; in-app leg dead | GAP-1 | P1 | journey E2E post-fix |
| User enables push | browser prompt | never asked | GAP-2 | P2 | FE-unit prompt flow |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| 4 read ops + SDK hooks | API/FE hooks, 0 consumers | spine+grep | P1 | Wire (GAP-1) |
| `requestNotificationPermission`, `onNotificationClick` | FE fns, 0 callers | grep | P2 | Wire (GAP-2) |
| medical-priority branch | dead backend branch | repo :553 | P3 | GAP-4 |
| SMS channel | enum-only | :524-531 | declared P4 | keep deferred |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Idempotent scheduled enqueue (entity+type+channel+scheduledAt) | backend | armer | — | none (good) |
| Status FSM queued→sent→delivered→read/failed/expired; deliveredAt dropped (Batch 3) | schema | tsp + schema | — | none |
| Expiry-on-change prevents stale reminders | backend | scheduling handlers | — | none |
| Push fails closed when OneSignal unconfigured (status=failed) | backend | repo :518-521 | — | acceptable; observability via status |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Read ops owner-scoped to recipient | read guards | `notifs.test.ts` ownership pins | — | none |
| Outbound consent fail-closed; in-app exempt (never leaves platform) | consent | resolver :74-117 | — | none (sound design) |
| No PHI in notification title/message convention | content | producer patterns | P3 `[NEEDS CONFIRMATION]` | spot-check producers during GAP-1 work |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| 90-day cleanup purges rows (by design; not a compliance record) | retention | cleanup job | — | none |
| consentValidated recorded per row | consent trail | schema | — | none |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Producer fan-in from 6+ modules; consumer fan-out = zero | spine + grep | classic write-only subsystem | GAP-1 unlocks all producers' value at once |
| Reminder/recall jobs ride the shared `core/jobs.ts` scheduler | jobs/index | consistent with governance-round finding | none |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Front-desk awareness (payment pending, check-in) is an in-app need, not email | FR10.7/10.9 | GAP-1 is the staff-facing half of the module | P1 |
| PH patients respond to SMS > email; SMS deferred P4 is a known market trade-off | PRD personas | document in spec when authored | note |

## 18. Webwright / Playwright Findings

Not used — absence of any notification surface is statically conclusive; no journey spec exists to inspect. No evidence saved.

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `notifs.test.ts` + e2e notifs test | backend | ops, ownership, filters, pagination | High |
| `reminderArmer.test.ts`, `recallDispatch.test.ts` | backend | consent gating, suppression, idempotency | High |
| `createAppointment.notif.test.ts`, `finalizeInvoice.notif.test.ts` | backend | producer triggers | High |
| `notifs.hurl` | contract | list/filter/mark-all + deliveredAt-absent pin | High |
| `notification-settings.test.ts` | frontend | parsing/toggles only | Medium (no enforcement assert) |
| E2E | — | none | — |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Inbox FE: bell badge count, list renders, mark-read updates | frontend/component | GAP-1 RED-first | Before |
| E2E: producer event → bell → inbox → mark read | E2E | journey completion proof | During |
| Push opt-in prompt flow + click deep-link | frontend/component | GAP-2 | Before |
| Template-tag registration assertion | backend | GAP-3 | Anytime |
| Settings enforcement coherence (defaults panel vs actual gate) | integration | guard Batch-4 relabel honesty | Anytime |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| PersonConsent (dental-patient) is the single enforced gate | cross-module `[SHARED DEPENDENCY]` | resolver | patient GAP-4 (silent consent save) directly corrupts sends | fix patient GAP-4 alongside |
| Email module template registry | cross-module | mapping | GAP-3 | assertion test |
| OneSignal env config | environment/tooling | core/notifs | push inert without it | document in spec |
| Billing overdue producer blocked by billing GAP-1 (no overdue status) | cross-module `[CROSS-MODULE RISK]` | WF-083 | overdue emails impossible until billing cron lands | sequence after billing batch |
| Inbox lands in dashboard shell | cross-module | shell | placement | coordinate |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Bell + unread badge + inbox panel (list/mark-read/mark-all) | GAP-1 | P1 | V1 REQUIRED | FE RED + E2E | backend frozen; hooks already generated |
| Push permission prompt + notification click routing | GAP-2 | P2 | V1 RECOMMENDED | FE RED | small |
| Template registration pin | GAP-3 | P3 | V1 RECOMMENDED | backend | quick |
| Remove/implement medical-priority branch | GAP-4 | P3 | V1 RECOMMENDED | unit | quick |
| Author notifications MODULE_SPEC | GAP-5 | P3 | V1 RECOMMENDED | none | post-inbox |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| SMS provider | V2 DEFERRED (P4 declared) | enum-ready; provider decision later |
| Invoice-overdue emails (WF-083) | V2 DEFERRED | declared gap + upstream billing dependency |
| Appointment confirmation-request flow | V2 DEFERRED | enum-only, no workflow defined |
| New notification types without producers | DO NOT ADD `[DO NOT OVERBUILD]` | taxonomy already ahead of usage |
| Real-time websocket push for in-app | DO NOT ADD (unprompted) | polling inbox suffices for V1 |

## 24. Audit Decision

**PARTIAL PASS.**

The matrix under-credited this module: row creation (10 producers), idempotent scheduling, fail-closed consent resolution, and per-channel delivery (email + OneSignal push) are implemented and well-tested, and both prior contract/settings gaps (G2, G4) are verified fixed. The pipeline is real.

It is not a PASS because the user-facing half is absent: there is no in-app surface of any kind (bell/inbox/badge — 4 read ops with zero consumers), so FR10.9 staff alerts and the recall journey cannot complete, and push can never reach a real user because the permission prompt is never invoked. Both are additive FE work against a frozen backend.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Inbox placement/shape — bell-popover only, or dedicated route too? | `[NEEDS CONFIRMATION]` | GAP-1 scope | Product/Design |
| Q2: Push opt-in moment (first login vs settings-only)? | `[NEEDS CONFIRMATION]` | GAP-2 UX | Product |
| Q3: Do notification titles/messages ever embed PHI today? | `[NEEDS CONFIRMATION]` | content hygiene | Eng |

## 26. Notes for Gap Plan Organizer

- **Truly V1 (decision-light):** GAP-1 (inbox — the unlock for every producer), GAP-2 (push opt-in), GAP-3/4 (quick pins).
- **Likely batch shape:** Batch A = inbox (FE-only + E2E journey); Batch B = push opt-in; Batch C = pins + spec doc (GAP-5).
- **Blocked/sequenced:** WF-083 overdue emails after billing's overdue cron lands; SMS stays deferred.
- **Must NOT implement:** websockets, SMS provider, new types.
- **Tests first:** inbox FE RED; push prompt RED.
- **Cross-module:** patient comms-consent silent-save fix (patient GAP-4) protects send correctness; billing overdue dependency noted.
- **Do not re-litigate:** G2 relabel, G4 deliveredAt, consent resolver, delivery pipeline.

---

Next recommended step:
Module/group: Notifications
Module slug: notifications
Primary PRD/spec: PRD FR10.7/10.9/FR8.9 + WORKFLOW_MAP §8 (module spec to be authored)
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/notifications-gap-plan.md
