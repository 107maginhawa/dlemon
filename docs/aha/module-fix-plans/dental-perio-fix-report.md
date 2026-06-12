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

---

# Batch B + GAP-5 + Batch C — Doc alignment, no-AI reconcile, iPad CI coverage

**Executed:** 2026-06-12 · **Branch:** `chore/workflow-verification-sweep` (NOT pushed) · **Commits:** `c94b8d2c` (Batch B + GAP-5 + C-3 docs) · `516f9b71` (Batch C iPad CI). **Closes the dental-perio module** (Batches A–C + GAP-5 all done). Doc-only + test-infra → self-review (Batch-F/D precedent), no 3-lens.

## §15 first — every fix-ready premise verified against code; several were stale

| Item | Fix-ready premise | §15 code truth | Action |
| --- | --- | --- | --- |
| **FIX-004** (WF-P05 PDF export) | WORKFLOW_MAP lists it P1, STANDARDS_COMPLIANCE defers — deferred wins | **REAL & truthful:** no server-side PDF render, no `@media print` route, **no Print button** anywhere in `apps/dentalemon/.../components/perio/`. Feature genuinely unbuilt. | Annotated **V2 DEFERRED (not built)** in WORKFLOW_MAP §2b + MODULE_SPEC WF-P05 (table row + detail section). |
| **FIX-005** (BR-P01..07 traceability) | BRs absent from "consolidated BUSINESS_RULES.md / br-registry — registry is load-bearing, consumed by the traceability script" | **Doubly stale:** all 7 BR-P01–P07 are **already in** `specs/api/docs/standards/br-registry.json` with implementation + test sources. The running script (`scripts/audit-traceability.ts`) reads `docs/prd/BUSINESS_RULES.md` via regex `BR-\d{3}` (cannot match letter-prefixed IDs) and **never reads br-registry.json**. Cited path `docs/product/BUSINESS_RULES.md` doesn't exist. | Verified registry complete + `audit:trace` green (47 BRs, 0 untested, exit 0). Added a **scope note** to `docs/prd/BUSINESS_RULES.md`: module-scoped `BR-Pxx` rules live in the per-module registry (their authoritative home) and are intentionally outside the numeric PRD matrix. **No tooling/regex change** (out of scope, blast-radius risk; registry already authoritative). |
| **FIX-006** (stale multi-exam line) | STANDARDS_COMPLIANCE still lists multi-exam comparison UI as deferred though it shipped 2026-06-07 | **REAL:** confirmed the comparison overlay shipped (`perio-comparison.tsx` + `GET /dental/perio-charts?patientId=`). | Moved the bullet from "deferred backlog" to "what dentalemon implements"; also noted per-exam staging is now persisted (Batch A). |
| **GAP-5 / decision #2** (no-AI / voice) | "components exist (use-voice-perio.ts, voice E2E)"; reconcile docs to no-AI truth, perio stays manual | **Stronger than framed:** voice is **mounted** in `perio-chart-overlay.tsx` (`VoicePerioControls` + `useVoicePerio` + `WebSpeechProvider`) — but gated behind the **`perio.voice_charting` feature flag (default OFF**, `feature-flags.ts`, "behind off-device-audio / PHI compliance review + capability detection") + browser speech support + not-readOnly + chart-exists. So the **default product is manual-keyboard-only** (decision #2 satisfied), and NO AI/ML model is bundled (staging is a deterministic rule engine). | Reconciled **both** wrong docs to the flag-gated-default-off truth: MODULE_SPEC §1 (over-claimed "voice... built and shipped" → experimental opt-in, default-OFF, Web-Speech/cloud → outside offline-first guarantee); STANDARDS_COMPLIANCE (said voice "out of scope" → documents the default-off flag + "manual entry is the supported input"); added the **real** flag to MODULE_SPEC §18 and removed two **vestigial flags** (`side_by_side_comparison`, `auto_staging`) that were never wired (both features shipped unconditionally). **No code touched** (decision = doc-align only; do NOT build/expand voice). |
| **C-3** (recession/gm authority) | document perio chart as authority for recession / gingival-margin | n/a (doc directive) | Documented in MODULE_SPEC §7b + STANDARDS_COMPLIANCE: the perio chart is the authoritative source of truth for per-site recession / gingival-margin (CEJ); other modules reference, never re-derive. |
| **FIX-007** (Batch C, iPad CI) | spec is "dev-mode-skipped (`test.skip(true,…)`)"; re-enable in the CI project matrix | **Stale:** the spec is NOT unconditionally skipped — it `test.skip`s **only** in the catch block when seeding fails (correct local-dev behaviour), runs + **passes locally (4/4, 22s)**, and is **already** in the `test:e2e` project matrix (`ipad-portrait`/`ipad-landscape`). Real gap is **CI-only**: the `e2e` job has no DB → the UI self-seed throws → device assertions silently SKIP; `journey-verification` has a DB but runs only `--project=journeys`. | Added a dedicated **`ipad-device-coverage`** CI job (mirrors journey-verification: postgres + api-ts boot + auto-migrate) that installs webkit and runs ONLY the iPad projects → the grid-visible + 44px-tap-target assertions actually execute in CI. Scoped to iPad (no blast radius). `continue-on-error: true` until the first CI run confirms webkit-on-ubuntu + boot, then promote to a hard gate. Spec left unchanged (the conditional skip is honest). |

## Verification (lighter gate — doc + test-infra only, no product/contract/SDK change)

| Check | Result |
| --- | --- |
| iPad perio specs (ipad-portrait + ipad-landscape), live API+app | **4 passed / 0** (22s) |
| `bun run audit:trace` (after BUSINESS_RULES note) | green — 47 BRs, 0 untested, exit 0 (matrix unchanged) |
| `quality.yml` YAML parse + job registered | OK — `ipad-device-coverage` present |
| TypeScript / lint / contract / SDK | **unaffected — zero `.ts/.tsx` changed** (no regen); only 4 `.md` + 1 `.yml` touched |
| Docs internal consistency | WORKFLOW_MAP / MODULE_SPEC / STANDARDS_COMPLIANCE all agree: WF-P05 deferred · voice flag-default-off · multi-exam shipped · recession/gm authority |

## Roadmap flags (not this batch)

- **Voice charting is mounted-but-flag-gated-off and Web-Speech/cloud-dependent** — a future product/code call is owed on whether to keep the default-off flag, hard-gate it behind a completed off-device-audio/PHI compliance review, or remove the components. Documented as experimental; NOT touched here (decision #2 = doc-align only).
- **iPad CI job is `continue-on-error`** pending the first green CI run (webkit-on-ubuntu + full-stack boot couldn't be validated from the local session); promote to a hard gate once confirmed.
- **`docs/prd/BUSINESS_RULES.md` numeric-only matrix** — module `BR-Pxx` rules will never appear in the auto matrix by design; the registry is their home. If a single unified matrix is ever wanted, that's a traceability-script enhancement (out of this P3 scope).
