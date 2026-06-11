# AHA Fix-Ready Plan: Dental Perio

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/03-organize-gap-plan-for-fixing.md`

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Dental Perio (periodontal charting, AAP/EFP 2017 staging/grading, longitudinal comparison) |
| Module slug | dental-perio |
| Source gap plan | `docs/aha/module-gap-plans/dental-perio-gap-plan.md` |
| Output file | `docs/aha/module-fix-plans/dental-perio-fix-ready-plan.md` |
| Audit decision | PARTIAL PASS |
| Superpowers used | No — organizer discipline applied via shared rules (§19) |
| Organizer decision | READY |
| Reason | The module has exactly one substantive seam (GAP-1/2 diagnosis + risk-factor persistence), it is fully evidenced, decision-free with one documented default semantic, and shapes cleanly into a single TDD batch. Remaining gaps are doc-only or decision-blocked. |
| Limitations | Organizer re-verified the cited source files (`perio-chart.schema.ts`, `completePerioChart.ts`, `perio-chart.repo.ts`, `dental-perio.tsp` PerioChart model, `perio-comparison.tsx`) — all gap-plan citations confirmed accurate as of this branch. No tests executed. KG node graph stale (type-edge drift only); wiring claims rest on `contract-spine.json` + source per `docs/aha/kg/knowledge-graph-status.md`. |

## 2. Fix Strategy Summary

This is the platform's healthiest module; the fix plan is deliberately narrow.

- **Fix first:** Batch A — persist the AAP/EFP diagnosis (stage/grade/extent) and its risk-factor evidence on the perio chart row, return it on all read paths, and surface a staging chip in history/comparison. This is GAP-1 + GAP-2 + the comparison staging row as ONE coherent batch (the gap plan §26 explicitly recommends this shape). Everything else about the module is verified done.
- **Then:** Batch B — three small doc fixes (GAP-3/4/6). Zero code.
- **Do not fix:** PDF export, calculus/MGJ fields, any AI/auto features (binding product non-goal), comparison-analytics expansion, anything voice-charting-related until product Q1 resolves.
- **Major risks:** Batch A touches database schema (new migration) and the TypeSpec → regen → SDK pipeline `[SHARED DEPENDENCY]`. Risk is contained because the columns are new+nullable (no backfill of existing rows required for V1 — old completed charts legitimately predate persisted diagnosis), and the regen pipeline is the established discipline used by every module.
- **Batching:** Two batches total. Batch A is a single `04` pass (migration + TypeSpec + handler + read paths + FE chip + pins is the natural vertical slice; splitting it would ship dead columns or unreadable data). Batch B can ride the same pass or a follow-up — it is risk-free docs.
- **Product decisions:** GAP-5 (voice charting sanctioned vs non-goal, Q1) blocks only the voice doc-alignment item, not Batch A or B. Q2 (frozen-at-completion vs recompute-on-amend) is resolved by default — see §8.
- **Environment blockers:** none.

**Corrections/clarifications vs raw gap plan:** none substantive. Organizer confirms the gap plan's §3 citations against current source. One refinement: the TypeSpec `CompletePerioChartResponse` already carries stage/grade/extent (the completion response is correct on the wire today); the spec change needed is to the `PerioChart` model (+ optional riskFactors echo) so GET/history read paths can return the diagnosis — i.e., the fix is persistence + read-back, not the completion response.

## 3. Active Fix Scope

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-1: stage/grade/extent computed at completion (`completePerioChart.ts:126`) but never persisted — schema `perio-chart.schema.ts:19-35` has no diagnosis columns; `chartRepo.complete()` writes only 3 summary stats; both GETs + history return bare chart. Clinical/legal diagnosis is ephemeral. | P1 | V1 REQUIRED | A | The module's core deliverable (the diagnosis of record) is forgotten after one response; record-integrity gap; history/comparison cannot show staging | Gap plan §5 GAP-1, §10, §11; organizer re-verified schema + repo + handler |
| FIX-002 | GAP-2: grading risk factors (smoking/diabetes/HbA1c/bone-loss/age, `completePerioChart.ts:50-55`) discarded after compute — grade unreproducible, evidence unrecorded | P2 | V1 REQUIRED (pairs with FIX-001; same migration) | A | A grade without its inputs is not auditable; one migration covers both | Gap plan §5 GAP-2; organizer re-verified handler |
| FIX-003 | Staging chip/row in history + comparison UI (currently depth trends only; `perio-comparison.tsx` has no staging reference) | P2 | V1 REQUIRED (rides FIX-001) | A | Longitudinal staging trajectory drives recall intervals (gap plan §17); persisting without surfacing leaves the broken journey "comparison shows staging trajectory" (§11) open | Gap plan §11, §17, §22; organizer grep confirmed no `stage` refs in comparison component |
| FIX-004 | GAP-3: WF-P05 PDF export listed explicit in WORKFLOW_MAP vs deferred in STANDARDS_COMPLIANCE (deferred wins) | P3 | V1 RECOMMENDED (doc-only) | B | Doc conflict misleads future audits/planning; 1-line annotation | Gap plan §5 GAP-3 |
| FIX-005 | GAP-4: BR-P01..07 absent from consolidated BUSINESS_RULES.md / br-registry (registry is load-bearing — consumed by traceability script) | P3 | V1 RECOMMENDED (doc/tooling) | B | Traceability tooling under-reports perio rule coverage | Gap plan §5 GAP-4, §21 |
| FIX-006 | GAP-6: STANDARDS_COMPLIANCE line 109 still lists multi-exam comparison UI as deferred (shipped 2026-06-07) | P3 | V1 RECOMMENDED (doc) | B | Stale regulatory-adjacent doc | Gap plan §5 GAP-6 |
| FIX-007 | `[TEST GAP]` `ipad-perio-charting.spec.ts` is dev-mode-skipped (`test.skip(true,…)`) — iPad device coverage relies on the chromium/keyboard spec | P3 | V1 RECOMMENDED (test honesty) | C | Gap plan §9 lists iPad chairside capture as V1 REQUIRED but its device spec never runs; coverage claim is overstated | Gap plan §18, §20 |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A — Diagnosis-of-record seam (P1 vertical slice) | Migration (stage/grade/extent + riskFactors JSONB, nullable) → TypeSpec `PerioChart` + regen → persist at `complete()` → return on GET/visit-GET/history → staging chip in comparison/history UI → backend/contract/FE pins | FIX-001, FIX-002, FIX-003 | Medium — touches schema (new migration) + TypeSpec regen pipeline `[SHARED DEPENDENCY]`; mitigated by nullable additive columns and established regen discipline | **Run in current `04` pass (now).** Do not split: the migration, persistence, read-back, and surface are one vertical slice; partial execution ships dead columns or invisible data |
| Batch B — Doc alignment | WF-P05 deferred annotation; BR-P01..07 registry entry; stale comparison line | FIX-004, FIX-005, FIX-006 | Trivial (docs only; FIX-005 also re-run traceability script to confirm registry parses) | Run in current `04` pass after Batch A gates pass, or as an immediate follow-up pass |
| Batch C — Test hardening (device coverage) | Re-enable or replace the dev-skipped iPad perio spec in the CI project matrix | FIX-007 | Low code risk; may surface CI-runner/device-project questions outside this module | Later — separate small pass; do not couple to Batch A (different failure modes) |
| (no Batch for GAP-5) | Voice-charting doc alignment / flag-gating | — | — | **Only after product decision Q1** (see §8/§9) |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | RED: complete a chart (with readings crossing stage thresholds) → `GET /dental/perio-charts/{id}` and `GET /dental/visits/{visitId}/perio-chart` return persisted `stage`/`grade`/`extent`; values survive independent of the completion response (fresh read, new repo instance) | backend/integration | Diagnosis is on the row, not just the response/audit blob | Extend `services/api-ts/src/handlers/dental-perio/dental-perio-coverage.test.ts` |
| FIX-001 | RED: history endpoint returns stage/grade/extent per finalized chart | backend/integration | Longitudinal read path carries the diagnosis | Extend `services/api-ts/src/handlers/dental-perio/dental-perio-history.test.ts` |
| FIX-001 | RED: contract pins — complete → re-GET asserts `stage`/`grade`/`extent` present and typed; history entries include them | contract (Hurl) | Wire shape matches TypeSpec after regen | Extend `specs/api/tests/contract/dental-perio.hurl` (39 existing requests) |
| FIX-002 | RED: complete with riskFactors body → stored `riskFactors` JSONB equals submitted inputs; recomputing `classifyChart(readings, storedRiskFactors)` reproduces the stored grade (reproducibility pin) | backend/unit+integration | Grade evidence is recorded and sufficient to reproduce the grade | Extend `dental-perio-coverage.test.ts` (+ pure-fn assertion against `utils/perio-classify-chart.ts`) |
| FIX-002 | RED: complete with NO body (existing no-body tolerance at `completePerioChart.ts:50-55`) → riskFactors persisted as `{}`/null without error | backend/integration | Additive change does not break the optional-body contract | Extend `dental-perio-coverage.test.ts` |
| FIX-003 | RED: comparison view given two finalized charts with differing stages renders a staging chip/row per exam (e.g. "Stage II → Stage III" visible); chart without persisted stage (legacy/null) renders gracefully (no chip, no crash) | frontend/component | Staging trajectory visible; null-safe for pre-migration charts | Extend `apps/dentalemon/src/features/workspace/components/perio/perio-comparison.test.tsx` + `perio-comparison.logic.test.ts` |
| FIX-004/005/006 | No tests (docs). For FIX-005, run the traceability script after registry edit to confirm BR-P01..07 are picked up | — | Registry parses; script output includes perio BRs | — |
| FIX-007 | Un-skip (or replace) `ipad-perio-charting.spec.ts`; it must run in the iPad Playwright project and pass, or be replaced by an honest equivalent | E2E/Playwright | Device coverage claim is true | `apps/dentalemon/e2e/` (existing spec) + Playwright project matrix |

Regression guard for Batch A: existing pins must stay green — 25 clinical staging cases, 3 over-staging fix pins, 3 merge no-data-loss pins, P2-1 numeric `isFloat` hurl asserts, RBAC 403 pins, lock-cascade tests. Do not weaken any of them.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `specs/api/src/modules/dental-perio.tsp` (PerioChart model :240-255; PerioChartHistory rides automatically) → `cd specs/api && bun run build` → `cd services/api-ts && bun run generate`; `services/api-ts/src/handlers/dental-perio/repos/perio-chart.schema.ts` (+ new migration via `db:generate`); `repos/perio-chart.repo.ts` (`complete()` :58-67); `completePerioChart.ts` (pass classification into repo); `getPerioChart.ts` / `getVisitPerioChart.ts` / `listPerioChartsForPatient.ts` (return new fields); `packages/sdk-ts` regen; `specs/api/tests/contract/dental-perio.hurl` | database/schema + shared/platform (TypeSpec/SDK regen) + module-local handlers | Medium: additive nullable columns; regen pipeline touches generated validators/SDK consumed platform-wide, but change is additive-optional so existing consumers unaffected |
| FIX-002 | Same migration + TypeSpec (riskFactors JSONB / optional model fields); `completePerioChart.ts` (persist riskFactors alongside diagnosis) | database/schema + module-local | Low (rides FIX-001 migration) |
| FIX-003 | `apps/dentalemon/src/features/workspace/components/perio/perio-comparison.tsx`, `perio-comparison.logic.ts`, `perio-types.ts` (+ possibly `perio-chart-overlay.tsx` history list) | module-local (FE) | Low — perio overlay only |
| FIX-004 | `docs/product/WORKFLOW_MAP.md` (WF-P05 line) | docs | None |
| FIX-005 | `docs/product/BUSINESS_RULES.md` / br-registry artifact | docs/tooling | Low — traceability script consumer |
| FIX-006 | `docs/clinical/STANDARDS_COMPLIANCE.md` line ~109 | docs | None |
| FIX-007 | `apps/dentalemon/e2e/ipad-perio-charting.spec.ts` + Playwright config project matrix | module-local (E2E) / possibly CI config | Low–Medium (CI matrix) |

Note on column shape (guidance, final call in `04`): `stage` / `grade` / `extent` as nullable `text` columns (values are small closed sets; a pg enum is acceptable but adds migration friction for zero V1 value `[DO NOT OVERBUILD]`); `risk_factors` as nullable `jsonb`. Stage/extent are legitimately null when unclassifiable (`classifyChart` already returns nulls) and for legacy pre-migration charts — no backfill required.

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001/002 | database/schema | New migration on `dental_perio_chart` (additive nullable columns) | Migrations run automatically on server start; test DB must be rebuilt (`bun run db:setup:test` after `db:generate`) | No — part of the fix itself; generate within the batch |
| FIX-001/002 | shared/platform `[SHARED DEPENDENCY]` | TypeSpec → OpenAPI → generated validators → SDK regen pipeline (PerioChart model consumed by SDK + FE types) | Regen discipline: spec-first, then regen, then handler, then pins (gap plan §21; same hazard class as dental-visit GAP-6 — reconcile any pending spec drift before regenerating) | Sequence within the batch: TypeSpec first |
| FIX-001 | cross-module (read-only) | Visit lock cascade (dental-visit) is unchanged; `getVisitForPerio` facade untouched | Confirms no cross-module code change needed | No |
| FIX-003 | module-local | Depends on FIX-001 fields existing in SDK types | FE chip cannot land before regen | Yes — FIX-001 within same batch, ordered first |
| FIX-005 | docs/tooling | br-registry consumed by traceability script | Registry edit must keep script green | No |
| GAP-5 item | product decision | Voice-charting stance (Q1) — pairs with dental-imaging's equivalent question; one product conversation should settle both | Doc alignment direction (and possible flag-gating) depends on the answer | Yes — blocked |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1: Voice perio charting — sanctioned (local speech, not "AI") or non-goal? MODULE_SPEC says "shipped", STANDARDS_COMPLIANCE says non-goal; components exist (`use-voice-perio.ts`, voice E2E) | `[NEEDS PRODUCT DECISION]` `[NEEDS CONFIRMATION]` | GAP-5 doc-alignment item (no Fix ID — excluded from active scope) | Determines whether docs align to "shipped" or the feature gets flag-gated/retired | Add to the cross-module product-decision queue, paired with dental-imaging's voice/AI-stance question (one conversation). Do NOT expand voice features meanwhile `[DO NOT OVERBUILD]` |
| Q2: Persisted diagnosis — frozen-at-completion or recompute-on-amend? | `[NEEDS CONFIRMATION]` (default adopted) | FIX-001 | Defines persistence semantics | **Not a blocker.** Adopt the gap plan's lean as the implementation default: **frozen-at-completion; a new exam yields a new diagnosis.** This is consistent with the imaging report version-pinning precedent (2026-06-10) and with the existing FSM — completed charts are immutable (BR-P02 lock cascade; no perio amendment workflow exists), so there is no amend path that could trigger recompute. Record the default in the fix report; revisit only if a perio amendment feature is ever proposed |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| GAP-5 voice-charting doc alignment (and any flag-gating) | `[NEEDS PRODUCT DECISION]` | MODULE_SPEC vs STANDARDS_COMPLIANCE contradict; product stance on speech-recognition-vs-AI unresolved | Q1 answered (cross-module conversation with dental-imaging stance) |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| PDF export / printable chart (WF-P05) | GAP-3 (feature half) | V2 DEFERRED | STANDARDS_COMPLIANCE deferral stands; only the doc annotation (FIX-004) is active |
| Per-site calculus + MGJ/keratinized-tissue fields | Gap plan §23 | V2 DEFERRED | Spec-sanctioned standards backlog; not needed for reliable V1 exam workflow |
| Voice-charting expansion (any new voice capability) | GAP-5 / §23 | `[NEEDS PRODUCT DECISION]` then re-classify | Stance unresolved (Q1); existing components stay as-is meanwhile |
| iPad device-spec re-enable | FIX-007 / §20 | V1 RECOMMENDED (Batch C, later) | Valid but independent of the P1 seam; separate small pass to avoid coupling CI-matrix questions to the schema batch |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| AI auto-staging / AI auto-anything for perio | Gap plan §23 | Binding product non-goal (local-first, no-AI — `docs/clinical/STANDARDS_COMPLIANCE.md`) `DO NOT ADD` |
| New comparison analytics beyond shipped trend rows | Gap plan §23 | No product anchor; shipped comparison is sufficient `DO NOT ADD` `[DO NOT OVERBUILD]` |
| New scheduler/cron framework for anything perio-adjacent | organizer guardrail | A job scheduler already exists at `services/api-ts/src/core/jobs.ts`; (no scheduled work is needed for this module's fixes anyway) `[DO NOT OVERBUILD]` |
| Backfill/recompute job for legacy completed charts' diagnosis | organizer guardrail | Frozen-at-completion semantics + nullable columns make backfill unnecessary; recomputing historical diagnoses retroactively would manufacture clinical records `[DO NOT OVERBUILD]` |
| Re-litigating verified-fixed areas (over-staging fix, per-site merge fix, P2-1 numeric coercion, RBAC gates, lock cascade, comparison feature) | gap plan §26 | All source-verified with regression pins; touching them adds risk for zero value |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | The persistence layer was never extended when classification compute landed (P1-6): `classifyChart()` output was wired to the response + audit metadata but no schema columns were added. Fix addresses the actual missing write path, not a display patch |
| FIX-002 | Root cause | Same omission, same change surface (inputs dropped after compute). Fixing in the same migration prevents a second schema pass |
| FIX-003 | Symptom-of-FIX-001 (downstream surface) | Correctly sequenced after persistence; building the chip against the in-session completion response instead would be a workaround — rejected |
| FIX-004/005/006 | Root cause (doc drift) | Docs lagged shipped reality / consolidation never done |
| FIX-007 | Root cause (test honesty) | Spec was dev-skipped and never re-enabled; coverage claim drifted from reality |

## 13. Recommended First Fix Batch

**Batch A — Diagnosis-of-record seam (FIX-001, FIX-002, FIX-003).**

- **Why first:** It is the module's only P1 and its only substantive code gap; the audit's PARTIAL PASS converts to PASS on this batch alone. It is decision-free (Q2 resolved by documented default), fully evidenced, and shapes naturally as one vertical TDD slice.
- **Tests to write first (RED before any implementation):**
  1. Backend: complete → fresh GET returns persisted stage/grade/extent (`dental-perio-coverage.test.ts`).
  2. Backend: history endpoint carries diagnosis per finalized chart (`dental-perio-history.test.ts`).
  3. Backend: riskFactors persisted + grade reproducible from stored inputs; no-body completion still tolerated.
  4. Contract: hurl pins for diagnosis on GET + history (`dental-perio.hurl`).
  5. Frontend: comparison renders staging chip per exam; null-stage legacy chart renders gracefully (`perio-comparison.test.tsx` + logic test).
- **Implementation order within the batch:** TypeSpec `PerioChart` model → spec build + api-ts generate → Drizzle schema + `db:generate` migration → `db:setup:test` → repo `complete()` + handler persist → GET/history read-back → SDK regen → FE chip → all pins green.
- **Explicit out-of-scope for this batch:** all of §10/§11 (PDF export, calculus/MGJ, voice anything, AI anything, comparison expansion, legacy backfill); Batch B docs; Batch C iPad spec; any change to staging/classify pure utils (persist at handler/repo layer — gap plan §16 KG note); any change to verified-fixed areas listed in §11.

## 14. Instructions for 04 Fix Prompt

- **Module/group name:** Dental Perio
- **Module slug:** `dental-perio`
- **Fix-ready plan path:** `docs/aha/module-fix-plans/dental-perio-fix-ready-plan.md`
- **Raw gap plan (context only):** `docs/aha/module-gap-plans/dental-perio-gap-plan.md`
- **Batch to execute first:** Batch A (FIX-001, FIX-002, FIX-003)
- **Tests to prioritize:** the five RED-first tests in §13, in that order; keep all existing regression pins green (25 staging cases, over-staging pins ×3, merge no-data-loss pins ×3, isFloat hurl pins, RBAC 403 pins, lock-cascade)
- **Files likely to touch:** see §6 FIX-001..003 rows (TypeSpec `dental-perio.tsp` :240-255; `perio-chart.schema.ts`; new migration; `perio-chart.repo.ts`; `completePerioChart.ts`; 3 read handlers; `dental-perio.hurl`; `perio-comparison.tsx`/`.logic.ts`/`perio-types.ts`; SDK regen)
- **Shared/database cautions:**
  - Spec-first regen discipline: edit TypeSpec, then `cd specs/api && bun run build`, then `cd services/api-ts && bun run generate`; SDK regen is a separate step. Reconcile any pending spec drift before regenerating `[SHARED DEPENDENCY]`.
  - Run `bun run db:generate` only from `services/api-ts` cwd; run `bun run db:setup:test` after generating the migration or backend tests will fail on the missing columns.
  - Never run the dev server / contract / E2E suites against `monobase_test` (template pollution); restart the API on :7213 before running contract tests (a stale server masks contract drift).
  - New columns must be nullable/additive — no backfill, no destructive migration.
  - Persistence semantics: **frozen-at-completion** (Q2 default, §8); record this in the fix report.
- **Items NOT to implement:** PDF export; per-site calculus/MGJ; any voice-charting change (blocked on Q1); any AI feature (binding non-goal); comparison analytics beyond the staging chip; legacy-chart diagnosis backfill; new scheduler framework (one exists at `services/api-ts/src/core/jobs.ts`); Batch C (iPad spec) and Batch B (docs) unless explicitly instructed after Batch A gates pass.
- **Stop condition:** after Batch A is green (backend + contract + FE + typecheck, no regression in existing pins), save `docs/aha/module-fix-plans/dental-perio-fix-report.md` and stop. Do not proceed to Batch B/C without instruction.

---

Next recommended step:
Module/group: Dental Perio
Module slug: dental-perio
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/dental-perio-fix-ready-plan.md
Recommended batch: Batch A — Diagnosis-of-record seam (FIX-001, FIX-002, FIX-003)
