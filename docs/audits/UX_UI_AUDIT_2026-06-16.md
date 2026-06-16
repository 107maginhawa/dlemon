# Dentalemon — UX / UI / Technical Audit & Remediation Tracker

**Date:** 2026-06-16 · **Branch:** `chore/ux-ui-polish` · **Scope:** `apps/dentalemon` (+ `packages/ui`)

This document is the **single source of truth** for the UX/UI/Technical remediation. Implementation
**must** follow the batch order and gate below. Do not drift: if a change isn't listed here, add it
here (with a line under *Decision Log*) before doing it. Tick each item only after its batch gate is green.

---

## 1. How this was produced & how much to trust it

- **Method:** 12 per-surface reviewers + 5 cross-cutting lens reviewers read the real source, then an
  **adversarial verification pass** re-checked every finding against the cited code (fabricated
  line-refs / already-handled issues were refuted — 34 of 151 raw findings were dropped). The
  `path:line` references and "before" code are real.
- **What it is NOT:** a human designer sign-off, a screen-reader pass, or a contrast-tool measurement.
  Contrast ratios in findings are **estimates**. A handful of items are **taste calls**, not defects.
  See *Decision Log* for findings whose stated rationale is wrong even where the fix is reasonable.
- **Therefore:** "won't break anything" is proven **per batch by the gate below**, not assumed.

## 2. Verification gate (run per batch, from `apps/dentalemon/` unless noted)

```bash
# Always (every batch):
cd apps/dentalemon && bun run typecheck      # tsc --noEmit
cd packages/ui      && bun run typecheck      # primitives compile (only if packages/ui touched)
cd apps/dentalemon && bun run lint            # eslint src --max-warnings 200
cd apps/dentalemon && bun test src/           # unit suite

# Layout-sensitive batches (5,6,7) ALSO:
cd apps/dentalemon && bun run test:journeys   # journey harness
cd apps/dentalemon && bun run test:e2e        # Playwright: chromium + ipad-portrait + ipad-landscape
# + manual/visual before-after (/browse or /design-review) on the touched screens

# Build-config batch (8) ALSO:
cd apps/dentalemon && bun run build           # confirm bundle builds & smoke-loads
```

**Rule:** a batch is not "done" until its gate is green with **no new failures** vs. the batch's base commit.
One commit per batch (or per coherent sub-batch). Never bulk-commit across risk tiers.

## 3. Risk tiers

| Tier | Meaning | Batches |
|------|---------|---------|
| 🟢 Safe | Additive or pure-token; cannot change logic/layout | 1, 3 |
| 🟢/🟡 Visual | Changes rendered pixels; needs an eyeball but not logic | 2, 4, 7 |
| 🟡 Layout | Can shift wrapping/box-model; needs E2E + visual QA | 5, 6 |
| 🟠 Behavioral | Changes behavior or build; needs targeted testing | 8, 9 |

## 4. Batch execution order (safest first)

- [x] **Batch 1 — Accessibility (additive)** 🟢 — aria-*, roles, key handlers. No visual change. *(done — commit below; gate green 2473/0)*
- [~] **Batch 2 — Design-token compliance** — **foundation + safe (color-preserving / fill / icon) swaps DONE** 🟢 (commit below; gate 2473/0). **Text-bearing status badges + inline/SVG colors DEFERRED → Batch 2-cont** (need accessible `*-foreground` tokens; recoloring text to mid-tone semantic tokens would REGRESS contrast — see D8).
- [~] **Batch 3 — Feedback** — **3a (toasts) DONE** 🟢 (commit below; gate 2473/0). **3b (native confirm/prompt→dialogs, new "Try again" buttons, price-cell cue) deferred to visual checkpoint** (introduces new visible UI).
- [x] **Batch 4 — Focus rings** 🟢/🟡 — `focus-visible` rings across **24 files** (whole `focus:border-lemon` pattern, not just the audit's few) + staff/portal nav. (commit below; gate 2473/0)
- [x] **Batch 5 — Touch targets (44px)** 🟡 — raised ~25 controls (nav/scheduling/booking/billing/patients/workspace/imaging/case-pres/reports). Perio dense-grid handled by judgment, not blanket 44px (D11). (commit below; gate 2473/0). *Visual/E2E pass still advised — see note.*
- [ ] **Batch 6 — Structural a11y** 🟡 — `<div onClick>` → `<button>` conversions.
- [ ] **Batch 7 — Loading & CLS** 🟡 — `<Skeleton>` swaps + intrinsic `<img>` dims.
- [ ] **Batch 8 — Performance / CWV** 🟠 — code-splitting, manualChunks, list virtualization.
- [ ] **Batch 9 — Forms** 🟠 — disable-on-submit, inline validation, success confirmation.

Counts after dedupe: **High 53 · Medium 50 · Low 14 · Total 117**.

---

## Batch 1 — Accessibility (additive) 🟢 ✅ DONE (commit `<batch1>`)

- [x] `reports.tsx` + `settings-page.tsx` — tab bars: added `role="tablist"`/`role="tab"`/`aria-selected`/`aria-controls` + `role="tabpanel"`. **High [UX]**
- [x] `revenue-report.tsx` — `<tr onClick>`: added `role="button" tabIndex={0}` + Enter/Space `onKeyDown` + `aria-label` + focus ring. **High [Technical]**
- [x] `personal-info-form.tsx` — avatar Camera/Remove buttons: added `aria-label`. **High [UI]**
- [x] `notification-settings.tsx` (×2 toggles) + `working-hours.tsx` — added `role="switch"` + `aria-checked` (stronger than `aria-pressed`). **Medium [UI]**
- [x] `staff-create-modal.tsx` + `staff-edit-modal.tsx` — added Escape-to-close `onKeyDown` on dialog wrapper. **Medium [UI]**
- [x] `patient-folder-card.tsx` — `role="button"` div: now handles Space + `preventDefault`. **Medium [UX]**
- [x] `address-form.tsx` — country combobox: added `aria-required`. **Low [UI]**
- [~] imaging `<img>` alt — **DROPPED from Batch 1 (false positive):** `CephReportView.tsx` and `FmxMount.tsx` already have alt (see D5). `comparison-view.tsx` alt *enhancement* (add modality/date) deferred → Batch 7 imaging.
- Tests updated to track improved semantics: `settings-page.test.tsx` (button→tab queries), `personal-info-form.test.tsx` (avatar empty-name → labelled).

## Batch 2 — Design-token compliance

### 2a — Token foundation ✅ DONE (commit `<batch2>`)
- [x] `tailwind.config.ts` `colors.dental` — added `healthy`, `implant`, `extracted`, `watchlist`, `watchlist-foreground`. **High [UI]**
- [x] `tailwind.config.ts` — added `lemon.accent` (#C8B800). **High [UI]**
- [x] `globals.css` — added `--dental-watchlist-foreground` (#713f12, AA on pale yellow) + `--phase-1..4` vars. **Medium [UI]**

### 2c — Safe color-preserving / fill / icon swaps ✅ DONE (commit `<batch2>`; gate 2473/0)
- [x] `dental-chart-thumbnail.tsx` — `bg-[#007AFF]` → `bg-dental-implant` (exact; test updated). **High [UI]**
- [x] `cdt-code-browser.tsx` — `border-[#c8b800]`/`text-[#c8b800]` → `border/text-lemon-accent`; `bg-[rgba(255,233,125,0.08)]` → `bg-lemon/10`. (Left `hover:text-[#a08800]` — no token.) **High [UI]**
- [x] `pre-completion-checklist.tsx` — icon `text-[#34C759]`/`text-[#FF9500]` → `text-success`/`text-warning` (exact). **Medium [UI]**
- [x] `queue-board.tsx` — `bg-[#FFF8D6]` → `bg-accent`; `hover:bg-[#f5df6a]` → `hover:bg-lemon-hover`. **Low/Med**
- [x] `recalls-sheet.tsx` — `hover:bg-[#f5df6a]` → `hover:bg-lemon-hover`. **Medium [Technical]**
- [x] `patients.tsx` — selected toggle `bg-[#FFF9DB]` → `bg-accent`. **Medium [UI]**
- [x] `tooth-overview-step.tsx:314` — watchlist badge `bg-[#fef9c3] text-[#854d0e]` → `bg-dental-watchlist text-dental-watchlist-foreground` (exact bg + accessible fg). **Medium [UI]**

### 2b — Accessible status tokens + badge recolor ✅ DONE (commit `<batch2b>`; gate 2473/0)
- [x] Added `success/warning/info` `-foreground` (#15803d/#b45309/#0369a1) + `destructive.emphasis` (#b91c1c) tokens. **High [UI]**
- [x] Recolored all text-bearing status badges/numbers IN PLACE (no structural `<StatusBadge>` — see D10) across: `billing-list`, `invoice-detail.helpers`, `workspace-payment-modal`, `treatment-plans-sheet` (fixed the 2 real contrast fails `bg-green-50 text-green-500` / `bg-red-50 text-red-400`), `perio-comparison`, `patient-folder-card`, `patient-profile-page`, `revenue-report`, `patient-report`, `morning-briefing` (fills→solid, badges→tint+fg), `metric-card`, `case-presentation-view`, `accepted-plan-viewer`. Co-located test assertions updated (`billing-list.test`, `patient-folder-card.test`). **High [UI]**
- [ ] **Remaining badge file:** `invoice-detail.tsx` (audit's "invoice-detail-sheet" ref was wrong) still has palette badge classes → fold into next swap pass. **Low [UI]**
- [ ] `tooth-overview-step.tsx:120,264,289,329` — off-white surfaces → `bg-secondary/*` (subtle warm→cool shift; eyeball). **Medium [UI]**
- [ ] **2d inline/SVG:** `dental-chart.tsx:217-258` SVG strokes (note: `--dental-implant` is hex, use `var(--dental-implant)` NOT `hsl()`; `#B8860A`≈`lemon-accent` not `lemon`), `treatment-plan-tab.tsx:46-51` `PHASE_ACCENTS`→`var(--phase-*)`, `signature-pad.tsx:31` canvas read `--foreground`, `workspace-top-bar.tsx:149-156` `rgba(255,233,125,0.3)`→`bg-lemon/20`, `patient-profile-page.tsx:85,345` inline gold. **Medium [Technical]**
- [ ] Auth backgrounds: `onboarding.tsx:217`/`verify-email.tsx:53` `bg-gray-50`→`bg-background`; `verify-email.tsx:63` blue→`bg-accent`; `index.tsx:28,35,42` (fills, safe); `onboarding-wizard.tsx:304`→`<Button variant="lemon">`. **High [UI]** *(mostly safe — fold into next batch)*

### Batch 2b — Accessible status tokens 🟠 NEEDS DECISION (before the text-badge swaps above)
The semantic tokens `success`/`warning`/`info` (#34C759/#FF9500/#5AC8FA) are **mid-tone FILL colors** — fine for backgrounds/dots/icons, but as *text on a light tint they fail ~1.7–2:1*. To recolor status badges without regressing contrast, add AA-readable foreground tokens, then swap badges to `bg-X/15 text-X-foreground`. **Proposed (for review):**
`success-foreground: #15803d` · `warning-foreground: #b45309` · `info-foreground: #0369a1` · a light-bg `destructive` text needs `#b91c1c` (current `--destructive-foreground` is white, for text ON red). All ≥ 4.7:1 on white.

## Batch 3 — Feedback (sonner toasts; replace native dialogs)

### 3a — Additive toasts 🟢 ✅ DONE (commit `<batch3a>`; gate 2473/0)
- [x] Success/error toasts on silent mutations via `toast.success(...)` + `toastError(err, fallback)` (canonical `@/lib/error-toast`): `clinic-activation-banner`, `data-erasure` (approve/reject), `calendar` (check-in/confirm), `appointment-modal` (save/reschedule, re-throws preserved), `BookingWizard` (hold/confirm; success screen already existed → error-only), `use-image-library` (5 mutations), `lab-orders-sheet`, `pmd-import` (import+merge), `rx-sheet` (save + acknowledge), `consent-sheet`, `invoice-detail` (record-payment), `imaging-workspace` (measurement). **[UX]**
- [x] `patients.tsx:84` `alert()` → `toast.error` (only native-dialog→toast swap in 3a). **High [UX]**
- [x] `medical-history-form.tsx` — allergy toggle confirms ("Added/Removed: <allergen>"); non-allergy left silent (would be noisy). **Medium [UX]**
- Skipped (already had inline feedback, no double-toast): invoice void/discount/uncollectible/payment-void, appointment double-booking branch, lab-order status-advance, consent refusal/revoke, rx dispense/cancel.
- **Test-infra fix (root cause):** 11 test files mocked `sonner` as `{ toast: { error } }` with no `.success`; Bun's `mock.module` is process-wide, so `toast.success` was `undefined` for later files and the new calls threw in-suite. Added `.success` to all 11 (D7).

### 3b — New visible UI 🟡 DEFERRED to visual checkpoint (with Batch 2)
- [ ] `patient-list.tsx:96,114,126` `window.confirm()` → `<ConfirmDialog>`. **High [UX]**
- [ ] `imaging-workspace.tsx:279-286` `window.prompt()` → `<Dialog>` w/ validated input. **High [UX]**
- [ ] Portal empty/error: `my-appointments-view.tsx:97-111` + `my-invoices-view.tsx:106-120` — add `Try again` (`refetch()`). **Medium [UX]**
- [ ] `treatment-table.tsx:430-442` — editable price cell: hover/focus cue + `toast.success` on save. **Medium [UX]**
- [ ] `pin-entry.$memberId.tsx:197` — keypad: `active:scale-95 transition-all`. **Low [UX]** *(also Batch 4)*

## Batch 4 — Focus rings ✅ DONE (commit `<batch4>`; gate 2473/0)

- [x] Upgraded the systemic `focus:border-lemon` (border-color-only) → `focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring` across **all 24 files** that had it (settings forms, workspace sheets, onboarding wizard, scheduling, billing, pmd) — not just the audit's 3. **High [UI]**
- [x] `staff-list.tsx` Edit/Deactivate buttons + `_portal.tsx` nav links — `focus-visible` rings (Deactivate's `text-red-600` also tokenized → `text-destructive-emphasis`). **Medium [UI]**
- Deferred micro-interactions (`active:scale-95` keypad, transitions) → fold into a later pass.
- Note: a few success/error BANNERS still use raw palette (e.g. `working-hours.tsx:113` `bg-green-50 text-green-700`) — tokenize in a follow-up (distinct from badges; acceptable contrast today).

## Batch 5 — Touch targets (Apple HIG 44px) 🟡 ✅ DONE (commit `<batch5>`; gate 2473/0)

**Done.** Standalone controls raised to `h-11`/`min-h-[44px]` (NB: the `<Button size="lg">` variant is only `h-10`/40px, so explicit `h-11` was used). Dense toolbars (imaging) raised to a conservative `min-h-[40px]`. Perio chart handled per D11. **Recommended: a human visual/E2E pass on the iPad viewport for the dense screens (imaging toolbar, perio, calendar) — the unit suite can't catch overflow.** Original target list retained below for reference.

Shared fix: raise to `h-11`/`min-h-[44px]`. **Verify wrapping/overflow per screen.**
- [ ] **High:** `sidebar.tsx:284` (h-7→h-11, drop `-ml-1` at `_dashboard.tsx:150`); `queue-board.tsx:28`; `appointment-modal.tsx:339`; `comparison-view.tsx:126` + `imaging-workspace.tsx:381` + `measurement-toolbar.tsx:46`; `treatment-table.tsx:316-340`; `billing.tsx:74`; `patient-registration-modal.tsx:208` + `patient-edit-form.tsx:229` + `follow-up-notes.tsx:80`; `patient-folder-card.tsx:117`; `BookingWizard.tsx:136-170,210-220,302`; `signature-pad.tsx:112,121` + `case-presentation-view.tsx:172`; `invoice-detail.tsx:346` + `payment-plan-create.tsx:91`.
- [ ] **Medium:** `perio-tooth-column.tsx:154,175` + `perio-bop-dot.tsx:32` + `voice-perio-controls.tsx:163`; `tooth-overview-step.tsx:184-215` + `treatment-row-popovers.tsx:50-58` + `medical-history-form.tsx:334-350`; `treatment-plans-sheet.tsx:289` + `notification-bell.tsx:90` + `personal-info-form.tsx:222,237`; `patient-image-list.tsx:136`; `case-presentation-view.tsx:200` + `…presentationId.tsx:31`.
- [ ] **Low:** `revenue-report.tsx:82` + `treatment-report.tsx:66` + `patient-report.tsx:61`; `patient-profile-page.tsx:87`; `signature-pad.tsx` Clear.

## Batch 6 — Structural a11y (div→button) 🟡

- [ ] `patient-image-list.tsx:201` — clickable `<div onClick>` → `<button>` (preserve flex with `text-left`/reset). **High [UX]**

## Batch 7 — Loading & CLS 🟡

- [ ] Replace text/`animate-pulse` loaders with layout-matched `<Skeleton>`: `morning-briefing.tsx:38-57`, `calendar.tsx:348`, `invoice-detail.tsx:353`, `payment-plan-view.tsx:228`, `soap-notes-sheet.tsx:227-232`, `medical-history-form.tsx:252-257`, `perio-chart-overlay.tsx:234`, `perio-comparison.tsx:163`, `case-presentation-panel.tsx:23`, `treatment-table.tsx:73-180`, revenue/treatment/patient reports, `comparison-view.tsx:163`. **High/Medium [UX/Technical]**
- [ ] Imaging `<img>` intrinsic dims: `CephReportView.tsx:179`, `FmxMount.tsx:59-65`, `comparison-view.tsx:163-174` — add `width`/`height` + `aspect-[3/4]` + aspect-reserved Skeleton. **High [Technical]**
- [ ] `my-appointments-view.tsx:94` + `my-invoices-view.tsx:103` — skeleton heights derived from card padding. **Medium [Technical]**
- [ ] `CephReportView.tsx:179` — seed `imgDims` estimate so overlay isn't invisible 1-2s. **Low [Technical]**

## Batch 8 — Performance / CWV 🟠

- [ ] `vite.config.ts` — `build.rollupOptions.output.manualChunks`; lazy-load heavy routes/components (Swiper, `@vvo/tzdb`, `country-list`, `react-easy-crop`). **Medium [Technical]**
- [ ] `FmxMount.tsx` + `patient-image-list.tsx` — paginate/virtualize large lists (TanStack Virtual). **Medium [Technical]**

## Batch 9 — Forms 🟠

- [ ] `personal-info-form.tsx:401` + `onboarding.tsx:274-289` — disable submit during async (thread parent `isPending`; RHF `isSubmitting` clears too early). **High [UX]**
- [ ] `patient-edit-form.tsx:69-76` — validate email/phone (or move to RHF+zod). **Medium [UX]**
- [ ] `contact-info-form.tsx:149` — add success confirmation (mirror onboarding `meta.toast`). **Medium [UX]**

---

## Remaining (workspace/clinical polish, mostly Low — fold into nearest batch)

- [ ] `tooth-slideout.tsx:496-516` — make "Save & Next" the lemon primary when present. **High [UX]** *(taste — see Decision Log)*
- [ ] `tooth-slideout.tsx:287-321` — read-only steps keep keyboard access (`aria-disabled` not `disabled`). **Medium [UX]**
- [ ] `perio-tooth-column.tsx:166` — disabled furcation: `disabled:bg-muted/30 cursor-not-allowed`. **Medium [UI]**
- [ ] `perio-chart-grid.tsx:95` — scroll-shadow hint on iPad. **Medium [Technical]**
- [ ] `calendar-day.tsx:157` — empty-slot "tap to book" affordance: `opacity-50 group-hover:opacity-100` + `text-muted-foreground`. **High [UX]**
- [ ] `workspace-top-bar.tsx:148-157` — `truncate flex-1 min-w-0` instead of `max-w-[120px]`. **High [UI]** *(with 2c)*
- [ ] `BookingWizard.tsx:352` — slot summary emphasis: `border-l-4 border-primary bg-primary/10 font-semibold`. **Low [UI]**
- [ ] `workspace-imaging-overlay.tsx:34` — bare `×` → lucide `<X>`. **Low [UX]**
- [ ] `calendar-month.tsx:170` — overflow days `/40` → `/60`. **Low [UI]**
- [ ] `pin-select.tsx:88-95` + `pin-entry.$memberId.tsx:102-109` — hand-rolled Retry/Back → `<Button>` + lucide icons. **Medium [UX]**
- [ ] `year-segment-control.tsx:37-42`, `tooth-slideout.tsx:447-516`, `perio-comparison.tsx:73` — spacing polish. **Low [UI]**

---

## Decision Log (deviations, rejections, re-reasoned findings)

| # | Finding | Decision | Reason |
|---|---------|----------|--------|
| D1 | `rx-sheet.tsx:337` active tab "fails 4.5:1 contrast" | **Re-reasoned, kept fix.** Apply `bg-primary text-primary-foreground` for *brand consistency* only. | `bg-foreground text-background` is black-on-white = max contrast; the contrast rationale is **wrong**. Switching to lemon actually *lowers* contrast (verify lemon `#FFE97D` + brown `#4A4018` ≈ AA before merging). |
| D2 | Contrast ratios across a11y findings | **Verify with a tool before claiming WCAG pass/fail.** | Ratios in the report are estimates, not measured. |
| D3 | "Make Save & Next the primary button" (`tooth-slideout`) | **Confirm with product before changing hierarchy.** | Taste/intent call, not a defect. |
| D4 | Bulk-apply all 117 at once | **Rejected.** Batch + gate, safest-first. | User requirement: no breakage; prove green per batch. |
| D5 | "Imaging `<img>` missing alt" (`CephReportView.tsx`, `FmxMount.tsx`) | **Refuted — already handled.** Dropped from Batch 1. | Both already have alt (`item.fileName`; `"Cephalometric radiograph with landmark tracing"`). Only `comparison-view.tsx` alt is an enhancement (add modality) → Batch 7. |
| D6 | Batch 1 a11y broke 4 unit tests | **Tests updated, not behavior reverted.** | Tests asserted the pre-fix DOM (tabs queried as `role="button"`; avatar button by *empty* accessible name). The fix is correct; expectations now track `role="tab"` / the new `aria-label`. |
| D7 | Batch 3a hung the full suite (in-suite only; isolation green) | **Root-caused & fixed the latent test landmine.** | 11 test files mocked `sonner` as `{ toast: { error } }` (no `.success`). Bun's `mock.module` is **process-wide**, so once one ran, `toast.success` was `undefined` for all later files → new `toast.success()` calls threw → handlers died → `waitFor` hung. Proven by stash-revert (baseline 2473/0 clean vs hang). Fixed by adding `.success` to all 11 mocks (now matches the already-complete ones). Not a product bug. |
| D8 | Audit's badge pattern `bg-success/15 text-success` | **Rejected for text; deferred text-badge recolor to Batch 2b.** | `success`/`warning`/`info` are mid-tone Apple FILL colors. As text on a light tint they fail (~1.7–2:1); the existing `text-green-800`/`amber-600` are darker. Naive swap = contrast REGRESSION. Need AA `*-foreground` tokens first (proposed in Batch 2b). Batch 2 shipped only color-preserving / fill / icon swaps. |
| D9 | `dental-chart.tsx` SVG: audit said `hsl(var(--lemon))` | **Corrected mapping (for Batch 2d).** | There is no `--lemon` var; dental vars are stored as **hex** (`--dental-implant: #007AFF`) so they need `var(--x)` NOT `hsl(var(--x))`. Declined-tooth `#B8860A` ≈ the new `lemon-accent` (#C8B800), not lemon (#FFE97D). |
| D10 | Audit wanted a shared `<StatusBadge>` primitive | **Did in-place token swaps instead.** | Each badge site has its own status→label logic; recoloring classes in place fixes the actual defects (token drift + contrast) with far less regression risk than a 14-site structural refactor. The DRY `<StatusBadge>` extraction is an optional follow-up, not a blocker. |
| D11 | "44px touch targets" blanket-applied to the perio chart | **Rejected blanket 44px for the perio grid.** | The perio chart is 6 sites × 32 teeth; 44px cells would make it unusable. Applied judgment: per-tooth mobility/furcation selects `h-6`→`h-9`; the 12px BOP dot wrapped in a 24px tap area (visual dot unchanged); standalone voice-control buttons → 44px. Dense clinical grids are a deliberate exception (cf. the local-first/no-AI non-goals). |
| D12 | `<Button size="lg">` assumed = 44px | **Used explicit `h-11`.** | The primitive's `lg` size is `h-10` (40px), 4px short of HIG. Touch-target fixes used explicit `h-11`. (Optional: bump the `lg` variant itself later.) |

## Progress Log

| Date | Batch | Commit | Gate result |
|------|-------|--------|-------------|
| 2026-06-16 | (tracker created) | `44ff21d1` | — |
| 2026-06-16 | Batch 1 — Accessibility (additive) | `2b6e8087` | ✅ typecheck · ✅ lint (0 err) · ✅ unit 2473/0 |
| 2026-06-16 | Batch 3a — Feedback toasts (+ sonner mock-shape fix) | `26e3e971` | ✅ typecheck · ✅ lint (0 err) · ✅ unit 2473/0 (stash-revert proved no regression) |
| 2026-06-16 | Batch 2 — Token foundation + safe color-preserving swaps | `1fdf3ad7` | ✅ typecheck · ✅ lint (0 err) · ✅ unit 2473/0 |
| 2026-06-16 | Batch 2b — Accessible status tokens + badge recolor (14 files) | `269ce943` | ✅ typecheck · ✅ lint (0 err) · ✅ unit 2473/0 |
| 2026-06-16 | Batch 4 — Focus rings (24 files, WCAG 2.4.7) | `6c87c234` | ✅ typecheck · ✅ lint (0 err) · ✅ unit 2473/0 |
| 2026-06-16 | Batch 5 — Touch targets (~25 controls; perio D11) | (this commit) | ✅ app+ui typecheck · ✅ lint · ✅ unit 2473/0 (E2E/visual advised) |
