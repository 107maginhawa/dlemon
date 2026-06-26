# iPad / Mac-desktop UI refine — execution reference

Branch: `design/ipad-desktop-refine`. Refine-within-constraints pass on `apps/dentalemon`
(Vite + TanStack, web :3003 / API :7213). NOT a rebrand. Every decision derives from
`docs/architecture/DESIGN.md` (Apple HIG + #FFE97D lemon) and existing tokens.

Breakpoints: iPad portrait 768, iPad landscape 1024, Mac desktop 1440 (sanity 1680).
Demo login: demo@dentalemon.com / DemoClinic1! / PIN 123456. PIN drops on full reload/HMR —
navigate via in-app SPA clicks, re-PIN after edits.

## Scope: 3 surfaces (Billing dropped after review — see below)

### 1. Dashboard — `src/features/dashboard/components/morning-briefing.tsx`
Defect: `md:grid-cols-3` fires at 768 while the 200px sidebar stays put → cramped 3-up,
truncated text, "View all" wraps under its label.
Fix: adopt the repo-proven pattern from `billing-list.tsx:143`
`grid-cols-1 md:grid-cols-2 lg:grid-cols-3` (and `lg:grid-cols-[2fr_1fr]`); update skeleton
grids to match; `shrink-0` on `metric-card.tsx` action button.

### 2. Calendar — `src/features/scheduling/components/calendar-day.tsx`
Defect: 30 dashed "+ Book" boxes (opacity-50 at rest) dominate; 2 real appts get lost.
Single day column stretches full width at desktop (~half wasted).
Fix: empty slots resting `opacity-0`, reveal on `group-hover` + `focus-visible`. Cap day
grid `max-w-3xl` left-aligned at desktop; iPad full width. Respect prefers-reduced-motion.
FLAG (don't fix): appt card not filling row width / "+ Book" bleed-through = concurrent-column
width math, out of scope.

### 3. Patient profile — `src/features/patients/components/patient-profile-page.tsx`
Defect: `max-w-4xl mx-auto` single column; desktop right ~40% empty.
Fix: header full-width; below, at `lg:` → `lg:grid lg:grid-cols-[320px_1fr]` with
HouseholdCard + InsuranceCard in left rail, Recent Visits in wide right column. Widen to
`max-w-6xl`. Below lg unchanged.

## Billing — DROPPED (review verdict)
Already correct: summary cards use `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
(billing-list.tsx:143, comment cites iPad-portrait fix PP-9/ISSUE-045); table has
`overflow-x-auto`; status pills already follow DESIGN.md §Badges via `getStatusBadgeClass`
(draft = intentional muted gray). Invoice modal clean at all breakpoints. No real defect —
forcing a change = manufactured work.

## Batch 2: 4 dashboard routes (Patients dropped, Staff trimmed)

### 4. Reports — `src/features/reports/components/{revenue,treatment,patient}-report.tsx`
Defect: summary cards `md:grid-cols-4` (revenue) / `md:grid-cols-3` (treatment+patient)
fire at 768 behind the fixed 200px rail → money figures cram into ~120px columns,
"COLLECTION RATE" wraps; header (title + date range + Export) squished into one row;
Invoices table clipped off the page right edge (no scroll).
Fix: grids → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-{4,3}` (skeletons matched);
header → `flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`, date group
`flex-wrap`; date inputs `h-9`→`h-11` (44px iPad touch); each table's bordered
container gets `overflow-x-auto` (scroll instead of page clip).

### 5. Settings — `src/features/settings/components/settings-page.tsx` (shell only)
Defect: 13-section pill bar `flex-wrap w-fit` wraps to 4-5 rows at 768; content pane
full-bleed-ish, form capped ~576px left-aligned → entire desktop right-half empty.
Fix: wrap nav+panel in `lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8`. Below lg
the nav is a single horizontal scroll row (`flex overflow-x-auto`, pills
`whitespace-nowrap`); at lg it flips to a sticky left rail
(`lg:flex-col lg:overflow-visible lg:bg-transparent lg:p-0 lg:self-start lg:sticky lg:top-6`,
items `lg:w-full`). Buttons get `min-h-[44px]` (matches patient-folder-card) + lemon
`focus-visible:ring-ring`. Used `minmax(0,1fr)` per the documented clip gotcha.

### 6. Staff — `src/features/staff/components/staff-list.tsx`
Defect (mild): 4-col table sprawls full desktop width for a handful of staff → large
inter-column eye-travel at 1440.
Fix: cap the StaffList root `max-w-5xl` (header+table cap together, left-aligned; mirrors
calendar-day cap); table container `overflow-hidden`→`overflow-x-auto` (safety net).
GOTCHA (reverted): adding `whitespace-nowrap` to the role badge widened the table past
568px at iPad portrait and pushed Edit/Deactivate off-screen — net worse than a wrapped
pill. Don't nowrap cells whose row also holds the primary actions at constrained widths.

### Patients — DROPPED (review verdict)
Already correct: `flex flex-wrap gap-4` of fixed `w-48` folder cards in a `max-w-[1600px]`
container distributes cleanly (5-up @1440, 2-up @768). No grid breakpoint trap (it's
flex, not grid), no dead space, skeleton matches. Forcing a change = manufactured work.

## Gates (must stay green, no regressions)
- `bun run typecheck`, `bun run lint` (--max-warnings 200), `bun run check:boundaries`
- font-size ratchet: NO net-new `text-[Npx]` literals — use existing `text-xs/sm` + rem tokens
- No new deps, no animation libs, no backend/schema/generated-file edits
- Quality floor: focus-visible rings, prefers-reduced-motion, responsive to 768

Before screenshots: scratchpad `before/{dashboard,calendar,patient,billing-list,billing-detail}-{768,1024,1440}.png`
