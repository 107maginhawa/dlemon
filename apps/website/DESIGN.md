<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->
---
name: Dentalemon
description: Local-first, buy-once dental software — own your practice.
---

# Design System: Dentalemon

## 1. Overview

**Creative North Star: "The Warm Workshop"**

Dentalemon is a manifesto with a hand-drawn heart. The brand argues a defiant economic point — *stop renting your practice, own it forever* — but it makes that argument in a warm, human, approachable voice, not a cold clinical-SaaS one. The anchor is the bespoke hand-drawn hero illustration: an owner-dentist at her chair, lemon logo on her iPad, plants and warm light around her. The whole visual system extends that single drawing outward — its warm off-white air, its lemon accent, its charcoal line-ink, its small sage-green life.

The system rejects the two failure modes its competitors live in. It is **not** enterprise-healthcare blandness (navy/teal, stock smiling-staff, "HIPAA-compliant cloud platform" boilerplate). It is **not** generic dental-SaaS marketing (feature grid, "trusted by" logo wall, free-trial CTA, subscription pricing ladder). The bespoke illustration is the anti-slop differentiator: no AI-generated landing page draws its own dentist. The **page is clean near-white** — sterile-trustworthy, premium, medical-aligned; warmth is not a flood but a contained island inside the hero artwork plus the lemon accent. Keeping the body near-white (rather than a warm wash) is what dodges the 2026 cream-default reflex entirely: pure white is simply not that trap.

**Key Characteristics:**
- Clean near-white surface; warmth localized to the hero illustration and the lemon accent, never a wall-to-wall warm wash.
- Lemon is voice, not garnish — committed accent, used with intent.
- No dark mode. The "villain" beat gets gravity from a lemon-wash band, not a dark inversion.
- Manifesto rhythm: provoke → prove → affirm. Motion is choreographed to match.
- Hand-drawn, human, premium-underdog. Never clinical-cold, never bargain-bin.

## 2. Colors

A clean near-white surface carries lemon as a committed accent against charcoal ink. Warmth is contained to the hero block and the accent — no warm flood, no dark inversion. Anchors are provisional until locked at build (lemon/sage/charcoal sampled to harmonize with `hero.png`).

### Primary
- **Lemon** (`~#F4C430`, provisional): The brand's voice and only true accent — sun = lemon = ownership. Carries CTAs, key emphasis, the lemon-wash "villain" band, and the illustration's logo. Committed, not sprinkled.

### Secondary
- **Sage** (`~#8FA66A`, provisional): The small green life in the illustration (plants). A quiet secondary for supporting marks, success/affirm states, occasional section accents. Never competes with lemon.

### Neutral
- **Charcoal Ink** (`~#2E2A26`, provisional): All body and heading text; the line-art ink of the brand. Available as an *optional* single dramatic band for the villain beat if lemon-wash needs more weight — used once, deliberately, never as a dark-mode theme.
- **Near-White** (`~#FCFBF9`, provisional): The body surface. A hair of warmth so it doesn't read cold-blue beside the hero, but essentially white — clean and medical-trustworthy, not parchment.
- **Hero Cream** (`~#F8EFE6`, provisional): The hero illustration's own backdrop. Lives *only* inside the contained hero section so the artwork sits seamlessly; never spreads to the rest of the page.
- **Taupe** (`~#7A7067`, provisional): Muted text — captions, meta, secondary labels. Must still clear 4.5:1 on near-white; bump toward ink if it's close.
- **Line** (`~#EDE9E3`, provisional): Hairline borders, dividers, input strokes (lighter now that the field is near-white).

### Named Rules
**The Contained-Warmth Rule.** The body is near-white. Warmth appears only inside the hero block (its own cream backdrop) and in the lemon accent. Never let warm-neutral spread across the page — that's the cream-default. White is the canvas; warmth is the subject.

**The No-Dark-Mode Rule.** This is a light, medical-aligned brand end to end. The "villain"/provoke beat gets its gravity from a lemon-wash band; charcoal is permitted for that one section only if needed, never as a recurring dark theme.

**The One Lemon Rule.** Lemon is the only accent. No second brand hue competes with it. Sage is support, never a co-star.

## 3. Typography

**Display Font:** Bricolage Grotesque (with system grotesque fallback) — *proposed, confirm at build*
**Body Font:** Hanken Grotesk (with system sans fallback) — *proposed, confirm at build*

**Character:** A characterful display grotesque with warmth and backbone — confident enough for manifesto headlines, friendly enough to sit beside a hand-drawn hero — paired with a neutral, highly legible humanist sans for body. Pairs on a contrast axis (expressive display vs. quiet body), not two near-identical grotesques. Explicitly drops Plus Jakarta Sans (reflex-reject) from the prior draft.

### Hierarchy
- **Display** (Bricolage, ~600–700, `clamp(2.5rem, 6vw, 5rem)`, line-height ~1.0, letter-spacing ≥ -0.03em): Hero H1 and manifesto statements only. `text-wrap: balance`.
- **Headline** (Bricolage, ~600, `clamp(1.75rem, 3vw, 2.75rem)`): Section openers.
- **Title** (Hanken or Bricolage, ~600, ~1.25rem): Card/sub-section titles.
- **Body** (Hanken, ~400, ~1.0625–1.125rem, line-height ~1.6): Prose. Cap measure at 65–75ch. `text-wrap: pretty`.
- **Label** (Hanken, ~500–600, ~0.8125rem): Buttons, nav, meta. Sentence case by default — no all-caps tracked eyebrows above every section.

### Named Rules
**The No-Eyebrow Rule.** No tiny uppercase tracked kicker above section headings. The manifesto refrain ("Unsubscribe.") is a deliberate brand line used sparingly — not a per-section scaffold.

## 4. Elevation

Choreographed motion, but flat-by-default surfaces. Depth comes from near-white/lemon-wash section bands and from generous spacing, not from drop shadows. Shadows appear only as soft, warm-tinted ambient lifts on genuinely interactive/elevated elements (primary CTA hover, a floating product capture), never as decoration on every card.

### Named Rules
**The Flat-Paper Rule.** Surfaces are flat at rest, like ink on paper. A shadow is a response to state (hover, float), not a default texture. If a card needs a shadow to feel separate, the spacing or the section background should have done that job.

## 5. Components

<!-- No components built yet (fresh rebuild). Canonical primitives below are direction, not extracted tokens. Re-run /impeccable document in scan mode once code exists. -->

### Buttons
- **Shape:** Pill (full radius) — friendly, matches the rounded illustration world.
- **Primary:** Charcoal ink fill, warm off-white text — or lemon fill with charcoal text for the single highest-intent CTA. Generous padding (~16px 28px).
- **Hover / Focus:** Soft warm ambient lift + slight translateY; visible focus ring (lemon or charcoal, whichever clears contrast). Honor reduced-motion.
- **CTA copy:** "Request Founding Access" (invite framing) or "Own it" (buy framing) — GTM still undecided; wire to one at build.

### Cards / Containers
- **Corner Style:** Soft (~16–24px radius), echoing the illustration.
- **Background:** Near-white or a half-step warm tint; lemon-wash inside the villain band.
- **Shadow:** Flat by default (see Elevation). Never nest cards.

### Inputs / Fields
- **Style:** Hairline `Line` stroke, soft radius (~12px), warm off-white field.
- **Focus:** Border shifts to charcoal/lemon + soft ring. Placeholder text must clear 4.5:1 (no faint gray).

### Navigation
- **Style:** Light, minimal; horizontal logo (`logos/logo-horizontal.svg`) left, sparse links + one accent CTA right. On the dark section, swap to `logo-horizontal-white.svg`.

### Hero (signature)
- Full-bleed `images/hero.png` as the hero background. Headline + subhead + CTA overlay the open left/upper area (the illustration leaves negative space there). Verify text contrast over the warm art — add a subtle warm scrim behind the copy if needed, never a heavy dark overlay that fights the illustration.

## 6. Do's and Don'ts

### Do:
- **Do** keep the body near-white and clean; contain warmth to the hero block and the lemon accent.
- **Do** use lemon as the single committed accent, and give the villain beat its gravity from a lemon-wash band (charcoal only if that one section needs more weight).
- **Do** lead with the ownership promise a subscription vendor structurally cannot make.
- **Do** show the real SUN product (carousel timeline) as a capture, not an illustration or abstract diagram.
- **Do** keep body text ≥4.5:1, 44px touch targets, visible focus, and a reduced-motion fallback for every choreographed reveal.
- **Do** keep copy em-dash-free in visible marketing text (verify in DOM).

### Don't:
- **Don't** let warm-neutral fill the whole page (cream/sand/parchment wall-to-wall) — that's the 2026 AI cream-default. The body is near-white.
- **Don't** introduce a dark-mode theme or recurring dark sections; this is a light medical-aligned brand.
- **Don't** build a feature grid, a "trusted by" logo wall, or a subscription pricing ladder ($X/mo tiers). Pricing is a one-time number.
- **Don't** drift into enterprise-healthcare blandness (navy/teal, stock smiling-staff, "HIPAA cloud platform" boilerplate).
- **Don't** use tiny uppercase tracked eyebrows or 01/02/03 markers above every section.
- **Don't** use gradient text, decorative glassmorphism, side-stripe borders, the hero-metric template, or identical icon-heading-text card grids.
- **Don't** mention imaging / perio / ceph, or call the product "complete" — those modules are parked.
- **Don't** pair two near-identical grotesques; keep display vs. body on a contrast axis.
