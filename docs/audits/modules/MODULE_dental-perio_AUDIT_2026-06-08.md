# Module Audit — dental-perio

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure (adversarial; verified against source)
**Verdict:** ✅ **READY** — 1 real clinical-correctness bug fixed (TDD): a partial perio chart of a fully-dentate patient was over-staged to AAP/EFP Stage IV because `classifyChart` defaulted `remainingTeeth` to the charted-tooth count, tripping the `<20 teeth` Stage-IV complexity factor (IDEAL-§343, and a test had *enshrined* the wrong behavior). Plus br-registry (whole module absent), MODULE_SPEC/API_CONTRACTS drift, a stale "frontend deferred" note, and a missing wrong-role RBAC test, all reconciled. Gates green.

---

## STEP 0 — Artifacts & /module-review

| Artifact | Location | Status |
|----------|----------|--------|
| Handler dir | `services/api-ts/src/handlers/dental-perio/` | ✅ create/get/getVisit/upsert/complete + **listPerioChartsForPatient** (multi-exam history); `utils/` (validation, cal, staging, classify-chart, lock-cascade) |
| TypeSpec | `specs/api/src/modules/dental-perio.tsp` | ✅ present (impl wider than v1.0 spec: per-site CAL/gingival-margin, AAP/EFP staging/grading, history) |
| MODULE_SPEC / API_CONTRACTS | `docs/product/modules/dental-perio/` | ✅ present (carried drift: stale "frontend deferred", PLANNED status, `assertBranchAccess`→`assertBranchRole`, wrong upsert/complete error codes, missing history endpoint — all reconciled) |
| Tests | 7 `*.test.ts` (103 assertions) | ✅ present (handler-coverage + history + 4 util suites) |
| Routes | `generated/openapi/{registry,routes}.ts` | ✅ wired (5 + history endpoint) |
| Contract | `specs/api/tests/contract/dental-perio.hurl` (39 req) | ✅ present |
| Frontend | `apps/dentalemon/src/features/workspace/components/perio/` + hooks + voice + E2E journeys | ✅ full-stack SHIPPED (spec said "deferred" — stale) |

**/module-review result:** **PASS** — no `test.skip`/`xit`/`.only`; no `Not implemented` stub; no TODO/FIXME in handler code; no non-test `as any` (the single `eslint-disable any` is the documented `logger: any` boundary in `perio-lock-cascade.ts`). Audit logging present on chart create / complete / lock-cascade (`logAuditEvent`). TypeSpec ops ↔ handler names match (interface-style ops, not bare `op `).

---

## STEP 3 — KG mapping (query-only)

`.understand-anything/domain-graph.json` maps `domain:periodontal-charting`,
`flow:record-perio-chart`, and `flow:perio-longitudinal-comparison`, plus the
hygiene-visit step `step:hygienist-led-hygiene-visit:record-perio`. Summaries are
**honest** — "AAP/EFP 2017-compliant … per-site pocket depths, BOP, furcation,
recession, mobility", "merge (no data loss)", "multi-exam longitudinal comparison
… staging/grading", and the correct routes `POST /dental/perio-charts` /
`GET /dental/perio-charts?patientId=`. **No over-claims.**

**KG-backlog (lossy, not a blocker):** the graph does not model the chart FSM
states (draft→completed→locked + the visit-lock cascade) nor the staging/grading
engine internals as distinct nodes. Fix on next KG regeneration (not regenerated
this round).

---

## STEP 6 — Traceability Matrix

| Item | Spec? | Impl? | KG | Test (file) | Strength | Verdict |
|------|-------|-------|----|-------------|----------|---------|
| **BR-P01** one chart per visit → 409 CHART_EXISTS | ✅ | ✅ createPerioChart:53; repo.findByVisitId | ✅ | coverage.test.ts:201 (+ contract 3b) | VERIFIED | 🟢 |
| **BR-P02** sealed-visit immutability: create→422 VISIT_LOCKED, upsert→422 VISIT_IMMUTABLE, complete→422 VISIT_LOCKED | ✅ | ✅ create:39, upsert:59-68, complete:64-73 | ✅ | coverage.test.ts:231,243,374,386,624,632 | VERIFIED | 🟢 |
| **N-PER-01** writing a completed/locked **chart** → 409 CHART_COMPLETED (state conflict, not 422) | ✅ (§15) | ✅ upsert:59-61; complete:64-66 | NONE | coverage.test.ts:531,614 | VERIFIED | 🟢 |
| **BR-P03** depths int 0–20 / recession −5..20 → 422 INVALID_DEPTH | ✅ | ✅ assertValidDepths | NONE | perio-validation.test.ts | VERIFIED | 🟢 |
| **V-PER-004** mobility/furcation grade 0–3 → 422 INVALID_GRADE | impl-only | ✅ assertValidGrades | NONE | coverage.test.ts:399,412 | VERIFIED | 🟢 |
| **P1-5** per-site gingival margin −5..20 → 422 INVALID_GINGIVAL_MARGIN | impl-only | ✅ assertValidGingivalMargins | NONE | coverage.test.ts:478 (validator 400); unit pins handler 422 | VERIFIED | 🟢 |
| **BR-P04** FDI quadrant check (gaps e.g. 19 invalid) → 422 INVALID_TOOTH_NUMBER | ✅ | ✅ isValidFdiToothNumber | NONE | coverage.test.ts:427 | VERIFIED | 🟢 |
| **BR-P05** clinical-role gate; non-member & wrong-role branch member → 403; read adds staff_full; staff_scheduling excluded (EF-PER-002) | ✅ | ✅ assertBranchRole on every handler | ✅ | coverage.test.ts:219 (non-member), **+staff_scheduling create 403 (NEW)**, 362,794,813 (read 403); history.test.ts:172 | VERIFIED (after new test) | 🟢 |
| **BR-P06** reading upsert idempotent on (chartId,toothNumber); single-site PATCH never nulls other sites | ✅ | ✅ perio-reading.repo PATCHABLE_READING_COLUMNS (atomic onConflict) | ✅ "merge no data loss" | coverage.test.ts:298,321,343 (data-loss regression pins) | VERIFIED | 🟢 |
| **BR-P07** complete min readings (adult 16 / primary 8, dentition inferred) → 422 INSUFFICIENT_READINGS | ✅ | ✅ complete:84-93 | NONE | coverage.test.ts:578,740,750 (N-PER-02) | VERIFIED | 🟢 |
| **V-PER-007** visit-lock → chart-lock cascade (lazy, audit-logged) | impl-only | ✅ perio-lock-cascade + repo.lockByVisitId | partial | coverage.test.ts:545 | VERIFIED | 🟢 |
| **2017 AAP/EFP staging/grading/extent** on completion | impl-only (P1-6) | ✅ perio-staging + perio-classify-chart | ✅ | perio-staging.test.ts (25, clinically pinned); coverage.test.ts:659 | VERIFIED | 🟢 |
| **IDEAL-§343** partial chart must NOT over-stage to IV via charted-count `remainingTeeth` default | flagged deferred | ✅ **FIXED** (was a real bug; test enshrined the defect) | NONE | perio-classify-chart.test.ts (3 NEW cases) | VERIFIED (after fix) | 🟢 |
| **Multi-exam history** `GET /dental/perio-charts?patientId=` (finalized only, branch from resource) | impl-only | ✅ listPerioChartsForPatient | ✅ flow node | history.test.ts (200/401/403/empty/draft-excluded) | VERIFIED | 🟢 |
| **Cross-tenant** branch derived from resource (visit/chart/patient charts), never caller-supplied | implied | ✅ all handlers | — | history.test.ts:172 (non-member 403) | VERIFIED (by source) | 🟢 |

---

## STEP 7 — Gaps Closed This Round

### REAL bug fixed (TDD: RED proven by source + a test that pinned the *wrong* answer, GREEN after)

| # | Bug | Class | Fix |
|---|-----|-------|-----|
| 1 | **Perio partial-chart over-staging (IDEAL-§343).** `classifyChart` computed `remainingTeeth: risk.remainingTeeth ?? readings.length`. The count of teeth *charted* on a (legitimately partial) perio exam is not the count of teeth *remaining* in the mouth. For any advanced case (stage ≥III) charted on <20 teeth — e.g. the BR-P07 minimum of 16 — the `<20 teeth` Stage-IV complexity factor fired purely from the partial-charting artifact, **over-staging a fully-dentate patient to Stage IV**. Over-staging drives over-treatment, so this is a clinical-safety defect. Worse, `perio-classify-chart.test.ts` had a test ("defaults remainingTeeth to charted count") that **asserted the buggy IV result as correct**, so the suite actively protected the defect. | clinical correctness / patient safety | `classifyChart` now passes `remainingTeeth: risk.remainingTeeth` straight through (undefined when omitted). The staging engine already treats `remainingTeeth === undefined` as "no evidence" (`!== undefined && < 20`), so the `<20 teeth` factor only fires when the clinician explicitly supplies a reduced dentition from the medical history. Pure-function engine untouched (its 25 clinical-threshold tests still pass). |

**New/updated tests (RED before fix, GREEN after):**
- `utils/perio-classify-chart.test.ts` — the defect-enshrining test replaced by **3** cases: (a) omitted `remainingTeeth` on an advanced 15-tooth chart stays **Stage III** (the fix); (b) explicit `remainingTeeth:18` correctly forces **IV**; (c) explicit `remainingTeeth:28` stays **III**.
- `dental-perio-coverage.test.ts` — **NEW** BR-P05 adversarial RBAC test: a `staff_scheduling` *branch member* (not merely a non-member) is denied **403** on chart create. The pre-existing 403 test used a no-membership ghost user; this pins that `assertBranchRole` filters by *role*, not bare membership.

### Doc / contract / registry / comment drift reconciled

| # | Drift | Fix |
|---|-------|-----|
| 2 | **br-registry — the entire `dental-perio` module was absent** (8 modules registered; perio missing). | Added a `dental-perio` block with **BR-P01..P07** + `V-PER-007` (lock cascade) + `V-PER-STAGING` (AAP/EFP + the IDEAL-§343 fix), each with verified source + test refs. |
| 3 | **MODULE_SPEC §9 stale** — "V-PER-011: backend-only — frontend DEFERRED." The perio chart-grid UI **is** shipped (`components/perio/` + hooks + voice + E2E journeys). | Corrected to "full-stack SHIPPED" with the real component/hook/E2E paths. |
| 4 | **MODULE_SPEC §1/§19 stale** — Status `PLANNED`; Vertical-Slice-Plan all ⬜. Also no record of the shipped-but-unspecced CAL/gingival-margin/staging/grading/history. | Status → `IMPLEMENTED (full-stack)`; all slice steps ✅ with artifact paths; added a "Spec-behind-impl note" enumerating CAL/GM (P1-5), staging/grading (P1-6), the history endpoint, and that voice charting + auto-classification (originally "out of scope") shipped. |
| 5 | **API_CONTRACTS drift** — auth note said `assertBranchAccess` (real: role-gated `assertBranchRole`); the history endpoint was undocumented; upsert error table listed `VISIT_LOCKED`/`CHART_COMPLETED` as 422 (real: `VISIT_IMMUTABLE` 422, `CHART_COMPLETED` **409**) and omitted `INVALID_GRADE`/`INVALID_GINGIVAL_MARGIN`; complete said "empty body" and omitted `stage/grade/extent`. | Auth note corrected (role gate + branch-from-resource + EF-PER-002); added the `GET …?patientId=` history section; upsert/complete error tables corrected with real codes/statuses; complete body documented (optional risk factors + the IDEAL-§343 `remainingTeeth` note) and response gains `stage/grade/extent`; gingival-margin/CAL fields documented. |
| 6 | **IDEAL-§343 deferred-item line** — listed the over-staging default as an open "needs a clarified default" item. | Marked **RESOLVED 2026-06-08** with the fix + test references. |
| 7 | **Stale comment** — coverage test header said "Routes registered inline — not yet wired in app.ts" (routes ARE wired in generated `routes.ts`). | Corrected to state the routes are wired in the generated registry/routes and the inline registration is for isolated handler exercise. |

---

## Ranked Remaining Gaps (surfaced, NOT closed — out of safe scope)

**Product/contract decisions (not unilaterally changed):**
1. **WF-P03 amendment path + WF-P05 print/PDF export are spec'd but not built as endpoints.** A completed chart is immutable (correct); the spec's "addendum amendment via dental-clinical WF-038 pattern" and server-side PDF render (`perio-{patientId}-{date}.pdf`) have no perio-side handler. The FE has a print path (`@media print`); a server-rendered PDF + a perio-addendum note are deferred features — CHECKPOINT before building.
2. **`completedAt` ordering of locked charts in history.** `findFinalizedByPatient` orders by `completedAt DESC`; a chart that reached `locked` via the visit-lock cascade *without* having been explicitly completed would have a null `completedAt` and sort last. Edge case only (the normal path sets `completedAt` on completion before lock). Surface for a product call on cascade-locked-without-complete semantics.

**REAL test gaps (impl present, assertion not added this round):**
3. **V-PER-007 cascade audit-row assertion** — the cascade transition is tested (chart→locked on read), but no test asserts the `perio.chart.locked` `dental_audit_log` row is actually written. By-source-present (`logAuditEvent` in `cascadeChartLockFromVisit`) but not pinned.
4. **Cross-branch read isolation positive test** — handlers derive branch from the resource and `assertBranchRole` would 403 a user whose membership is at a *different* branch, but no test seeds a two-branch fixture to prove a cross-branch read is rejected (the non-member 403 is the closest existing pin).

**KG-backlog:** chart FSM (draft/completed/locked + visit-lock cascade) and the staging/grading engine not modeled as distinct nodes (lossy projection) — fix on next KG regeneration.

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors |
| dental-perio module suite (`test-with-db.ts`, 7 files) | ✅ **103 pass / 0 fail** (96 baseline + 3 new staging cases − 1 replaced + 1 new RBAC) |
| `eslint` (changed files) | ✅ 0 errors, 0 warnings |
| `check:boundaries:dental-perio` | ✅ no cross-module repo violations |
| Contract suite (fresh `:7213`) | ✅ **`dental-perio.hurl` Success (39 req)** + `dental-visit.hurl` (35) Success. The 3 failures are **pre-existing environmental, outside this module** (auth-verification + auth-password-reset: mailpit:8025 down; billing-lifecycle: Stripe) — identical to the dental-clinical/visit/scheduling/patient rounds. |

---

## Files Changed

- `services/api-ts/src/handlers/dental-perio/utils/perio-classify-chart.ts` — IDEAL-§343 fix: stop defaulting `remainingTeeth` to charted count
- `services/api-ts/src/handlers/dental-perio/utils/perio-classify-chart.test.ts` — replaced the defect-enshrining test with 3 correct cases
- `services/api-ts/src/handlers/dental-perio/dental-perio-coverage.test.ts` — **NEW** wrong-role (staff_scheduling) create-403 RBAC test; corrected stale routes-wiring comment
- `specs/api/docs/standards/br-registry.json` — **+dental-perio module** (BR-P01..P07, V-PER-007, V-PER-STAGING)
- `docs/product/modules/dental-perio/MODULE_SPEC.md` — status, §9 frontend-shipped, §19 slice plan, spec-behind-impl note
- `docs/product/modules/dental-perio/API_CONTRACTS.md` — auth note, history endpoint, upsert/complete error+response reconciliation
- `docs/context/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` — §343 deferred item marked RESOLVED
- `docs/audits/modules/MODULE_dental-perio_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — rollup entry
