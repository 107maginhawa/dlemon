# AHA Fix Report: Notifications — Batch A (In-App Surface)

**Executed:** 2026-06-11 · **Prompt:** `04-module-or-group-fix-tdd.md` · **Branch:** `chore/workflow-verification-sweep` (NOT pushed) · **Batch:** A (FIX-001 in-app bell/inbox; FIX-002…006 = later batches, not in this pass).

## What shipped (FIX-001 — GAP-1 in-app notification surface)

Pure FE consumption of already-generated, already-tested SDK ops — **no TypeSpec / SDK regen / schema / backend change** (the notifications backend is frozen). The module was built backend-first with a producer fan-in from 6+ modules but **zero consumers**; this wires the user-facing surface that was the root gap.

- `hooks/use-notifications.ts`
  - `useNotifications()` over `listNotificationsOptions({ query: { status: 'unread', channel: 'in-app', limit: 25 } })`. **Single source of truth:** the unread badge count is `pagination.totalCount` and the panel rows are `data` from the *same* query — they cannot diverge (structurally immune to the summary-vs-body coherence bug class). `refetchInterval: 60s` keeps the badge live without websockets (per §11 Do Not Build).
  - `useMarkNotificationRead()` / `useMarkAllNotificationsRead()` over the generated `markNotificationAsRead` / `markAllNotificationsAsRead` mutations; both `invalidateQueries({ queryKey: listNotificationsQueryKey() })` (partial-key match → badge + panel refetch).
- `notification-bell.tsx` — bell control + unread badge in the shell header with a toggle-open inbox panel (rows: title / message / time; per-row "Mark read"; header "Mark all read"; honest loading / error / empty states). Plain state-toggled positioned div (no Radix portal) for deterministic happy-dom testing and a minimal shell edit.
- `routes/_dashboard.tsx` — one additive mount: `<NotificationBell/>` in the header (`ml-auto`), rendered on every dashboard route. `app-sidebar.test.tsx` and the shell stay green.
- `test-setup.ts` — added `Bell` to the lucide mock allow-list (fixed allow-list convention).

Notifications are **recipient-scoped server-side** (the `listNotifications` handler filters by the authenticated user's id), so a member only ever sees their own rows — no branchId/tenant param is sent and none is needed.

## Adversarial review → fixes folded in (before commit)

A 4-lens adversarial workflow (14 agents: contract-shape / coherence-ux / phi-security / regression-test-a11y) confirmed **8 real, in-scope findings, 0 out-of-scope**. All fixed in this batch, each pinned by a test:

| # | Sev | Finding | Fix |
| --- | --- | --- | --- |
| 1 | P1 | Silent truncation: badge counts true total but panel lists only the first page (limit 25) with no indicator | Honest **"Showing N of M unread" footer** when `unreadCount > rows` (`data-testid="notification-more"`) |
| 2 | P2 | Coherence test never exercised `totalCount > page` | Mock now **paginates honestly** (`data` = page, `totalCount` = full); new >page-size test asserts the footer |
| 3 | P2 | Badge-on-error behavior untested | New test: on query error (no data) the badge is hidden — never a stale count beside an error panel |
| 4 | P1 | Per-row `aria-label` duplicated notification title (PHI) into the a11y layer | Removed the custom label — the visible row text is the sufficient accessible name |
| 5 | P1 | Button `aria-label` (exact count) vs visual badge (`9+`) divergence for SR | Badge span marked `aria-hidden` → the exact count on the button is the single authoritative SR signal; visual `9+` is decorative |
| 6 | P2 | `Number('9+')` = NaN would break the coherence oracle for N>9 | Dedicated N=12 test pins the `9+` cap; oracle retained for the ≤page case |
| 7 | P2 | Dialog had no Escape-to-close | Escape keydown handler closes the panel (matches `use-sheet-a11y` convention) |
| 8 | P2 | No focus management for the dialog | `tabIndex={-1}` + focus-into-panel on open, return-focus-to-bell on close |

## Verification (fresh runs)

| Layer | Result |
| --- | --- |
| Component (`notification-bell.test.tsx`) | **15 pass / 0 fail** — bell + badge from `totalCount`, unread/in-app query scoping, open→rows, **coherence oracle** (badge == unread rows), real stateful mark-read round-trip (row leaves + badge decrements), mark-all clears, empty / error / **no-stale-badge-on-error**, **truncation footer**, `9+` cap, **Escape close**, focusable panel |
| Notifications + shared shell (`app-sidebar`) + settings feature | **97 pass / 0 fail** |
| Typecheck (root FE + `@monobase/api-ts`) | both **exit 0** |

## Q3 PHI spot-check (checklist, per plan §14)

Inbox renders notification title/message to the **recipient only** (recipient-scoped handler). Producer titles/messages (e.g. `createAppointment` confirmation with a timestamp) describe the recipient's own context — not a cross-user disclosure. The one a11y-layer over-disclosure (redundant title in the per-row aria-label) was removed (finding #4). **No producer-side violation to escalate.**

## Not implemented (later batches / out of scope)

- **FIX-002** (Batch B) push opt-in prompt + click routing; **FIX-003/004/005/006** (Batch C) template-tag assertion, dead `isMedicalNotification` removal, MODULE_SPEC, settings-coherence test.
- Per §10/§11: SMS provider, WF-083 invoice-overdue emails (blocked by billing GAP-1), websockets, new notification types, public create endpoint, dedicated inbox route, any change to delivery pipeline / consent resolver / settings relabel / `deliveredAt` contract.

## Decision queue (unchanged from plan)

No new product decisions surfaced. Pre-resolved UX defaults adopted: bell + popover only (no dedicated route, Q1); explicit settings opt-in for push (Q2, Batch B); FIX-004 = remove the dead medical-priority branch (Batch C).

---

# Batch A backfill + Batch B + Batch C — MODULE COMPLETE

**Executed:** 2026-06-12 · Branch `chore/workflow-verification-sweep` (NOT pushed) · Commits: A-backfill `8e151da0` · B `adf1e994` · C `5f4b5f80`.

**Two product-decision overrides** of this fix-ready plan were applied (per `docs/aha/outputs/product-decisions.md`): **Q2 push moment** = prompt at the **first relevant clinical action** (not settings-only/login) → opt-in mounted in the patient-workspace shell; **FIX-004** = medical-priority notifications **fail-open / bypass quiet-hours-batching** (NOT "remove the dead branch") → the predicate became a real classifier rather than being deleted.

## A backfill — FIX-001 producer→inbox E2E (`8e151da0`)
The Batch-A component tests proved the bell/inbox in isolation; this backfills the FR10.9 reachability proof (downgraded P1→P2 in the roadmap). New `apps/dentalemon/tests/e2e/notification-inbox.spec.ts`: seeds a REAL in-app notification via the booking module — the logged-in member hosts a booking event, books their own open slot, then cancels it; `cancelBooking` writes to `recipient: user.id`. Single user (host == client) → no auth switch to corrupt the in-memory PIN session. Asserts the seeded "Booking Cancelled" row surfaces in the dashboard-shell bell → inbox → mark-read decrements. Non-vacuous: the unread badge only renders when `unreadCount > 0`. Additive only (one spec). E2E 1/1 (chromium), notification-bell 15/0, FE typecheck + eslint 0.

## B — FIX-002 push opt-in + click routing (`adf1e994`)
`PushOptInPrompt` (dismissible nudge) mounted in `_workspace.tsx` (first clinical action); honest absence when push unconfigured (`isOneSignalEnabled()` false); `requestNotificationPermission()` only on the user gesture; stops nagging after grant/deny/dismiss (`localStorage`). `usePushNotificationRouting` (in the dashboard shell) registers a single OneSignal click listener (no-op when unconfigured; once-per-page — the SDK can't unregister) → pure `makeNotificationClickHandler`/`resolveNotificationDeepLink` map the backend push `data: {type, relatedEntity}` to a deep link (booking/appointment→/calendar, recall→/patients, billing→/billing, unknown→/dashboard, never a dead tap). FE-only; OneSignal live delivery stays `[BLOCKED BY ENVIRONMENT]` — DI adapters test prompt/routing logic (no SDK module mock → no cross-file pollution). 3-lens: no blockers/majors; folded NITs (assert real `'billing'` producer type; z-40 so the nudge never overlaps workspace bottom-sheets). Gate: push-opt-in 6/0, routing 6/0, prompt 4/0, notifications+settings+sidebar 55/0, FE typecheck + eslint 0.

## C — FIX-003/004/005/006 pins + hygiene + MODULE_SPEC (`5f4b5f80`)
Extracted `notification-classification.ts` (pure: email-template map + Phase-2 unregistered tags + `MEDICAL_NOTIFICATION_TYPES` + classifiers); the two private repo methods now delegate (behavior-identical — review diffed the map byte-for-byte; empty medical set ≡ the old `return false`).
- **FIX-003** — §15 found a **LIVE** seam (not just a test gap): reminderArmer/recallDispatch create email-channel reminders whose types map to tags absent from `EmailTemplateTags` (only `auth.*` registered, no `.hbs`) → an email-consented reminder queues a row that **fails at process time** (`resolveTemplateByTags`→null→`markAsFailed`). In-scope honest disposition (batch is test/doc-only; §11 forbids overbuilding email templates): a **registry-invariant** test (every mapped tag REGISTERED or documented-Phase-2 — catches a NEW phantom tag) + the Phase-2 set **pinned to its exact 4 tags** (closes the self-widening escape hatch) + MODULE_SPEC Phase-2 flag + roadmap. Did NOT author the 4 templates and did NOT change send behavior.
- **FIX-004** — product decision overrode the plan's "remove": replaced the hardcoded `return false` (misleading dead code) with a real, live, set-driven classifier `isMedicalNotificationType` over an empty `MEDICAL_NOTIFICATION_TYPES`. No quiet-hours/batching exists anywhere → fail-open is already satisfied for every notification; no V1 medical types. Non-vacuous (true for an in-set type — would fail under the old hardcoded false — and false over every real producer type).
- **FIX-006** — coherence pins that the clinic "Notification Settings" defaults panel cannot override the consent gate: `resolveConsentedChannels` has no preferences input; consent decides per patient (2 backend pins) + the `NOTIFICATION_CONSENT_NOTICE` honesty relabel bound to the live export (1 FE pin).
- **FIX-005** — authored `docs/product/modules/notifications/MODULE_SPEC.md` (shipped surface: in-app inbox, push opt-in/routing, channels, consent gate, medical fail-open, email Phase-2 gap).
3-lens: no blockers/majors; folded the MINOR (spec said 19 types → 18) + NITs (exact Phase-2 pin; §10b email-fails-at-process wording). Gate: notifs backend 26/0 + reminder/recall consumers 51/0 (no regress), resolver 12/0, FE settings 19/0, FE notifications+settings 50/0, api-ts + FE typecheck 0, eslint 0 errors, **no contract/SDK/TypeSpec change** (no regen).
