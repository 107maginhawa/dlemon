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
