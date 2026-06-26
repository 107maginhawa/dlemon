# Dashboard / Home Redesign — Design Reference + First-Slice Spec

**Branch:** `ux/workspace-first-slice` · **Date:** 2026-06-25 · **Status:** approved, ready to build
**Surface:** `apps/dentalemon/src/features/dashboard/` (Home / `/_dashboard/dashboard`)

---

## Part 1 — Design reference (the "why")

### Problem with the current Home

- **A wall of zeros.** Six equally-weighted `MetricCard`s read `0`, `₱0.00`, `0`, `0`, `1`, `1`. The screen reports counts; it never answers "what's my day?"
- **No focal point.** Two rows of three identical cards = flat hierarchy. The single most important thing for a clinician — *today's chair timeline* — has the same visual weight as "Lab Orders."
- **Vanity metrics.** "Pending Treatments: 0 — *Check workspace for treatment details*" is a proxy count that punts. Every number should be a verb (click through to an action).
- **Dead empty states.** "0 appointments today" / "No appointments tomorrow" just sit there — no "add one," no "view the week," no reason the day is empty.
- **Fake data.** The Reminders block ("Reorder composite resin", "X-ray calibration due") is hardcoded with no backend — a credibility risk.

### What a dentist actually wants here (ranked jobs-to-be-done)

1. **"What does my day look like?"** — the chair-side **timeline**: each appointment with time, patient, procedure, and status, plus flags (new patient, outstanding balance, etc.). This is the spine of the screen.
2. **"Who needs action right now?"** — unconfirmed appointments, patient waiting, overdue balances, **lab cases due today**, payment plans behind.
3. **"Are there gaps in my chair time?"** — schedule utilization / open slots (deferred past first slice).
4. **"How's the practice doing?"** — production & collections, glanceable and **secondary**, not the headline.

### Inspiration — one pattern to steal from each

| App | Steal |
|---|---|
| **Jane App** ("Today") | Day-as-agenda you work top-to-bottom; calm, schedule-first home. |
| **Dentrix Ascend** (Home Route) | Per-appointment clinical flags (alert / balance / unsigned). |
| **Curve / Dentally** | Confirmation-status pills + "who's unconfirmed" front-desk queue. |
| **Things 3** ("Today") | Humane empty states ("Nothing today"), the daily-plan metaphor. |
| **Linear** | Calm density; ⌘K command palette for power users (future). |
| **Stripe Dashboard** | Thin KPI ribbon + activity split — numbers never own the whole screen. |

### Modern best practices applied

- Schedule-first, not metrics-first.
- One focal point; <5s glanceability.
- Every metric is actionable (click-through); kill vanity counts.
- Empty states are onboarding, not dead ends.
- No fake data.
- Role-aware (front desk vs dentist) — extend the existing `canViewFinancials` split.
- Color reserved for semantic status; lemon for the primary action only (already done well).

---

## Part 2 — First-slice spec (the "what we build now")

### Goal

Replace the flat 6-card grid with a **command-center layout**: a Today timeline hero + a right-rail action queue + a compact KPI ribbon. **Data-only** — reuse the existing `useDashboardSummary` query and SDK fetches. No backend, no new endpoints.

### Layout

```
Greeting · date          [+ Patient] [+ Appt] [Open Workspace]   ← slim, unchanged
┌──────────────────────────────────────────┬────────────────────┐
│ TODAY · Mon Jun 25                        │ NEEDS ATTENTION     │
│ ────────────────────────────────────────  │ • 2 unconfirmed     │
│ 9:00  ● Maria S.   Cleaning      ✓ done    │ • 1 checked-in      │
│ ─ now ───────────────────────────────────  │ • overdue ₱…  (fin) │
│ 11:00 ● Juan R.    RCT      ⚠ balance      │ • lab due (fin)     │
│ (empty → "No appointments today.           │ • plans behind (fin)│
│           [Add appointment][View week]")   │ ───────────────────  │
│                                            │ TODAY'S NUMBERS     │
│                                            │ Collected ₱… (fin)  │
│                                            │ Done / Remaining    │
└──────────────────────────────────────────┴────────────────────┘
UP NEXT — Tomorrow Jun 26 · N appts                  [Open calendar]  ← kept, shrunk
```

Grid: `lg:grid-cols-[2fr_1fr]`, single column on mobile (rail stacks below timeline).

### Components (new, under `features/dashboard/components/`)

1. **`schedule-timeline.tsx`** — `<ScheduleTimeline appointments now onAdd onViewWeek />`
   - Renders today's appointments sorted by time, each row: time · patient (initials avatar) · serviceType · status pill · balance flag (when financial).
   - **Now-line**: a divider inserted before the first appointment whose `scheduledAt > now` (pure helper, testable).
   - Empty state: copy + `[Add appointment]` (→ `/calendar`) + `[View week]` (→ `/calendar`).
2. **`attention-queue.tsx`** — `<AttentionQueue items />`
   - Derives action items from existing data: unconfirmed/`scheduled`, `checked_in`, `overdueInvoices` (financial), `overdueLabOrders` (financial), `paymentPlansBehind` (financial). Each item click-through navigates to the relevant route. Hidden items collapse; empty queue shows a calm "All clear."
3. **`kpi-ribbon.tsx`** — compact horizontal strip: `dailyCollectionsCents` (financial), done count, remaining count. Reuses formatting helpers.

`MorningBriefing` becomes the composition root: greeting + quick actions (unchanged) → `[ScheduleTimeline | (AttentionQueue + KpiRibbon)]` → Tomorrow "Up next" (kept, shrunk). **Remove** the Reminders block and the 6 `MetricCard`s from the grid.

### Helpers (add to `morning-briefing.helpers.ts`, pure + unit-tested)

- `sortByTime(appointments)` — ascending by `scheduledAt`.
- `nowLineIndex(sortedAppointments, now)` — index to insert the now-line, or `-1`.
- `buildAttentionItems({ appointments, overdueInvoices, overdueLabOrders, paymentPlansBehind, showFinancials })` → `AttentionItem[]` (`{ id, label, count, tone, route }`). Financial-only items omitted when `showFinancials === false`.

### What we keep / reuse

- `useDashboardSummary` (unchanged), `MetricCard` (still used by KPI ribbon or kept for reuse), all formatting helpers, `canViewFinancials`, lemon/semantic tokens, `tabular-nums`.

### Role behavior

- `showFinancials === false` (e.g. `staff_full`): AttentionQueue drops financial items; KPI ribbon drops collections and shows done/remaining only. No financial data leaks — matches existing `getDashboardSummary` 403-tolerance.

### Out of scope (deferred)

Schedule utilization %, operatory/chair column, ⌘K palette, real tasks/inventory surface, fuller front-desk role split, AI/imaging summary card.

### Testing (TDD — tests first, RED → GREEN)

- **Unit** (`morning-briefing.helpers.test.ts` additions): `sortByTime`, `nowLineIndex` (before-all / after-all / mid-day / empty), `buildAttentionItems` (financial vs non-financial, zero-state).
- **Component** (`schedule-timeline.test.tsx`, `attention-queue.test.tsx`): renders rows; empty state renders CTAs; now-line position; financial items hidden when `showFinancials=false`.
- **Existing** `morning-briefing.test.ts` updated for the new composition (remove Reminders/6-card assertions; assert timeline + queue + ribbon present via testids `schedule-timeline`, `attention-queue`, `kpi-ribbon`).
- **E2E**: Playwright check that `/dashboard` renders the timeline region and (with empty data) the empty-state CTAs — verified by an E2E agent, not a human checkpoint.

### Acceptance gate

`bun run typecheck` + `bun run lint` + `bun run test` (FE) green, no regressions; new + updated tests pass; Playwright dashboard smoke green; zero financial leakage in non-financial role.
