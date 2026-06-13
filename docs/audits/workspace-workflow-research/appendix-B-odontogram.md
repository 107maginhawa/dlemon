# Appendix B — Living-document Odontogram

Chunk B of the workspace-workflow research. Scope: baseline / proposed / completed /
declined / carried-over chart layers, compare/diff (P1-14), mixed dentition (P1-17),
per-surface tooth slideout, chart baseline merge & carry-over.

Citations are `file:line` or doc-id. `[ASSUMPTION]` marks anything not verified in
source. Register schema per the plan prompt §Step 4. Slices numbered `SL-B01…`.

Governing decision context: **ADR-008** (`docs/decisions/ADR-008-cross-visit-chart-layers.md`)
— Proposed/Completed/Declined layers are a **read-time status overlay** over the
`getTreatmentPlan` aggregate, *not* persisted on the chart; durable **write-time chart
sync** is deliberately deferred (ADR-008:21-27). This is the single most important
sequencing fact for this chunk: the persisted chart (`dental_chart` + baseline) and the
treatment records are two stores reconciled only at render time.

Non-goals honored: local-first/offline, no-AI (no ceph auto-tracing, no auto-diagnosis).

---

## (2) Baseline inventory — IMPLEMENTED workflows & rules

| # | Workflow / rule | FE entry (`file:line`) | Backend handler / endpoint | Governing ids | Test coverage |
|---|---|---|---|---|---|
| B-I1 | Render cumulative chart layers (proposed/completed/declined/carried-over) | `routes/_workspace/$patientId.tsx:263` `deriveChartLayerSets`; `components/dental-chart.tsx:101-304` | `getTreatmentPlan` (`dental-patient/treatment-plans/getTreatmentPlan.ts:73-92` `completedToothNumbers`) | CHART-XV, ADR-008, P1-15 | FE unit `lib/chart-layers.test.ts` (7); `dental-chart.helpers.test.ts` `resolveToothLayer` (487-515); backend `getTreatmentPlan` via `dental-patient` suite |
| B-I2 | Layer precedence completed>proposed>declined>entryClassification | `lib/chart-layers.ts:37-48`; `dental-chart.helpers.ts:173-182` `resolveToothLayer` | (derived; no endpoint) | CHART-XV | FE unit `chart-layers.test.ts:67-80`; `dental-chart.helpers.test.ts:487-515` |
| B-I3 | Multi-select layer toggle (combinable, never empties) | `dental-chart.tsx:130-147,313-345` | n/a (client state) | P1-15, CHART-BR-006 | FE unit `dental-chart.helpers.test.ts` `DEFAULT_VISIBLE_LAYERS` (584); `isToothVisible` |
| B-I4 | Declined layer = gray diagonal hatch + chip only when present | `dental-chart.tsx:244-254,281-283,320-323` | `getTreatmentPlan` status=`declined` (`getTreatmentPlan.ts:69`) | CHART-XV, WCAG 1.4.1 | FE unit `chart-layers.test.ts:59-65` (derive); rendered hatch = E2E-only (chart stubbed, `test-setup.ts`) |
| B-I5 | Carried-over proposed teeth (amber dashed ring) | `dental-chart.tsx:243,248-249,269`; `$patientId.tsx:122,419` carriedOverItems | `getTreatmentPlan` `carriedOver` flag (`getTreatmentPlan.ts:150`) | CHART-XV, BR-008 | FE unit `chart-layers.test.ts:82-93`; ring = E2E-only |
| B-I6 | Baseline carry-over: new visit inherits cumulative dentition (read-time synthetic chart) | (FE reads `chart.teeth` from `getDentalChart`) | `chart/getDentalChart.ts:37-42`; `chart/chart-carryover.ts:31-44` `chartFromBaseline` | living-doc (commit 19926439), CHART-BR-002 | backend unit `chart/chart-carryover.test.ts` (2); `dental-chart-baseline.test.ts` (4) |
| B-I7 | Baseline merge on full chart save (last-write-wins per tooth, existing-protected) | `components/tooth-slideout.tsx` → save → `use-save-chart.ts` | `chart/upsertDentalChart.ts:53-55`; `repos/dental-chart-baseline.repo.ts:23-71` `mergeVisitChart`/`mergeTeeth` | CHART-BR-002, AC-BL-001..006 | backend unit `repos/dental-chart-baseline.test.ts` (6 AC-BL); handler `dental-chart-baseline.test.ts` (4) |
| B-I8 | Per-tooth / per-surface edit (PATCH single tooth) | `tooth-slideout.tsx:148-174` per-surface; chart click | `chart/updateTooth.ts`; `repos/dental-chart.repo.ts` `updateTooth` | WF-009, EF-VIS-002 | backend unit `repos/dental-chart.test.ts:126-264` (updateTooth, entryClassification); contract `dental-visit.hurl:147` |
| B-I9 | Tooth slideout stepper (Overview→Treatment→Review), per-surface condition, classification-only save | `components/tooth-slideout.tsx:57-476` | `createDentalTreatment` + `updateTooth` | IN-04, D11, WF-009 | FE unit `tooth-slideout.test.ts` (11) |
| B-I10 | Chart compare / diff overlay (P1-14) | `components/chart-compare-overlay.tsx:60-255`; opened from `timeline-carousel.tsx:30,336` | reuses `getDentalChart` (no new endpoint) | P1-14 | FE unit `dental-chart.helpers.test.ts:697+` `computeChartDiff` (~12); overlay DOM = E2E-only |
| B-I11 | Mixed / primary / permanent dentition rendering (P1-17) | `dental-chart.tsx:180-225`; `dental-chart.helpers.ts:62-86` `getMixedDentitionTeeth`, `:30-40` `getDentitionType`; fed by `timeline-carousel.tsx:263` | (client; dentition init = `POST /dental/patients/:id/dentition`) | P1-17, P2-002 | FE unit `dental-chart.helpers.test.ts:229-309` (getDentitionType, mixed set, primary mapping) |
| B-I12 | Tooth notation toggle FDI/Universal/Palmer (display only; identity stays FDI) | `dental-chart.tsx:114-121,256`; `dental-chart.helpers.ts:412-464` | branch settings `toothNotation` | QW-5 | FE unit `dental-chart.helpers.test.ts:348-464` (Palmer, display label, round-trip) |
| B-I13 | Per-tooth cross-visit history | (slideout history view) | `chart/getToothHistory.ts`; `GET /dental/visits/history/{patientId}/teeth/{toothNumber}` | — | contract `dental-visit.hurl:432`; FE unit `tooth-slideout.test.ts:110` |
| B-I14 | Chart version snapshots on save | (implicit) | `upsertDentalChart.ts:51` `saveVersion`; `repos/dental-chart.repo.ts` | AC-001/AC-002 | backend unit `repos/dental-chart.test.ts:316-340` |
| B-I15 | Visit-lock immutability gate on chart writes | (FE read-only when locked) | `upsertDentalChart.ts:37-39`; `updateTooth.ts:41-43` | EF-VIS-002/003, AC-VIS-002, BR-003 | backend (lock-gate tests in visit suite) `[ASSUMPTION]` exact file not opened |
| B-I16 | Chart write RBAC (assistant may write conditions under supervision) | n/a | `upsertDentalChart.ts:34`; `updateTooth.ts:38` `assertBranchRole` | E2, dental-visit perms | backend unit (assistant tests) `dental-assistant.hurl` |
| B-I17 | Chart read branch authorization | n/a | `getDentalChart.ts:28` `assertBranchAccess` | branch-scope | contract `dental-visit.hurl:116-143` |
| B-I18 | Offline localId stored on chart insert | `use-save-chart.ts` `[ASSUMPTION]` sends localId | `upsertDentalChart.ts:47-48`; `repos/dental-chart.repo.ts:85` | GAP-001 | **UNTESTED** (stored only; see B-G3) |

**Wiring reconciliation (contract-spine.json):** `getDentalChart` (op 1737) → FE consumers
`chart-compare-overlay.tsx`, `use-dental-chart-query.ts`, `use-save-chart.ts` ✔ wired.
`getTreatmentPlan` (op 2279) → wired. `updateTooth` (line 4265), `getToothHistory`
(2268) → handlers present. No orphan chart ops found in this chunk.

---

## (3) Per-family sequencing analysis + ordering-gap list

### Family B — Odontogram living document

Ordered happy-path sequence (pre/postconditions):

```
[returning patient opens new visit]
  pre: baseline row exists for patient
  → getDentalChart(visitId) finds no dental_chart row
  → chartFromBaseline(baseline) returns synthetic chart (sentinel id, baseline.teeth verbatim)
  post: FE renders cumulative existing dentition (no 404)

[clinician charts a finding / treatment on a tooth]
  → tooth-slideout: assign per-surface conditions → CDT/treatment → Save
  → updateTooth (PATCH single tooth)  OR  upsertDentalChart (full POST)
  pre: visit NOT completed/locked  (EF-VIS-002/003)
  post: dental_chart.teeth mutated; saveVersion(); [upsert ONLY] baseline merged

[layers render]
  → getTreatmentPlan aggregates ALL visits → {proposed, completed, declined, carriedOver}
  → resolveToothLayer precedence: completed > proposed > declined > entryClassification
  post: chart shows cumulative status overlay (read-time, ADR-008)

[compare]
  → ChartCompareOverlay fetches a reference visit chart → computeChartDiff(ref, focus)
  post: per-tooth added/resolved/unchanged list (client-side only)

[next visit]
  → baseline (merged last-write-wins) carried forward again
```

**Ordering gaps found** (detail in register §4):

- **B-G1 — `updateTooth` (per-surface PATCH) does NOT merge into the patient baseline.**
  Only `upsertDentalChart` calls `mergeVisitChart` (`upsertDentalChart.ts:53-55`);
  `updateTooth.ts` has no baseline write (verified: grep `baseline` in `updateTooth.ts` →
  none). A clinician who edits a single tooth via the PATCH path produces chart state
  that the next visit's carry-over **silently drops** (baseline never sees it). Two save
  paths, one baseline writer → ordering/consistency gap. **NEW**.
- **B-G2 — read-time overlay divergence is unbounded by design (ADR-008).** If a treatment
  is dismissed/un-performed, the persisted `dental_chart` tooth state (e.g. `caries`)
  and the overlay disagree until a human re-charts. ADR-008:27 names the revisit
  trigger ("clinician-visible bugs"). This is the durable write-time-sync deferral.
  **KNOWN** (ADR-008).
- **B-G3 — offline localId is non-idempotent.** `localId` is *stored* on first insert
  (`dental-chart.repo.ts:85`) but never used as a conflict/dedup key — there is no
  `onConflict` on localId and no dedup test (grep confirms zero idempotency test). A
  retried offline chart save (same localId, new row id) replaces rather than dedups;
  P2P replay can double-apply. **KNOWN** (GAP-001 — stored-not-enforced).
- **B-G4 — no concurrent-edit conflict resolution across the two save paths or two
  devices.** `mergeTeeth` is last-write-wins per tooth (`dental-chart-baseline.repo.ts:57-71`),
  but `updateTooth` does a read-modify-write on `dental_chart.teeth` with no optimistic
  version check — interleaved single-tooth PATCHes on the same chart can lost-update a
  sibling tooth. **NEW**.
- **B-G5 — compare reference picker can offer the focal visit / has no empty-state guard
  beyond auto-select [ASSUMPTION partially].** `chart-compare-overlay.tsx:69` auto-selects
  `referenceOptions[0]`; the caller is expected to exclude the focal visit, but there is
  no in-component assertion. Low severity. **NEW**.
- **B-G6 — diff direction heuristic treats every non-improving change as "worsened".**
  `computeChartDiff` (`dental-chart.helpers.ts:503-545`): any state→non-{healthy,filled,
  crown,implant} change is `added`/"worsened", and tooth-absent-in-focus = "resolved".
  A *reclassification* (e.g. caries→fractured) is labeled "new/worsened" and an extracted
  tooth dropping out of the snapshot reads as "resolved/treated" — clinically misleading.
  **NEW** (clinical-correctness).

---

## (4) Gap & candidate register (Steps 3–4)

Schema: `| id | finding | chunk | I/K/N | lenses{S,R,O,C} | KG-node | MODULE/WF | BR (existing|proposed) | spine-op/handler | severity | blast-radius |`

| id | finding | chunk | I/K/N | lenses | KG-node | MODULE/WF | BR | spine-op/handler | sev | blast-radius |
|---|---|---|---|---|---|---|---|---|---|---|
| B-G1 | `updateTooth` per-surface PATCH skips baseline merge → carry-over silently drops single-tooth edits | B | NEW | S,O,C | dental_chart / chart_baseline | dental-visit / WF-009,WF-032 | proposed **BR-0301**: every chart write path (full upsert AND per-tooth PATCH) MUST merge into `dental_patient_chart_baseline` | `updateTooth` (`chart/updateTooth.ts`) | P1 | data-loss |
| B-G2 | Read-time overlay divergence (chart vs treatment status) unbounded; durable write-time sync deferred | B | KNOWN | S,C | dental_chart / treatment | dental-visit (ADR-008) | strengthens BR-008; proposed **BR-0302** (when write-time sync lands): performed treatment transition mutates persisted tooth state | `getTreatmentPlan` (2279) | P2 | correctness |
| B-G3 | Offline `localId` stored but never used as idempotency/dedup key (no onConflict, no test) | B | KNOWN | O,S | dental_chart | dental-visit / WF-009 | strengthens GAP-001; proposed **BR-0303**: chart upsert is idempotent on (visitId, localId) — replay returns existing row, no new version | `upsertDentalChart` / `dental-chart.repo.ts:85` | P1 | data-loss |
| B-G4 | `updateTooth` read-modify-write on `teeth` JSONB has no version/optimistic check → concurrent PATCH lost-update | B | NEW | O,S | dental_chart | dental-visit / WF-009 | proposed **BR-0304**: per-tooth PATCH is a column-scoped/atomic write that never overwrites sibling teeth (mirror perio EF-PER-005 single-site idempotency) | `updateTooth` | P1 | data-loss |
| B-G5 | Compare overlay has no in-component guard excluding the focal visit from reference options | B | NEW | S | dental_chart | dental-visit / P1-14 | proposed **BR-0305**: compare reference set excludes the focal visit (self-diff = no-op) | `chart-compare-overlay.tsx:69` | P3 | cosmetic |
| B-G6 | `computeChartDiff` mislabels reclassification as "worsened" and tooth-dropout as "treated" | B | NEW | C | dental_chart | dental-visit / P1-14 | proposed **BR-0306**: diff distinguishes reclassification (neutral) and extraction-dropout (not "resolved") from genuine improvement | `dental-chart.helpers.ts:503` | P2 | correctness |
| B-G7 | Mixed-dentition set is a single canonical age-8 snapshot, not derived from charted/age data → wrong teeth for a 6- or 11-yo | B | NEW | C | dental_chart | dental-visit / WF-032,P1-17 | proposed **BR-0307**: mixed-dentition tooth set is patient-specific (eruption stage / charted presence), not a fixed snapshot | `dental-chart.helpers.ts:62` | P2 | correctness |
| B-G8 | No extracted/missing-tooth charting guard on the chart write path (EC2 lives elsewhere) | B | NEW | C,S | dental_chart / treatment | dental-visit / WF-009 | proposed **BR-0308**: a new restorative finding on a tooth charted `extracted`/`missing` is rejected/warned (FDI guard) | `updateTooth`/`upsertDentalChart` | P2 | correctness |
| B-G9 | Carry-over read path (`chartFromBaseline`) has no contract (`.hurl`) test — only backend unit | B | NEW | S | chart_baseline | dental-visit / WF-032,WF-033 | strengthens CHART-BR-002 (coverage) | `getDentalChart` (1737) | P2 | correctness |
| B-G10 | `localId` idempotency + baseline-merge-on-PATCH are UNTESTED at contract layer | B | NEW | O | dental_chart | dental-visit | (coverage for BR-0301/0303) | `upsertDentalChart`/`updateTooth` | P2 | correctness |
| B-C1 | **Candidate:** durable write-time chart sync (treatment perform → tooth state auto-charts) — the ADR-008 endgame | B | NEW | S,C,O | dental_chart / treatment | dental-visit (ADR-008) | proposed **BR-0302** | new transition trigger on treatment FSM | P2 | correctness |
| B-C2 | **Candidate:** per-tooth chart merge conflict resolution for P2P (cadence) with audit ordering | B | NEW | O,S | dental_chart / cadence | dental-visit / cross-cutting | proposed **BR-0309**: concurrent per-tooth chart edits across devices resolve last-write-wins with a recorded conflict audit marker | cadence `+ upsertDentalChart` | P2 | data-loss |
| B-C3 | **Candidate:** chart "as-of-date" / historical layer view (show the chart as it was at a past visit, distinct from compare) | B | NEW | C | dental_chart | dental-visit / P1-14 | proposed **BR-0310**: a read-only as-of snapshot reconstructs cumulative status at a chosen visit date | reuse `getTreatmentPlanVersion` (2293) | P3 | cosmetic |
| B-C4 | **Candidate:** surface-level (not just tooth-level) completed/proposed overlay so a MOD filling shows only the treated surfaces | B | NEW | C | dental_chart | dental-visit / WF-009 | proposed **BR-0311**: layer resolution is surface-aware where treatment carries a surface set | `getTreatmentPlan` (surfaces already returned) | P3 | cosmetic |

KNOWN-vs-NEW integrity: only **B-G2** (ADR-008) and **B-G3** (GAP-001) map to existing
recorded items; all others are NEW for this chunk and were grep/contract-spine-verified
not already wired or tested. No MASTER-GAP-MATRIX chart row was relabeled.

---

## (5) TDD-ready slice specs

Run conventions (per `VERTICAL_TDD.md` + MEMORY gotchas): backend tests **from
`services/api-ts/`** via `bun run scripts/test-with-db.ts <file>` with
`DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase_test` (per-file,
never `bun test <path>`, never dir-arg). Contract via `scripts/run-contract-tests.ts`
against `$API_URL` (**restart the API server first**). FE unit: DentalChart is globally
stubbed (`test-setup.ts` → `data-testid="dental-chart-stub"`) — assert pure functions
(`deriveChartLayerSets`/`resolveToothLayer`/`computeChartDiff`), never rendered-chart DOM;
chart DOM asserted only in E2E (`tests/e2e/helpers/e2e-seed.ts`). Gate: api-ts `bunx tsc`
(root `bun run typecheck` is FE-only) + `bun run check:boundaries` + backend + contract +
FE tsc/unit + E2E, green with no regressions.

---

### SL-B01 — Baseline merge on per-tooth PATCH (closes B-G1) — **P1, data-loss**
`depends: —`  ·  binds **BR-0301**, WF-009/WF-032, AC-BL-* family.

- Backend-leaning slice (steps 5,7,8 minimal — no new FE surface; reuses existing PATCH).
- **RED first — backend** `services/api-ts/src/handlers/dental-visit/chart/update-tooth-baseline.test.ts`:
  (a) PATCH a single tooth → `DentalChartBaselineRepository.findByPatient` reflects the
  edited tooth; (b) the merge honors CHART-BR-002 (a `treatment_plan`/`condition` PATCH
  does not overwrite an `existing` baseline tooth); (c) next-visit `chartFromBaseline`
  carries the PATCH-edited tooth forward.
- **GREEN:** call `baselineRepo.mergeVisitChart(...)` in `updateTooth.ts` after
  `repo.updateTooth(...)`, mirroring `upsertDentalChart.ts:53-55` (reuse `mergeVisitChart`
  — do not write a parallel merger).
- **Contract** `dental-visit.hurl` (extend §6 area near line 147): after a tooth PATCH,
  the next visit's `getDentalChart` 404-fallback returns the edited tooth in `teeth`.
- FSM/transition: none. Property test: none.
- Reuse: `mergeVisitChart`, `mergeTeeth` (already tested in `dental-chart-baseline.test.ts`).

### SL-B02 — Idempotent offline chart upsert on `(visitId, localId)` (closes B-G3) — **P1, data-loss**
`depends: —`  ·  binds **BR-0303**, GAP-001.

- Backend-only slice (skip FE steps).
- **RED first — backend** `repos/dental-chart.test.ts` (extend `upsert` describe):
  two upserts with the SAME `localId` on the same visit → second returns the *existing*
  chart id (no second row, no extra `saveVersion`); two upserts with DIFFERENT localId →
  normal replace; null localId → today's behavior unchanged.
- **GREEN:** add a unique index / `onConflict (visitId, localId)` guard in
  `dental-chart.repo.ts` upsert; short-circuit replay before `saveVersion`. Add migration
  via `bun run db:generate` (review SQL, never hand-edit generated migrations).
- **Contract** `dental-visit.hurl`: POST chart twice with identical `localId` → same `$.id`,
  version count unchanged.
- Property test: optional — replay N times = 1 row (à la perio single-site idempotency
  `dental-perio-coverage.test.ts:442`).
- Reuse: GAP-001 localId field already present (`dental-chart.repo.ts:27,85`).

### SL-B03 — Atomic / version-guarded per-tooth PATCH (closes B-G4) — **P1, data-loss**
`depends: SL-B01` (same handler touched).  ·  binds **BR-0304**.

- Backend-leaning.
- **RED first — backend** `repos/dental-chart.test.ts`: simulate interleaved
  read-modify-write — PATCH tooth 11 and tooth 12 against the same chart from two stale
  reads → BOTH edits survive (no sibling lost-update). Today's RMW (`dental-chart.repo.ts`
  `updateTooth`) should fail this RED.
- **GREEN:** make `updateTooth` a column/element-scoped JSONB update (single
  `onConflictDoUpdate` / `jsonb_set` per tooth, or an optimistic `updatedAt` guard with
  retry), mirroring the perio single-site upsert pattern (EF-PER-005,
  `dental-perio-coverage.test.ts:442`).
- Property test: `chart-tooth-patch.property.test.ts` à la `treatment.fsm.property.test.ts`
  — random interleavings preserve all distinct teeth.

### SL-B04 — Clinically-honest chart diff (closes B-G6) — **P2, correctness**
`depends: —`  ·  binds **BR-0306**, P1-14. Pure-function slice (FE only, no backend/E2E DOM).

- **RED first — FE unit** `dental-chart.helpers.test.ts` (extend `computeChartDiff`
  describe ~697): caries→fractured = `reclassified` (neither added nor resolved);
  present→absent where prior state was `extracted`/`missing` = NOT `resolved`; genuine
  caries→filled = `resolved`.
- **GREEN:** add a `reclassified` bucket (or a `direction` tag) to `ChartDiffResult` and
  branch on extraction/dropout in `computeChartDiff`. Update `chart-compare-overlay.tsx`
  summary + list to render the new bucket.
- E2E: extend the existing compare spec to assert the reclassified row renders distinctly.
- Reuse: `computeChartDiff`, `ChartDiffResult` (extend, don't fork).

### SL-B05 — Patient-specific mixed dentition (closes B-G7) — **P2, correctness**
`depends: —`  ·  binds **BR-0307**, P1-17, P2-002. FE-leaning (+ optional dentition data).

- **RED first — FE unit** `dental-chart.helpers.test.ts`: `getMixedDentitionTeeth(age|
  chartedTeeth)` returns the correct erupted set for a 6yo vs an 11yo (today it's a fixed
  age-8 snapshot, `dental-chart.helpers.ts:62-86`).
- **GREEN:** parameterize `getMixedDentitionTeeth` by age/eruption stage or by the teeth
  actually charted; `dental-chart.tsx:194-218` consumes the parameterized set.
- E2E: a pediatric patient's chart renders the right primary/permanent split.
- Note `[ASSUMPTION]`: confirm with product whether eruption tables or charted-presence is
  the source — flag for the open-questions list rather than assuming.

### SL-B06 — Extracted/missing-tooth charting guard (closes B-G8) — **P2, correctness**
`depends: —`  ·  binds **BR-0308** (relates to EC2), WF-009.

- Backend-leaning.
- **RED first — backend** `chart/updateTooth.test.ts` (new): PATCH a restorative finding
  (`caries`/`filled`) on a tooth whose current state is `extracted`/`missing` → rejected
  (422) or flagged. Mirror perio FDI/extracted guards.
- **GREEN:** add the guard in `updateTooth.ts` / repo before write.
- **Contract** `dental-visit.hurl`: PATCH onto an extracted tooth → 422.

### SL-B07 — Carry-over read-path contract coverage (closes B-G9) — **P2, coverage**
`depends: —`  ·  strengthens CHART-BR-002. Contract-only.

- **RED first — contract** `dental-visit.hurl`: a returning patient with a baseline but no
  `dental_chart` row for the new visit → `GET /dental/visits/{visitId}/chart` returns 200
  with the baseline teeth and the sentinel id (`chart-carryover.ts:20`), not 404.
- **GREEN:** behavior already implemented (`getDentalChart.ts:37-42`) — this slice is the
  missing contract pin; expect GREEN-on-first-impl, so it is a pure coverage backfill.

---

### Slice dependency / value order

```
SL-B01 (P1 data-loss) ──► SL-B03 (P1 data-loss, same handler)
SL-B02 (P1 data-loss, independent)
SL-B04 (P2)  SL-B05 (P2)  SL-B06 (P2)  SL-B07 (P2 coverage)  — all independent
```
Build order: SL-B01, SL-B02, SL-B03 first (P1 data-loss); then SL-B07 (cheap coverage),
SL-B04, SL-B06, SL-B05. Candidates B-C1 (write-time sync) and B-C2 (P2P merge) are larger
program items gated on the ADR-008 revisit trigger and the cadence sync activation — not
sliced here (design-only, flagged for product decision).

---

## Open questions / `[ASSUMPTION]` list

1. **B-G2 / B-C1 — write-time chart sync timing.** ADR-008 defers this deliberately. Is the
   revisit trigger ("clinician-visible divergence bug") met yet, or stay read-time?
2. **B-G7 / SL-B05 — mixed-dentition source.** Eruption-age tables vs charted-presence as the
   authority? `[ASSUMPTION]` current code is a fixed age-8 snapshot.
3. **B-G1 vs B-G3 ordering** — should the baseline-merge-on-PATCH (SL-B01) and idempotency
   (SL-B02) share one migration? `[ASSUMPTION]` separate is cleaner.
4. **B-C2 — cadence P2P chart merge.** Is the per-tooth last-write-wins + conflict-audit the
   intended model, and does it belong to Chunk F (cross-cutting sync)? Flag to synthesizer.
5. `[ASSUMPTION]` B-I15 lock-gate backend tests exist in the visit suite (not opened); confirm
   exact file before relying on coverage in the inventory.
6. `[ASSUMPTION]` B-I18 — `use-save-chart.ts` actually populates `localId`; not read line-by-line.
