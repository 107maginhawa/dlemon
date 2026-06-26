# Charting Workspace — UX/UI Review (11 items)

Source: user QA pass on the dental charting workspace (2026-06-26), branch `ux/workspace-first-slice`.
Posture: investigation-first. Each item is classified, evidenced with `file:line`, and gated behind a decision before any code. This file is the single source of truth — keep it updated (decision + fix + evidence) as items are resolved.

Legend for **Type**: `DESIGN` = taste/standard decision · `DATA/LOGIC` = correctness bug · `WORKFLOW` = missing/incorrect affordance.
Legend for **Status**: `TRIAGED` · `RESEARCHING` · `DECIDED` · `IN-PROGRESS` · `DONE`.

Key files: `apps/dentalemon/src/features/workspace/components/{dental-chart.tsx,dental-chart.helpers.ts,timeline-carousel.tsx,tooth-slideout.tsx,workspace-payment-modal.tsx}`, `.../lib/chart-layers.ts`, `services/api-ts/.../chart/{getDentalChart.ts,chart-export.ts}`, `.../treatment-plans/getTreatmentPlan.ts`, route `.../routes/_workspace/$patientId.tsx`.

---

## GROUP A — Chart visual / design system

### 1. "Planned" tooth outline too subtle — DESIGN — **DONE**
- **DECISION (2026-06-26, user):** keep the planned edge NEUTRAL (fill owns red = caries) but make it an obvious **2px dotted slate** `#475569`; carried-over → **2.5px dotted amber** `#B8860A`. Dotted (vs dashed) + heavier weight reads "provisional/planned" and is pattern-distinct from completed (solid green) and declined (solid gray) — the three cues now read as a set.
- **FIX:** `getLayerOutline('proposed')` → `2px dotted #475569` / carried `2.5px dotted #B8860A` (`dental-chart.helpers.ts`). Legend swatches updated to `border-2 border-dotted` in the in-chart legend (`dental-chart.tsx`) and the carousel compact legend (`timeline-carousel.tsx`); copy comments dashed→dotted. Tests flipped: `getLayerOutline` "obvious DOTTED edge" + carried-over dotted (5 pass). Typecheck clean.

### 2. Terminology "Completed" vs "Treated" — DESIGN — **DONE**
- **DECISION (2026-06-26, user):** rename the tooth-LAYER label **"Completed" → "Treated"**. The ChartLayer KEY stays `'completed'`; only the displayed label changed, so it never collides with the CARD/visit status "Completed" on the same screen.
- **FIX:** `LAYER_LABELS.completed` → `'Treated'` (`dental-chart.helpers.ts`) — propagates to the interactive layer tabs, the in-chart legend, the historical card's read-only layer key, AND the treatment-table by-status group heading (all consume `getLayerLabel`). Also: `tooth-layer-explanation.ts` LABELS.completed → 'Treated' (the right-panel "why this colour" title in [Image 4]); hardcoded "Completed" legend swatch labels in `dental-chart.tsx` + `timeline-carousel.tsx` compact legend; carousel layer-group tooltip copy. Tests flipped: `getLayerLabel('completed') === 'Treated'`, carousel layer-key `/Treated/i` (4+3 pass); explanation precedence test also flipped to proposed-wins (item-6 fallout caught here, +1 completed-only case). Typecheck clean.
- **Deliberately NOT changed (out of scope):** the BE PDF-export legend `CHART_EXPORT_LEGEND` label "Completed" (`chart-export.ts`) — a separate print surface, BE-side, not on the colliding screen; user said fold in "only if you want". The `tooth-layer-explanation` baseline/proposed labels still read "Baseline"/"Proposed" (vs the chart's "Existing"/"Planned") — pre-existing inconsistency, candidate follow-up, left untouched to keep item 2 atomic.

### 3. Legend ⟷ carousel pagination dots overlap — DESIGN — **DONE**
- FIX: the per-card footer legend and the Swiper pagination shared the same row (measured: both at y≈689). Root cause = the pager is absolute at the swiper's bottom and the swiper had no real bottom room — `.dental-swiper { padding: ...24px }` was DEAD because Swiper's own `.swiper { padding: 0 }` (same specificity, loads later) overrode it. Fixed by raising specificity to `.dental-swiper.swiper { padding: 8px 4vw 44px }` (+ `--swiper-pagination-bottom: 10px`) so the pager drops to its own row below the card (now 26px gap, verified live at 1440px). `src/styles/globals.css:266`. Carousel CSS test 42/0.
- Original analysis below.
- [Image 1] The per-card compact legend (`ChartCompactLegend`, `timeline-carousel.tsx:94-130`, rendered in the active-card footer ~`:417`) and the Swiper pagination bullets (`renderBullet`, `timeline-carousel.tsx:600-609`) share the bottom band and crowd/overlap on the right.
- Fix is a layout/region-separation problem (give the legend and the pager their own rows/space, or reposition the pager). Resolve in the fix phase per UX spacing standards.

### 4. Layer tabs style — segmented control? — DESIGN — **DONE**
- **DECISION (2026-06-26, user):** these are MULTI-SELECT visibility toggles (combinable layers), so a segmented control (which implies pick-one) is the wrong model — REJECTED. Keep multi-select chips but restyle: **ON = filled chip, OFF = outline**, and add each layer's **cue swatch** (dotted slate / solid green / solid gray / plain neutral) to its chip so the filter doubles as the legend.
- **FIX:** new pure helper `getLayerCueSwatch(layer)` (`dental-chart.helpers.ts`) returns the per-layer border class + colour, mirroring `getLayerOutline` so the chip cue == the tooth edge. Wired into all 3 render sites: the in-chart chips (`dental-chart.tsx`), the carousel interactive tabs, and the historical read-only layer key (`timeline-carousel.tsx`). ON/OFF clarified (active = neutral fill + solid border; inactive = transparent + visible `border-border` outline, swatch dimmed `opacity-50`). No status hue on the chip body (lemon stays interaction-only); identity rides the swatch. Test: `getLayerCueSwatch` 4 pass (dotted slate / solid green / gray / baseline no-colour). 25 layer-chip tests + 24 DentalChart + carousel/historical-key tests green; typecheck clean.

---

## GROUP B — Charting fidelity / data model

### 5. Per-surface status, not whole-tooth — DESIGN — **DECIDED: Option B (minimal multi-surface cue)**
- **DECISION (2026-06-26, user):** Option B. Grid keeps whole-tooth dominant-condition fill; add a small corner pip on teeth with >1 distinct surface condition → "open for detail," routing to the slideout surfacemap (already live). No full grid swap. FE-only build: thread `surfaceConditionMap` through `buildToothMap` so `renderTooth` can mark multi-surface teeth. Status-layer edge cues, precedence, legend, and CVD marks stay whole-tooth (untouched). NOT a Phase-3 dependency now — the precedence/cue work in Phase 3 stays whole-tooth.
- [Image 3 = tooth as a ring split into 5 surfaces: B/M/D/P/O] A tooth can have different conditions/statuses per surface. The odontogram GRID paints ONE state/colour for the whole tooth: `renderTooth` reads a single `state` from `toothMap` and one `fillColor` (`dental-chart.tsx:216,282`), default `variant='column'`.

#### Convention research (cited)
- Per-surface IS the global standard. Restorations/conditions are charted on the specific surface of an occlusal-view diagram in Open Dental ([Graphical Tooth Chart manual](https://www.opendental.com/manual/graphicaltoothchart.html)), Dentrix, Eaglesoft. 5 surfaces posterior (M/O/D/B + L), 4 anterior (M/I/D/B + L) — [Surfaces of the Teeth, dentalcare.com](https://www.dentalcare.com/en-us/ce-courses/ce500/surfaces-of-the-teeth).
- Paper colour convention: red = work-to-be-done, blue = existing/completed ([dental charting color-coding](https://www.slideshare.net/slideshow/dental-charting-color-coding-and-symbols-class-activity/236728965)). Our system deliberately differs (fill = condition, edge = status, grayscale-safe) — keep ours; the relevant takeaway is only that per-surface placement is expected.

#### Feasibility: LOW. The entire per-surface pipeline already exists and is partly LIVE.
- Render component: `UniversalTooth` already accepts `surfacesStatus: SurfaceStatus[]` + `variant='surfacemap'` and paints each region via `applySurfaceColors` (`dental/universal-tooth.tsx:73`, `dental/svg-utils.ts:64`). 32 `tooth-N-surfacemap.svg` assets ship in `apps/dentalemon/public/teeth/`. `transformSvgIds` maps B/M/D/P(L)/O → SVG ids (`dental/types.ts:100`).
- Data round-trips fully: BE `surfaceConditionMap` (`dental-chart.schema.ts:58`), written via `updateTooth.ts:56`, returned by `getDentalChart` (`...chart`), captured in the slideout (`tooth-slideout.tsx:209`), saved (`use-save-tooth-flow.ts:52`).
- **Already LIVE in the slideout**: `tooth-overview-step.tsx:126-132` renders `<UniversalToothFdi variant="surfacemap" surfacesStatus={...}>` — the dentist already assigns and SEES per-surface conditions on the big single tooth while editing.
- **The ONLY gap = the grid**: `buildToothMap` (`dental-chart.helpers.ts:345`) flattens API teeth to `Map<number, ToothState>` (one state/tooth) and drops `surfaceConditionMap`; `renderTooth` passes a single `fillColor` with default `column` variant. So a tooth with O-caries + M-filling shows as ONE winning colour in the grid (lie-by-omission), while the slideout shows it correctly.

#### Blast radius if we change the GRID
- Status LAYER cues (proposed dashed ring, completed green ring, declined gray hatch) ride the tooth EDGE/outline — orthogonal to per-surface FILL, so they survive untouched.
- BUT: grid teeth are ~64px in a 32-tooth arch. The `surfacemap` "donut" is a blockier, less-anatomical shape than the `column` tooth and 5 regions at 64px hurt glanceability. Precedence (`resolveToothLayer`), the legend, and CVD redundancy marks (caries dot / fractured slash, `dental-chart.tsx:291`) all assume one whole-tooth state. Full grid swap = a redesign of the odontogram's visual identity, not just plumbing.

#### Mock: `scratchpad/surface-mock.png` (whole-tooth vs per-surface vs the app's existing surfacemap asset).

#### Recommendation (for go/no-go)
- **B — Minimal multi-surface cue (recommended)**: grid stays whole-tooth (dominant condition) for glanceability; add a small corner pip on teeth with >1 distinct surface condition → "open for detail," routing to the slideout surfacemap that already renders per-surface. Removes the lie, preserves the grid, FE-only small build (pass `surfaceConditionMap` through `buildToothMap`).
- **A — No-go / keep split**: do nothing; per-surface already lives in the slideout. Cheapest, but the grid keeps mis-painting multi-surface teeth.
- **C — Full GO**: switch the whole grid to `surfacemap` per-surface. Biggest change; 64px legibility risk; touches precedence/legend/CVD; needs its own design pass.

### 6. Tooth 36 shows "Completed" but has Pending work — DATA/LOGIC (LOGIC) — **DONE (FE+BE precedence flip)**
- **DECISION (2026-06-26, user):** flip precedence `completed > proposed` → **`proposed > completed > declined`**. Outstanding planned/diagnosed work wins so a tooth with NEW pending work reads as Planned even when it also carries a performed treatment — the dentist never sees a green Treated ring hiding work still to be done. Shared FE+BE contract change.
- **FIX (FE):** `resolveToothLayer` now checks proposed before completed (`dental-chart.helpers.ts:226`); `deriveChartLayerSets` dropped the `if (completed.has(n)) continue` skip and now removes proposed teeth from completed/declined to keep the sets disjoint (`lib/chart-layers.ts`). **FIX (BE):** `deriveLayerSets` dropped the `completed.has` skip + `layerFor` checks proposed first (`chart-export.ts`) — backs both PDF export and the per-visit carousel `layers`. `getTreatmentPlan.ts` UNCHANGED (emits raw `completedToothNumbers`; precedence applied downstream). Shared-contract comments updated in both files.
- **Tests (RED→GREEN):** FE `resolveToothLayer` "proposed wins over everything" + `deriveChartLayerSets` "a tooth with a planned item wins as proposed" (6+8 pass); BE `chart-export.test.ts` "resolves to proposed" / "proposed wins over a competing completed item" (5 pass); `getDentalChart.test.ts` per-visit layers unaffected (distinct teeth, 2 pass). Typecheck + check:boundaries clean.
- **DB proof** (patient Juan 869d1494, tooth 36): 2 × `performed` (D0220, D2391, visit ba08e604) **and** 1 × `diagnosed`/pending (D3120 pulp cap, active visit 2ed583d9) → now resolves to **Planned** (dotted edge), not the green Treated ring.
- **Sub-question ANSWERED — the extra "Filled — Pending" breakdown rows are NOT double-counted treatments.** The slideout "Treatment Breakdown" is fed by `getToothHistory` (`chart/getToothHistory.ts`), which emits **one row per COMPLETED/LOCKED visit** where the tooth is in that visit's chart snapshot (`state` = charted state, `treatmentStatus` = the first non-dismissed treatment that visit via `.find`). So those rows are a *visit-snapshot* axis, not the treatment list. Two SEPARATE display bugs noted (out of scope for the flip, no fix here): (a) the active visit's pending pulp-cap isn't in this list at all (only completed/locked visits are scanned); (b) a snapshot row with NO treatment shows a false "Pending" badge because the code does `status === 'performed' ? 'Done' : 'Pending'` (undefined → "Pending") and also mislabels `verified` as Pending. → candidate follow-up.
- Live re-verify (tooth 36 → dotted Planned) folded into the combined Phase-3 cue-set verification at 1440px (after items 1/2/4 land).

---

## GROUP C — Workflow / editability / navigation / bugs

### 7. Can the dentist act on pending tasks from the right panel? — WORKFLOW — TRIAGED (needs panel audit)
- The slideout (`tooth-slideout.tsx`) shows the Treatment Breakdown read-only in [Image 4]. Need to audit: is editing gated by visit state (`isReadOnly` when visit completed/locked, `$patientId.tsx:188`), by the wizard step (Overview vs Treatment), or simply missing? The visit in [Image 4] is Active (editable), so a dentist SHOULD be able to update/add — confirm the affordance exists and is reachable.

### 8. Historical cards show disabled Existing/Planned/Completed tabs — DESIGN — TRIAGED
- [Image 5] Past snapshot card renders the layer controls as greyed, non-interactive text (read-only "layer key", `timeline-carousel.tsx:273-292`).
- Decide: keep as a read-only key, remove (a snapshot is single-state), or replace. Couple with item 9.

### 9. Trace when a tooth was planned vs treated while browsing carousel — WORKFLOW — TRIAGED
- No current per-tooth provenance/history affordance. `carriedOver` flag and per-visit snapshots exist but there's no "when was this planned / treated" view. Propose the affordance (e.g. per-tooth timeline in the slideout, or hover/click on a historical card).

### 10. Carousel lets you advance past an incomplete visit — WORKFLOW — TRIAGED
- `handleSlideChange` (`timeline-carousel.tsx:526-535`) has no gate; any card is freely browsable. Decide whether browsing should be gated (probably NOT — browsing history is fine; the real question is whether STARTING/closing visits is gated, which is separate). Clarify the intended rule.

### 11. Payment modal dead-end + summary/body mismatch — DATA/LOGIC + WORKFLOW — **DONE (FE)**
- FIX (FE-only, honors the one-invoice-per-visit model): `WorkspacePaymentModal` now selects `visitInvoice` = the invoice whose `visitId === props.visitId` (was: patient's latest across all visits). `workspace-payment-modal.tsx:184`. So the active visit (0 invoices) now offers "Create Invoice & Pay" for its ₱12,700 (no dead-end), and a visit WITH an invoice shows its own banner + Record Payment. Banner + body are now the same visit → coherent. DB proof: the only invoice (₱3,500 Paid) belonged to visit c9caccab (Jun 16), not the active visit. Regression test added (`workspace-payment-modal.test.ts`: "ignores an invoice that belongs to a DIFFERENT visit"). 33/0 payment tests, typecheck clean.
- Remaining: live re-confirm in browser; and a later glance that backend `createDentalInvoice` bills the visit's billable treatments correctly (separate from this dead-end fix).
- Original analysis below.
- [Image 6] Banner shows invoice INV-2026-C575A78A **Paid**, Balance ₱0.00/₱3,500.00; body lists 4 treatments mostly **Pending** with Subtotal **₱12,700**; button "Record Payment".
- **Root cause (code)**: `WorkspacePaymentModal` (`workspace-payment-modal.tsx`):
  - Banner = `latestInvoice` = most-recent non-voided patient invoice (`:185-187`) → the OLD ₱3,500 paid invoice.
  - Line items + ₱12,700 subtotal = `lineItems` prop = the CURRENT visit's treatments (`:182`). **Two different sources** → the Paid-₱3,500 banner contradicts the ₱12,700 pending body (summary-vs-body bug class).
  - **Dead-end (11a)**: when ANY non-voided invoice exists, the footer becomes "Record Payment" whose onClick is just `setInvoiceDetailId(latestInvoice.id)` (`:311-320`) — it re-opens the already-Paid invoice. The "create an invoice for the new ₱12,700 of work" path (`handleCreateInvoice`, `:189-199`) is suppressed. So there is no forward action for the actual pending work → "no way to move forward."
- Live re-confirm of the exact stuck state is pending (browser session reset); the screenshot + code are sufficient to root-cause.

---

## Suggested sequencing
- **B6** + the deferred precedence flip — highest value, clinical-safety, already decided; unblocks the "completed hides pending" class. Shared FE+BE contract change.
- **C11** — real payment dead-end / money-coherence bug; high user impact.
- **Group A (1–4)** — visual/standards batch; research-led, render comparisons before deciding.
- **B5** (per-surface) — biggest build; its own go/no-go.
- **C7,8,9,10** — workflow/affordance batch.

Decision needed: which cluster to take first.
