# AHA Fix Report: Dental Perio — Batch A (Diagnosis-of-record seam)

**Executed:** 2026-06-11 · **Prompt:** `04-module-or-group-fix-tdd.md` · **Branch:** `chore/workflow-verification-sweep` (NOT pushed) · **Batch:** A (FIX-001 + FIX-002 + FIX-003). This flips the module's audit PARTIAL PASS → **PASS**. Batch B (docs) + C (iPad spec) not in this pass.

## What shipped — persist the 2017 AAP/EFP diagnosis of record

The stage/grade/extent were computed at completion and returned once, then forgotten — the clinical/legal diagnosis was ephemeral and the read paths + comparison couldn't show it. This vertical persists it. **Semantics: frozen-at-completion** (Q2 default — completed charts are immutable via the lock cascade; no perio amendment workflow exists, so there is no recompute path).

- **TypeSpec** (`dental-perio.tsp`): extracted the completion risk-factor fields into a new `PerioRiskFactors` model and made `CompletePerioChartRequest` spread it (`...PerioRiskFactors`) — single-sourcing the reproducibility contract. Added `stage?/grade?/extent? (| null)` + `riskFactors? (| null)` to the `PerioChart` model (read paths + `PerioChartHistory` ride it).
- **Schema** (`perio-chart.schema.ts`) + **migration `0101_complete_junta.sql`**: 4 additive **nullable** columns — `stage/grade/extent` (text) + `risk_factors` (jsonb). No backfill: legacy charts legitimately have no persisted diagnosis (frozen-at-completion); stage/extent are legitimately null for periodontally healthy patients (no CAL → no stage).
- **Repo** `complete()` + **handler** `completePerioChart.ts`: persist `stage/grade/extent/riskFactors` alongside the summary stats.
- **Read paths** (`getPerioChart`/`getVisitPerioChart`/`listPerioChartsForPatient`): unchanged — they already spread `...chart`, so the new columns flow through.
- **FE** (`perio-comparison`): `buildStagingCells` + `formatStage` (logic) + a new `summary-row-stage` chip row (`Stage III · C` per exam, em-dash for legacy/null) — the staging trajectory is now visible.

## Adversarial review → fixes folded in (4-lens workflow, 10 agents)

6 confirmed-real findings; triaged with engineering judgment:

| Finding | Sev | Disposition |
| --- | --- | --- |
| Completion response returned computed `classification.*` not the persisted `updated.*` row → could silently diverge from storage | P1 | **Fixed** — return `updated.stage/grade/extent`; strengthened the test to pin the **completion response body** equals the persisted GET |
| `CompletePerioChartResponse.grade` non-nullable vs `PerioChart.grade` nullable (read paths can return null) | P1 | **Fixed** — made it `PerioGrade \| null` for contract symmetry; regenerated |
| Add NOT NULL / CHECK so completed charts must have stage/grade | P2 | **Rejected (incorrect)** — a periodontally **healthy** patient legitimately completes a chart with **null stage** (`classifyChart` returns null with no CAL; the verifier itself cited the proving test). A constraint would reject valid healthy charts and contradicts the plan's "stage/extent legitimately null" note. |
| No explicit no-body / no-Content-Type completion test | P2 | **Already covered** — the `NOBODY_CHART` test POSTs with no body → asserts grade defaults to 'B', riskFactors `{}` |
| FE `?? null` coercion redundant since SDK dropped the `\| null` union | P3 | **Kept (intentional)** — the OpenAPI schema is still `nullable:true`, so the wire can send null even though the TS type dropped it; defensive coercion is correct |
| Completion response doesn't echo riskFactors | P2 | Out of scope (read back on GET; not needed on the completion response) |

## Verification (fresh runs)

| Layer | Result |
| --- | --- |
| BE `dental-perio-coverage.test.ts` (persist + reproducibility + no-body + response-pin) | **42 pass / 0 fail** |
| BE `dental-perio-history.test.ts` (read-back) | **7 pass / 0 fail** |
| BE regression: `perio-staging` (25 staging cases), repo, classify, cal, validation | **all pass** (25 / 8 / 7 / 9 / 10) |
| Contract `dental-perio.hurl` (GET + visit-GET + list read-back pins) | **41 / 41** |
| FE perio workspace suite (comparison component + logic) | **154 pass / 0 fail** |
| Typecheck (root FE + `@monobase/api-ts`) + sdk-ts tsc | all **exit 0** |
| RED→GREEN | persistence + history + FE staging all verified RED before the fix |

## Cross-module note

This closes **dental-visit GAP-3 / FIX-003** is NOT this module — that's case-presentation. (This module's read-back is self-contained.) No cross-module wiring is owed by perio.

## Decisions / not implemented

- **Q2 frozen-at-completion** adopted as the implementation default (recorded per plan §8); revisit only if a perio amendment feature is ever proposed.
- **Q1 voice-charting stance** `[NEEDS PRODUCT DECISION]` — unchanged, blocks only the GAP-5 doc item (not this batch). Paired with dental-imaging's voice/AI stance.
- Batch B (doc alignment: WF-P05/BR-P01..07/STANDARDS_COMPLIANCE line) and Batch C (re-enable iPad perio spec) **not** in this pass.
- Per §11 not built: AI auto-staging, comparison analytics beyond the staging row, legacy-chart backfill, pg enums for the new columns, any scheduler.
