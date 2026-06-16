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

- [ ] **Batch 1 — Accessibility (additive)** 🟢 — aria-*, roles, alt, key handlers. No visual change.
- [ ] **Batch 2 — Design-token compliance** 🟢/🟡 — token foundation + color swaps + shared `<StatusBadge>`.
- [ ] **Batch 3 — Feedback** 🟢 — sonner toasts on mutations; replace native `alert/confirm/prompt`.
- [ ] **Batch 4 — Focus rings & micro-interactions** 🟢/🟡 — `focus-visible` rings, `active:` states.
- [ ] **Batch 5 — Touch targets (44px)** 🟡 — raise sub-44px controls. Layout-sensitive.
- [ ] **Batch 6 — Structural a11y** 🟡 — `<div onClick>` → `<button>` conversions.
- [ ] **Batch 7 — Loading & CLS** 🟡 — `<Skeleton>` swaps + intrinsic `<img>` dims.
- [ ] **Batch 8 — Performance / CWV** 🟠 — code-splitting, manualChunks, list virtualization.
- [ ] **Batch 9 — Forms** 🟠 — disable-on-submit, inline validation, success confirmation.

Counts after dedupe: **High 53 · Medium 50 · Low 14 · Total 117**.

---

## Batch 1 — Accessibility (additive) 🟢

- [ ] `reports.tsx:40-59` + `settings-page.tsx:37-49` — tab bars: add `role="tablist"`/`role="tab"`/`aria-selected`/`aria-controls`. **High [UX]**
- [ ] `revenue-report.tsx:158-162` — `<tr onClick>` drill-down: add `role="button" tabIndex={0}` + Enter/Space `onKeyDown`. **High [Technical]**
- [ ] `personal-info-form.tsx:218-231` — avatar Camera/Remove icon buttons: add `aria-label`. **High [UI]**
- [ ] `notification-settings.tsx:133-142` + `working-hours.tsx:133-142` — custom toggles: add `aria-pressed={state}`. **Medium [UI]**
- [ ] `staff-create-modal.tsx:168` + `staff-edit-modal.tsx:175` — add Escape-to-close `onKeyDown`. **Medium [UI]**
- [ ] `patient-folder-card.tsx:76` — `role="button"` div: handle Space (`'Enter' || ' '`) + `preventDefault`. **Medium [UX]**
- [ ] `address-form.tsx:195-207` — country combobox: add `aria-required`. **Low [UI]**
- [ ] imaging `<img>` alt text — `CephReportView.tsx:179`, `FmxMount.tsx:59-65`, `comparison-view.tsx:188` — descriptive alt (modality/date). **Medium [UI]**

## Batch 2 — Design-token compliance 🟢/🟡

**2a — Token foundation (config + CSS, no visual change):**
- [ ] `tailwind.config.ts` `colors.dental` — add `implant`, `watchlist`, `healthy`, `extracted` (vars already in globals.css). **High [UI]**
- [ ] `tailwind.config.ts` — add `lemon.accent` (#C8B800 emphasis) for CDT selected/star. **High [UI]**
- [ ] `globals.css` — add `--dental-watchlist-foreground` (higher-contrast); add `--phase-*` accent vars. **Medium [UI]**

**2b — Shared primitive:**
- [ ] Create `<StatusBadge status=...>` (one place) mapping → `bg-success/15 text-success`, `bg-warning/15`, `bg-destructive/15`, `bg-info/15`. Migrate call sites in 2c. **High [UI]**

**2c — Pure class swaps (consume tokens):**
- [ ] `dental-chart-thumbnail.tsx:32` — `bg-[#007AFF]` → `bg-dental-implant`. **High [UI]**
- [ ] `dental-chart.tsx:217-258` — inline SVG `#B8860A`/`#007AFF`/`#9CA3AF` → `hsl(var(--lemon|--primary|--border))`. **High [UI]**
- [ ] `treatment-plan-tab.tsx:46-51` — `PHASE_ACCENTS` hardcodes → read `--phase-*` vars. **High [UI]**
- [ ] `cdt-code-browser.tsx:215-287` — 5× `#c8b800` → `border-lemon-accent`/`text-lemon-accent`. **High [UI]**
- [ ] `morning-briefing.tsx` (173-176, 225, 278, 300, 332, 374, 383) + `metric-card.tsx:28-31` — palette → semantic tokens. **High [UI]**
- [ ] Status badges → `<StatusBadge>`: `billing-list.tsx:42-58`, `workspace-payment-modal.tsx:52-62`, `invoice-detail.helpers.ts:154-173`, `invoice-detail-sheet.tsx:45-52`, `patient-folder-card.tsx:129,138`, `patient-profile-page.tsx:49-54,150-154,236-242`, `treatment-plans-sheet.tsx:76-84`, `perio-comparison.tsx:36`, `case-presentation-view.tsx:158`, `accepted-plan-viewer.tsx:44`, revenue/patient reports. **High [UI]**
- [ ] `billing-list.tsx:143,161` — `text-red-500`/`text-amber-600` → `text-destructive`/`text-warning`. **Medium [UI]**
- [ ] inline-style brand colors → tokens: `patient-profile-page.tsx:85,345`, `workspace-top-bar.tsx:149-156` (`rgba(255,233,125,0.3)` → `bg-lemon/20`), `signature-pad.tsx:31` (canvas read `--foreground`). **Medium [Technical]**
- [ ] `queue-board.tsx:91` + `recalls-sheet.tsx:270` — `hover:bg-[#f5df6a]` → `hover:bg-lemon-hover`. **Medium [Technical]**
- [ ] `tooth-overview-step.tsx:120,264,289,314,329` — off-whites + watchlist → `bg-secondary/20-30`, `bg-dental-watchlist`. **Medium [UI]**
- [ ] `pre-completion-checklist.tsx:210-212` — `text-[#34C759]`/`text-[#FF9500]` → `text-success`/`text-warning`. **Medium [UI]**
- [ ] `patients.tsx:114` — `bg-[#FFF9DB]` → `bg-accent`. **Medium [UI]**
- [ ] `queue-board.tsx:37` — `bg-[#FFF8D6]` → `bg-accent`. **Low [Technical]**
- [ ] Auth: `onboarding.tsx:217`, `verify-email.tsx:53` `bg-gray-50` → `bg-background`; `verify-email.tsx:63` blue → `bg-accent text-accent-foreground`; `index.tsx:28,35,42` `bg-blue/green/purple-500` → `bg-primary/bg-success/bg-info`; `onboarding-wizard.tsx:304` inline lemon → `<Button variant="lemon">`. **High [UI]**

## Batch 3 — Feedback (sonner toasts; replace native dialogs) 🟢

- [ ] Add `toast.success`/`toast.error` to mutations (`onSuccess`/`onError`). **High:** `clinic-activation-banner.tsx:25`, `data-erasure.tsx:233-234`, `calendar.tsx:148-165` (check-in/confirm), `appointment-modal.tsx:189-195`, `BookingWizard.tsx:233-238,260-278`. **Medium:** `use-image-library.ts:85-149` (5), `lab-orders-sheet.tsx:107-119`, `pmd-import.tsx:76-118`, `rx-sheet.tsx:267`, `consent-sheet.tsx:274`, `invoice-detail.tsx` record-payment, `treatment-table.tsx` price edit, `imaging-workspace.tsx:275`. **[UX]**
- [ ] Replace native dialogs: `patients.tsx:84` `alert()` → `toast.error`; `patient-list.tsx:96,114,126` `window.confirm()` → `<ConfirmDialog>`; `imaging-workspace.tsx:279-286` `window.prompt()` → `<Dialog>` w/ validated input. **High [UX]**
- [ ] `medical-history-form.tsx` — allergy toggle: toast on add/remove. **Medium [UX]**
- [ ] Portal empty/error: `my-appointments-view.tsx:97-111` + `my-invoices-view.tsx:106-120` — add `Try again` (`refetch()`). **Medium [UX]**
- [ ] `treatment-table.tsx:430-442` — editable price cell: hover/focus cue + `toast.success` on save. **Medium [UX]**
- [ ] `pin-entry.$memberId.tsx:197` — keypad: `active:scale-95 transition-all`. **Low [UX]** *(also Batch 4)*

## Batch 4 — Focus rings & micro-interactions 🟢/🟡

- [ ] `wizard-step-clinic.tsx:32,42,62,74`, `signature-pad.tsx:90`, `case-presentation-view.tsx:190` — add `focus-visible:ring-2 focus-visible:ring-ring`. **Medium–High [UI]**
- [ ] `staff-list.tsx:215-231`, `_portal.tsx:76-87` — add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`. **Medium [UI]**

## Batch 5 — Touch targets (Apple HIG 44px) 🟡

Shared fix: raise to `h-11`/`min-h-[44px]` or `<Button size="lg">`. **Verify wrapping/overflow per screen.**
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

## Progress Log

| Date | Batch | Commit | Gate result |
|------|-------|--------|-------------|
| 2026-06-16 | (tracker created) | — | — |
