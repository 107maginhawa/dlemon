# Design System — Dentalemon

> Apple HIG foundation + Lemon brand accent. App UI, not marketing site.

## 1. Visual Theme & Atmosphere

Apple's native design language: iOS system colors, grouped backgrounds, glass bars, hairline separators. The interface retreats so the dental chart and patient data can be the hero. Color is earned — every element starts system-neutral, and the brand lemon appears only when it carries meaning: active state, primary action, logo.

**Key Characteristics:**
- SF Pro with optical sizing (Display 20px+, Text below 20px)
- Apple grouped background (`#F2F2F7`) with white card surfaces
- Single brand accent: Lemon `#FFE97D` replacing Apple Blue — all other colors are Apple system colors
- Glass top/bottom bars with backdrop blur (iOS native feel)
- iPad-first touch targets (44px minimum)
- 0.5px hairline separators (Apple convention)

## 2. Color Palette & Roles

### Brand Accent (replaces Apple Blue)
- **Lemon** (`#FFE97D`): Primary CTAs, active indicators, highlights, logo icon. The ONLY brand accent.
- **Lemon Hover** (`#F5DC60`): Hover/pressed state.
- **Lemon Foreground** (`#4A4018`): Text on lemon backgrounds (never white — insufficient contrast).
- **Lemon Soft** (`rgba(255,233,125,0.15)`): Subtle hover backgrounds, selected states, row highlights.
- **Focus Ring** (`rgba(255,233,125,0.35)`): Keyboard focus indicator.

### Neutrals — Apple HIG system colors
- **Page Background** (`#F2F2F7`): Apple `systemGroupedBackground`. Primary canvas.
- **Surface** (`#FFFFFF`): Cards, modals, elevated surfaces. Apple `systemBackground`.
- **Fill Tertiary** (`rgba(118,118,128,0.12)`): Apple `systemFill`. Button hover, segment controls.
- **Separator** (`rgba(60,60,67,0.12)`): Apple separator. Table row borders.
- **Separator Opaque** (`#C6C6C8`): Apple `opaqueSeparator`. Bar borders.
- **Text Primary** (`#000000`): Apple `label`.
- **Text Secondary** (`#8E8E93`): Apple `secondaryLabel`.
- **Text Tertiary** (`#C7C7CC`): Apple `tertiaryLabel`. Placeholders, disabled.

### Semantic — Apple system colors
- **Success** (`#34C759`): Apple `systemGreen`. Completed treatments, done states.
- **Warning** (`#FF9500`): Apple `systemOrange`. Overdue alerts, pending items.
- **Error** (`#FF3B30`): Apple `systemRed`. Errors, allergy alerts, destructive actions.
- **Info** (`#5AC8FA`): Apple `systemTeal`. Informational callouts.

### Dental Chart Colors
- **Caries** (`#FF3B30`): Active caries — systemRed.
- **Fractured** (`#FF9500`): Fracture/at-risk — systemOrange.
- **Filled** (`#5AC8FA`): Composite/amalgam restoration — systemTeal.
- **Crown** (`#FFE97D`): Crowned/restored — brand lemon.
- **Missing** (`#C7C7CC`): Missing/extracted — tertiaryLabel gray, dashed border.

### Dark Theme — Apple dark mode
- **Page** (`#000000`): Apple dark `systemBackground`.
- **Surface** (`#1C1C1E`): Apple dark `secondarySystemBackground`.
- **Lemon** (`#FFE97D`): Stays lemon.
- **Lemon Hover** (`#FFF0A0`): Slightly lighter in dark mode.
- **Text Primary** (`#FFFFFF`)
- **Text Secondary** (`#8E8E93`)
- **Separator** (`rgba(84,84,88,0.65)`): Apple dark separator.

## 3. Typography Rules

### Font Family
- **Display** (20px+): `SF Pro Display`, fallbacks: `SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif`
- **Body** (<20px): `SF Pro Text`, fallbacks: `SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif`
- **System fallback**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Data/Tables**: SF Pro with `font-variant-numeric: tabular-nums` for column alignment.

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Use |
|------|------|--------|-------------|----------------|-----|
| Page Title | 28px | 600 | 1.14 | 0.196px | Screen titles ("Dashboard", "Patients") |
| Section Heading | 20px | 600 | 1.20 | normal | Card group headers, section labels |
| Card Title | 17px | 600 | 1.24 | -0.374px | Card headings, table column headers |
| Body | 14px | 400 | 1.43 | -0.224px | Standard reading text, table cells |
| Body Emphasis | 14px | 600 | 1.43 | -0.224px | Emphasized body, active labels |
| Caption | 12px | 400 | 1.33 | -0.12px | Secondary text, timestamps, badges |
| Caption Bold | 12px | 600 | 1.33 | -0.12px | Tooth numbers, status labels |
| Micro | 10px | 400 | 1.40 | -0.08px | Fine print only |

### Principles
- Negative letter-spacing at all sizes (Apple convention)
- Weight restraint: most text at 400 or 600. No 800/900.
- Tabular nums for financial amounts, tooth numbers, dates
- Left-align body text. Center only page titles when appropriate.

## 4. Component Stylings

### Buttons

**Primary (Lemon CTA)**
- Background: `#FFE97D`
- Text: `#4A4018` (dark on lemon, never white)
- Padding: 10px 20px (44px min touch height)
- Radius: 10px (Apple)
- Hover: `#F5DC60`
- Active: slight scale(0.98)
- Use: "Continue to Payment", "Save & Continue", primary actions

**Secondary (Outline)**
- Background: transparent
- Text: `#000000`
- Border: 0.5px solid `#C6C6C8`
- Padding: 10px 20px
- Radius: 10px
- Hover: `rgba(118,118,128,0.12)` background
- Use: "Cancel", "Back", secondary actions

**Ghost (Icon buttons)**
- Background: transparent
- Color: `#FFE97D` (lemon tint, replaces Apple Blue tint)
- Size: 34px square (padded to 44px touch)
- Radius: 7px
- Hover: `rgba(118,118,128,0.12)` background
- Use: Top bar icons (Rx, Consent, Attach, Expand)

**Danger**
- Background: `#FF3B30` (systemRed)
- Text: `#FFFFFF`
- Use: Destructive actions only

### Cards & Containers
- Background: `#FFFFFF`
- Border: none (cards float on `#F2F2F7` grouped background — no border needed)
- Radius: 12px (lg)
- Shadow: `0 1px 3px rgba(0,0,0,0.08)`
- Hover shadow (if interactive): `0 2px 10px rgba(0,0,0,0.08)`

### Sidebar Navigation
- Width: 200px expanded, 56px collapsed (icon rail)
- Background: `#F2F2F7` (grouped)
- Border-right: 0.5px solid `#C6C6C8`
- Item height: 44px (touch target)
- Default text: `#8E8E93`
- Hover: text `#000000`, bg `rgba(118,118,128,0.12)`
- Active: text `#FFE97D` (lemon), bg `rgba(255,233,125,0.12)`, 3px left border `#FFE97D`
- Icons: Lucide React, 20px, stroke-width 1.5

### Tables (Breakdown Table)
- Header: `#FFFFFF` background, sticky, 11px text, weight 600, uppercase, `#8E8E93`
- Row height: 48px minimum
- Row hover: `rgba(255,233,125,0.15)` (lemon soft)
- Row border: 0.5px solid `rgba(60,60,67,0.12)` (Apple separator)
- Cell text: 14px, `#000000`
- Amount cells: tabular-nums, right-aligned

### Badges / Status
- Apple-style: padding 2px 7px, radius 4px, 11px font, weight 600, translucent bg
- Done: `rgba(52,199,89,0.15)` bg, `#248A3D` text (systemGreen family)
- Pending: `rgba(255,149,0,0.15)` bg, `#CC7700` text (systemOrange family)
- Overdue: `rgba(255,59,48,0.15)` bg, `#D70015` text (systemRed family)

### Slideout Panel
- Width: 320px
- Background: `#FFFFFF`
- Left border: 3px solid `#FFE97D` (lemon accent)
- Shadow: `-4px 0 16px rgba(0,0,0,0.08)`
- Behavior: workspace content shrinks (not overlay)

### Top Bar (Workspace)
- Height: 56px
- Background: `rgba(255,255,255,0.72)`
- Backdrop filter: `saturate(180%) blur(20px)` (iOS native)
- Border-bottom: 0.5px solid `#C6C6C8`
- Glass effect

### Footer (Payment)
- Height: 56px
- Background: `rgba(255,255,255,0.72)`
- Backdrop filter: `saturate(180%) blur(20px)` (matches top bar)
- Border-top: 0.5px solid `#C6C6C8`
- Sticky bottom
- CTA button right-aligned

### Dialogs / Modals (centered)
- **Always compose the shared primitive** `@monobase/ui` `Dialog` — never hand-roll a `position:fixed` overlay or import `@radix-ui/react-dialog` directly. The primitive provides the overlay, focus trap, Escape-to-close, focus return, entrance animation, and a top-right `✕` close. Reference: `apps/dentalemon/src/features/imaging/components/calibration-dialog.tsx`.
- Shape: `<Dialog open onOpenChange><DialogContent><DialogHeader><DialogTitle/><DialogDescription/></DialogHeader> …body… <DialogFooter/></DialogContent></Dialog>`.
- Container: white surface, `rounded-lg`, `shadow-lg`, `bg-black/80` overlay (all from the primitive — don't override). Width via `className` (`sm:max-w-sm` compact, `sm:max-w-md` standard).
- **Escape / overlay / ✕ map to the non-destructive default** (cancel / keep / skip) — wire `onOpenChange={(o) => { if (!o) onClose() }}`.
- Buttons: `rounded-lg`, 44px min height, explicit `focus-visible:ring-2 focus-visible:ring-ring` (destructive → `ring-destructive`). Confirm tone: lemon (primary) · `bg-destructive` (destructive) · `bg-amber-100/text-amber-900` (caution override). Cancel: outline or muted text.
- **Test harness note:** the test setup stubs Radix `Dialog` to plain divs and **drops `data-testid`/`className` on `DialogContent`/`DialogTitle`**. Put any container-level `data-testid` on an **inner `<div>`**, and assert on real elements (buttons, inputs, text). Escape/focus behavior is the primitive's job — not unit-testable here, covered by e2e.
- Used by (centered confirm/form dialogs): pre-completion checklist, discard-visit, carry-over (workspace); cancel-appointment (scheduling); patient-registration, patient-edit (patients); calibration, annotation (imaging).
- **NOT for transactional panels.** `workspace-payment-modal` and `appointment-modal` are 520px header / scroll-body / footer panels with a custom close and internal scroll — a different pattern. They intentionally do NOT use this primitive (forcing it needs `p-0`/`gap-0`/remove-close overrides and breaks their `getByRole('dialog',{name})` tests under the harness stub). If a third such panel appears, extract a separate `DialogPanel` primitive rather than overriding this one.

## 5. Layout Principles

### Spacing System
- Base unit: 4px
- Scale: 2 / 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 (px)
- Density: Comfortable — not cramped, not spacious

### Grid & Container
- Max content width: 1440px
- Sidebar: 200px (or 56px collapsed)
- Workspace: full viewport, no max-width constraint
- Two-zone workspace: carousel top (collapsible), table bottom

### Border Radius Scale
- sm: 4px (small inputs, micro elements)
- md: 8px (buttons, standard cards)
- lg: 12px (large cards, modals, panels)
- xl: 16px (carousel cards)
- full: 9999px (badges, pills)

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | No shadow | Standard content, table rows |
| Subtle | `0 1px 2px rgba(26,26,26,0.04)` | Sidebar, subtle separation |
| Card | `0 2px 8px rgba(26,26,26,0.06)` | Cards, panels, modals |
| Elevated | `0 4px 16px rgba(26,26,26,0.08)` | Hover cards, slideout panel |
| Glass | `rgba(255,255,255,0.85)` + `blur(20px)` | Top bar, floating headers |
| Focus | `0 0 0 2px rgba(226,194,49,0.25)` | Keyboard focus ring (gold) |

Shadow philosophy: warm-tinted, subtle. No heavy drop shadows. Depth comes from background contrast, not shadow drama.

## 7. Motion

- Easing: enter `ease-out`, exit `ease-in`, move `ease-in-out`
- Micro: 50-100ms (button press, toggle)
- Short: 150-250ms (hover, focus, sidebar collapse)
- Medium: 250-400ms (slideout open/close, carousel transition)
- Brand: 380ms `cubic-bezier(0.25, 0.46, 0.45, 0.94)` (carousel card transitions per PRD)
- Rule: motion serves comprehension. No bouncy, no flashy.
- Respect `prefers-reduced-motion`: disable transforms, use instant transitions.

## 8. Component Framework

- **Base**: shadcn/ui (New York style)
- **Icons**: Lucide React, 20px default, stroke-width 1.5
- **Motion**: Framer Motion v12
- **Carousel**: Swiper.js v11 (coverflow effect)
- **Charts**: lightweight (TBD — Recharts or similar)

## 9. Do's and Don'ts

### Do
- Use lemon (`#FFE97D`) ONLY for primary interactive elements — it's the singular brand color
- Follow Apple HIG for all semantic colors (systemRed, systemGreen, systemOrange, systemTeal)
- Use `#F2F2F7` grouped backgrounds with `#FFFFFF` card surfaces — the iOS standard
- Use glass effect (translucent + blur) for both the top bar AND footer
- Use 0.5px hairline separators (Apple convention on retina)
- Apply negative letter-spacing at all text sizes (Apple convention)
- Maintain 44px minimum touch targets for all interactive elements
- Use tabular-nums for all financial amounts and tooth numbers

### Don't
- Don't put white text on lemon backgrounds — use `#4A4018` dark text
- Don't introduce custom accent colors — lemon for brand, everything else is Apple system
- Don't use Moss Green or Honey Gold from prior versions — those are retired
- Don't use heavy shadows — Apple card shadow is `0 1px 3px rgba(0,0,0,0.08)` maximum
- Don't use solid opaque footer/top bar — use glass (translucent + blur) to match iOS
- Don't use weight 800/900 — max is 700 (bold), rarely needed
- Don't add textures, gradients, or decorative backgrounds

## 10. Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-08 | Apple-clean white-dominant direction | User requested Apple-like minimal approach |
| 2026-04-08 | Lemon gold as primary | Derived from Dentalemon logo icon |
| 2026-04-08 | Sage as accent only | Hint, not dominant. Active nav + success. |
| 2026-04-13 | Apple getdesign as foundation | SF Pro, Apple spacing, shadow philosophy |
| 2026-04-13 | App UI rules over marketing | Dense-but-readable, calm surfaces, utility language |
| 2026-05-01 | Honey Gold #D4A43A replaces Lemon Gold #E2C231 | Warmer, deeper gold. Less "caution tape", more "premium". |
| 2026-05-01 | Moss Green #6B8A6B replaces Sage #8A9E6E | Warmer green. More organic/natural. |
| 2026-05-01 | White-dominant confirmed over cream | User tested cream (#FFFDF7) and white (#FFFFFF). Chose white. Color is punctuation. |
| 2026-05-01 | Apple HIG + Lemon #FFE97D replaces custom palette | Full Apple HIG system colors (grouped bg #F2F2F7, systemRed/Green/Orange/Teal), brand lemon #FFE97D as the only custom accent replacing Apple Blue. Honey Gold #D4A43A and Moss Green #6B8A6B retired. Explored 6 wireframe variants before deciding. |
| 2026-06-28 | Workspace confirm modals adopt shared `@monobase/ui` Dialog | pre-completion (raw Radix), discard + carry-over (hand-rolled overlays) had each drifted on radius/shadow/overlay. Unified on the system primitive; deleted hand-rolled overlay + `useSheetA11y` wiring. Escape/focus now from Radix. |
