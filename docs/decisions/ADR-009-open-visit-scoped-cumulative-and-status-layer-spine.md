# ADR-009: Cumulative Chart Binds to the Open Visit; statusToLayer Is the Single Source of Truth

**Status**: Accepted
**Date**: 2026-06-24
**Supersedes**: the `isActive`-coupling portion of [ADR-008](./ADR-008-cross-visit-chart-layers.md) (its line: "The **active** chart is cumulative…"). The rest of ADR-008 (read-time status overlay, `deriveChartLayerSets`, precedence `completed > proposed > declined > entryClassification`, declined-as-hatch, interim/write-time-sync note) stands unchanged.

**Context**: ADR-008 made the dental chart one cumulative odontogram rendered through status-filtered layers, and said *"the **active** chart is cumulative ('Current — all visits'); historical timeline-carousel cards stay per-visit snapshots."* In the carousel implementation, "active" was read as **the centered card** (`isActive = idx === activeIndex`). That coupling produced a clinical-safety bug: centering an old **Completed** visit relabeled it "Current — all visits" and repainted it with today's cumulative status. A three-persona panel (chairside, billing/convention, info-design/accessibility) flagged this independently as **provenance falsification** — a walkout/claim performed from a centered historical card would attribute today's completed work to the wrong visit and date. Verified live: a Jun-22 Completed visit displayed as "Current — all visits".

A second, related gap: the chart layers and the treatment list each folded treatment status into a view independently, so they could silently diverge in meaning.

---

## Decision

**1. The cumulative overlay binds to the genuine OPEN visit, never to the centered card.**

- "Open visit" = the single visit with status `active` or `draft` (`findOpenVisit`), the living document. The "Current — all visits" label, the cumulative cross-visit layer sets (`completed/proposed/declined/carriedOver`), and the layer toggle attach to **that visit's** card by identity (`visit.id === openVisitId`), regardless of which card is centered.
- Centering a historical card changes only selection/editing focus and visual emphasis (the lemon accent/border) — it never relabels the card "Current" or repaints it with today's status. Historical cards stay honest dated snapshots ("Visit snapshot").
- If no open visit exists (all completed/locked), no card is cumulative — every card is a snapshot. There is no "centered card inherits cumulative" path.
- The route passes `openVisitId` to the carousel authoritatively; the carousel falls back to `findOpenVisit(visits)` when it is omitted.

**2. `statusToLayer()` is the single source of truth for the status→layer fold.**

- One projection (`dental-chart.helpers.ts`) maps treatment status to chart layer: `diagnosed|planned → proposed`, `performed|verified → completed`, `declined → declined`, `dismissed → null` (off-chart / struck from the plan). A tooth with no treatment record is `baseline` (Existing).
- Both the chart's `deriveChartLayerSets` and the treatment list's by-status presentation grouping derive from this one fold, so they can differ in **resolution** (the list shows the six raw statuses; the chart shows four layers) but can never **contradict**. Invariant: *if the list shows a tooth has a Planned item, the chart paints that tooth `proposed`.*

## Consequences

- Provenance is safe: completed work can no longer be mis-attributed to a historical visit by browsing the carousel. This unblocks the walkout/claim flow on the chart side (the table was already visit-scoped).
- `Existing` and `Completed` are kept distinct (provenance: "was already there" vs "done by us") per the panel — never collapsed, because billing reconciliation and medico-legal defensibility depend on the split.
- Lemon (`--primary`) is reserved for interaction (selection ring, active filter, CTA); status/layer is encoded on neutral edges + fill hue + redundant CVD marks, not on lemon. (Colour decisions are implementation, not part of this ADR's contract.)

## Not in scope (deliberately deferred)

- **Unifying the chart's layer filters with the table's "Hide Completed" into one control.** Panel-endorsed, but it is a lift-state-to-route refactor entangled with the (now-done) filter-tab rework, with real regression surface on a clinical surface and modest launch value. Deferred to a dedicated follow-up; the chart filters and table completed-toggle remain independent for now.
- **Write-time chart sync** remains the durable end state per ADR-008; this ADR does not change that trajectory. `statusToLayer` is the natural seam to reuse when that migration happens.
