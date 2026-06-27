# Carousel Timeline — how to read a tooth's story across visits

A non-engineer reference for the per-tooth carousel/timeline. It explains what each
visit card paints, why a tooth can legitimately show nothing on a card, and the
invariants the demo seed must obey so QA never has to re-investigate "is this a data
bug or a logic bug?".

> **Audience:** QA, clinicians reviewing the demo, anyone confused by a tooth that
> appears, disappears, then reappears across the carousel.
> **Companion tools:**
> `bun services/api-ts/scripts/inspect-tooth-timeline.ts <patient> <tooth>` (read a
> single tooth's story) and `bun services/api-ts/scripts/check-timeline-coherence.ts`
> (prove the whole seed obeys the invariants below).

---

## 1. Mental model: two layers on every card

Each carousel card is one **visit**. A tooth on that card is painted from **two
independent sources**:

1. **Per-visit chart snapshot** — the tooth's clinical *state* as charted **on that
   visit** (`healthy`, `caries`, `filled`, `watchlist`, `missing`, …). This is the
   tooth's **fill colour**. Snapshots are **per-visit and do NOT auto-carry**: a tooth
   only has a snapshot on a card if that visit's chart explicitly recorded it. The one
   exception is **baseline** teeth (`entryClassification` `existing` / `existing_other`)
   which are immutable and copied forward — but a *finding* like `watchlist` or `caries`
   is **not** baseline and does not carry on its own.

2. **Cumulative as-of treatment layers** — the tooth's lifecycle *layer* (`Planned` /
   `Treated` / `Declined`) derived from the patient's **whole treatment history, as of
   this visit's date**. This is the tooth's **edge cue** (dotted/solid ring). Treatments
   *are* cumulative: a treatment performed on March 1 shows `Treated` on every card from
   March 1 onward. Findings/conditions are **not** cumulative — only treatments are.

> **The headline rule:** *Conditions live in per-visit snapshots (fill). Treatments
> live in the cumulative as-of layer (edge).* Mixing these up is the source of every
> "why did this tooth flicker?" confusion.

---

## 2. The tooth cues (locked vocabulary)

The chart, chips, legend, per-tooth panel, and printed PDF all speak the same words
(`getLayerLabel` / `getLayerCueSwatch` / `getToothHistoryStatusBadge`).

| Cue | Where it comes from | Visual | Means |
|-----|---------------------|--------|-------|
| **Existing** (baseline) | snapshot `existing` / `existing_other` | fill only, no edge | dentition that was already there; immutable, carries forward |
| **Planned** | treatment `diagnosed` \| `planned` (as-of) | dotted **slate** edge | outstanding recommended work — wins over Treated/Declined |
| **Planned (carried)** | planned treatment first proposed in a prior visit | dotted **amber** edge | aging pending work carried over |
| **Treated** | treatment `performed` \| `verified` (as-of, from `performedAt`) | solid **green** edge | realized work; never reverts |
| **Declined** | treatment `declined` (as-of) | solid **gray** edge + hatch | patient refused the recommended work |
| **Missing / Extracted** | snapshot `missing` \| `extracted` | terminal fill | tooth is gone — **absorbing**, no actionable layer after |

The fill (clinical state hue) and the edge (lifecycle layer) are deliberately separate:
fill owns clinical-state colour (caries-red, filled-blue), the edge owns the lifecycle
cue, and lemon `--primary` is reserved for interaction (selection). A `Treated` tooth
therefore shows a green edge *over* whatever fill its snapshot has.

In the **per-tooth ledger** (slideout breakdown) a row also carries a status badge:
`Treated` / `Planned` / `Declined` / `Dismissed` for treatment rows, and **`Flagged`**
(red) for a finding row (a condition charted that visit with no treatment).

---

## 3. Workflow × business-rule matrix

How each lifecycle event renders. "Card (that visit)" = what you see on the event's
own carousel card; "Card (later visits)" = what later cards show; "Ledger row" = the
per-tooth slideout breakdown.

| Lifecycle event | What happens in DB | Card (that visit) | Card (later visits) | Ledger row | Invariant |
|-----------------|--------------------|-------------------|---------------------|------------|-----------|
| **Tooth flagged watchlist** | snapshot tooth `state=watchlist` on visit N | watchlist fill, no edge | **must** carry `watchlist` (or a progressed state) on every later card until restored/terminal | `Flagged` finding | **I1** |
| **Caries diagnosed** | snapshot `state=caries` (+`conditionCode`) on N | caries (red) fill | **must** carry `caries` forward until a performed treatment restores it to `filled`/`crown`/`implant`, or it goes terminal | `Flagged` finding | **I1** |
| **Restoration present** | snapshot `state=filled`\|`crown`\|`implant` on N (often the result of a performed treatment) | restoration fill | **must** carry forward until terminal — may persist, upgrade, or regress to recurrent caries, but must never go **absent** | `Flagged` finding (state) | **I1** |
| **Treatment planned** | treatment `status=diagnosed`\|`planned`, owning visit N | dotted slate (amber if carried) edge | Planned edge persists as-of until performed/declined/dismissed | `Planned` | I-treat |
| **Treatment performed** | treatment `status=performed`, `performedAt=D` | if `D ≤` this visit: green edge; else (`performedAt` in the future) still `Planned` (see §note) | **Treated** (green) edge on every card with date ≥ `D` | `Treated` | **I2** |
| **Treatment verified** | `status=verified`, `performedAt=D` | same as performed | Treated, never reverts | `Treated` | **I2** |
| **Treatment declined** | treatment `status=declined`, visit N | gray solid + hatch edge | Declined as-of from N — **not absorbing**: a fresh proposal flips it to Planned | `Declined` | I-treat |
| **Treatment dismissed** | treatment `status=dismissed` | off-chart (no edge) | drops from all as-of layers and the ledger — legitimate Planned→none | `Dismissed` | I-treat |
| **Carried over** | planned treatment with `sourceVisitId` = earlier visit | amber dotted edge | Planned-carried from the *origin* visit's date until performed/declined/dismissed | `Planned` | I-treat |
| **Tooth extracted / missing** | snapshot `state=extracted`\|`missing` on visit N | terminal fill, strips all layers | terminal forward; no Planned/Treated/Declined after | finding (state) | **I3** |

> **§note — `performedAt` vs the as-of date.** `deriveLayerSetsAsOf`
> (`chart-export.ts:160-169`) paints a performed/verified treatment `Treated` only on
> cards dated **≥ `performedAt`**. If `performedAt` is *after* a card's date but the work
> was already proposed by then, that card shows **`Planned`**, not blank. So a tooth can
> read `Treated` on the newest card and `Planned` on older ones — that is correct, not a
> revert. (This is why the seed must backdate `performedAt` to the visit the work was
> actually done in; see §6.2.)

**`I-treat` (treatment precedence, LOCKED — already enforced in code, not data):** as-of
layer precedence is `proposed (Planned) > completed (Treated) > declined > baseline`
(`chart-export.ts:184`). A fresh proposal supersedes both a completed treatment and a
prior refusal on the same tooth — so the completed/declined layers are **non-monotonic by
design** (a tooth can legitimately go Treated→Planned or Declined→Planned). The seed must
not fight this; the guard must not flag it (see I2).

---

## 4. How to read a gap

A tooth showing **nothing** on a card is not automatically a bug.

**Legitimate empty (no row / no fill):**
- The tooth was **never flagged and never treated** for this patient → it has no
  snapshot and no treatment, so no card paints it and the ledger emits no row. (Most
  teeth, most visits.)
- A **terminal** tooth (missing/extracted) after the terminal visit → nothing
  actionable, by design (**I3**).
- A **primary tooth that exfoliated** (shed naturally in mixed dentition) → it legitimately
  leaves the arch. *This invariant set assumes permanent dentition; primary-tooth
  exfoliation is out of scope for the guard (see §5 scope).*

Note: a tooth being **charted differently** later is not a gap — `caries` on one card
becoming `filled` on the next (because a treatment was performed) is the correct, expected
arc, not a disappearance. What must never happen is the tooth going **absent**.

**A data bug (this is what the guard catches):**
- A tooth shows a finding (watchlist/caries/restoration) on visit N, **nothing** (absent
  snapshot) on a later visit — the classic *flagged → absent → flagged* flicker. The
  condition didn't go anywhere clinically; the seed just forgot to chart it on the middle
  visits. Violates **I1**.
- A tooth in the **completed (Treated)** as-of set drops to `declined` or nothing on a
  later card *without* a fresh re-proposal. Violates **I2**. (Treated→Planned via
  re-proposal is legitimate — see I-treat.)
- **Active disease** (`caries`/`watchlist`/`fractured`) charted on a tooth *after* it was
  `missing`/`extracted`. Violates **I3**. (A `crown`/`implant` after extraction is fine —
  that's an implant restoration.)

Rule of thumb: **a gap is fine if it has a reason** (never charted, terminal, or shed).
A tooth that goes from a known non-healthy state to **absent** is the seed bug.

---

## 5. Invariants (enforced by `check-timeline-coherence.ts`)

These are the rules the demo seed must satisfy. The guard reads the **raw per-visit
snapshots** (`chartRepo.findByVisit`) and the patient's treatments, and derives as-of
layers with the *same* `deriveLayerSetsAsOf` the app uses — **not** the per-tooth ledger
(`getToothHistory`), which synthesises states for treatments with no snapshot
(`getToothHistory.ts:73`) and would mask snapshot gaps. Visit dates use
`completedAt ?? createdAt` over `status ∈ {completed, locked, active}`, exactly as the
inspector does (`inspect-tooth-timeline.ts:63-65`). A green guard means "the data is
coherent — any remaining surprise is logic."

- **I1 — no disappearing teeth (the flicker bug).** Once a tooth has a non-`healthy`
  snapshot state on visit N, **every later charted visit must carry a snapshot for that
  tooth** (the latest known state, or a charted change). The hard, enforced failure is
  **non-healthy → absent (no snapshot)** on a later card. "Cured" must be an explicit
  charted `healthy` row, never silent absence — after which the tooth may be absent again.
  *Clinical state may legitimately move in any direction* — `watchlist`→`caries`
  (progression), `caries`→`filled` (restored), even `filled`→`caries` (recurrent/secondary
  caries around an old restoration). The guard does **not** police the direction of state
  change, only disappearance, because real teeth regress and re-restore.

- **I2 — Treated is sticky.** For the cumulative **completed** set: once
  `deriveLayerSetsAsOf(...).completed` contains tooth T as of date D, every later date D′
  must have T in **completed**, OR in **proposed** (a legitimate fresh re-proposal — the
  precedence flip), OR T `missing`/`extracted`. T must never silently fall to **declined**
  or to **no layer**.

- **I3 — no active disease after a tooth is gone.** Once a tooth is `missing`/`extracted`
  on visit N, no later visit may chart **active disease** on it (`caries`, `watchlist`,
  `fractured`). Restorations/replacements **are** allowed — an extracted tooth legitimately
  becomes `crown`/`implant` (implant-supported crown), and terminal states persist
  forward. So `extracted → crown` is valid; `extracted → caries` is a bug.

### Scope (explicit, so the guard neither over- nor under-fires)
- **Permanent dentition only.** Primary/mixed-dentition patients and natural exfoliation
  of primary teeth are **out of scope** — a shed primary tooth legitimately disappears and
  would false-trip I1/I3. The guard skips primary FDI numbers (5x/6x/7x/8x deciduous).
- **`surfaceConditionMap`-only findings are out of scope.** A finding recorded solely in
  `surfaceConditionMap` with `state='healthy'` is not covered by I1 (which keys off
  `state`/`conditionCode`). Seed findings must be charted on `state`/`conditionCode` to be
  guarded. (If we later seed surface-only findings, extend I1.)
- **`carriedOver`, `dismissed`, `declined`** are lifecycle-legitimate transitions, not
  violations — the guard must treat dismissal as terminating a treatment and a fresh
  proposal as superseding completed/declined (I-treat).

---

## 6. Worked examples (real seed data)

Captured with `inspect-tooth-timeline.ts` against the demo DB. `snapshot` = per-visit
fill state; `asOf` = cumulative treatment layer; `ledger` = whether the per-tooth panel
emits a row.

### 6.1 ❌ The flicker bug (Juan dela Cruz `562648a3…`, tooth #16) — violates I1

```
2025-12-09  snapshot=ABSENT      asOf=—   ledger=no
2026-01-28  snapshot=watchlist   asOf=—   ledger=YES · finding
2026-03-29  snapshot=ABSENT      asOf=—   ledger=no      ← watchlist vanished
2026-05-13  snapshot=ABSENT      asOf=—   ledger=no
2026-06-17  snapshot=watchlist   asOf=—   ledger=YES · finding   ← reappeared, no resolving event
2026-06-27  snapshot=ABSENT      asOf=—   ledger=no
```

The tooth is on a watchlist with no intervening treatment, extraction, or return to
health — so it should read `watchlist` on **every** card from Jan 28 onward. Instead it
flickers because the seed only charted #16 on the two visits whose template mentioned
it. This is the bug Deliverable 2 fixes.

### 6.2 ✅ A clean treatment lifecycle (same patient, tooth #36)

```
2025-12-09  snapshot=filled            asOf=—          ledger=YES · finding
2026-01-28  snapshot=filled            asOf=—          ledger=YES · finding
2026-03-29  snapshot=caries (K02.1)    asOf=proposed   ledger=YES · 2 treatment   (D0220, D2391)
2026-05-13  snapshot=ABSENT            asOf=proposed   ledger=no
2026-06-17  snapshot=filled            asOf=proposed   ledger=YES · finding
2026-06-27  snapshot=ABSENT            asOf=completed  ledger=no
```

The cumulative `asOf` axis behaves correctly: caries diagnosed → `proposed` (Planned)
→ `completed` (Treated) once `performedAt` passes. **But the snapshot rows still
violate I1** (the `caries`/`filled` go absent on intervening cards) — so even a tooth
with good treatment data needs the snapshot carry-forward.

Note the `performedAt=2026-06-26` (≈ reseed day) collapses the Treated layer onto the
final card. **Cause:** seed-demo advances treatments through the HTTP API, and
`updateDentalTreatment.ts:126` hardcodes `patch.performedAt = new Date()` — the API does
not accept a client `performedAt`, and `performed`/`verified` rows are immutable
afterward. So this cannot be fixed by passing a date through the seed's API path; the
reseed applies a **direct-DB backdate pass** stamping each performed treatment's
`performedAt` to its owning visit's `completedAt` after all status transitions complete.
(seed-supplement already inserts `performedAt: completedAt` directly — `seed-supplement.ts:913`.)

### 6.3 ✅ Legitimate empty (same patient, tooth #14)

```
2025-12-09 … 2026-06-27   snapshot=ABSENT   asOf=—   ledger=no   (every visit)
```

Never flagged, never treated → correctly paints nothing on every card and emits no
ledger row. This is **not** a bug — it's the common case and the baseline for "how to
read a gap" (§4).

---

## 7. For maintainers — keep this in sync

- Tooth cues: `apps/dentalemon/src/features/workspace/components/dental-chart.helpers.ts`
  (`getLayerOutline`, `getLayerCueSwatch`, `getLayerLabel`, `getToothHistoryStatusBadge`).
- As-of layer precedence: `services/api-ts/src/handlers/dental-visit/chart/chart-export.ts`
  (`deriveLayerSetsAsOf`) ↔ FE `chart-layers.ts` (`deriveChartLayerSets`) — LOCKED, must agree.
- Ledger emit rule: `services/api-ts/src/handlers/dental-visit/chart/getToothHistory.ts`.
- Per-visit snapshot carry-forward (baseline-only): `dental-chart.repo.ts` `upsert`.

- Restoration vs finding roles: `computeChartDiff` (`dental-chart.helpers.ts:723`) treats
  `healthy`/`filled`/`crown`/`implant` as `IMPROVED_STATES`. That is the *diff* view
  (did this visit improve the tooth?). In the *timeline carry-forward* view (I1) those
  same restoration states are **standing states that persist** — same states, different
  role. Don't "fix" one against the other; they're intentionally distinct.

This doc and the invariants in §5 are the contract `check-timeline-coherence.ts`
enforces. Change an invariant here → update the guard, and vice versa.
