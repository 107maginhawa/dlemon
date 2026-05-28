<!-- oli-audit v1 | dimension: ui-compliance | date: 2026-05-26 -->
# Frontend UI Compliance Audit

**Scope**: `apps/dentalemon/src/`
**Stack**: React 19, TanStack Router, Radix UI / shadcn, Tailwind CSS
**Date**: 2026-05-26

---

## Findings Table

| ID | Severity | Dimension | Description | File:Line | Fix |
|----|----------|-----------|-------------|-----------|-----|
| U01 | HIGH | Raw HTML | `<input>`, `<select>`, `<textarea>`, `<button>` used throughout — shadcn `Input`, `Select`, `Textarea`, `Button` exist but are bypassed. Worst offenders: soap-notes-sheet (17), onboarding-wizard (16), appointment-modal (12), treatment-table (12), rx-sheet (11), invoice-detail (11), tooth-slideout (10), lab-orders-sheet (9). Total ~75 files affected. | `features/workspace/components/soap-notes-sheet.tsx`, `features/onboarding/components/onboarding-wizard.tsx`, and ~55 more | Replace with shadcn `<Input>`, `<Button>`, `<Select>`, `<Textarea>` |
| U02 | HIGH | Hardcoded colors | `#FFE97D`, `#4A4018`, `#FFCC5E`, `#c8b800`, `#007AFF`, `rgba(255,233,125,…)` scattered across 60+ files instead of CSS custom properties / Tailwind tokens. `BRAND_GOLD` constant exists in `constants/brand` but is inconsistently used — same colour also hardcoded inline in the same file (`patient-profile-page.tsx:82 vs :86`). | `features/imaging/components/imaging-workspace.tsx` (31 hits), `features/onboarding/components/onboarding-wizard.tsx` (16 hits), `features/workspace/components/soap-notes-sheet.tsx` (10 hits), and 57 more | Define `--color-brand-gold`, `--color-brand-gold-text` in Tailwind config; replace all raw hex with `bg-brand-gold`, `text-brand-gold-text` tokens |
| U03 | HIGH | Missing loading/error | `VisitChartCard` in `timeline-carousel.tsx` calls `useQuery` (getDentalChartOptions) but destructures only `data` — no `isLoading`, `isPending`, or `isError` handling. Renders empty chart silently on network failure. | `features/workspace/components/timeline-carousel.tsx:63` | Destructure `isLoading`, `isError`; render skeleton or error badge per card |
| U04 | MEDIUM | Raw HTML | PIN entry keypad uses raw `<button>` (4 instances: back button, "Forgot PIN?" link, keypad digit buttons). Functionally correct but bypasses the design system `Button` component. | `routes/auth/pin-entry.$memberId.tsx:119,142,172,182` | Acceptable for custom numeric keypad — see note below; at minimum apply `asChild` pattern or extract `KeypadButton` with consistent focus ring |
| U05 | MEDIUM | Hardcoded colors | `timeline-carousel.tsx` uses `border-[#FFCC5E]` for the active card accent border (different shade from the `#FFE97D` design token). Creates visual inconsistency. | `features/workspace/components/timeline-carousel.tsx:76` | Unify to `border-brand-gold`; also the `bg-[#FFE97D]` accent bar at line 82 should use the same token |
| U06 | MEDIUM | Missing aria | `follow-up-notes.tsx` has a `<textarea>` and `<button>` (Submit) with zero ARIA attributes. Submit button has `onClick` but no `aria-label`. | `features/patients/components/follow-up-notes.tsx:54,67,69` | Add `aria-label="Add follow-up note"` to button; add `id` + `<label>` or `aria-label` to textarea |
| U07 | MEDIUM | Missing aria | `patient-list.tsx` Export and "Bulk Archive" buttons (lines 145, 157) have `onClick` with no `aria-label`. | `features/patients/components/patient-list.tsx:145,157` | Add `aria-label="Export patients"` and `aria-label="Archive selected patients"` |
| U08 | MEDIUM | Missing aria | `patient-folder-card.tsx` wraps the entire card in a clickable `<div>` — no `role="button"` or `tabIndex` — making it unreachable by keyboard users. | `features/patients/components/patient-folder-card.tsx:112` | Add `role="button" tabIndex={0} onKeyDown` or convert to `<button>` |
| U09 | MEDIUM | Raw HTML | `fee-schedule.tsx` uses 3 raw `<input>` + 1 raw `<button>` with hardcoded `#FFE97D` focus ring via `outline-none` + `focus:border-[#FFE97D]`. Removes the browser default focus ring without replacing it with a WCAG-compliant alternative. | `features/settings/components/fee-schedule.tsx:100,107,113,130` | Use shadcn `Input` (has built-in focus ring); use shadcn `Button variant="default"` styled via token |
| U10 | MEDIUM | Inline style | `calendar-week.tsx` and `calendar-day.tsx` use `style={{ color: isHour ? undefined : 'transparent' }}` — opacity/visibility should be `invisible` or `opacity-0` Tailwind class, not an inline colour override. | `features/scheduling/components/calendar-week.tsx:137`, `features/scheduling/components/calendar-day.tsx:87` | Replace with `className={isHour ? '' : 'invisible'}` |
| U11 | LOW | Raw HTML | PIN select screen's member cards use raw `<button role="button">` — `role="button"` is redundant on a `<button>` element (causes double announcement by screen readers). | `routes/auth/pin-select.tsx:44` | Remove redundant `role="button"` |
| U12 | LOW | Missing loading | `pin-select.tsx` fetches members inside `useEffect` with `fetch()` but has no loading state — the list renders empty with "No staff members found" until data arrives, indistinguishable from a real empty result. | `routes/auth/pin-select.tsx` (PinSelectRoute useEffect) | Add `isLoading` state; show spinner or skeleton cards until fetch resolves |
| U13 | LOW | Missing error | `pin-select.tsx` has a bare `.catch(() => {})` — network errors are silently swallowed, no user feedback. | `routes/auth/pin-select.tsx:useEffect catch block` | Catch and set error state; render error message with retry option |
| U14 | LOW | Hardcoded color | `dental-chart-thumbnail.tsx:32` uses `bg-[#007AFF]` (iOS system blue) for "needs treatment" tooth status. Not part of the design system. | `features/patients/components/dental-chart-thumbnail.tsx:32` | Define a semantic tooth-status token (e.g., `bg-tooth-needs-treatment`) in Tailwind config |
| U15 | LOW | Inline style | `patient-profile-page.tsx:82,324` mixes `BRAND_GOLD` constant (inline style) with raw `#FFE97D` hardcoded string in className on the same component — dual pattern for same colour. | `features/patients/components/patient-profile-page.tsx:82,86,324` | Consolidate to one pattern (token-based className preferred) |
| U16 | LOW | Raw HTML | `_dashboard.tsx` uses raw `<button>` (sidebar trigger) — confirmed by `grep` returning zero `useQuery`/loading refs, but the shell button lacks `aria-label`. | `apps/dentalemon/src/routes/_dashboard.tsx` | Add `aria-label` to sidebar toggle button |
| U17 | LOW | Missing aria | `dental-chart.tsx` renders tooth cells with `onClick` (2 raw `<button>` hits) but chart cells have no `aria-label` indicating tooth number / current status. | `features/workspace/components/dental-chart.tsx` | Add `aria-label={`Tooth ${toothNumber}: ${status}`}` per cell |

---

## Dimension Summary

| Dimension | Issues Found | Severity |
|-----------|-------------|----------|
| Raw HTML elements (no shadcn) | U01, U04, U09, U16 — ~75 files, 200+ instances | HIGH / MEDIUM |
| Hardcoded colors | U02, U05, U14, U15 — 60 files, ~180 instances | HIGH / MEDIUM / LOW |
| Missing loading / error states | U03, U12, U13 | HIGH / LOW |
| Missing ARIA / accessibility | U06, U07, U08, U11, U17 | MEDIUM / LOW |
| Inline styles | U10, U15 | MEDIUM / LOW |
| PIN auth screens | U04, U11, U12, U13 — partially compliant | MEDIUM / LOW |
| Dental chart / timeline carousel | U03, U05, U17 | HIGH / LOW |

---

## Overall UI Compliance Score

**5.5 / 10**

Reasoning:
- PIN auth screens show the right pattern (aria-label on every keypad key, focus-visible ring, role=status on dot indicators, role=group on keypad) — good fundamentals.
- `imaging-ceph-report` has proper isLoading/isError guards — sets a good example.
- `app.tsx` has correct isPending/error patterns.
- Raw HTML elements are pervasive — the design system components exist (`components/input.tsx`, `components/textarea.tsx`, `components/sidebar.tsx`) but are underutilised in feature code.
- 60+ files hardcode brand colors that have a `BRAND_GOLD` constant already defined — the extraction work is done but adoption is ~30%.
- Silent fetch failures (`pin-select` catch:no-op) and missing loading skeletons in the timeline carousel are user-facing UX regressions.

---

## Top 3 Issues to Fix Immediately

### 1. U01 — Raw HTML elements (HIGH)
~200 instances of `<input>`, `<select>`, `<textarea>`, `<button>` bypass the design system. Start with the highest-traffic paths: `soap-notes-sheet.tsx`, `treatment-table.tsx`, `appointment-modal.tsx`. Use shadcn `Input`, `Button`, `Select`, `Textarea` — they include focus rings, dark-mode tokens, and ARIA patterns out of the box.

### 2. U02 — Hardcoded hex colors (HIGH)
60 files use raw `#FFE97D` / `#4A4018` / `rgba(255,233,125,…)`. The `BRAND_GOLD` constant in `@/constants/brand` already exists — the fix is (a) add `brand-gold` and `brand-gold-text` to `tailwind.config` as semantic tokens, then (b) run a codebase-wide find-replace. `imaging-workspace.tsx` alone has 31 hardcoded colour hits and should be prioritised.

### 3. U03 — Timeline carousel missing loading/error state (HIGH)
`VisitChartCard` calls `useQuery` without handling `isLoading` or `isError`. On slow connections or API failures, the dental chart renders empty with no feedback — clinically confusing. Add a `Skeleton` card while loading and a muted error badge on failure. This is a one-file, low-effort fix with high clinical UX impact.

---

## PIN Auth Screens — Accessibility Assessment

**Overall: PASS with minor issues (U04, U11, U12, U13)**

| Check | pin-entry.$memberId.tsx | pin-select.tsx |
|-------|------------------------|----------------|
| aria-label on interactive elements | PASS — every keypad button has `aria-label={key}`, back button has `aria-label="Go back to profile selection"` | PASS — member cards have `aria-label=\`Sign in as ${member.displayName}\`` |
| role=status for live PIN dots | PASS — `role="status"` with descriptive `aria-label` | N/A |
| role=group on keypad | PASS — `role="group" aria-label="PIN keypad"` | N/A |
| focus-visible ring | PASS — `focus-visible:ring-2 focus-visible:ring-primary` on member cards | PASS |
| keyboard navigation | PASS — Keyboard module via Swiper not applicable here; standard tab order | PARTIAL — card is `<button>` so tab-accessible |
| Error/lockout feedback | PASS — lockout UI with time, error message, forgot-PIN link | FAIL (U12/U13) — no loading state, silent network errors |
| Redundant ARIA | N/A | FAIL (U11) — `role="button"` on `<button>` element |
| Loading state | N/A | FAIL (U12) — bare `useEffect` fetch, no loading indicator |

`pin-entry.$memberId.tsx` is the stronger of the two — solid accessibility implementation. `pin-select.tsx` needs loading skeleton + error handling added to the fetch side.

---

## Dental Chart & Timeline Carousel Assessment

**dental-chart.tsx**: No `useQuery` call (data passed as props) — loading handled by parent. Raw `<button>` on tooth cells but no aria-label per tooth (U17). Grid layout uses `style={{ gridTemplateColumns }}` which is acceptable for dynamic column counts. Hardcoded `#FFE97D`, `#007AFF`, `rgba` in 3 places.

**timeline-carousel.tsx**: `VisitChartCard` uses `useQuery` without loading/error branches (U03). Active card accent uses `border-[#FFCC5E]` — mismatched from design token (U05). Carousel container uses inline `style={{ width: panelOpen ? 'calc(100% - 340px)' : '100%' }}` — acceptable for dynamic layout. Keyboard module is enabled (`keyboard={{ enabled: true }}`). Lock button has `aria-label` via `lockPending` prop context but the lock `<button>` itself needs confirmation.

---

*Generated by UI compliance audit agent | dentalemon frontend | 2026-05-26*
