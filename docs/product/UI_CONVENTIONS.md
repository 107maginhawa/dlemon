<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-ui-blueprint --blueprint --all -->
<!-- based-on: DESIGN.md, globals.css, apps/dentalemon/src/components/, ROLE_PERMISSION_MATRIX.md -->

# UI Conventions — Dentalemon

> Shared conventions for all module UI blueprints.
> Authority: DESIGN.md → UI_CONVENTIONS.md → per-module specs.

---

## 1. Design System Foundation

**Visual language:** Apple HIG — iOS/iPadOS native patterns on web.

| Token | Value | Usage |
|-------|-------|-------|
| Brand accent | `#FFE97D` (`--primary`) | Primary CTAs, active states, logo |
| Brand accent hover | `#F5DC60` | Hover/pressed |
| Accent foreground | `#4A4018` | Text on lemon bg (never white) |
| Accent soft | `rgba(255,233,125,0.15)` | Row highlights, selected states |
| Focus ring | `rgba(255,233,125,0.35)` | Keyboard focus indicator |
| Background | `#F2F2F7` | Grouped background (page bg) |
| Card/Surface | `#FFFFFF` | Card surfaces, panel bg |
| Foreground | `#000000` | Primary text |
| Secondary label | `#3C3C43` at 60% opacity | Secondary text |
| Separator | `#C6C6C8` at 0.5px | Hairline dividers |

**Dental chart status colors:**

| State | Token | Value |
|-------|-------|-------|
| Healthy | `--dental-healthy` | `#dcfce7` |
| Caries | `--dental-caries` | `#FF3B30` |
| Fractured | `--dental-fractured` | `#FF9500` |
| Filled | `--dental-filled` | `#5AC8FA` |
| Crown | `--dental-crown` | `#FFD60A` |
| Missing | `--dental-missing` | `#C7C7CC` |
| Implant | `--dental-implant` | `#007AFF` |
| Extracted | `--dental-extracted` | `#111111` |
| Watchlist | `--dental-watchlist` | `#fef9c3` |

---

## 2. Typography

| Role | Font | Size | Weight | Style |
|------|------|------|--------|-------|
| Display | SF Pro Display | 20px+ | 600 | Optical sizing |
| Body | SF Pro Text | <20px | 400 | — |
| Caption | SF Pro Text | 12px | 400 | `#8E8E93` |
| Monospace numbers | SF Mono | — | — | Tabular nums |

**Hierarchy:**
- `text-2xl font-semibold` — Page titles
- `text-xl font-semibold` — Section headers
- `text-base` — Body text
- `text-sm text-muted-foreground` — Labels, secondary
- `text-xs text-muted-foreground` — Captions, timestamps

---

## 3. Layout Principles

| Property | Value |
|----------|-------|
| Min touch target | 44px |
| Sidebar width (expanded) | 200px |
| Sidebar width (collapsed) | 56px (icon rail) |
| Slideout panel width | 320px |
| Content max width | 1280px |
| Card border radius | `rounded-xl` (12px) |
| Base spacing unit | 4px |

**Primary layout:** Sidebar (200px) + Main content area
**iPad-first:** All touch targets ≥44px. Tablet layout drives design.

---

## 4. Component Library

All UI built from `apps/dentalemon/src/components/` (Radix UI primitives, custom styled):

| Component file | Maps to |
|---------------|---------|
| `button.tsx` | Primary, secondary, ghost, destructive buttons |
| `card.tsx` | All card containers |
| `table.tsx` | Data tables |
| `dialog.tsx` | Modal dialogs |
| `sheet.tsx` | Slideout panels (320px) |
| `tabs.tsx` | Tab navigation |
| `form.tsx` | RHF form wrapper |
| `input.tsx`, `select.tsx`, `textarea.tsx` | Form fields |
| `badge.tsx` | Status indicators |
| `skeleton.tsx` | Loading states |
| `empty-state.tsx` | Empty collection states |
| `pagination.tsx` | Table pagination |
| `combobox.tsx` | Searchable selects |
| `loading.tsx` | Spinner/loading indicator |
| `sonner.tsx` | Toast notifications |

**Domain-specific components** (from `apps/sample-workspace/src/components/`):
- `DentalChartGrid` — 32-tooth chart grid
- `TimelineCarousel` — Visit snapshot carousel
- `BreakdownTable` — Treatment cost breakdown
- `ToothDetailPanel` — Per-tooth slideout
- `SurfaceSelector` — Tooth surface selector

---

## 5. Form Conventions

**Library:** React Hook Form + Zod (schema-first validation)

| Convention | Rule |
|-----------|------|
| Validation timing | `onBlur` for individual fields, `onSubmit` for form-level |
| Error display | Inline below field, `text-sm text-destructive` |
| Required indicator | Asterisk (`*`) in label, `aria-required="true"` on input |
| Disabled state | `opacity-50 cursor-not-allowed` |
| Submit loading | Button shows spinner, disabled during request |
| Server errors | Mapped to field or shown as alert above form |

---

## 6. State Conventions

All interactive screens must handle all 9 states:

| State | Implementation |
|-------|---------------|
| 1. Loading | Skeleton components (never spinner-only for data tables) |
| 2. Empty | `<EmptyState>` component with icon + message + CTA |
| 3. Partial (data loading) | Show stale data with loading indicator |
| 4. Error | `<Alert variant="destructive">` with retry action |
| 5. Success | Toast notification (`sonner`) |
| 6. Offline | Banner: "Working offline — changes will sync" |
| 7. Permission-denied | 403 → redirect to allowed screen |
| 8. Not found | 404 → `<NotFound>` component |
| 9. Active/nominal | Normal data display |

---

## 7. WCAG 2.1 AA Requirements

| Requirement | Implementation |
|------------|---------------|
| Color contrast | ≥4.5:1 for normal text, ≥3:1 for large text |
| Focus indicators | `ring-2 ring-[rgba(255,233,125,0.35)]` on all interactive |
| Keyboard navigation | Tab order logical; no keyboard traps |
| ARIA landmarks | Every page: `<main>`, `<nav>`, `<header>` |
| Screen reader | All icons have `aria-label` or `aria-hidden` |
| Reduced motion | `prefers-reduced-motion: reduce` applied to carousel/animations |

---

## 8. Navigation Patterns

| Pattern | When to use |
|---------|------------|
| Sidebar nav | Primary feature navigation |
| Tabs | Sub-section switching within a screen |
| Breadcrumb | 3+ level deep navigation |
| Back button | Detail → list navigation |
| Slideout (Sheet) | Contextual detail without leaving context |
| Dialog | Confirmations, short forms |

---

## 9. Badge / Status Patterns

| Status | Color | Usage |
|--------|-------|-------|
| Active/success | `bg-green-100 text-green-800` | Active patients, paid invoices |
| Warning/pending | `bg-orange-100 text-orange-800` | Overdue, pending |
| Error/critical | `bg-red-100 text-red-800` | Errors, critical alerts |
| Draft | `bg-gray-100 text-gray-700` | Draft status |
| Lemon/selected | `bg-[#FFE97D] text-[#4A4018]` | Active selection, featured |
