# Charting Axis & Colour Refine — execution reference

Workstream to de-tangle the visit-carousel tooth chart (Dentalemon's signature surface): the
status/time axis collision, the colour overload, and a billing-safety bug. Panel-validated
(three-persona clinical review: chairside dentist, Open Dental/Dentrix power user, clinical
info-design/UX). Decision record: this file + `~/.claude/plans/fancy-twirling-summit.md`.

**This is the heavy clinical surface** (`_workspace/$patientId`) deliberately excluded from the
iPad/desktop refine. Treat every change as clinical: tests first, no regressions, no broad refactor.

## Execution standards (MANDATORY — apply per slice)
- **Vertical TDD** (`docs/development/VERTICAL_TDD.md`): RED (failing test) → GREEN (impl) → verify, per
  slice. Invoke `superpowers:test-driven-development` at the start of each slice; do not write impl
  before a failing test.
- **Gates after every slice** (`cd apps/dentalemon`): `bun run typecheck` (0 errors), `bun run lint`
  (≤200 warnings, ZERO net-new), font-size ratchet (no net-new `text-[Npx]`). `check:boundaries` is
  backend-only → N/A.
- **FE verification** via `/browse` (boot API :7213 then app :3003; demo `demo@dentalemon.com` /
  `DemoClinic1!` / PIN `123456`; PIN drops on full reload/HMR — re-PIN after edits; multi-visit
  patient e.g. Juan dela Cruz). Before/after screenshots at 768/1024/1440 + a grayscale/CVD spot-check.
- Use `superpowers:verification-before-completion` before claiming any slice done (run the gate, show
  output). Don't commit/PR unless asked.

## Branch
Continue on a charting branch off `main` (the `design/ipad-desktop-refine` tree is unrelated FE work).
Confirm before starting.

---

## Locked decisions (panel outcomes)
| Q | Decision |
|---|---|
| Q1 Tabs | **Demote to neutral show/hide filters + rename → Existing / Planned / Completed / Declined.** Keep "Completed" (not "Done") — walkout vocabulary. Don't remove. |
| Q2 Colour | **Clinical state is the SOLE owner of fill hue.** Treatment layer → edge-style + opacity + existing hatch (no hue). Keep status legible on the tooth without toggling filters. Table's 6 statuses reconcile to the chart's 4 layers via a documented projection (no repaint). |
| Q3 Axes | Status = filter; Time = carousel position + dated snapshots. **Requires the P0 bug fix** (below) or time stays double-encoded. |
| Q4 New-vs-old | **Mark the exception (carried-over = amber dash), not the default (new).** NO lemon "this-visit" glow. Lemon reserved for interaction (selection/active/CTA). Optional "fresh" cue = lightness within the Planned token, never a new hue. |
| Q5 Existing+Completed | **Keep separate** (provenance: did WE do it vs pre-existing — billing + medico-legal). Distinct fills, shared "solid edge = realized" so they group against dashed "planned". |
| Q6 List | **Two views.** Keep the working table grouped BY VISIT (This Visit / Carried-Over — walkout). Add a separate BY-STATUS/PHASE treatment-plan presentation view (pre-auth, declined-with-reason). Tooth = click-to-filter only, never a grouping. |

**Corrected colour fact:** `--primary` = lemon `#FFE97D` (`src/styles/globals.css:25`), so the "proposed"
outline (`dashed var(--primary, #007AFF)`, dental-chart.tsx:255) renders **lemon, not blue**. The real
crisis is lemon meaning ~5 things, not a blue collision.

## Single-source-of-truth contract (the spine — build first)
Add `statusToLayer()` next to `resolveToothLayer` (`dental-chart.helpers.ts`). The chart fill/edge AND
the treatment-list group/badge derive from the **same treatment array at the same scope**.
Fold: `diagnosed+planned→Planned`, `performed+verified→Completed`, `declined→Declined`,
`dismissed→off-chart`, none→`Existing`.
**Invariant:** if the list shows a tooth has a Planned item, the chart paints that tooth Planned.
A test must pin this invariant.

---

## Slices (priority order; each is a vertical TDD slice)

### P0-1 — Bind cumulative overlay + label to the OPEN visit, not the centered card  *(billing-safety bug)*
- **Why:** centering an old Completed visit relabels it "Current — all visits" and repaints with
  today's status → walkout/claim mis-attribution (provenance falsification).
- **Files:** `timeline-carousel.tsx` (drop the `isActive` gate on overlay props + scope label, lines
  ~138, 196-200; key off open/editable visit identity instead), `$patientId.tsx` (pass open-visit id).
- **RED:** test that a centered historical (completed) card renders label "As of {date}" / "Visit
  snapshot" and receives NO cumulative completed/proposed sets; only the open visit gets them.
- **Gate + browse:** swipe back on a multi-visit patient → old card must NOT say "Current — all visits".

### P0-2 — One projection drives chart AND list; fix the carried-over contradiction
- **Why:** chart=cumulative vs table=visit-scoped disagree; carried-over rows show gray badge while the
  chart shows amber → chart says "urgent", list says "muted".
- **Files:** `dental-chart.helpers.ts` (`statusToLayer()` + tests), `dental-chart.tsx`,
  `treatment-table.tsx` (carried-over rows keep real status badge + small carried marker; de-emphasis
  via opacity, not gray), unify chart filter state with the table's "Hide Completed".
- **RED:** invariant test (list Planned ⇒ chart Planned for same tooth); carried-over row badge test.

### P1-1 — Colour de-overload: state owns hue, layer → edge-style
- **Files:** `dental-chart.tsx` (remove `LayerDot` 93-102/308; proposed outline → neutral dashed, strip
  lemon; declined hatch stays; carried-over amber dash stays), keep `getToothFillColor` state hues.
- **RED:** snapshot/DOM test that proposed teeth carry no lemon/hue outline and no layer dot; state fill
  unchanged.

### P1-2 — Demote + rename tabs to neutral filters
- **Files:** `dental-chart.tsx:60-87` (CHART_LAYERS: neutral styling, active = lemon ring only; labels
  Existing/Planned/Completed/Declined). Update data-testids + tests referencing `chart-layer-*`.
- **RED:** filter still hides/shows; chips carry no per-layer hue.

### P1-3 — Always-visible state legend in the carousel + CVD redundancy
- **Why:** legend is `showLegend={false}` in cards (defect); caries-red vs fractured-orange collapse
  under protanopia (clinical-misread risk).
- **Files:** `timeline-carousel.tsx:191` (compact always-on state key; full layer/edge key on-demand
  popover), `dental-chart.helpers.ts:374-387` + tooth render (redundant non-colour mark on caries +
  fractured; keep green off the tooth fill).
- **RED:** caries/fractured teeth expose a non-colour marker attr; legend present in card.

### P2 — Treatment-plan presentation view (by status/phase)
- Dedicated phased TP view for patient presentation + pre-auth; declined-with-reason listed;
  estimate-vs-charge totals labelled distinctly. New component; reuses treatment data. Defer until
  P0/P1 land.

### Backend (flagged — NOT in this workstream; needs product + API)
- Open Dental "Existing-Other" provenance (work done elsewhere) — missing today.
- True status-as-of-date per historical card (the "ideal" timeline; deferred in favour of
  working-chart + dated-snapshots).

---

## Scope locks
- Touch only: `timeline-carousel.tsx`, `dental-chart.tsx`, `dental-chart.helpers.ts`,
  `treatment-table.tsx`, their tests, `$patientId.tsx` (wiring only), `docs/decisions/`.
- Do NOT: change backend/schema/generated files, alter the state-fill palette beyond adding CVD marks,
  collapse Existing+Completed, add a lemon this-visit glow, or build the P2/backend items early.
- No new deps, no animation libs.

## Tests to update (exist today)
`timeline-carousel.test.ts`, `chart-layers.test.ts`, `treatment-table*.test.ts`, `dental-chart`
tests, `tooth-layer-explanation` consumers. Watch data-testids: `chart-scope-label`, `chart-layer-*`,
`visit-slide`.

## ADR
Supersede the `isActive`-coupling portion of `ADR-008` with a short **ADR-009**: cumulative chart is
open-visit-scoped; `statusToLayer` projection is the single source of truth for chart + list.

## Risks (fix-order)
1. Billing/medico-legal — carousel mis-attribution (P0-1).
2. Sync — chart/list contradictions erode trust (P0-2).
3. Clinical safety — caries/fractured CVD collapse (P1-3).
