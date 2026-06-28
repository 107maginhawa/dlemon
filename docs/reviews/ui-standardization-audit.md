# Dentalemon UI/UX Standardization — Phase 1 Audit

**Scope:** `apps/dentalemon` only. Standard of record: `PRODUCT.md` (§Accessibility, §Design Principles) + `DESIGN.md` (§2 Color, §3 Typography, §4 Components, §5 Layout). Targets: iPad (768/1024px) + macOS desktop (1440px).
**Status:** READ-ONLY audit complete. No code changed. Awaiting approval before Phase 2.

---

## Patched prompt (3 fixes applied to the original)

1. **Standards reattached.** The pasted prompt referenced "the hard standards above" with no such block. The standard is: design tokens not raw Tailwind palette (`text-gray-*`/`bg-slate-*` → `muted`/`secondary`/`foreground`); the rem type scale not `text-[Npx]` literals; 44px touch targets; `focus-visible` rings + focus-trap on overlays; color never the sole signal; `prefers-reduced-motion` alternatives; AA contrast (body ≥4.5:1).
2. **Audit scope widened.** UI weight is in `src/features/**` (227 tsx, 17 modules) and `src/components/**` (14), not routes (33, mostly thin shells/layouts/tests). Audit walks features+components grouped into modules.
3. **Triage required.** Each surface marked already-compliant vs needs-work; Phase 2 may conclude a module needs nothing. Honor intentional exceptions: `workspace-payment-modal` + `appointment-modal` deliberately don't use the shared `Dialog` primitive (DESIGN.md §4); raw hex inside canvas/SVG chart-draw files is legitimate; `data-testid` goes on an inner `<div>` because the test harness drops it on `DialogContent`.

Minor: findings live here (`docs/reviews/`); browser verification needs API (:7213) + MinIO + vite (:3003) booted and the PIN-guarded workspace reached via SPA nav (hard `goto` drops the in-memory PIN); login `demo@dentalemon.com` / `DemoClinic1!` / PIN `123456`.

---

## What's already on-system (do NOT churn)

- **Token system is complete and mature** — full HSL semantic set + `lemon`, `status-{done,planned,diagnosed}`, `dental-*`, `success/warning/info` with AA-readable `-foreground` inks (`tailwind.config.ts`, `globals.css`). Deviation = measurable.
- **Font-size debt is already a tracked ratchet** — `scripts/check-arbitrary-font-size.ts`, BASELINE **326**, ratcheted down from 348 across prior passes. The sweep is the vehicle to lower it further, not a new problem.
- **FSM/status color tokens gated** — `scripts/check-fsm-tokens.ts` runs in `lint`.
- **Overlay focus-trap mostly done** — 18/24 hand-rolled `fixed inset-0` overlays already use `useSheetA11y` (trap-capable per recent commit). Dialog unification (PR #51) already migrated 6 modals to the shared primitive.

---

## Cross-cutting findings (evidence)

| # | Finding | Severity | Evidence |
|---|---------|----------|----------|
| X1 | **Raw Tailwind palette instead of tokens** — `text-gray-*/slate-*/zinc-*/neutral-*` | P1 | 357 occurrences. Concentrated: imaging (17 files), workspace (10), scheduling (4), staff (2). |
| X2 | **Off-scale font literals** `text-[11px]/[13px]/[15px]` bypass rem scale (hurts iPad legibility + user font-scaling) | P1 | 326 (ratchet baseline). Concentrated: workspace (13 files), scheduling (7), billing (7), dashboard (5). |
| X3 | **Untrapped real modals** — interactive forms without `useSheetA11y` focus-trap | **P0** | `staff-create-modal.tsx` (12 interactive els), `staff-edit-modal.tsx` (16). Keyboard/screen-reader users can tab out of an open modal. |
| X4 | **Untrapped overlays — triage** | P2 | `apply-template-button`, `reports/invoice-detail-sheet`, `patients/patient-statement` (form, but print-oriented). `chart-export-overlay` is a `window.print` surface — likely exempt. |
| X5 | **`focus-visible` coverage gap** | P1 | 58/131 interactive files have focus rings. ~73 interactive files lack a visible keyboard-focus indicator. |
| X6 | **State-coverage holes** (empty/loading/error) | P1 | dashboard error=0/7; scheduling empty=0/12; staff error=0/6; portal empty=0 error=0 (4); imaging empty=1/28; case-presentation empty=0/7. |
| X7 | **Sub-44px interactive targets** | P1 | ~9 interactive els with explicit `h-8/h-9/h-[<44px]`. Spot-fix during each module pass. |
| X8 | Raw hex in className/style (non-canvas) | P2 | 4 files, all chart/tooth draw (`dental-chart`, `timeline-carousel`, `cdt-code-browser`, `universal-tooth`) — mostly legitimate canvas color; verify the non-canvas spots only. |

---

## Module triage & recommended Phase 2 order

Ordered by (impact × deviation density). Highest-traffic + most-deviated first.

| Order | Module | Surfaces | Triage | Headline work |
|-------|--------|----------|--------|---------------|
| 1 | **staff** | staff.tsx, features/staff (6) | **needs-work (P0)** | X3 focus-trap on create/edit modals; error state (X6); palette (X1). Small + has the only P0 → first. |
| 2 | **workspace / charting** | _workspace/$patientId, features/workspace (61, incl. perio) | needs-work | Largest surface: X2 (13 files), X1 (10), touch targets, focus-visible. Already heavily polished — fix deviations, don't redesign. |
| 3 | **billing** | billing.tsx, features/billing (29) | needs-work | X2 (7 files, dense tables). Honor the 2 exempt transactional panels. |
| 4 | **imaging / ceph** | imaging-* routes, features/imaging (28) | needs-work | X1 (17 files — worst palette offender); empty states (X6, 1/28). Exclude canvas draw colors. |
| 5 | **scheduling** | calendar.tsx, features/scheduling (12) | needs-work | X2 (7), empty states (0/12), palette. |
| 6 | **dashboard** | _dashboard/dashboard.tsx, features/dashboard (7) | needs-work | X2 (5), error states (0/7). |
| 7 | **patients** | patients.tsx, patients_/$patientId, features/patients (18) | light | X2 (3); patient-statement overlay triage (X4). |
| 8 | **settings** | settings.tsx, features/settings (27) | light | X2 (2); good state coverage already. |
| 9 | **reports** | reports.tsx, features/reports (4) | light | invoice-detail-sheet overlay triage (X4). |
| 10 | **portal** | portal.{index,bills,appointments}, features/portal (4) | needs-work (states) | empty=0 error=0 — patient-facing, add states. |
| 11 | **case-presentation** | features/case-presentation (7) | light | empty=0; signature-pad hex verify. |
| 12 | **onboarding / auth / booking** | onboarding, dental-onboarding, auth/*, book.$branchId | verify-only | First-run + public surfaces; check states + 44px. |

---

## Phase 2 protocol (per module, on branch `feat/dialog-extract-billing-ux` or a fresh `feat/ui-standardize-<module>`)

1. Read the module's surfaces; apply only token/scale/a11y/state fixes from this audit — no logic, data, or routing changes.
2. Migrate `text-[Npx]` → rem scale and **lower `BASELINE` in `check-arbitrary-font-size.ts`** by the count removed.
3. `bun run typecheck` + `bun run lint` (includes `check:fsm-tokens` + `check:font-size`) green.
4. Browser-verify changed surfaces at 768/1024/1440 with before/after evidence.
5. Atomic commit, then STOP and report before the next module.

**Recommendation:** start with **staff** (only P0, smallest blast radius) to validate the protocol end-to-end, then proceed down the table.

---

## Deferred backlog (do later)

Tracked here so nothing is silently dropped. None block shipping; each needs its own visually-verified pass.

### From module 1 — staff ✅ (commit `5d045bd6`)
- **B1** Role-badge categorical colors in `staff-list.tsx` (`getRoleBadgeClass`: amber/blue/green/purple per role) left as raw palette — there is no token set for categorical role hues. Candidate: add a `role-*` token group if we want these on-system. P2.
- **Audit correction:** "staff error=0" was a false grep signal; `staff-list.tsx` already has error/loading/empty states. No work.

### From module 2 — workspace ✅ (commit `344241c0`)
- **B2** `workspace-payment-modal.tsx` — 15 off-scale literals incl. 3 `text-[15px]`. Intentional dense money panel + `getByRole('dialog',{name})` tests; needs an individually-verified pass. P1 (ratchet).
- **B3** `dental-chart.tsx` — canvas glyph colors (`bg-gray-900`/`slate-700` tooth markers) + 6 palette uses. Mostly legitimate visual encoding; verify the non-canvas spots only. P2.
- **B4** Perio dense-grid internals — `perio-tooth-column.tsx` (`bg-zinc-700` dark "plaque present" chip + ~8 palette uses), `perio-site-cell`, `perio-chart-grid`, `perio-cal-cell`. Dedicated legibility pass already touched these; re-tokenizing needs per-grid visual verification. P2.
- **B5** `chart-export-view.tsx` — 7 palette uses; it's a print surface, tokenize against print styles. P2.

### Cross-cutting (whole-app, after the module sweep)
- **B6** ✅ DONE — `focus-visible` coverage gap (~69 hand-rolled-button files lacked a keyboard ring). Fixed with ONE `@layer base` rule in `globals.css` (`a/button/[role=button]/tab/menuitem/switch/option/summary :focus-visible → 2px lemon outline + offset`). shadcn/Radix primitives keep their own ring (their `focus-visible:outline-none` in the utilities layer wins by @layer order), so no double-ring. Verified: bare buttons get the outline, primitives don't. Note: lemon-on-white outline is low-contrast by the app's existing focus aesthetic — strengthening the focus indicator app-wide (darker/companion ring for WCAG 2.4.11) is a separate design-system call if wanted.
- **B7** ✅ DONE — sub-44px touch targets: insurance-card close 36→44px; imaging viewer rotate/flip 40→44px; apply-template-button, patient-image-list upload, claim-detail Cancel → `coarse:min-h-[44px]` (44px on touch, compact on mouse). Calendar appointment chips (`min-h-[30px]`) intentionally excluded — they're sized to time-duration; forcing 44px breaks the time grid (tap-to-open handles touch).
- **B8** Untrapped overlay triage (X4) — `apply-template-button`, `reports/invoice-detail-sheet`, `patients/patient-statement` (verify real-modal vs print); `chart-export-overlay` is a `window.print` surface, likely exempt. P2.

### From module 4 — imaging ✅ (safe slice only)
- **Audit correction:** the "worst palette offender, 17 files" flag was a false signal. ~240 raw-palette uses are an **intentional dark PACS/radiology viewer theme** (bg-zinc-800/900/950, border-zinc-700, light text on dark, lemon active accent) — a deliberate convention so X-rays/ceph pop, not sloppy deviation. Confirmed in `imaging-workspace.tsx` (dark toolbar + buttons). Only the 5 off-scale font literals and 2 light-Dialog Cancel buttons were genuine deviations; those are fixed.
- **B9** ~~Make the imaging dark viewer theme-able~~ — **DECIDED 2026-06-28: leave hardcoded-dark.** The dark PACS viewer is an intentional, coherent radiology convention; tokenizing 53 surfaces for theme-ability that's unlikely to be needed is speculative effort with real regression risk. Won't-do unless an app-wide dark mode or a real viewer-theming requirement lands. Closed.
- **B10** Imaging empty-state coverage is thin (1/28). Adding empty states is a feature addition beyond standardization; scope separately. P2.

### From module 5 — scheduling ✅
- Migrated 15 off-scale literals (calendar day/week/month, appointment-card, recall-due-list, queue-board) → text-xs/sm/base. Tokenized light-surface status palette in appointment-card, calendar-week/month, waitlist-panel → secondary/muted/border tokens. Baseline 178 → 163.
- **appointment-modal** (1 literal) left untouched — it's the second DESIGN-exempt transactional panel; folded into **B2** (handle both exempt panels together in a verified pass).
- **B11** Appointment/calendar cards use **side-stripe status borders** (`border-l-*`), which impeccable flags as an anti-pattern. It's the calendar's established status language; replacing it (full borders / bg tints / leading status dot) is a redesign needing design review, not a token swap. Colors are now tokenized; the pattern decision is deferred. P2.

### From module 6 — dashboard ✅
- Migrated 14 off-scale literals (metric-card, morning-briefing, attention-queue, kpi-ribbon, schedule-timeline) → text-xs/sm. Baseline 163 → 149. Palette already clean (the morning-briefing hex is JS chart data, not className).
- **B12** Dashboard home has no error-state UI for its data fetches (schedule/kpi/attention; only morning-briefing handles error). Adding error/empty fallbacks is feature work (needs error UI + wiring), scoped separately from the token sweep. P1.

### From module 7 — remaining light modules ✅ (batched, each audited individually)
Audited every remaining module for font/palette/className-hex deviations before touching anything; most were already clean.
- **patients** — 8 literals (follow-up-notes, patient-profile-page, duplicate-patients-panel) → text-xs/sm; `dental-chart-thumbnail` dashed placeholder `border-gray-600` → `border-muted-foreground`.
- **settings** — 4 literals (data-erasure, audit-log) → text-xs/sm.
- **pmd** — `pmd-viewer` superseded badge `bg-gray-100 text-gray-500` → `bg-secondary text-muted-foreground`.
- **notifications** — `notification-bell` 1 literal → text-xs.
- **reports, portal, case-presentation, onboarding, booking, person, org, auth** — audited, **0 deviations** (clean). The earlier "hex" flags (signature-pad, patient-folder-card, dental-chart) are JS/canvas draw colors, not className — legitimate, left as-is.

Baseline 149 → 136. Residual whole-app literals are text-[10px] (Micro role, no rem token) + the deferred B2 dense panels.

### Status: all 12 module groups swept. Remaining work = the tracked backlog (B1–B12) only.
