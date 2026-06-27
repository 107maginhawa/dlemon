# Per-Tooth Panel Audit — 2026-06-27

Subject: the per-tooth RIGHT PANEL (the slideout opened by clicking a tooth), as
seen while editing the Jun 27 entry for Juan dela Cruz, tooth #16.

---

## 1. Scope & Method

**Read-only audit.** No source file was edited, created, or deleted. No timeline
logic was touched (`deriveLayerSetsAsOf`, `getToothHistory`'s emit rule,
`services/api-ts/scripts/check-timeline-coherence.ts` are all untouched and
unreviewed-for-change — any concern about them is reported here, not patched).
The single file written this run is this document.

**Source of truth.** All vocabulary and invariants are anchored to
`docs/product/CAROUSEL_TIMELINE.md` (two-layer model: per-visit SNAPSHOT fill vs
cumulative AS-OF treatment edge; invariants I1/I2/I3; locked cue/label vocabulary).

**Anchors verified by Read** (not taken on faith from the prompt):
- `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx:254` — `w-[340px]` desktop, `max-lg:w-full` iPad/mobile.
- `tooth-slideout.tsx:261-262` — title `<h2>` + name `<p>`, **no** truncate/line-clamp/whitespace-nowrap → title is NOT clipped.
- `tooth-overview-step.tsx:291` table `table-fixed`; `:295-302` colgroup widths 19/8/14/20/17/22; `:305-310` `<th>` cells with **no** nowrap/truncate; `:333` `{entry.state}` under "Condition"; `:336` `break-words` on Treatment cell.
- `dental-chart.helpers.ts:364-373` — `getToothHistoryEventBadge`: `finding` → red "Flagged"; `treatment` → lifecycle badge.
- `getToothHistory.ts:73-74` synthState (`'caries'` for pending, `'filled'` for performed); `:91-106` treatment-event emit (no treatment `id` surfaced); `:114` finding-event emit for any non-healthy state.
- `tooth-slideout.tsx:310` stepper circles `w-7 h-7` (28px); `:345` FindingsPanel gated `!readOnly && visitId`.

**Screenshot note settled:** the `#16 / Upper Right First Molar` HEADER title is
**NOT clipped** — the prompt's suspicion is correct. What is mashed is the TABLE
COLUMN HEADERS (`tooth-overview-step.tsx:305-310`), a different element ~6
sections lower in the panel.

---

## 2. Dimension Findings

### Dimension 1 — Layout (the mashed headers)

**Root cause.** The panel is fixed at `w-[340px]` on desktop (lg) —
`tooth-slideout.tsx:254` (and `:114` for the orphan saved state). Inside it the
Treatment Breakdown table is `table-fixed` with a 6-col colgroup of percentage
widths **19/8/14/20/17/22** (`tooth-overview-step.tsx:291,295-302`). At 340px,
minus the step container's `p-4` padding (`tooth-slideout.tsx:330`, 16px each
side) and the per-cell `px-2`, each `th`/`td` gets a very narrow box. **Two
DIFFERENT mechanisms** produce the mess:

1. **Header overflow.** The `<th>` cells (`px-2 py-2`,
   `tooth-overview-step.tsx:305-310`) have **no** wrapping/truncation/overflow
   rule, so single-word headers `Surface` / `Condition` / `Treatment` / `Status`
   are each wider than their fixed column slot and visually bleed past their
   colgroup boundary into the neighbor — the "mashed headers" the screenshot shows.
2. **Body mid-word wrap.** The body Treatment cell has `break-words`
   (`tooth-overview-step.tsx:336`), so a long CDT description like "Periodic oral
   evaluation - established patient" wraps mid-word inside its 20%-of-340px
   (~58px) column → "Periodi/c oral evaluati/on - establis/hed patient".

The table is wrapped in `overflow-x-auto` twice (`:266` and `:290`), but
`table-fixed` + percentage columns means the table never grows past 100% of the
340px box — so **the horizontal scrollbar never engages; columns get crushed
instead of scrolling.** Six columns of real content (a date, surfaces, a
condition word, a full CDT sentence, a status pill, a peso amount) cannot legibly
coexist in ~300px usable.

**Title actually clipped?** NO. `tooth-slideout.tsx:261`
(`<h2 className="font-bold text-lg leading-tight">Tooth #{toothNumber}</h2>`) and
`:262` (`<p className="text-sm text-muted-foreground">{name}</p>`) carry no
truncate/line-clamp/overflow-hidden/whitespace-nowrap — `leading-tight` only
tightens line-height; the `<p>` wraps freely. The header div (`:259`
`flex items-start justify-between`) gives the title block all width left of the ✕
button. So: title fine, column headers overlapping.

**iPad vs Desktop.** Desktop-only problem. On lg the panel is the fixed
`w-[340px]` (`:254`) where the 6 columns get crushed. On iPad/mobile (max-lg) the
same element is `max-lg:w-full` (`:254`), i.e. full viewport width, so the table
has ample room and the headers/cells do NOT overlap. The fix targets the **lg
width only**; the `max-lg:w-full` branch is already fine and must not be changed.
Minor separate inconsistency: the empty-state "Tooth saved" panel
(`tooth-slideout.tsx:114`) is hard-coded `w-[340px]` with NO `max-lg:w-full`
override (a narrow 340px strip on iPad), but it carries no table so it is not part
of this overlap bug.

**Proposed fix (two-part, priority order).**
1. **Widen the panel on desktop.** The carousel already reserves an empty RIGHT
   GUTTER where "New Visit" lives (`timeline-carousel.tsx:696-738`), and New Visit
   only renders when the most-recent card is centered (`timeline-carousel.tsx:599`)
   — i.e. exactly NOT while a clinician is mid-edit on a tooth. Overlapping the
   slideout over that gutter while open is low-conflict: bump desktop width from
   `w-[340px]` to `~lg:w-[440px]` and let the chart area's right gutter collapse
   under it (it is fixed/z-30 and already shrinks the workspace). ~100px of extra
   width turns 6 crushed columns into legible ones. Do NOT touch the max-lg branch.
2. **Fix header overflow + mid-word wrap regardless of width.** Give `th`
   `whitespace-nowrap` + `truncate` (with `title` attr) OR abbreviate headers
   (`Tx`, `Cond`, `Surf`), and switch the body Treatment cell from `break-words`
   to normal word-wrap (`break-words` is what forces "Periodi/c"; plain wrapping
   breaks on spaces). The single most legible fix is **widen-to-440 + de-densify**:
   drop Surface and Condition out of the table into a compact stacked sub-line per
   row, leaving **Date | Treatment | Status | Total** as the 4 columns that
   actually need their own column.

**Column mockup (recommended — 440px panel + 4 real columns, finding/condition as a sub-line):**

```
+--------------------------------------------------------------+
| Treatment Breakdown                                          |
+----------+----------------------------+-----------+----------+
| Date     | Treatment                  | Status    |    Total |
+----------+----------------------------+-----------+----------+
| Jun 27   | Periodic oral evaluation - | [Planned] |  P800.00 |
|          | established patient        |           |          |
|          | Surf B - Fractured         |           |          |   <- sub-line
+----------+----------------------------+-----------+----------+
| Jun 17   | -                          | [Flagged] |     -    |
|          | Watchlist                  |           |          |
+----------+----------------------------+-----------+----------+
| ...                                                          |
+----------+----------------------------+-----------+----------+
| Total                                              P800.00   |
+--------------------------------------------------------------+
```

If the 6-column shape must stay, the minimum legible version at 440px with
abbreviated, nowrap headers:
`Date | Surf | Cond | Treatment(wrap-on-space) | Status | Total`

**Evidence:** `tooth-slideout.tsx:254`, `:330`; `tooth-overview-step.tsx:266`,
`:290-302`, `:305-310`, `:336`.

---

### Dimension 2 — Editability

**Current behavior.** The Treatment Breakdown table inside `ToothOverviewStep` is
**READ-ONLY today, in both open and closed visits.** It is a pure render of
`useToothHistory` data: every cell (Date/Surface/Condition/Treatment/Status/Total)
is plain text or a non-interactive badge (`tooth-overview-step.tsx:313-369`) —
no onClick, no input, no status-change control, no advance/downgrade affordance
anywhere in that table. The Overview step DOES allow NEW entry (surface-condition
picker + Findings create), but it cannot EDIT or RE-STATUS an existing ledger row.
A dentist who mis-charted the Jun 27 "Planned" entry, or wants to advance it
Planned→Performed, or downgrade it, cannot do any of that here — they must go to
the separate Treatment plan table (`treatment-table.tsx`), a different surface.

**Code path.**
- `tooth-overview-step.tsx:289-369` — render-only ledger, no edit controls.
- `tooth-slideout.tsx:331-347` — Overview step renders `ToothOverviewStep` + `FindingsPanel` (create-only).
- `treatment-table.tsx:421-452` (Mark Done), `:481` (Decline gated `diagnosed|planned`), `:458` (Dismiss) — the ACTUAL edit surface, separate from the slideout breakdown.
- `use-mark-treatment-done.ts:30-42` — two-step advance.
- `updateDentalTreatment.ts:48-66` — immutability + transition gate.

**FSM allows** (`treatment.schema.ts:174-177`): `diagnosed → [planned, dismissed,
declined]`; `planned → [performed, dismissed, declined]`; `performed → [verified,
dismissed]`. There is **NO `diagnosed → performed` edge**, so a single jump 422s
("Invalid status transition", `updateDentalTreatment.ts:61-66`). The FE already
respects this: `use-mark-treatment-done.ts:32-42` does
`diagnosed → PATCH{planned}` THEN `PATCH{performed}`; `planned` is a single step.
`performed`/`verified` are immutable for field edits
(`updateDentalTreatment.ts:48-56` → 422 `TREATMENT_IMMUTABLE`), though status can
still go `performed → verified|dismissed`. `performed` sets
`performedAt = new Date()` server-side (`updateDentalTreatment.ts:126`) and
refuses a client-supplied `performedAt` — the known backdate gotcha.

**What's missing** to support in-panel edit of an existing ledger row:
- **(a)** The treatment's `id` surfaced in the ToothHistory entry.
  `getToothHistory` currently emits `visitId, status, cdt, price, surfaces` but
  **NOT the treatment id** (`getToothHistory.ts:91-106`), so the FE has no handle
  to PATCH.
- **(b)** Per-row affordances mirroring `treatment-table`'s set — Advance (reusing
  `useMarkTreatmentDone` two-step), Decline (gated `diagnosed|planned`), Dismiss,
  field edit — wired only for `eventKind === 'treatment'` rows (finding rows have
  no treatment to PATCH; route them to Findings resolve/convert instead).
- **(c)** The same consent gate the Mark-Done path enforces
  (`updateDentalTreatment.ts:70-73`: performed requires signed consent).
- Crucially, the panel must NOT offer a single "set to performed" on a `diagnosed`
  row — it must walk the two-step or it will 422.

**Closed-chart gate.** Once the visit/chart is CLOSED, edits must be blocked at the
affordance level exactly like `treatment-table` via its `readOnly` prop
(`treatment-table.tsx:148` `readOnly = readOnlyProp || !visitId`; controls gated
behind `!readOnly` at `:422/:458/:481`). The slideout already carries a `readOnly`
prop (`tooth-slideout.tsx:53,63`) and switches the footer to Close/Add-Amendment
(`tooth-slideout.tsx:454-471`) — so post-close corrections should flow through the
AMENDMENT path (append-only correction record, `AmendmentForm`/`AmendmentsList`),
never an in-place status mutation. Backend-side, the immutability rule
(`performed`/`verified` → 422) plus a visit-lock check are the real gate; the panel
affordances must honor `readOnly` so a closed chart never shows
Advance/Decline/Dismiss.

---

### Dimension 3 — Semantics

**Columns truthful?** Partially. The bible's two axes are (1) per-visit SNAPSHOT
state = clinical condition (fill) and (2) cumulative AS-OF treatment LAYER =
lifecycle (edge), with the per-tooth ledger row carrying a status badge of
Treated/Planned/Declined/Dismissed for treatment rows and Flagged for finding rows
(`CAROUSEL_TIMELINE.md:61-63`). The table's **Status** column is truthful to this:
`getToothHistoryEventBadge` returns "Flagged" (red) for `eventKind === 'finding'`
and the lifecycle badge for `eventKind === 'treatment'`
(`dental-chart.helpers.ts:364-373`) — correctly keeping the condition axis
(Flagged) distinct from the lifecycle axis (Planned/Treated/Declined/Dismissed).
The **Condition** column renders the raw chart `state` verbatim
(`tooth-overview-step.tsx:333` `{entry.state}` capitalized); `state` IS the
snapshot axis (the right axis) — but it includes values that are not clinical
conditions (see Watchlist).

**Watchlist misplaced? YES — a real semantic flag.** "Watchlist" rows appear under
"Condition" because the table prints `entry.state` verbatim
(`tooth-overview-step.tsx:333`) and `watchlist` is one of the snapshot `ToothState`
values (in `TOOTH_STATES`, `tooth-overview-step.tsx:48`). Per the bible, watchlist
is a tooth STATE / monitoring flag, not a diagnosed condition like caries or
fracture (`CAROUSEL_TIMELINE.md:75` lists "Tooth flagged watchlist" as a snapshot
`state=watchlist` whose ledger row is "Flagged"). Labelling the column "Condition"
and putting "Watchlist" in it conflates a surveillance STATE with a diagnosis. The
row is internally consistent (Watchlist state → Flagged badge, matching
`getToothHistory.ts:114`, which emits a finding for any non-healthy state), but the
COLUMN HEADER "Condition" is the misnomer — it is really a "State/Snapshot" column.
Renaming it "State" (or "Finding/State") makes Watchlist sit truthfully; "Condition"
implies a diagnosis the tooth does not have. **(Report — do not edit.)**

**Status-axis conflation.** The Status column itself does NOT conflate the axes —
it is the explicit two-axis merge point (Flagged for condition, lifecycle badge
for treatment) by design (`dental-chart.helpers.ts:364-373`). The conflation risk
is in the **"Condition" column header**: it presents the SNAPSHOT/state axis under
a label that reads like the diagnosis axis. Also: the table mixes finding rows (no
treatment, Flagged) and treatment rows in one chronological list (the intended
ledger), but because finding rows show "—" under Treatment and Total
(`tooth-overview-step.tsx:337,351`) while still carrying a state under "Condition",
a reader can mistake a pure monitoring snapshot for a billable diagnosis. Header
rename + keeping Flagged distinct resolves it.

**Caries / carries / carried-over ambiguity (OPEN QUESTION — not resolved here).**
The label space contains at least three look-alike tokens that the user must
disambiguate before any copy change:
- **(a) `caries`** — the clinical condition / decay state (a `ToothState`,
  `tooth-overview-step.tsx:41`; the bible's snapshot `state=caries`,
  `CAROUSEL_TIMELINE.md:76`).
- **(b) `carries`** — almost certainly a typo/mis-hearing of "caries" if it
  appears in UI copy, but could read as the verb in the bible's carry-forward
  concept (`CAROUSEL_TIMELINE.md:75` "must carry watchlist forward").
- **(c) `carried-over` / "Planned (carried)"** — a distinct LIFECYCLE value
  meaning a planned treatment first proposed in a prior visit, shown amber dotted
  (`CAROUSEL_TIMELINE.md:52,83`; `dental-chart.helpers.ts:294-296`).
These are three different concepts (a clinical condition, a data carry-forward
invariant, a lifecycle "carried" badge). This audit explicitly does NOT pick which
the screenshot intends — the correct column, badge hue, and copy differ for each,
so the user must confirm.

**Evidence:** `CAROUSEL_TIMELINE.md:61-63`, `:75-83`;
`tooth-overview-step.tsx:307` (Condition header), `:333` (`{entry.state}`), `:48`
(watchlist is a ToothState); `dental-chart.helpers.ts:364-373`;
`getToothHistory.ts:114`.

---

### Cross-cutting — the "No active findings" contradiction

**NOT a contradiction — a TWO-DATA-SOURCE collision over the word "finding"**
(severity: medium UX trap, not a logic bug). The caption comes from `FindingsPanel`
(`findings-panel.tsx:142-143`), whose `activeFindings` is the `dental_findings`
vocabulary table filtered to `status === 'active'` (`use-findings.ts:69`). The
Treatment Breakdown's Watchlist/Flagged rows come from a COMPLETELY DIFFERENT
source: `getToothHistory` reads chart-snapshot `state` and treatments
(`getToothHistory.ts:76-124`) and emits a "finding" EVENT for any non-healthy
snapshot state (incl. watchlist) at `getToothHistory.ts:114`. So a tooth can
simultaneously have (a) zero active structured findings → "No active findings" and
(b) several snapshot-derived "Flagged" rows in the ledger. Both are individually
truthful; together they read as a contradiction because both surfaces use
"finding"/"Flagged" language. **Recommend** the user disambiguate vocabulary (e.g.
the panel's "Findings" = structured curated findings; the ledger's red badge →
"Flagged (state)", or scope the caption "No active structured findings").

Note: `FindingsPanel` is gated `!readOnly && visitId` (`tooth-slideout.tsx:345`),
so on a CLOSED visit the caption vanishes and only the ledger's Flagged rows remain
— the contradiction is **open-visit-only**, i.e. exactly mid-edit, when it does the
most damage.

**On I1/I2/I3:** nothing here violates the invariants; this audit is read-only and
did not touch `deriveLayerSetsAsOf`, `getToothHistory`'s emit rule, or
`check-timeline-coherence.ts`. One adjacent observation tied to I2 / the bible's
§6.2 backdate gotcha: any future in-panel "Advance to Performed" affordance (Dim 2)
would re-trigger `updateDentalTreatment.ts:126` `performedAt = new Date()`,
stamping today's date and collapsing the Treated layer onto the current card — the
same artifact the seed had to direct-DB backdate around. An in-panel advance must
be understood to set `performedAt = now` by design (correct for live work done
today), but would need the same backdate discipline if ever used to record
historical work.

---

## 3. Expert Verdicts

### Lens 4a — Practicing Dentist / Clinical Charting

**Rating: 4/10** — the data is clinically truthful and the two-axis ledger is
genuinely good, but the panel is a cramped read-only artifact wearing a
"Treatment/Review" stepper it can't honor, so a dentist mid-visit can see #16's
story but cannot fix or advance it where they're looking.

**What 10/10 looks like from the chair:** a single tooth surface that lets me READ
the tooth's life in one glance and ACT on it without leaving — because at the chair
"what's going on with #16" and "do the filling on #16" are the same thought, two
seconds apart, often one-handed in gloves while the patient is reclined.
Concretely: (1) the history reads as a clinical narrative, not a 6-column
spreadsheet crushed into 300px — each visit a scannable row (date, what I saw, what
I did/plan, where it stands, what it costs), the longest CDT token gets real
horizontal room and wraps on spaces never "Periodi/c"; (2) the vocabulary is
unambiguous — never "Condition" over a monitoring STATE, never "No active findings"
while four Flagged rows sit above; (3) acting is in-place and respects the FSM
(Advance walks diagnosed→planned→performed, never single-jumps to 422; Decline;
Dismiss; consent gate enforced; closed chart → controls vanish, routed to
append-only Amendment); (4) it works in gloves (≥44px targets, one-handed reach,
arm's-length read, obvious active state); (5) performedAt honesty — in-panel
Advance stamps today by design, and the panel makes clear it records work done NOW.

**Concrete changes:**
1. WIDEN before redesign: lg panel fixed `w-[340px]` (`tooth-slideout.tsx:254`, and the orphan "Tooth saved" at `:114`). Bump to `~lg:w-[440px]`; the New Visit right gutter is empty exactly while a tooth is being edited (`timeline-carousel.tsx:599`), so overlapping is low-conflict. Do NOT touch `max-lg:w-full`.
2. DE-DENSIFY the ledger 6→4 columns: `Date | Treatment | Status | Total`, Surface+Condition demoted to a sub-line ("Surf B · Fractured"). Headers overlap purely because `th` has no nowrap/truncate over a too-narrow fixed colgroup slot (`tooth-overview-step.tsx:295-310`).
3. Switch the Treatment body cell from `break-words` to normal space-wrapping (`tooth-overview-step.tsx:336`). A clinician reads a CDT description by its words; never break inside one.
4. RENAME "Condition" header to "State"/"Finding/State" (`tooth-overview-step.tsx:307`); it renders `entry.state` verbatim (`:333`) and "Watchlist" is a surveillance STATE, not a diagnosis (`CAROUSEL_TIMELINE.md:75`). **(Report.)**
5. RESOLVE the "No active findings" / "Flagged rows" terminology collision (`findings-panel.tsx` caption vs `getToothHistory.ts:114`). Scope the caption ("No active structured findings") OR relabel the badge ("Flagged · state"). "No findings" above four flagged rows reads as a broken chart and erodes trust.
6. Make the ledger ACTIONABLE for `eventKind === 'treatment'` rows: surface the treatment id from `getToothHistory` (`:91-106` omits it), then add per-row Advance (reuse `use-mark-treatment-done.ts`), Decline (gate `diagnosed|planned`), Dismiss — mirroring `treatment-table.tsx`, honoring the consent gate. Finding rows get "Resolve/Convert to treatment".
7. HARD-gate all in-panel edit behind the existing `readOnly` prop (`tooth-slideout.tsx:53`). Closed/locked → Close + Add Amendment (already wired `:454-471`), NEVER Advance/Decline/Dismiss; corrections are append-only amendments.
8. Reconcile the stepper with reality: it advertises "2 Treatment / 3 Review" but Overview's ledger is read-only and Treatment/Review are a separate create flow. Either make Overview's ledger the edit surface (preferred) or relabel.
9. REPORT-ONLY clinical flag (do not touch timeline logic): the `synthState` heuristic (`getToothHistory.ts:73-74`) invents `state='filled'` for performed and `'caries'` for pending treatments lacking a snapshot. A fabricated "caries" in a clinical State column is a charting hazard — a dentist could read a diagnosis never charted. Consider "—"/"no snapshot" rather than a guessed disease.

**Questions the user should ask:** (folded into §5.)

---

### Lens 4b — UI/UX Specialist

**Rating: 4/10** — the two-axis ledger is well-modeled and the slideout has real
a11y bones (Esc-to-close + focus return via `useSheetA11y`, 44px footer targets,
aria-disabled stepper), but the panel fails the most basic UX contract: it shows a
"Treatment/Review" stepper and an editable-looking step that is actually a
read-only ledger, mashes its own column headers into illegibility at 340px, and
contradicts itself in plain words ("No active findings" above four Flagged rows).
A clinician cannot tell what they can touch, cannot read the longest cell, and is
told two opposite things about the same tooth.

**What 10/10 looks like (interaction / hierarchy / a11y):**
1. **Mode legibility (core failure).** One unambiguous reading mode and one
   unambiguous editing mode, with a visible deliberate transition — not an implied
   promise from a stepper. Today `tooth-slideout.tsx:286-327` paints a 3-step
   stepper with green-checks + a lemon active pill (universal "filling out a form"
   signal), but the Overview ledger (`tooth-overview-step.tsx:289-369`) is pure
   render. The stepper writes a cheque the content can't cash. A 10/10 either makes
   the ledger genuinely actionable (so the stepper is honest) or visually separates
   "History (read)" from "Record this visit (edit)" as two labelled regions; mode
   is announced (aria-live / heading), and `readOnly` is VISIBLE not just behavioral.
2. **Legibility / visual hierarchy.** No element overlaps another. Headers
   (`:305-310`) fit their column or are abbreviated/truncated-with-title; the
   longest CDT token wraps on spaces never "Periodi/c" (today `break-words` at
   `:336` forces mid-word). At 340px the table de-densifies to the 3-4 fields that
   earn a column (Date / Treatment / Status / Total), surface+state as a quiet
   sub-line.
3. **One tooth, one truth.** Never "No active findings" (`findings-panel.tsx:142`)
   while four red "Flagged" rows sit above. Disambiguate the shared word "finding";
   a column never lies about its axis ("Condition" header at `:307` over a
   "Watchlist" cell → rename to "State").
4. **Touch / glove / reach.** Every interactive target ≥44px, one-handed on a
   reclined-patient iPad. Footer buttons honor 44px (`tooth-slideout.tsx:459/511`)
   and condition-picker buttons `min-h-[44px]` (`:196`), but the stepper circles
   are 28px (`w-7 h-7`, `:310`) and any future ledger-row action needs validation.
   The 340px desktop panel is the NARROW case; the iPad full-width branch
   (`max-lg:w-full`, `:254`) is the design center.
5. **State visibility & focus order.** Which tooth, step, mode, and editability are
   all visible without interaction. Focus order logical, aria-disabled future steps
   non-actionable, Esc/focus-return preserved (`useSheetA11y`). Contrast meets WCAG
   AA — the `[10px]` badge text (`:341`) and muted sub-labels checked, not assumed.

**Concrete changes:**
1. WIDEN desktop panel before redesign: `w-[340px]` (`tooth-slideout.tsx:254`, orphan empty-state `:114` lacks `max-lg:w-full`). Bump to `~lg:w-[440px]`; New Visit gutter empty while editing → low-conflict. Do NOT touch `max-lg:w-full`. **(Report.)**
2. DE-DENSIFY 6→4 columns (`Date | Treatment | Status | Total`), Surface+State as sub-line ("B · Watchlist"). Mashed headers root cause: `th` (`:305-310`) no nowrap/truncate over fixed-percentage slots too narrow for the words.
3. FIX mid-word wrap: `break-words` → normal space-wrapping (`:336`). **(Report.)**
4. RESOLVE "No active findings" / "Flagged rows" — the single worst trust failure. Caption (`findings-panel.tsx:142-143`) reads `dental_findings` `status==='active'`; ledger Flagged reads snapshot states — different sources, same word. Scope caption OR relabel badge. Note the caption is gated `!readOnly && visitId` (`tooth-slideout.tsx:345`), so the collision is open-visit-only — exactly mid-edit.
5. RENAME "Condition" → "State"/"Finding/State" (`:307`); renders `entry.state` (`:333`), "Watchlist" is a monitoring STATE. **(Report.)**
6. RECONCILE the stepper with reality (`:286-327`) — the deepest UX lie. Make Overview actionable (preferred) or relabel/restructure; add a visible mode indicator.
7. Make read-vs-edit a VISIBLE state. Today `readOnly` (`:53`) only swaps the footer (`:454-471`) and hides the FindingsPanel (`:345`); the ledger looks identical open vs locked. Add an explicit locked/amend-only banner; route post-close corrections through the append-only Amendment path.
8. Validate touch/contrast for chairside: stepper circles 28px (`:310`) below the 44px footer target; ledger rows / future row-actions unvalidated; `[10px]` badge/sub-label text (`:341`, `:240`) needs an AA contrast check.

**Questions the user should ask:** (folded into §5.)

---

## 4. Prioritized Fix List

Within each tier, **presentation/CSS** fixes are separated from **logic/behavior**
changes (the split the user cares about). All are REPORT-ONLY this run — nothing
was edited.

### P1 — must fix (illegibility + active trust failures)

**Presentation / CSS:**
- **P1-A — Mashed column headers.** `th` cells have no `whitespace-nowrap`/`truncate` over a too-narrow fixed colgroup slot (`tooth-overview-step.tsx:305-310`, colgroup `:295-302`). Fix: widen panel `lg:w-[340px] → lg:w-[440px]` (`tooth-slideout.tsx:254`) AND/OR de-densify to 4 columns + abbreviate/nowrap headers. Pure CSS/markup.
- **P1-B — Mid-word CDT wrap.** Treatment body cell `break-words` (`tooth-overview-step.tsx:336`) → normal space-wrapping. Pure CSS.

**Logic / behavior:**
- **P1-C — "No active findings" vs Flagged rows contradiction.** Two data sources share the word "finding" (`findings-panel.tsx:142-143` vs `getToothHistory.ts:114`). Fix = copy/vocabulary decision (scope caption to "No active structured findings" or relabel ledger badge "Flagged · state"). Copy change, but requires a product decision on canonical vocabulary → logic-adjacent. *(Borderline: the code change is presentation/copy, but the DECISION is semantic.)*

### P2 — should fix (semantic truthfulness + missing core capability)

**Presentation / CSS:**
- **P2-A — "Condition" header is a misnomer.** Rename to "State"/"Finding/State" (`tooth-overview-step.tsx:307`); column renders `entry.state` (`:333`), and watchlist is a STATE not a diagnosis (`CAROUSEL_TIMELINE.md:75`). Header text only → presentation, BUT it asserts a semantic axis, so confirm vocabulary with the user first. *(Borderline: copy edit, semantic intent.)*
- **P2-B — Stepper visual honesty.** The "2 Treatment / 3 Review" stepper (`tooth-slideout.tsx:286-327`) over a read-only Overview ledger. If the chosen resolution is "relabel/restructure" it is presentation; if "make actionable" it is logic (→ P2-D). *(Flagged: cannot classify until the user picks the resolution.)*

**Logic / behavior:**
- **P2-C — Surface the treatment `id` in ToothHistory.** `getToothHistory.ts:91-106` omits the id, so the FE has no PATCH handle. Backend change (read-path only; does NOT touch the emit rule's flag/no-flag decision). Precondition for any in-panel edit.
- **P2-D — In-panel ledger actions.** Per-row Advance (reuse `use-mark-treatment-done.ts` two-step, never single-jump → 422), Decline (`diagnosed|planned`), Dismiss for `eventKind==='treatment'` rows; honor the consent gate (`updateDentalTreatment.ts:70-73`). Finding rows → "Resolve/Convert". Logic.
- **P2-E — Hard-gate in-panel edit behind `readOnly`.** Closed/locked chart must hide Advance/Decline/Dismiss and route to the append-only Amendment path (`tooth-slideout.tsx:53,454-471`). Logic.

### P3 — nice to have / hygiene

**Presentation / CSS:**
- **P3-A — Orphan "Tooth saved" empty-state width.** `tooth-slideout.tsx:114` hard-codes `w-[340px]` with no `max-lg:w-full` → a narrow strip on iPad. Pure CSS.
- **P3-B — Touch/contrast validation.** Stepper circles 28px (`:310`) below the 44px target; `[10px]` badge/sub-label text (`:341`, `:240`) AA contrast check. Presentation.
- **P3-C — Visible read-only/locked banner.** Make `readOnly` a visible state, not just absent buttons. Presentation, but couples to P2-E.

**Logic / behavior:**
- **P3-D — `synthState` fabricates a diagnosis (REPORT-ONLY, do NOT touch timeline logic).** `getToothHistory.ts:73-74` invents `state='caries'` for pending treatments lacking a snapshot. A guessed disease shown in a clinical State column is a charting hazard. Consider "—"/"no snapshot". This is inside the backend ledger the run is forbidden to edit → product decision required before any change.

---

## 5. Open Questions for the User

1. **Caries / carries / carried-over terminology.** Three look-alike tokens, three
   different concepts: `caries` (decay condition/state, `tooth-overview-step.tsx:41`,
   `CAROUSEL_TIMELINE.md:76`); `carries` (likely a typo of caries, or the
   carry-forward verb, `CAROUSEL_TIMELINE.md:75`); `carried-over` / "Planned
   (carried)" (lifecycle badge, amber dotted, `CAROUSEL_TIMELINE.md:52,83`,
   `dental-chart.helpers.ts:294-296`). The correct column, badge hue, and copy
   differ per concept. **Which does the screenshot intend?**

2. **Primary user & device.** Is the design center the chairside iPad (full-width
   branch, gloved one-handed taps, arm's-length read over a reclined patient) or the
   desktop-mouse 340px panel (assistant transcribing post-op)? The mashed-header bug
   is a 340px-desktop artifact; if chairside is primary, the iPad branch should be
   tuned first and 340px treated as the degraded case — today it's the reverse.

3. **Is the panel for reading, editing, or both?** Today it's a read-only ledger
   wearing an editing stepper; the mode boundary is undefined and that ambiguity is
   the core UX failure. If both, how do I tell what is touchable before I reach?

4. **Read-vs-edit mode entry/exit.** If the ledger becomes editable, how do I ENTER
   edit mode and EXIT/cancel without saving — obvious one-handed in gloves? An
   always-live edit surface is dangerous at the chair; an explicit toggle or
   deliberate per-row action protects against accidental gloved taps mutating a
   clinical record.

5. **Relationship to New Visit flow & the chart-close gate.** Can I open and edit
   #16 mid-New-Visit, and the moment I Complete/lock the visit do Advance/Decline
   vanish and flip to Amendment (`tooth-slideout.tsx:454-471`)? Who may amend a
   closed chart, and is every amendment audited? Does advancing Planned→Performed
   stamp `performedAt = now()` by design (`updateDentalTreatment.ts:126`), and does
   the team understand historical work needs the separate direct-DB backdate path
   (`CAROUSEL_TIMELINE.md §6.2`)?

6. **One-handed / glove / a11y.** Are ALL targets ≥44px (28px stepper circles and
   ledger-row actions are not), does the layout survive a gloved-tap miss, does
   `[10px]` badge/caption text meet WCAG AA at that size, and is focus order +
   screen-reader announcement of the active step/mode validated for a clinic that
   may face accessibility obligations?

7. **Canonical vocabulary across four word-sets.** Are "Findings" (structured
   `dental_findings`), the ledger's "Flagged" rows (snapshot states), the
   "Condition" column (raw state), and the Findings-chip vocabulary (Caries,
   Fracture, Abscess…) the SAME taxonomy or four overlapping ones a clinician must
   reconcile? Decide one canonical meaning per word before any copy ships.

### Items where logic-vs-presentation could not be cleanly classified
- **P1-C** (findings caption): the code edit is copy/presentation, but choosing the
  canonical vocabulary is a semantic/product decision.
- **P2-A** (Condition→State rename): header text is presentation, but it asserts a
  clinical axis — confirm vocabulary first.
- **P2-B** (stepper honesty): presentation if relabel, logic if made actionable —
  cannot classify until the user picks the resolution (relabel vs make-editable).
- **P3-D** (`synthState` fabricated caries): inside the backend ledger this run must
  not edit; flagged for product decision, not classified for action.

---

*Read-only audit. No source files edited. Timeline logic (`deriveLayerSetsAsOf`,
`getToothHistory` emit rule, `check-timeline-coherence.ts`) untouched.*
