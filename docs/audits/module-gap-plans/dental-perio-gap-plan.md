# dental-perio — Module Gap Plan

**Module:** dental-perio (Periodontal charting)
**Audit date:** 2026-06-09
**Method:** Live runtime audit (`/webwright`, Firefox) against the running app (localhost:3003 → API 7213, full demo seed) + code/spec/DB ground-truthing.
**Auditor evidence:** `outputs/dental-perio-audit/` (plan.md, final_runs/run_1/ screenshots + log).
**Test/KG validation pass:** 2026-06-09 — findings re-validated against current source (HEAD `e49e411d`) + full test-surface inventory + knowledge-graph wiring check. See §"Knowledge Graph Findings" and §"Test Coverage" below.

## Audit Decision: **PARTIAL PASS** *(confirmed unchanged after test/KG validation)*

The module is functionally strong and broadly production-grade: charting (keyboard + voice), the AAP/EFP 2017 staging/grading engine, multi-exam longitudinal comparison, RBAC, visit-lock cascade, and immutability all work and are well-tested. The gap is at the **finalization seam**: a completed/locked perio chart, when reopened, **does not surface its periodontal diagnosis (Stage/Grade/Extent)** and **shows BoP% and Mean Depth as "–"**. The clinical data is intact in the DB, but the single most important output of a perio exam — the diagnosis — is not durably recorded on the chart record nor shown on re-read. No P0 safety/security hole; not a clean PASS.

> **Validation verdict (2026-06-09):** All P1/P2/P3 findings **CONFIRMED** at source with line-exact precision (see each gap). Two findings were **sharpened**: P2-1 is a genuine wire-contract violation (not merely a display quirk), and P1-1's fix cost is lower than first stated (TypeSpec enums already exist). No finding was retracted.

---

## Gaps by Severity

### P0 — none
No blocked core workflow and no safety/security hole. Charting, completion, comparison, RBAC, and audit logging all function.

### P1

**P1-1 — Periodontal diagnosis (Stage/Grade/Extent) is not persisted on the chart record.** ✅ CONFIRMED
`completePerioChart.ts:126` computes `classifyChart(readings, riskFactors)` but `chartRepo.complete()` (`completePerioChart.ts:128-132` → `perio-chart.repo.ts:58-75`) writes only `bopPercent`, `meanDepth`, `deepPocketCount`. The schema (`repos/perio-chart.schema.ts:19-35`) has **no stage/grade/extent columns**. `getPerioChart.ts:53` and `getVisitPerioChart.ts:56` return `{ ...chart, readings }` — the bare chart, no classification. The FE only shows chips from the in-session `completion` response: `perio-chart-overlay.tsx:144-146` sets `stage = completion?.stage` (etc.), and the code **self-documents the bug** at lines 141-143: *"The persisted chart does not carry stage, so we only show chips from the completion response within the session."* Consequence: chips appear once at completion, then **vanish on close/refresh/other-clinician open**. The diagnosis survives only in `dental_audit` metadata (`completePerioChart.ts:170-172`) — and in one observed live case `stage` was `null` there — a non-clinical surface that no read path queries.
- **Why it matters:** The AAP/EFP stage/grade is the periodontal *diagnosis*. It must be part of the durable, retrievable clinical record for longitudinal care, referrals, and medico-legal traceability. Today it is ephemeral and the visit narrative ("Stage II, Grade B") becomes a competing, un-reconciled source of truth.
- **Evidence:** live (reopened Completed chart → 0 classification chips), code (refs above), DB/audit.
- **Fix-cost note (validation):** TypeSpec **already** defines `PerioStage`/`PerioGrade`/`PerioExtent` enums and returns them on `CompletePerioChartResponse` (`dental-perio.tsp:301-338`). The `PerioChart` model (`dental-perio.tsp:240-251`) is the **only** place missing the three fields. So the fix is: add 3 nullable DB columns + add the 3 optional fields to `model PerioChart` (reuse existing enums) + persist in `complete()` + the existing `{ ...chart }` spread auto-returns them. No new enum/codegen surface.

### P2

**P2-1 — Completed/locked chart summary shows BOP% and Mean Depth as "–" — a wire-contract violation.** ✅ **FIXED 2026-06-09 (Batch 3)** — `getPerioChart` + `getVisitPerioChart` now coerce `summaryBopPercent`/`summaryMeanDepth` with `numOrNull` (mirrors `listPerioChartsForPatient`); RED-before tests in `dental-perio-coverage.test.ts` (both single-GETs `typeof === 'number'`) + `dental-perio.hurl` §7b (`isFloat` on both single-GETs after complete). No spec change (impl now matches the declared `float64`). FE string-shape render test deferred (P1 regression guard). Original finding below.
`perio-chart-overlay.tsx:257-259` passes `chart.summaryBopPercent` / `summaryMeanDepth` / `summaryDeepPocketCount` straight from the GET response for non-draft charts. Drizzle returns `numeric` columns as **strings**, but `integer` as a **number**. `PerioSummaryBar` (`perio-summary-bar.tsx:48` and `:71`) gates on `typeof === 'number'`, so the two `numeric` strings render as "–" while the integer (`deepPocketCount`) renders.
- **Sharpened root cause:** This is not just a display quirk — it is a **contract drift**. The OpenAPI/SDK type declares `summaryBopPercent?: number` (`packages/sdk-ts/.../types.gen.ts:59124`; `dental-perio.tsp:249-250` = `float64`), but `getPerioChart.ts:53` / `getVisitPerioChart.ts:56` emit the raw Drizzle string. **`listPerioChartsForPatient.ts` already coerces** with `numOrNull` (lines 55, 64-65) — so 2 of the 3 read paths violate the declared float64 contract while the 3rd conforms. Typecheck cannot catch it because the SDK type asserts `number` (the type lies about the wire).
- **Why it matters:** Misleading/incomplete clinical summary on every finalized chart; BoP% is a primary periodontal inflammation metric. It is also a contract conformance bug that the type system masks.
- **Positive control:** the History/comparison tab renders the same chart's BoP%/mean correctly — because `listPerioChartsForPatient` coerces (and `perio-comparison.logic` defensively coerces too). This isolates the bug to the two un-coerced single-GET handlers feeding the current-exam summary bar.

**P2-2 — Risk-factor inputs collected at completion are not persisted.** ✅ CONFIRMED
`PerioClassificationPanel` (`perio-chart-overlay.tsx:298`, state at `:86`) collects smoking / diabetes / HbA1c / radiographic bone-loss / age etc. into local `riskFactors` state, passed to `completeChart(riskFactors)` (`:314`) → used only to compute Grade (`completePerioChart.ts:126`), then discarded (no columns; same root cause as P1-1). The Grade cannot be explained, re-derived, or audited, and because the chart is immutable post-completion there is no way to correct a mistyped risk factor.
- **Why it matters:** Clinical traceability ("why Grade C?") and correctability of the diagnosis inputs.
- **Validation note:** This means **recompute-on-read is insufficient for Grade** — without persisted risk factors the engine cannot reproduce the grade. P1-1 (persist the computed outputs) and P2-2 (persist the inputs) are genuinely complementary, not redundant.

### P3 / NEEDS CONFIRMATION

**P3-1 [NEEDS CONFIRMATION] — Hygienist can finalize the staging diagnosis without dentist sign-off.** ✅ CONFIRMED (+ doc drift noted)
`completePerioChart.ts:75` permits `['dentist_owner','dentist_associate','hygienist']` to complete (which computes Stage/Grade). Hygienists charting perio is appropriate (per IDEAL §7), but whether a hygienist may *finalize the diagnosis* vs. only chart-and-hand-off for dentist sign-off is a product/clinical-governance decision.
- **Doc/code drift (new):** the handler docstring says *"BR-P05: dentist role required"* (`completePerioChart.ts:6`) while the code allows hygienist (`:75`). Reconcile the docstring/BR text with whatever policy is decided.

**P3-2 — Stage is frequently `null` because depth-only charting yields no interdental CAL.** ✅ CONFIRMED
Staging is driven by worst-site interdental CAL (= probing depth + gingival-margin position). Casual depth-only entry leaves gingival margin at 0 → CAL low/zero → `computeStage` returns `null` (only Grade + Extent chips show). The UI does not signal that gingival-margin/recession entry is required to obtain a Stage. (Confirmed by `perio-classify-chart.test.ts` / `perio-staging.test.ts` — interdental-only CAL is intentional; the gap is the missing UI nudge.)
- **Why it matters:** Clinicians may believe a chart is "staged" when Stage is silently null. Clinical-completeness nudge, not a defect.

**P3-3 — Test gaps at the finalization seam (see Test Coverage section).** ✅ CONFIRMED + expanded below.

---

## Broken / Misleading Journeys

1. **Complete a perio exam → diagnosis shown → reopen → diagnosis gone.** A clinician finalizes a chart and briefly sees "Stage X / Grade Y / Extent", implying it is recorded; reopening the same chart shows no classification. Mild false-affordance + lost diagnosis (P1-1).
2. **Finalize a chart → BoP% and mean depth disappear.** The two metrics visible live during charting blank out to "–" the moment the chart is completed (P2-1).
3. **Enter risk factors to grade → grade computed → inputs discarded.** No record of what drove the grade; not correctable (P2-2).

(No fully broken workflow — charting, completion, comparison, and persistence of readings/summary integers all work.)

---

## Unused / Unwired Implementation

- **`classifyChart()` outputs are computed-but-not-consumed durably.** Stage/Grade/Extent are produced on completion and emitted to the HTTP response + audit metadata only; no durable read path (chart row, GET handler, list handler) carries or recomputes them.
- **No read-side classification.** `getPerioChart` / `getVisitPerioChart` could recompute or return the persisted classification but return neither.
- **All 6 handlers are wired** (verified against the generated route registry; see KG findings) — no orphan endpoints. Voice charting is fully built and correctly gated. No dead UI.

---

## Knowledge Graph Findings

**KG status (2026-06-09):** Knowledge graph exists at `.understand-anything/knowledge-graph.json` (4.4 MB, 2681 files, baseline commit `1196799b`). HEAD is `e49e411d` — **534 changed files behind**, including ~11 perio files (overlay, comparison.{ts,tsx,logic}, summary-live test, types, use-perio-history, listPerioChartsForPatient, the two repos, classify-chart, the `.tsp`, the `.hurl`).
**Decision: did NOT regenerate.** A 534-file delta classifies as `FULL_UPDATE` under the auto-update gate, which only recommends a full `/understand` rebuild (~12M tokens / 60–90 min per prior measurement) and stops — it would not incrementally patch. The existing node set already covers perio (71 nodes: all 6 handlers, repos, FE components, voice, hooks, E2E, contract). The drift is **type-import edges only** for the recently-added files; no architectural change at the finalization seam. **Every line-specific finding was instead ground-truthed against current source** (authoritative), so KG staleness does not affect this plan. KG-derived edges for `perio-comparison.logic.ts` / `use-perio-history.ts` may be incomplete and are marked where used.

**Wiring (UI → API → handler → data), verified against current source + route registry:**

- **6 handlers, all wired:** `createPerioChart` (POST /dental/perio-charts), `upsertToothReading` (PUT …/readings), `completePerioChart` (POST …/complete), `getPerioChart` (GET …/{chartId}), `getVisitPerioChart` (GET /dental/visits/{visitId}/perio-chart), `listPerioChartsForPatient` (GET /dental/perio-charts?patientId=). No orphan endpoints.
- **Current-exam path:** `perio-chart-overlay.tsx` → `usePerioChart` hook → SDK → `getVisitPerioChart` (read) / `createPerioChart` / `upsertToothReading` / `completePerioChart`. The overlay's summary bar consumes the **un-coerced** GET → string bug (P2-1).
- **History path:** `perio-chart-overlay.tsx` (view='history') → `PerioComparison` → `use-perio-history` → `listPerioChartsForPatient` (coerced → correct). Confirms the P2-1 positive control at the wiring level.
- **`PerioSummaryBar` has exactly one importer** (`perio-chart-overlay.tsx`) — small FE blast radius for any summary-bar-side fix; the handler-coercion fix is preferred regardless (see below).
- **Cross-module reads:** perio → `dental-visit` via `visit-perio.facade` (`getVisitForPerio`) for lock-cascade; perio → `dental-audit` via `logAuditEvent` (`perio.chart.completed`). No reverse dependencies (no other module reads perio chart rows).

---

## Test Coverage

### Existing Tests Found (validated by reading assertions, not names)

**Backend — utils (pure unit):**
- `utils/perio-classify-chart.test.ts` — 2017 AAP/EFP `classifyChart()`: healthy→Stage I/II localized; advanced→Stage III/Grade C generalized; mid-buccal recession does NOT inflate stage (interdental-only CAL); tooth-loss ≥5 → Stage IV; partial 15-tooth chart does NOT over-stage.
- `utils/perio-staging.test.ts` — `computeStage`/`computeGrade`/`computeExtent`/`classifyPerio`: CAL thresholds, complexity bumps to IV, grade ratio bands + smoking/diabetes/progression → C, extent localized/generalized/molar-incisor.
- `utils/perio-validation.test.ts` — `assertValidDepths` (BR-P03), `assertValidToothNumber` (BR-P04 quadrant gaps).
- `utils/perio-cal.test.ts` — `computeSiteCal`/`computeReadingCal`/`maxReadingCal` (three GM/CEJ cases, clamp at 0, null handling).

**Backend — repo:**
- `repos/perio-chart.repo.test.ts` — create draft, `findByVisitId`, unique-visit constraint, reading upsert insert→update, `complete()` sets status/completedAt/summary (summary persisted as numeric strings, deserialized to numbers).

**Backend — handler integration (`buildTestApp`, real DB):**
- `dental-perio-coverage.test.ts` — create 201/409/403/422-locked; upsert 200 + no-data-loss + BOP toggle-off + 403 + 422-immutable + CAL + 422 INVALID_GRADE/INVALID_TOOTH_NUMBER; complete 422<16, **200 with stage/grade/extent + summary as JSON numbers on the completion RESPONSE**, 409 re-complete, 422 visit-locked, primary-dentition 8-reading rule; getVisit 200/204/403/401; getById 200/403/404; visit-lock cascade materialization.
- `dental-perio-history.test.ts` — `listPerioChartsForPatient`: completed/locked most-recent-first, excludes drafts, includes readings+CAL, empty for none, 401/403; **asserts summary fields are JSON numbers** (list path).

**Contract (Hurl) — `dental-perio.hurl`:** auth gates 401; full setup; create 201; dup 409; upsert 16+ idempotent; GET by chartId/visitId 200 (pre-completion); list pre-completion excludes draft; **complete 200 asserting summaryBopPercent/MeanDepth `isFloat`, deepPocket `isInteger`, stage="III", grade="B", extent="localized"** (on the completion RESPONSE); re-complete 409; upsert-on-completed 409; **list post-completion asserts summary as numbers**; bogus 404; no-chart 204.

**Frontend — component/hook:**
- `perio-chart-overlay.test.tsx` — 404 empty-state, START posts+invalidates, draft editable, Complete disabled<16/enabled≥16, completed read-only + status badge "Completed", INSUFFICIENT_READINGS copy. **Fixture mocks completed-chart summary as numbers (`:49-51`).**
- `perio-summary-live.test.ts` — `computeLivePerioSummary()` draft/live path (number inputs) only.
- `perio-comparison.test.tsx` + `perio-comparison.logic.test.ts` — insufficient-data <2 exams, trend rows (BoP%/mean/deep), worsening-in-red, improving-not-flagged; **logic test feeds string `'18.00' as any` → coercion covered for the comparison path**.
- `perio-site-cell.test.tsx` — aria-label, digit commits depth+advance, ≥threshold red, read-only, clamp 0–20, reject non-numeric.
- `use-perio-chart.test.ts` — 404→null, load draft, start/upsert/complete mutations, single-error-toast.
- `use-voice-perio.test.ts` — provider wiring, cursor start, interim ignored, cadence fill, low-confidence→pending, out-of-range→confirm, per-tooth coalesced single upsert, CAL never written, "stop".
- Also present: `perio-threshold.test.tsx`, `perio-sequence.test.ts`, `perio-bop-bucket.test.ts`, `perio-cal-display.test.ts`, `furcation-gate.test.ts`, voice grammar/sequencer/controls/integration tests.

**E2E:** `perio-charting.spec.ts` (full flow: keyboard 16 teeth, red ≥5mm, CAL, complete→chips+badge, read-only, reopen-immutable **but only asserts the status badge on reopen**), `perio-voice-charting.spec.ts`, `ipad-perio-charting.spec.ts` (≥44px targets), `journeys/03-perio-charting.journey.spec.ts` (@AC-PERIO-01 real-API start), `journeys/02-periodic-recall.journey.spec.ts`.

### Coverage answers to the finalization-seam questions

| # | Question | Answer | Where |
|---|----------|--------|-------|
| A | complete → **GET** round-trips stage/grade/extent (persistence)? | **NO** — only the completion RESPONSE is asserted (coverage test + hurl). No GET-back assertion. | gap = P1-1 |
| B | `getPerioChart`/`getVisitPerioChart` return summary as **numbers** for a completed chart? | **NO** (the two single-GETs are uncovered AND non-conforming). List path **is** covered (`dental-perio-history.test.ts` + hurl). | gap = P2-1 RED |
| C | FE renders completed-chart summary from the **string** GET shape (not "–")? | **NO** — overlay fixture uses numbers (`:49-51`); `perio-summary-live` is draft/number only; only `perio-comparison.logic` exercises strings. | gap = P2-1 FE |
| D | FE reopen shows Stage/Grade/Extent from `chart.*` (persisted) vs only completion response? | **NO** — E2E reopen checks only the status badge. | gap = P1-1 FE |
| E | Risk factors persisted + round-tripped? | **NO** — passed to completion, never asserted stored. | gap = P2-2 |
| F | RBAC on complete? | **PARTIAL** — create & upsert 403-for-staff_scheduling covered; **complete has no 403 test**; hygienist-allowed-complete not explicitly asserted; dentist-vs-hygienist finalize untested. | gap = P3-1 / regression |
| G | Contract post-complete GETs the single chart to assert persistence/numeric? | **NO** — asserts on completion response + list only; no single-GET-after-complete step. | gap = P1-1/P2-1 contract |
| H | Multi-exam comparison/history covered? | **YES** (backend list + comparison component/logic). Missing: stage/grade/extent trend across exams (depends on P1-1). | enhancement |

### Missing Test Coverage

| Gap / Risk | Missing Test | Test Type | Priority | Why It Matters |
|------------|--------------|-----------|----------|----------------|
| P2-1 wire-contract violation | `getPerioChart` **and** `getVisitPerioChart` return `summaryBopPercent`/`summaryMeanDepth` as JSON **numbers** for a completed chart (currently strings → fails) | Backend integration (handler) | **P0** (RED before fixing) | Pins the actual broken read paths at the source; cheapest, most durable proof. Today only the list path is asserted. |
| P2-1 FE display | Render overlay/`PerioSummaryBar` for a **completed** chart whose `summaryBopPercent`/`summaryMeanDepth` arrive as **strings** (real wire shape) → assert "18%"/"3.2 mm" render, not "–" | FE component | **P1** | Locks the FE against the un-coerced shape; existing overlay fixture uses numbers and hides the bug. |
| P1-1 persistence | Complete a chart with definite Stage/Grade/Extent → `GET` it → assert stage/grade/extent returned and equal to the completion response | Backend integration (handler) | **P0** (RED before fixing) | Proves the diagnosis is durable, not ephemeral. No round-trip test exists. |
| P1-1 FE reopen | Render overlay for a **reopened completed** chart (no in-session `completion`) → assert chips read from `chart.stage/grade/extent` | FE component | **P1** | Proves chips survive close/refresh/other-clinician; today they come only from `completion?.*`. |
| P1-1 contract | Extend `dental-perio.hurl`: after `POST …/complete`, **GET the chart** and assert `stage`/`grade`/`extent` + numeric summary present | Contract (Hurl) | **P1** | Black-box guard that the wire carries the persisted diagnosis on read. |
| P2-2 risk-factor persistence | Complete with risk factors → read them back → assert stored and tie to the computed grade | Backend integration (handler) | **P1** | Grade explainability/auditability; correctness of the recorded diagnosis inputs. |
| P3-1 finalize policy | If dentist sign-off is introduced: allow/deny tests for hygienist vs dentist on the finalize step. Regardless: add the **missing 403 test for `staff_scheduling` completing** + an explicit positive test that `hygienist` may complete (pin current policy) | Backend integration (handler) | **P1** (regression) | Closes the RBAC test gap on `complete`; makes the policy decision explicit and enforced. |
| P3-2 staging nudge | Render a draft/completed chart with depth-only readings (no GM) → assert a "gingival-margin needed to stage" hint appears and Stage shows as not-staged | FE component | **P2** | Prevents the silent-null-Stage false-confidence. |
| P1-1 E2E | Extend `perio-charting.spec.ts` reopen step to assert Stage/Grade/Extent chips (not just the status badge) after close→reopen | E2E | **P2** | End-to-end proof the diagnosis is visible to the next clinician. |
| P1-1 history enhancement | Comparison shows stage/grade/extent trend across exams once persisted | FE component | **P3** | Longitudinal diagnosis trend (optional, post-P1-1). |

### Regression tests required per gap

- **P2-1:** (P0) backend numeric-typing test on both single-GET handlers; (P1) FE string-shape summary-bar render; (P1) hurl single-GET-after-complete numeric assertion. Keep the existing `dental-perio-history` numeric assertion green (list path must not regress).
- **P1-1:** (P0) backend complete→GET round-trip equality; (P1) FE reopen-chip-from-`chart.*`; (P1) hurl post-complete GET stage/grade/extent; reconcile `dental_audit` metadata (`completePerioChart.ts:170-172`) matches the persisted values (no `stage:null` divergence).
- **P2-2:** (P1) backend risk-factor round-trip + grade linkage. If an "amend classification" path is added, add immutability-preserving allow/deny tests.
- **P3-1:** (P1) `staff_scheduling` complete → 403; `hygienist` complete → 200 (or → sign-off-required if policy changes). Update docstring/BR text to match.
- **P3-2:** (P2) depth-only → not-staged hint.

---

## Recommended Fix Order (test-first, safest sequence)

> Order rationale unchanged from the original audit, sharpened by the test/wiring findings: P2-1 is the cheapest, highest-daily-visibility fix and is now framed as a **contract-conformance** fix (mirror the existing list-handler coercion), so a **backend** RED test is the right entry point — cheaper and more durable than an FE-only one. P1-1/P2-2 are the durable-record fixes (need one migration) and naturally pair. P3 follows.

1. **P2-1 — coerce numeric summary on the two single-GET handlers.**
   - **RED:** add a backend integration test asserting `getPerioChart`/`getVisitPerioChart` return `summaryBopPercent`/`summaryMeanDepth` as numbers for a completed chart (fails today — they are strings).
   - **Smallest fix:** mirror `listPerioChartsForPatient`'s `numOrNull` (lines 55, 64-65) in `getPerioChart.ts:53` and `getVisitPerioChart.ts:56` so the wire matches the declared `float64`. No schema change, no FE change required. (Optionally also harden `PerioSummaryBar` to accept numeric strings — defense in depth, not the primary fix.)
   - **GREEN/regression:** the new backend test passes; add the FE string-shape summary-bar render test; add the hurl single-GET-after-complete numeric assertion.

2. **P1-1 — persist the diagnosis.**
   - **RED:** backend complete→GET round-trip asserting stage/grade/extent persisted; FE reopen-chip-from-`chart.*` test.
   - **Smallest fix:** migration adding nullable `stage`/`grade`/`extent` columns to `dental_perio_chart`; write them in `chartRepo.complete()` (extend the `summary` arg); add the 3 optional fields to `model PerioChart` in `dental-perio.tsp` (reuse existing `PerioStage`/`PerioGrade`/`PerioExtent` enums) → regen routes/validators/SDK; the `{ ...chart }` spread in both GET handlers auto-returns them; overlay reads `chart.stage ?? completion?.stage`.
   - **GREEN/regression:** round-trip + reopen tests pass; hurl post-complete GET asserts the fields; audit metadata reconciled.

3. **P2-2 — persist the risk-factor inputs.**
   - **RED:** backend risk-factor round-trip test.
   - **Smallest fix:** persist `CompletePerioChartRequest` risk factors (JSONB snapshot column or discrete columns) alongside the classification so the grade is explainable/auditable; if correctability is required, add a guarded "amend classification" path that preserves immutability semantics.

4. **P3-2 — staging completeness nudge** (FE hint when Stage is null due to missing gingival-margin/CAL data).

5. **P3-1 — hygienist finalize policy** (resolve governance; adjust the role list / add dentist sign-off only if product confirms; reconcile the `BR-P05` docstring; add the RBAC tests either way).

### Fix-order adjustments vs original

- **No reordering.** The test/KG pass **confirms** the original 1→5 sequence.
- **Refinement:** P2-1's RED test moves to the **backend** (numeric typing on the two GET handlers) rather than FE-first, because the bug is a real wire violation and the backend coercion is the single-source fix matching the in-repo `numOrNull` pattern. FE/contract tests are added as regression guards after.
- **Refinement:** P1-1 noted as **lower-cost than originally framed** — enums + completion-response shape already exist in TypeSpec; only `model PerioChart` + DB columns are new.

---

## Dependencies on Other Modules / Blast Radius

- **dental-visit** — perio reads visit lock/complete state via `visit-perio.facade` (`getVisitForPerio`) for the lock cascade; **no change required**, but P1-1 must preserve immutability (locked/completed charts stay read-only on the new columns too).
- **dental-patient (medical history)** — risk factors (smoking/diabetes/HbA1c) are passed manually at completion today. Future: source from the patient medical-history record (relates to P2-2; out of scope here).
- **dental-audit** — already receives `perio.chart.completed` with stage/grade/extent metadata (`completePerioChart.ts:155-174`); keep writing it and **reconcile** with the new persisted columns after P1-1 (note the observed `stage:null` audit case).
- **SDK (`packages/sdk-ts`)** — P2-1 coercion needs **no** SDK change (type already `number`; the fix makes runtime conform). P1-1 requires SDK regen after the `PerioChart` model gains the 3 optional fields — **additive, no breaking change** for existing consumers.
- **specs/api (TypeSpec)** — P1-1 only: add 3 optional fields to `model PerioChart` (`dental-perio.tsp:240-251`) → regen. P2-1 needs no TypeSpec change (the contract is already correct; the impl was violating it).
- **Blast radius is contained to perio.** `PerioSummaryBar` has a single importer (the overlay). The two GET handlers' coercion is additive (string→number, matching the declared type) with no downstream readers outside perio. New nullable DB columns are migration-safe. No other module reads `dental_perio_chart` rows.

---

## Items Marked [NEEDS CONFIRMATION]

- **[NEEDS CONFIRMATION] P3-1** — May a `hygienist` finalize the staging diagnosis, or should completion that produces a Stage/Grade require dentist sign-off? (Code currently allows hygienist; docstring says dentist-only.)
- **[NEEDS CONFIRMATION]** — Persistence shape for the diagnosis & risk factors: discrete columns vs JSONB snapshot on `dental_perio_chart`? (Affects migration + TypeSpec. Recommendation: discrete `stage`/`grade`/`extent` columns for the diagnosis (queryable/trendable); JSONB snapshot for the risk-factor inputs.)
- **[NEEDS CONFIRMATION]** — Given charts are immutable post-completion, is an explicit "amend classification / re-stage" action desired (to correct a mistyped risk factor), or is a new chart on a new visit the intended correction path?
- **[NEEDS CONFIRMATION]** — Should `getPerioChart` *recompute* classification on read instead of persisting it? **Validation note:** recompute cannot reproduce **Grade** without persisted risk factors (P2-2), so persisting the computed outputs (P1-1) is the more complete answer; recompute-on-read would still require P2-2.

---

## Appendix — What Works (verified live)

- Login → profile-select → PIN → workspace → Perio tab (per-visit, disabled without a selected visit).
- Keyboard charting with auto-advance, live over-threshold/deep-pocket counts, red ≥threshold highlighting, configurable threshold (≥4–7mm).
- Completion gate (≥16 adult / ≥8 primary readings) and chips appearing at completion (Grade B / Localized observed).
- Multi-exam longitudinal comparison: trend rows (BoP%/mean/deep) + per-tooth max-PD with worsening sites in red (tooth 35 relapse correctly flagged across Claudia's 3 exams).
- RBAC: dentist_owner/associate/hygienist write; staff_full read; staff_scheduling excluded from clinical perio.
- Voice charting present, correctly gated to draft + browser speech support.
- Visit-lock cascade to chart lock; immutability of completed/locked charts.
- Audit row `perio.chart.completed` written on finalize.
