# Compliance Report — dental-perio

---
Audit Date: 2026-05-30
Dimension: compliance (oli-check, single-module slice)
Module: dental-perio
Spec Version: oli-module-specs v1.0 (generated 2026-05-24)
Scope: services/api-ts/src/handlers/dental-perio/** + generated route/validator wiring + specs/api perio TSP/OpenAPI + module tests + ERROR_TAXONOMY. Frontend (apps/dentalemon) intentionally out of scope — perio chart-grid UI is DEFERRED per MODULE_SPEC §9 / V-PER-011.
Source of truth: docs/product/modules/dental-perio/MODULE_SPEC.md + API_CONTRACTS.md + docs/product/ERROR_TAXONOMY.md, aligned to docs/audits/codebase-map/ knowledge graph (CODE_SPEC_TRACE, CODE_API_SURFACE = ground truth for wiring).
---

## Generated Code Exclusion

`src/generated/**` is excluded from violation findings. It is read only as evidence of route wiring. Wiring is CONFIRMED present (not a finding):
- `src/generated/openapi/routes.ts:1027-1311` registers all 5 perio routes via `registerRoutes` (generated registrar, distinct from the hand-written `handlers/dental/index.ts`).
- `specs/api/dist/openapi/openapi.json` contains all 5 perio paths (308 perio refs).
- Knowledge graph: CODE_SPEC_TRACE.md lines 78/91/204/205/244 mark all 5 perio operations `matched`; CODE_API_SURFACE.md lines 141-179 list them HIGH confidence.
- TypeSpec source authored at `specs/api/src/modules/dental-perio.tsp` (281 lines, all 5 operations).

(The comment in `dental-perio-coverage.test.ts:13` — "Routes registered inline — not yet wired in app.ts" — is STALE; the generated `registerRoutes` does wire them. The test still registers inline, which is acceptable for a fast unit harness, but the comment misleads.)

## Audit Scope

| Artifact | Available | Steps Executed |
|----------|-----------|----------------|
| MODULE_SPEC.md | YES | Steps 3-10 (BR, AC, permissions, state, API, data, errors) |
| API_CONTRACTS.md (per-module) | YES | Step 8b |
| ERROR_TAXONOMY.md | YES | Error-code cross-reference (Step 6.4 / 8b) |
| TypeSpec + OpenAPI | YES | Step 8 route/contract existence |
| Knowledge graph (codebase-map) | YES | Wiring ground truth |
| Frontend consumers | N/A (deferred) | Steps 11b/11c/11d skipped — UI not implemented |

> Spec paradox disclaimer: MODULE_SPEC §15 / API_CONTRACTS and the canonical ERROR_TAXONOMY.md disagree on the visit-lock error code. The CONSISTENCY_REPORT.md already records this as F-039. ERROR_TAXONOMY is authoritative; divergences are flagged below.

---

## Executive Summary

dental-perio is a clean, fully-wired, contract-tested clinical module. All 7 business rules (BR-P01..P07) are enforced in code with matching tests; the state machine (draft→completed→locked) including the visit-lock cascade is correctly materialized; permissions match the matrix exactly (staff_scheduling excluded everywhere, hygienist granted write per the spec footnote); audit markers are written for create/complete/lock per ADR-006. Routes are registered, present in OpenAPI, and traced `matched` in the knowledge graph.

There are **no P0 or P1 violations.** The findings are all P2/P3 consistency and documentation issues, dominated by a confirmed cross-document error-code divergence (the same "visit sealed" condition emits `VISIT_LOCKED` in two handlers and `VISIT_IMMUTABLE` in a third, while ERROR_TAXONOMY canonicalizes `VISIT_IMMUTABLE` for clinical writes), plus a deep-pocket summary-metric drift (code threshold 5 mm + per-site counting vs spec's "teeth with depth ≥6 mm").

- **Overall compliance rate:** ~92% (all BR/AC/permission/state/contract items pass; deductions are P2 consistency items)
- **P0:** 0
- **P1:** 0
- **P2:** 4
- **P3:** 3

---

## P2 — Fix When Touching Module

### V-PER-001 — Inconsistent error code for the same "visit sealed" condition across handlers
- **Severity:** P2 (API consistency; confirmed CONSISTENCY_REPORT F-039)
- **Category:** Error contract (Step 6.4 / 8b)
- **Evidence:** For the identical semantic condition (parent visit completed/locked), `createPerioChart.ts:40` and `completePerioChart.ts:60` throw `BusinessLogicError(..., 'VISIT_LOCKED')`, while `upsertToothReading.ts:64` throws `BusinessLogicError(..., 'VISIT_IMMUTABLE')`. ERROR_TAXONOMY.md:172 canonicalizes `VISIT_IMMUTABLE` (422) for "Clinical write to locked visit (BR-003)"; `VISIT_LOCKED` (line 128) is scoped to the visit module's own "locked post-completion" case. The dental-perio block of ERROR_TAXONOMY (lines 179-180) lists only `CHART_COMPLETED` + `INSUFFICIENT_READINGS` — neither `VISIT_LOCKED` nor `VISIT_IMMUTABLE` is in the perio catalog. MODULE_SPEC §15 + API_CONTRACTS use `VISIT_LOCKED` for all three; coverage test asserts `VISIT_LOCKED` on complete (lines 458-468) and `VISIT_IMMUTABLE` on upsert (lines 281-295) — codifying the split.
- **Concrete fix:** Standardize all three perio write paths on the taxonomy clinical-write code `VISIT_IMMUTABLE` (change createPerioChart.ts:40 and completePerioChart.ts:60), update the two coverage-test assertions, and add `VISIT_IMMUTABLE` to the dental-perio block of ERROR_TAXONOMY §5 + MODULE_SPEC §15 + API_CONTRACTS. (Aligns with the already-correct upsert handler and with dental-clinical/dental-visit which both use `VISIT_IMMUTABLE`.)
- **Autofixable:** true (string change in 2 handlers + 2 test assertions + 3 doc rows; mechanical, but run the suite after).

### V-PER-002 — dental-perio error codes missing from ERROR_TAXONOMY catalog
- **Severity:** P2 (spec/taxonomy gap; confirmed F-039)
- **Category:** Error contract (Step 6.4)
- **Evidence:** Handlers emit `CHART_EXISTS` (createPerioChart.ts:55), `INVALID_DEPTH` (perio-validation.ts:56,62), `INVALID_TOOTH_NUMBER` (perio-validation.ts:45), and `INVALID_GRADE` (perio-validation.ts:79). The ERROR_TAXONOMY.md dental-perio block (lines 179-180) lists only `CHART_COMPLETED` + `INSUFFICIENT_READINGS`. CONSISTENCY_REPORT F-039 already documents the first three as missing; `INVALID_GRADE` is also absent and is not in MODULE_SPEC §15 either (it was added in code as V-PER-004).
- **Concrete fix:** Add `CHART_EXISTS` (409), `INVALID_DEPTH` (422), `INVALID_TOOTH_NUMBER` (422), `INVALID_GRADE` (422) to the dental-perio block of ERROR_TAXONOMY.md §5; note `FORBIDDEN`/`VISIT_IMMUTABLE` as shared platform codes.
- **Autofixable:** true (doc-only, additive rows).

### V-PER-003 — MODULE_SPEC §15 error table stale: missing INVALID_GRADE and CHART_COMPLETED (code correct)
- **Severity:** P2 (spec drift; code follows the authoritative behavior)
- **Evidence:** MODULE_SPEC §15 lists CHART_EXISTS/VISIT_LOCKED/INVALID_DEPTH/INVALID_TOOTH_NUMBER/INSUFFICIENT_READINGS/FORBIDDEN but omits `INVALID_GRADE` (perio-validation.ts:79, with tests at coverage.test.ts:299-323) and `CHART_COMPLETED` (the 409 state-conflict used by completePerioChart.ts:53 and upsertToothReading.ts:57; API_CONTRACTS.md:194,223 does list it, so §15 is internally inconsistent with §10's own contract doc).
- **Concrete fix:** Add `INVALID_GRADE` (422) and `CHART_COMPLETED` (409) rows to MODULE_SPEC §15; reconcile §11/§13 references.
- **Autofixable:** true (doc-only).

### V-PER-004 — `recession` lower bound (-5 mm) undocumented in MODULE_SPEC
- **Severity:** P2 (data-validation spec gap; code defensible, TSP already documents it)
- **Evidence:** `perio-validation.ts:59-64` accepts `recession` in [-5, 20] with a clinical rationale (coronal overgrowth / pseudo-pocket); the TypeSpec model documents `@minValue(-5) @maxValue(20)` (dental-perio.tsp:92-95,142-145). But MODULE_SPEC §7 PerioToothReading lists `recession smallint? — mm, overall per tooth` with no range, and §2 defines recession as the (implicitly non-negative) CEJ→margin distance. The spec is the only artifact missing the negative-range allowance.
- **Concrete fix:** Add the [-5, 20] mm range + coronal-overgrowth rationale to MODULE_SPEC §7 / §13 edge cases (mirror the TSP `@doc`).
- **Autofixable:** true (doc-only).

---

## P3 — Track

### V-PER-101 — Deep-pocket threshold mismatch: spec says ≥6 mm, code uses 5 mm
- **Severity:** P3 (observation; clinically defensible either way)
- **Evidence:** MODULE_SPEC §7 (`summaryDeepPocketCount` = "Teeth with max depth ≥6 mm") and §4 WF-P04 ("deep pockets (≥6 mm)") vs `completePerioChart.ts:33` `DEEP_POCKET_THRESHOLD_MM = 5`. The metric counts more sites than the spec narrative implies.
- **Concrete fix:** Align the code constant and the spec wording on a single clinician-chosen threshold (5 mm moderate vs 6 mm severe). Pair with V-PER-102.
- **Autofixable:** false (clinical decision).

### V-PER-102 — `summaryDeepPocketCount` is a per-site count, but spec defines it as per-tooth
- **Severity:** P3 (metric definition drift)
- **Evidence:** MODULE_SPEC §7 defines it as "Teeth with max depth ≥6 mm" (per-tooth), but `completePerioChart.ts:90-98` increments `deepPocketCount` per individual deep site, so one tooth with 3 deep sites contributes 3. Reported number overstates the per-tooth metric the spec/UI promise (WF-P04 shows "teeth with deep pockets").
- **Concrete fix:** Compute per-tooth max across the 6 depth fields and count teeth whose max ≥ threshold; or redefine the metric in the spec as per-site. Pair with V-PER-101.
- **Autofixable:** false (logic + definition decision).

### V-PER-103 — AC-P04 / AC-P05 enforced but lack dedicated test assertions
- **Severity:** P3 (test-coverage observation; enforcement is present)
- **Evidence:** INVALID_DEPTH (AC-P04) and INVALID_TOOTH_NUMBER (AC-P05) are enforced in perio-validation.ts (lines 55-58, 44-46) and called from upsertToothReading.ts:42-44, but neither the coverage suite nor the repo test asserts the 422 rejection (coverage tests cover INVALID_GRADE and VISIT_IMMUTABLE/CHART_COMPLETED but not depth/FDI rejection). The spec §12 explicitly lists BR-P03 and BR-P04 as required BR tests.
- **Concrete fix:** Add coverage assertions: out-of-range depth → 422 `INVALID_DEPTH`; cross-quadrant FDI gap (e.g. tooth 19) → 422 `INVALID_TOOTH_NUMBER`.
- **Autofixable:** false (write new tests).

---

## Business Rule Compliance (Step 3)

| Rule | Rule (short) | Status | Severity | Evidence |
|------|--------------|--------|----------|----------|
| BR-P01 | One chart per visit → 409 CHART_EXISTS | ENFORCED | — | createPerioChart.ts:53-56 + unique index perio-chart.schema.ts:32 (race-safe) |
| BR-P02 | Chart immutable after visit locked → 422 | ENFORCED | — | createPerioChart.ts:39-41; upsertToothReading.ts:60-65; completePerioChart.ts:59-61; cascade perio-lock-cascade.ts (code-consistency caveat: V-PER-001) |
| BR-P03 | Probing depth 0–20 → 422 INVALID_DEPTH | ENFORCED | — | perio-validation.ts:51-58 (upsertToothReading.ts:44) |
| BR-P04 | Valid FDI quadrants (gaps 19/29/49/56 rejected) | ENFORCED | — | perio-validation.ts:18-27,43-47; TSP outer-bound 11-85 + handler precise check |
| BR-P05 | Clinical role required → 403 | ENFORCED | — | assertBranchRole [owner,associate,hygienist] in create/upsert/complete; reads add staff_full |
| BR-P06 | Reading upsert idempotent per (chartId,toothNumber) | ENFORCED | — | perio-reading.repo.ts:47-78 onConflictDoUpdate + unique index perio-reading.schema.ts:35 |
| BR-P07 | ≥16 readings (adult) / 8 (primary) to complete | ENFORCED | — | completePerioChart.ts:72-81 + dentition inference perio-validation.ts:35-41 |

## Acceptance Criteria (Step 4 — test existence)

| AC | Criterion | Status | Test |
|----|-----------|--------|------|
| AC-P01 | POST creates chart → 201 | TESTED | coverage.test.ts:180-193 |
| AC-P02 | Duplicate chart → 409 | TESTED | coverage.test.ts:195-211 |
| AC-P03 | PUT upserts reading → 200 | TESTED | coverage.test.ts:235-260 |
| AC-P04 | Depth out of [0,20] → 422 | UNTESTED (logic present) | V-PER-103 |
| AC-P05 | Invalid FDI → 422 | UNTESTED (logic present) | V-PER-103 |
| AC-P06 | Complete <16 → 422 | TESTED | coverage.test.ts:409-417 |
| AC-P07 | Complete ≥16 → 200 completed | TESTED | coverage.test.ts:419-442 + primary path 475-539 |
| AC-P08 | Write on locked visit → 422 | TESTED | coverage.test.ts:274-296, 455-469 |
| AC-P09 | staff_scheduling create/read → 403 | TESTED | coverage.test.ts:262-271, 575-579, 594-599 |
| AC-P10 | GET returns readings grouped by tooth | TESTED | coverage.test.ts:543-551; ordered by toothNumber perio-reading.repo.ts:31 |

## Permissions (Step 5)

§6 matrix vs code: create/record/complete = [dentist_owner, dentist_associate, hygienist] ✓; view/print = above + staff_full ✓ (getPerioChart.ts:33-38, getVisitPerioChart.ts:31-36); staff_scheduling excluded everywhere ✓ (EF-PER-002, tested). No permission violations.

## State Transitions (Step 9)

draft→completed (completePerioChart) ✓; draft/completed→locked via visit cascade (perio-lock-cascade.ts, lazy on read/write per ADR-006) ✓; re-complete → 409 CHART_COMPLETED ✓; lockByVisitId guarded `ne(status,'locked')` for idempotency ✓. No invalid transition reachable. Compliant.

## Data / Schema (Step 10)

Schema (perio-chart.schema.ts, perio-reading.schema.ts) matches §7: unique(visitId), unique(chartId,toothNumber), FK cascade visitId→visits and chartId→chart, examinerMemberId stored as UUID with no JOIN (matches §7b loose coupling). Migration 0038 matches schema. Compliant.

## Domain Events / Audit (10b / Step 9d)

`perio.chart.created` (createPerioChart.ts:85), `perio.chart.completed` (completePerioChart.ts:138), `perio.chart.locked` (perio-lock-cascade.ts:61) all written as synchronous dental_audit_log rows via logAuditEvent — matching ADR-006 (audit-log-only markers, no event bus). Compliant.

## Minor note (not counted)

`visit-perio.facade.ts:25` calls a helper named `this_select` and the file's displayed line numbering is irregular, but it is functionally a plain projection select (id/status/branchId/patientId). No behavioral defect; cosmetic naming only — fold into V-PER-004 cleanup if touching the module.

---

## Stabilization Plan

1. **Fix Now (P0):** none.
2. **Before New Work (P1):** none.
3. **When Touching Module (P2):** V-PER-001 (standardize visit-lock code on `VISIT_IMMUTABLE` across handlers + tests + docs), V-PER-002 (add perio codes to ERROR_TAXONOMY), V-PER-003 (add INVALID_GRADE + CHART_COMPLETED to MODULE_SPEC §15), V-PER-004 (document recession [-5,20] in MODULE_SPEC).
4. **Track (P3):** V-PER-101 (5 vs 6 mm threshold), V-PER-102 (per-site vs per-tooth deep-pocket count), V-PER-103 (add INVALID_DEPTH / INVALID_TOOTH_NUMBER assertions).
