# Per-Tooth Panel — Card Layout Spec (Phase 1)

**Date:** 2026-06-27
**Context:** Phase 1 of the per-tooth right-panel improvement. Follows the findings in
[`per-tooth-panel-audit-2026-06-27.md`](./per-tooth-panel-audit-2026-06-27.md). Phase 1 is
**presentation-only and FE-only**: replace the cramped 6-column "Treatment Breakdown" table
with an iPad-friendly stacked card list, and fix the "No active findings" caption that
contradicts visible Flagged rows. No data-shape, badge-logic, FSM, gate, or backend changes.

This work confirms the two-axis model in [`../CAROUSEL_TIMELINE.md`](../CAROUSEL_TIMELINE.md):
**"caries" is the CONDITION (finding axis)**, distinct from the treatment/lifecycle **state**.

---

## Decision

**Cards over table.** The per-tooth "Treatment Breakdown" moves from a 6-column `<table>` with
a fixed `<colgroup>` to a stacked list of cards — one card per visit-event.

Why:

- **iPad 340px.** The slideout is `w-[340px]` on `lg` and full-screen (`max-lg:w-full`) below
  `lg` (`tooth-slideout.tsx:254`). Six columns inside 340px forces mid-word wrapping and the
  fixed `colgroup` (340px) overlaps adjacent cells. Cards reflow cleanly at both 340px and
  full width and give us >=44px tap targets with legible (>=11px) data text.
- **Two-axis honesty.** A single row that smears "condition" and "state" together reads
  ambiguously. Cards label **Condition** (the finding, e.g. caries/fracture) and **State**
  (the watchlist/lifecycle status) as *separate* fields, matching the two-axis model and
  making state-only finding rows (e.g. Watchlist / Flagged) read truthfully.
- **Structurally kills the audit P1/P2 layout defects.** The card structure removes the
  colgroup overlap (**P1-A**) and the mid-word wrap (**P1-B**), and eliminates the
  cramped-column legibility problem (**P2-A**) by construction rather than by tuning widths.

This is a layout change only. We **reuse** the existing badge helpers
(`getToothHistoryStatusBadge`, etc.) and the existing date/price formatting — no badge logic
and no formatting is re-derived.

---

## Card layout spec

```
┌─────────────────────────────────────┐
│ Jun 27, 2026          [Planned] ₱800 │   <- date left; status badge + price right
│ Periodic oral evaluation             │   <- treatment description (or omit line if none)
│ Condition: Fractured · State: —      │   <- condition (caries/fracture) and state (watchlist) labeled, "—" when absent
├─────────────────────────────────────┤
│ Jun 17, 2026             [Flagged]   │
│ Watchlist                            │   <- state-only finding rows read truthfully
└─────────────────────────────────────┘
```

### Field rules

- **Date** — left-aligned on the card header. Use the existing date formatting; do not
  re-derive.
- **Status badge** — right-aligned in the header, via the existing badge helper
  (`getToothHistoryStatusBadge` etc.). No new badge logic.
- **Price** — right-aligned in the header, after the badge, via existing price formatting.
  Omit when the event has no price.
- **Treatment line** — the treatment description (e.g. "Periodic oral evaluation"). **Optional**:
  omit the line entirely when the event has no treatment description (e.g. a state-only finding row).
- **Condition vs State** — rendered as two *labeled* fields, e.g. `Condition: Fractured · State: —`.
  - **Condition** = the finding axis (caries, fracture, …).
  - **State** = the lifecycle/watchlist axis (Watchlist, …).
  - Render **"—"** in either field when that axis is absent for the event.
- **Total footer** — the existing "Total" footer row is **kept** unchanged below the card list.

### Responsive / a11y constraints

- Cards must read well at **both** `w-[340px]` (lg) and full-width (`max-lg:w-full`).
- Any interactive element has a tap target **>=44px**.
- Data text stays legible — **avoid <11px** for data values.

---

## Phase 1 checklist

- [ ] RED test extended in `tooth-slideout.test.ts` (cards render; condition/state labeled; "—" when absent; caption truthful).
- [ ] Table → cards in `tooth-overview-step.tsx` (reuse `getToothHistoryStatusBadge` + existing date/price formatting; keep Total footer).
- [ ] Caption fix in `findings-panel.tsx` (line ~143) — stop saying "No active findings" when Flagged rows are visible.
- [ ] FE gate green: `bun run test` + `bun run typecheck` + `bun run lint`.
- [ ] Live iPad screenshot verified at 340px and full-width.

---

## Phase 2 backlog (NOT in this phase)

- **P2-C** — Surface the treatment id on the card (link/affordance to the treatment record).
- **P2-D** — In-panel **Advance** (two-step FSM: diagnosed→planned→performed), **Decline**, and
  **Dismiss** actions, with the consent gate enforced.
- **P2-E** — `readOnly` hard-gate plus append-only **amendment** flow for closed charts (no
  mutation of a closed chart; amendments are appended).
- **P3-D** — Report-only surfacing (export/report view of the per-tooth timeline).
