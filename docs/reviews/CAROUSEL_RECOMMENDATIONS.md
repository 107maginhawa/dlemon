# Carousel Recommendations — Longitudinal Comparison as a Product-Wide Pattern

> 2026-06-02. Synthesis of the clinical-core review, focused on dentalemon's UX differentiator. Read with `modules/visit-charting-review.md`, `modules/perio-review.md`, `modules/imaging-ceph-review.md`, `modules/treatment-planning-review.md`.

## The core insight

The timeline carousel exists to answer one clinical question: **"how has this changed over time?"** That question recurs in every clinical module — the odontogram, perio, imaging, and treatment progress. Today the app has the *data* to answer it everywhere (every module stores immutable per-visit snapshots) but the *experience* nowhere: no module lets a clinician actually compare across time.

**The carousel should be reframed from "a visit-history widget" into the app's signature pattern: _compare any clinical dimension over time_.** That is the moat — incumbents (Open Dental date-slider, Dentrix Exam Comparison) do this per-feature and unglamorously; dentalemon can do it as one coherent, beautiful, cross-module interaction.

## Current state (verified)

`apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx` — Swiper `EffectCoverflow` (`rotate:35, depth:200, scale:0.72, slideShadows:false`, `centeredSlides`, `slidesPerView:auto`, keyboard enabled, clickable pagination). Each `VisitChartCard` lazily fetches its own chart (`getDentalChartOptions`). Active card renders teeth at `md` (~80px), inactive at `xs` (~28px); the Baseline/Proposed/Completed layer toggle shows only on the active card. New-visit "+" card appended. `en-PH` date formatting.

The substrate is good. The gaps are: it's **single-feature** (odontogram only), it shows **snapshots but no diff**, layers are **mutually exclusive**, and — most damning — **the demo seeds one visit per patient, so the Cover Flow never has more than one card** (`screenshots/03-workspace-carousel.png`).

## What's blocking the differentiator (ranked)

| # | Blocker | Where | Severity |
|---|---------|-------|----------|
| 1 | Demo seed = 1 visit/patient → carousel never shows comparison | seed scripts | **P1** (highest leverage, lowest cost) |
| 2 | No diff/compare affordance — snapshots can't be contrasted | `timeline-carousel.tsx`, `dental-chart.tsx` | **P1** |
| 3 | Layers are mutually-exclusive tabs, not combinable overlays | `dental-chart.tsx` layer toggle | P1 |
| 4 | Comparison absent in perio (no UI at all) and imaging (side-by-side only, no registration overlay) | perio/imaging features | P1 (per module) |
| 5 | Notation toggle + mixed dentition don't reach the chart | `dental-chart.tsx` hardcodes FDI; `getDentitionType` binary | P1 |
| 6 | Carousel a11y: no diff for reduced-motion users; Escape/focus in sheets | `timeline-carousel.tsx`, sheets | P2 |

## Recommendations

### A. Make it demonstrable (do first — P1, ~hours)
Seed 4–6 patients with **3–6 longitudinal visits** that show real chart evolution (caries → filling → crown; a watch tooth progressing; an extraction → implant arc). Without this, every carousel investment is invisible in demos and review. This alone unlocks evaluation of everything below.

### B. Add a true compare mode to the odontogram (P1)
Beyond browsing cards, let the clinician **pin two visits and diff them**:
- A "Compare" toggle that overlays the focal card's chart against a chosen prior snapshot, highlighting **what changed per tooth/surface** (new condition = additive highlight, resolved/treated = struck-through or faded). This is the visual analog of Open Dental's date-slider replay and the thing that "sells" the snapshot model.
- Reuse the existing per-visit chart fetch; the diff is a client-side set comparison of tooth states between two snapshots.
- Keep the Cover Flow for *browsing*; compare mode is a focused 2-up overlay.

### C. Make layers combinable, not exclusive (P1)
Baseline / Proposed / Completed are currently tabs (one at a time). Industry norm (Open Dental "Show" tab) is **independently toggleable layers** so a clinician can see existing + planned together. Convert the segmented control to multi-select chips; color-code by layer so overlap reads clearly. This also makes the proposed→completed treatment-progress story legible inside a single card.

### D. Extend the pattern to perio (P1, gated on perio UI existing)
Perio data is already snapshot-shaped (immutable per-visit charts with frozen `summaryBopPercent / MeanDepth / DeepPocketCount`). Once a perio UI exists (currently **P0 — no frontend at all**), give it the **same comparison interaction**: a perio carousel / multi-exam grid with red-line threshold emphasis on worsening sites (matches Dentrix Exam Comparison + Open Dental's 6-exam grid). Caveat: meaningful perio trend needs CAL (currently missing — no gingival-margin input); until then it can only trend depth/BOP.

### E. Extend the pattern to imaging (P1)
Imaging comparison is today side-by-side with two unsynchronized viewers (`comparison-view.tsx`); serial superimposition is deferred. The carousel concept argues for **registered overlay** (align two timepoints on stable structures) as the imaging frame of the same "over time" pattern — the clinical standard (ABO: cranial-base + maxillary + mandibular registrations). Start with a synced-zoom/opacity-slider overlay; structural multi-registration is the v2 target.

### F. Connect the disconnected chart capabilities (P1)
Two capabilities exist in the backend/settings but never reach the chart, and both matter for the carousel's credibility:
- **Notation**: `locale-settings.tsx` persists FDI/Universal/Palmer but `dental-chart.tsx` hardcodes FDI — wire `toothNotation` through so US deployments see Universal. Tooth identity stays stable underneath (snapshots unaffected).
- **Mixed dentition**: backend seeds true mixed dentition (age 6–12) but `getDentitionType` is binary and renders primary OR permanent — render both so pediatric snapshots are accurate over the eruption timeline (a compelling carousel story in itself).

### G. Accessibility & motion (P2)
- Honor `prefers-reduced-motion`: offer a non-animated stacked/list comparison as an equal path (the diff in B should not depend on the Cover Flow animation).
- Fix sheet dismissal: Escape-to-close + focus return to the triggering tooth (A11Y-2 in `LIVE_AUDIT_NOTES.md`).
- Verify the inner `role="img"` on teeth doesn't double-announce inside the native `<button>`.

## Phased build

- **Phase 1 (demonstrable):** A (seed) + F (notation + mixed dentition wiring). Cheap, unblocks everything.
- **Phase 2 (the differentiator):** B (odontogram diff/compare) + C (combinable layers) + G (reduced-motion/a11y).
- **Phase 3 (cross-module):** D (perio comparison — after perio UI ships) + E (imaging overlay). Treat as instances of one shared "compare over time" component, not three bespoke builds.

## Design fidelity note
Keep what's working: anatomical crown+root SVG teeth give each snapshot a recognizable "fingerprint" (exactly the perceptual basis a comparison carousel needs), the lemon accent on the active card, and the 3-step tooth slideout. Build the comparison layer in the same Apple-HIG language (`docs/architecture/DESIGN.md`).
