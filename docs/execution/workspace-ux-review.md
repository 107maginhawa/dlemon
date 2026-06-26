# Workspace Page — UX Review (plan-only)

## Summary

The workspace squanders its vertical budget: a hard-coded **560px** Cover Flow slide (`globals.css:245`) plus stacked status banners and a 9-button tab strip push the **treatment breakdown — the clinician's primary working surface and the patient's money — entirely below the fold** on a typical iPad, where it then opens into a *second* nested `max-h-[450px]` scroll region that can hide the Grand Total. On top of that spatial problem, the page offers **no ordered "what now" scent** for the visit workflow (start → chart → plan/perform → notes → complete/payment): the only guidance is a passive "Visit in progress" line, the workflow-entry "New Visit" action is a faint opacity-60 dashed tile *after* the carousel, and the terminal "Complete visit" action is one anonymous icon among eight. Finally, the **active visit date is buried as muted `text-xs` in the top bar and never re-stated next to the rows being edited**, a charting-safety risk on a multi-visit patient.

## Three priority concerns

### 1. Next-step guidance — VERDICT: largely absent (P0/P1)
There is no information scent for the happy path. For a patient with **zero visits** the only entry point is the recessive dashed `+ New Visit` tile; for an **open visit** the sole cue is "Visit in progress — finish or discard it" (a lifecycle constraint, not a next step); and an auto-selected **completed** visit lands the clinician on a read-only screen with no forward CTA. Visit-scoped top-bar icons and tabs (Notes, Attachments, Rx, etc.) also fire silently with no `currentVisitId`, creating dead-ends before the flow even begins.

**Fix:** Add a single state-aware guided strip in the context band (one line, reused across states) driven off already-computed `currentVisit.status` / `openVisit` / `treatments`:
- no visits → prominent **"Start first visit"** primary button + one-line scent ("Start a visit to chart teeth, plan treatment, and take payment").
- open + empty chart → "Tap a tooth to chart" and surface `ApplyTemplateButton` in the empty-table state.
- treatments exist, none performed → "Mark treatments done or add notes".
- work performed → "Ready to complete — review checklist".
- read-only landing, no open visit → "This visit is closed. Start a new visit to chart today." wired to `handleNewVisit`.

Give **Complete visit** a labelled/accented treatment distinct from the icon cluster, and apply the Perio disabled-with-tooltip pattern to every visit-scoped trigger so nothing no-ops silently.

### 2. Breakdown visibility / scroll / New-Visit space — VERDICT: failing (P0)
The fixed chain (TopBar 56px + tab strip ~52px + ChartConflictBanner + in-progress indicator + carousel zone with 628px swiper + Compare row + New Visit tile + footer) is `shrink-0` and never yields, so on a ~768px iPad the Treatment Breakdown header starts off-screen. The breakdown then has its **own** `max-h-[450px]` inner scroll nested inside the outer `overflow-auto` zone — two scrollbars on one axis that can strand the Grand Total. New Visit sits below the swiper at 60% opacity (reads as disabled on touch, which has no hover).

**Fix (in order of impact):**
- Replace the fixed 560px slide height with a viewport-relative clamp (~`min(46vh, 420px)` for the centered card) so the chart never claims >~45% of screen; reduce `.dental-swiper` bottom padding and carousel `py-4`; add a collapse/expand control on the carousel zone.
- Remove the inner `max-h-[450px] overflow-auto` on both table views (`treatment-table.tsx:344` and `:685`); let the table grow inside the **single** outer scroll zone with the already-sticky `thead` and a `sticky bottom-0` total row.
- Consolidate ChartConflictBanner + in-progress indicator + Compare into **one** compact context row (saves ~50px); gate the conflict banner to render only when `conflictedTeeth` is non-empty.
- Demote rarely-used tab triggers (Occlusion, Recalls, Tasks, Plans, Export) into a "More" overflow menu; keep year filter + 1–2 high-frequency tabs inline.
- Relocate **New Visit** to a stable, always-visible solid button (carousel header/controls row), full opacity when enabled; keep the dashed/dimmed + hint treatment only for the disabled open-visit case.
- Target: table header + ~3–4 rows + Grand Total visible above the fold on a 768px iPad with one open visit.

### 3. Sticky date — VERDICT: not anchored (P1)
`currentVisitDate` lives only in the WorkspaceTopBar far-right cluster as muted `text-xs`, crammed between safety badges and 8 icons; the table scrolls independently with no date anchor adjacent to the rows. On a multi-visit patient this invites editing the wrong visit — a charting/billing-safety error.

**Fix:** Add a slim **sticky visit-context strip directly above the treatment table** (or pin inside the Treatment Breakdown header, which already uses the sticky pattern) showing the visit date prominently + status badge + read-only state, e.g. "Editing — Jun 24, 2026 · Active", pinned while rows scroll. Secondarily, raise the top-bar date's weight (label "Visit", foreground color, calendar icon, divider from icon cluster) as the global anchor. This strip is the natural host for the concern-#1 next-step scent and the consolidated status affordances from concern #2.

## All findings (deduped, prioritized)

| Priority | Title | Concern | Effort | Recommendation | Location |
|---|---|---|---|---|---|
| **P0** | Fixed 560px carousel slide pushes the entire treatment breakdown below the fold | 2 | M | Viewport-relative clamp (~`min(46vh,420px)`) for the centered card, reduce swiper bottom padding + carousel `py-4`, add carousel collapse/expand; target header + 3–4 rows + total above fold on 768px | `globals.css:242-246`; `timeline-carousel.tsx:338-343`; `$patientId.tsx:468-544` |
| **P0** | No empty/zero-state guidance for a patient with no visits | 1 | S | First-run empty state: "No visits yet" + prominent **Start first visit** button (footer-CTA styling) calling `handleNewVisit` + one-line flow scent; replaces the recessive dashed tile | `$patientId.tsx:468-544`; `timeline-carousel.tsx:418-435` |
| **P1** | Reclaim vertical budget — banners + tab strip + carousel starve the table *(merge of 3 lens findings)* | 2 | L | Collapse banners/Compare into one context row, share/shrink the year+tab row height, make carousel height-flexible, remove nested inner scroll; one scroll region only | `$patientId.tsx:362-543`; `timeline-carousel.tsx:338-436` |
| **P1** | Nested scroll: outer table-zone scroll + inner `max-h-[450px]` is a scroll trap that can hide the Grand Total *(merge of 3 findings)* | 2 | S | Drop inner `max-h-[450px] overflow-auto` at lines 344 + 685; single outer scroll; keep `thead` sticky, pin subtotal/total `sticky bottom-0` | `treatment-table.tsx:344,685`; `$patientId.tsx:522` |
| **P1** | Current visit date is not anchored — scrolls away / buried in top bar *(merge of 3 sticky-date findings)* | 3 | M | Slim **sticky visit-context strip** above the table (date + status + read-only), pinned on scroll; reuse table sticky-header pattern; also raise top-bar date weight | `$patientId.tsx:519-543`; `workspace-top-bar.tsx:219-223`; `treatment-table.tsx:281-304` |
| **P1** | No "what now" workflow scent for an open visit *(merge of 4 next-step findings)* | 1 | M | State-aware one-line next-step hint off `currentVisit.status`/`treatments`/`openVisit`; actionable empty-table state with inline `ApplyTemplateButton`; hosted in the sticky context strip | `$patientId.tsx:480-499`; `treatment-table.tsx:251-273` |
| **P1** | "Complete visit" indistinguishable from 8 secondary top-bar icons | 1 | M | Give Complete visit a labelled/accented primary treatment (when `status==='active'`); group secondary entry points; don't promote payment above completion | `workspace-top-bar.tsx:224-265`; `payment-summary-bar.tsx:46-54` |
| **P1** | Gated tabs/top-bar actions fail silently or open empty sheets with no `currentVisitId` | 1 | M | Apply Perio disabled+tooltip pattern to all visit-scoped triggers ("Select or start a visit first"); keep patient-scoped actions enabled | `$patientId.tsx:570-742`; top bar `234-239` |
| **P1** | New Visit stranded below 628px swiper at opacity-60 — least prominent yet most important *(merge of 3 findings)* | 2 | M | Relocate to stable always-visible solid button in carousel controls/header; full opacity when enabled; dashed/hint only for disabled open-visit case; drop opacity-60 resting state (no hover on touch) | `timeline-carousel.tsx:418-435`; `$patientId.tsx:500-516` |
| **P1** | Tab strip = 9 near-identical text-links: no grouping, no tab semantics, AI-slop className repetition *(merge of 2 findings)* | 2 | M | Extract one `WorkspaceToolButton` from a config array; group clinical vs utility vs nav; add active/focus states; move rare items to a "More" menu | `$patientId.tsx:362-465` |
| **P1** | Tab-strip buttons below 44px tap target, underline-only affordance, weak focus | 2 | M | `min-h-[44px]` hit area (padding, not font), persistent chip/border instead of hover-underline, explicit `focus-visible:ring-2` | `$patientId.tsx:369-453` |
| **P1** | Visit status communicated by color alone (carousel pill, table StatusBadge, odontogram rings) | other | M | Add non-color redundant cue (icon/shape/pattern) per status/layer; verify WCAG non-text contrast; extend severity-icon pattern to safety-floor badges | `timeline-carousel.tsx:240-252`; `treatment-table.tsx:83-105` |
| **P1** | Hand-rolled Treatment Plan modal lacks focus trap, scroll lock, dialog semantics | other | M | Replace with the standard Radix/shadcn Dialog used elsewhere (free focus trap/scroll lock/aria-modal/labelled title); use lucide X close | `$patientId.tsx:591-604` |
| **P2** | Auto-selected completed visit lands clinician in read-only screen with no "start new" scent | 1 | S | When auto-selected visit is read-only AND no open visit exists, show explicit "This visit is closed. Start a new visit to chart today." wired to `handleNewVisit` | `$patientId.tsx:148-161` |
| **P2** | 340px slideout reserved via `paddingRight` shrinks the table during charting | 2 | M | On iPad widths, overlay the ToothSlideout over the carousel (or reserve 340px only from the carousel zone) so the breakdown keeps full width; keep reserve-shrink for wide desktop | `$patientId.tsx:468-471` |
| **P2** | Carousel pill vs table badge use two duplicated color maps — palette drift, blue means two things | other | M | Centralize status/layer colors into one shared mapping (alongside `statusToLayer`) consumed by both; reconcile semantics | `timeline-carousel.tsx:240-252`; `treatment-table.tsx:83-105` |
| **P2** | `window.confirm` for irreversible Lock Visit — inconsistent with accessible dialog pattern | other | S | Replace with the Radix AlertDialog pattern already used by DiscardVisitDialog | `timeline-carousel.tsx:226-235` |
| **P2** | Inline price/notes use raw `type=number`/`textarea` with hover-only affordance, blur-only save | other | M | Route through shared shadcn Input/Textarea; make editability discoverable on touch (pencil/edit chip); add `inputMode="decimal"` + explicit confirm for the billable amount | `treatment-table.tsx:495-538,542-568` |
| **P2** | Promote top-bar visit date so it reads as an anchor, not afterthought | 3 | S | Label "Visit", foreground/medium weight, divider/chip from icon cluster — lighter-touch complement to the sticky strip | `workspace-top-bar.tsx:219-223` |

## Suggested first slice (most gain / least effort, in order)

1. **Remove the nested `max-h-[450px]` inner scroll** (`treatment-table.tsx:344` + `:685`) — one scroll region, sticky `thead`, `sticky bottom-0` total. *(S)* Stops hiding the money; prerequisite for everything else fitting.
2. **Shrink the carousel: replace the fixed 560px slide with a viewport clamp + reduce padding** (`globals.css:245`, `timeline-carousel.tsx`). *(M)* Single biggest above-the-fold win for concern #2.
3. **Consolidate the three status bands into one compact context strip and make it the sticky visit-date anchor above the table.** *(M)* Solves concern #3, recovers ~50px, and creates the host slot for guidance.
4. **Add the state-aware next-step scent + first-run/read-only empty states into that strip** (driven off existing `currentVisit.status`/`openVisit`/`treatments`; actionable empty-table state with `ApplyTemplateButton`). *(S–M)* Solves concern #1 with no new endpoints.
5. **Relocate New Visit to a solid, always-visible button at full opacity** in the carousel controls. *(M)* Closes the New-Visit prominence half of concern #2 and gives the empty/read-only states a real entry point.

