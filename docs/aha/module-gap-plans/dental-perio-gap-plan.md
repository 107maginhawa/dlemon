# AHA Module/Group Gap Plan: Dental Perio

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Dental Perio (periodontal charting, AAP/EFP 2017 staging/grading, longitudinal comparison) |
| Module slug | dental-perio |
| Type | Business Module |
| Output file | `docs/aha/module-gap-plans/dental-perio-gap-plan.md` |
| Primary PRD/spec used | `docs/product/modules/dental-perio/MODULE_SPEC.md` + `API_CONTRACTS.md` (PRD lists perio as Phase-2; built ahead of schedule with full spec anchor) |
| Supporting PRDs/specs used | `docs/clinical/STANDARDS_COMPLIANCE.md` perio section (AAP/EFP verdict; deferred backlog; **no-AI non-goal**); AC-PERIO-01..10; WORKFLOW_MAP WF-P01..P05; BR-P01..P07 (module-spec-scoped) |
| PRD/spec coverage quality | Strong |
| Paths inspected | `services/api-ts/src/handlers/dental-perio/` (6 handlers, 2 schemas, utils: staging/classify/validation/CAL); FE `features/workspace/components/perio/` (12 files) + hooks; `dental-perio.hurl` (39 req) |
| PRDs/specs inspected | All above |
| KG used | Yes — spine + grep; all 6 ops have FE consumers |
| KG refreshed | No |
| `/understand-domain` used | Yes (cross-check only) |
| `/understand-domain` refreshed | No |
| Webwright used | No — module live-driven 2026-06-07 (multi-exam comparison verification) and claims this round are schema/handler-static |
| Playwright/E2E inspected | Yes (inspected): `perio-charting.spec.ts`, `perio-voice-charting.spec.ts`, `ipad-perio-charting.spec.ts` (dev-skip), `journeys/03-perio-charting` (real API) |
| Existing tests inspected | 6 backend files (~1,945 handler+util lines incl. 25 clinical staging cases), 39-req hurl, ~12 FE files, 4 E2E |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | No tests executed |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| Module spec + API contracts | `docs/product/modules/dental-perio/` | module spec | Current (reconciled 2026-06-08; §2.25 spec-behind-impl notes) | endpoints, exam FSM, per-site model, BR-P01..07, permissions |
| Clinical standards | `docs/clinical/STANDARDS_COMPLIANCE.md` perio §74-113 | regulatory | **Partially stale**: "multi-exam comparison UI deferred" (line 109) — comparison UI shipped 2026-06-07; voice-charting line conflicts with MODULE_SPEC "shipped" | AAP/EFP verdict = ship-as-is; calculus/MGJ + PDF export deferred |
| AC-PERIO-01..10 | `ACCEPTANCE_CRITERIA.md` §18 | acceptance criteria | Current (formalized 2026-06-05) | all 10 testable + covered |
| Prior audit + gap plan + matrix Batch 3 | 2026-06-08/09 artifacts | prior audit (pre-AHA) | Partially superseded (P2-1 fixed Batch 3 b76d47d5; P1-1/P2-2 re-verified OPEN) | §3 |

## 3. Expected vs Actual

**Expected:** clinical-grade perio exams — one chart per visit (draft→completed→locked), 6-site probing with BOP/recession/GM and read-only CAL, mobility/furcation, AAP/EFP 2017 Stage I–IV / Grade A–C / extent computed from interdental sites with risk modifiers, summary stats, longitudinal comparison, clinical-role gating.

**Actual: the platform's healthiest module, with one real seam.** Verified this round:

- All 6 ops wired with FE consumers; full overlay stack (grid, classification panel, summary bar, threshold control, **multi-exam comparison shipped 2026-06-07** — trend rows BOP%/mean-depth/deep-pockets, worsening-red, history endpoint bounded to 12 finalized charts). The STANDARDS_COMPLIANCE "comparison UI deferred" line is stale.
- All prior fixes hold: Stage-IV over-staging (IDEAL-§343) — `perio-classify-chart.ts:129` passes `remainingTeeth` through (no charted-count defaulting), 3 regression cases; per-site upsert merge (2026-06-03 data-loss fix) — `perio-reading.repo.ts:76-100` atomic `onConflict` touching only request-present `PATCHABLE_READING_COLUMNS`, 3 no-data-loss pins; P2-1 numeric coercion on both single-GET handlers (Batch 3, `numOrNull` at `getPerioChart.ts:56-61` / `getVisitPerioChart.ts:59-65`, RED-before tests + hurl `isFloat` asserts).
- BR-P01..07 all enforced+tested (409 dup, locked-visit 422, depth/tooth validation, role gates incl. new staff_scheduling 403 pin, ≥16/8 completion gate, idempotent upsert); audit event on completion (`completePerioChart.ts:155-174`).

**The seam (unchanged):**

1. **P1-1 — the diagnosis is not on the record.** `completePerioChart.ts:126` computes stage/grade/extent via `classifyChart()`, returns them in the response and stashes them in audit metadata (:170-172) — but `perio-chart.schema.ts:19-35` has **no stage/grade/extent columns**, `chartRepo.complete()` writes only the 3 summary stats, and both GET handlers return the bare chart. A completed perio exam's AAP/EFP diagnosis is ephemeral: history view and comparisons can't show staging, and the legal record of "Stage III Grade B generalized" lives only in an audit-metadata blob.
2. **P2-2 — risk factors discarded:** smoking/diabetes/HbA1c/bone-loss/age inputs (`:50-55`) feed grading and are then dropped — recompute-on-read is impossible and the grade's evidence is unrecorded.

Doc conflicts: WF-P05 PDF export "explicit" vs deferred (deferred wins per standards doc); MODULE_SPEC "voice charting SHIPPED" vs STANDARDS "speech-recognition = non-goal" — voice components exist (`use-voice-perio.ts`, voice E2E) `[NEEDS CONFIRMATION]` which doc reflects product intent.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WF-P01/BR-P01/AC-01/02 create + dup 409 | one draft per visit | ✓ | overlay start | `createPerioChart.ts:51-62` | unique visit | coverage tests | Implemented | No |
| WF-P02/BR-P03/04/06 per-site readings | 6-site, validated, idempotent, merge-safe | ✓ | grid + site cells | upsert handler + repo :76-100 | reading schema | AC-03/04/05 + 3 merge pins | Implemented | No |
| CAL read-only derivation | PD+GM clamped ≥0, never stored | ✓ | cal display | utils | — | `perio-cal.test.ts` | Implemented | No |
| WF-P03/BR-P07 completion gate + summary | ≥16/8; BOP%/mean/deep-pockets persisted | ✓ | complete flow | `completePerioChart.ts:128-132` | summary cols | AC-06/07 | Implemented | No |
| AAP/EFP staging/grading/extent computed | 2017 rules, interdental-only, risk modifiers, null-safe | ✓ compute (25 clinical cases; over-staging fixed) | classification panel | `classifyChart()` :126 | — | staging+classify tests | Implemented | No |
| **Diagnosis persisted on exam record** | stage/grade/extent on chart row, returned on GET | **Missing** — response+audit-metadata only | overlay reads `completion?.stage` only (:141-146) | repo.complete() writes summary only | **no columns** :19-35 | none (no persistence test possible) | Partially Implemented | **GAP-1** |
| Risk-factor evidence persisted | grading inputs recorded | **Missing** — discarded post-compute | panel collects then drops | :50-55, :126 | no columns | none | Missing | **GAP-2** |
| BR-P02/AC-08 lock cascade | visit lock → chart immutable | ✓ | read-only states | guards | — | coverage + E2E reopen-immutable | Implemented | No |
| BR-P05/AC-09 role gates | clinical roles write; staff_full read; scheduling excluded | ✓ | — | assertBranchRole | — | 403 pins | Implemented | No |
| Longitudinal comparison | history endpoint + trend UI | ✓ (shipped 2026-06-07) | `perio-comparison.tsx` | `listPerioChartsForPatient` | — | history tests + logic tests | Implemented | staging row absent (rides GAP-1) |
| Numeric summary wire shape (P2-1) | float64 on all reads | ✓ (Batch 3) | summary bar `typeof==='number'` gates | numOrNull ×2 | numeric cols | RED-before pins + hurl isFloat | Implemented | No |
| WF-P05 PDF export | printable chart | Deferred (standards doc) — WORKFLOW_MAP still lists explicit | — | — | — | — | Not Required for V1 | GAP-3 (doc) |
| Calculus/MGJ per-site | extended fields | Deferred (spec-sanctioned) | — | — | — | — | Not Required for V1 | No |
| Voice charting | per docs: shipped AND non-goal (conflict) | components exist (`use-voice-perio.ts`, voice E2E) | voice flow | — | — | voice spec | Unclear | GAP-5 `[NEEDS CONFIRMATION]` |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| Diagnosis on record | **GAP-1**: stage/grade/extent computed at completion but never persisted — clinical/legal diagnosis ephemeral; history/comparison cannot display staging; GETs return bare chart | P1 | V1 REQUIRED | schema :19-35 no cols; repo.complete() summary-only; GETs :53/:61 | Add stage/grade/extent columns (migration), persist at complete, return on GETs + history; RED-first persistence test; surface staging chip in history/comparison |
| Grading evidence | **GAP-2**: risk factors (smoking/diabetes/HbA1c/bone-loss/age) discarded after grade compute — unreproducible grade | P2 | V1 REQUIRED (pairs with GAP-1) | :50-55 → :126, no persist | Persist riskFactors JSONB alongside diagnosis (same migration) |
| PDF export doc conflict | **GAP-3**: WF-P05 explicit in WORKFLOW_MAP vs deferred in standards doc | P3 | V1 RECOMMENDED (doc-only) | both docs | Annotate WF-P05 deferred; export itself stays V2 |
| BR registry | **GAP-4**: BR-P01..07 absent from consolidated BUSINESS_RULES.md / br-registry | P3 | V1 RECOMMENDED (doc) | catalog lines 14-77 | Register (load-bearing registry consumed by traceability script) |
| Voice-charting doc conflict | **GAP-5**: MODULE_SPEC "shipped" vs STANDARDS "non-goal"; components exist | P3 | `[NEEDS CONFIRMATION]` `[NEEDS PRODUCT DECISION]` if speech-recognition counts as AI | both docs + `use-voice-perio.ts` | Confirm intent; align docs (and flag-gate if non-goal) |
| Stale standards line | **GAP-6**: STANDARDS doc still lists multi-exam comparison UI as deferred (shipped 2026-06-07) | P3 | V1 RECOMMENDED (doc) | line 109 vs `perio-comparison.tsx` | doc update |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Voice perio charting (speech provider + cadence fill + out-of-range confirm) | `use-voice-perio.ts` + E2E | conflicting docs (GAP-5) | stance ambiguity | Confirm; do not expand until resolved `[DO NOT OVERBUILD]` |
| Per-site gingival margin + CAL (beyond original spec) | API_CONTRACTS §2.25 | spec-behind-impl, sanctioned | none | Keep |
| Built ahead of PRD phase | whole module | PRD lists perio Phase-2 | none — full spec anchor exists | Keep |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| WF-P01..03 exam: create → chart → complete | dentist/hygienist | perio exam | draft → readings → gate → staging → summary | Implemented | **GAP-1/2** (diagnosis not on record) | full chain tests |
| WF-P04 historical review + comparison | dentist | recall visit | history → trend rows → per-tooth max-PD | Implemented | staging row rides GAP-1 | comparison tests |
| Lock cascade | system | visit locks | chart immutable | Implemented | No | E2E |
| WF-P05 print/export | dentist/staff | referral | PDF | Deferred | GAP-3 doc | — |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Reading capture (merge-safe, validated) | atomic per-site | Implemented | repo pins | V1 REQUIRED | done |
| Completion gate + summary | ≥16/8 + stats | Implemented | AC pins | V1 REQUIRED | done |
| Staging/grading compute | 2017 rules | Implemented | 25 cases + fix pins | V1 REQUIRED | done |
| Diagnosis persistence | on chart row | Missing | GAP-1 | V1 REQUIRED | the seam |
| Risk-factor persistence | evidence recorded | Missing | GAP-2 | V1 REQUIRED | same migration |
| History + trends | finalized-only, bounded | Implemented | history tests | V1 REQUIRED | done |
| Lock immutability | 422 writes | Implemented | E2E | V1 REQUIRED | done |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Full perio exam chairside | hygienist/dentist | 6-site capture <10min | Implemented | No | V1 REQUIRED | E2E keyboard flow |
| Diagnose per AAP/EFP and have it on record | dentist | persisted Stage/Grade/extent | Compute ✓ / record ✗ | GAP-1/2 | V1 REQUIRED | schema |
| Compare exams over time | dentist | trends + staging trajectory | Trends ✓ / staging absent | GAP-1 | V1 REQUIRED | comparison |
| Referral letter with chart | dentist | PDF export | Deferred | GAP-3 | V2 DEFERRED | — |
| iPad chairside capture | hygienist | touch targets, gate | Implemented (E2E dev-skip) | §20 note | V1 REQUIRED | ipad spec |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-1 diagnosis not persisted | clinical record / legal | P1 | V1 REQUIRED | schema+repo+GETs | A diagnosis the system computed, showed the clinician, and then forgot — record-integrity gap in the module's core deliverable | migration + persist + read-back + history chip |
| GAP-2 risk factors discarded | record evidence | P2 | V1 REQUIRED | handler | Grade unreproducible; audit metadata is not a queryable record | same migration |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Reopen last year's exam → see diagnosis | staging on chart | bare chart; chips only in same-session response | GAP-1 | P1 | persistence + GET read-back pin |
| Comparison view shows staging trajectory | Stage II → III flag | depth trends only | GAP-1 | P2 | comparison staging row test |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| (none — all 6 ops consumed; no dead FE) | — | spine + grep | — | — |
| Audit-metadata diagnosis blob as only persistence | data placement | :170-172 | not queryable | superseded by GAP-1 fix |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| stage/grade/extent absent from schema + TypeSpec PerioChart model | schema/API | schema :19-35; tsp :240-255 | P1 | GAP-1 migration + TypeSpec + regen + contract pins |
| Drizzle numeric→string coercion handled at all 3 read paths | API | numOrNull ×3 | — | none (Batch 3 verified) |
| Atomic single-statement upsert (no read-modify-write race) | backend | repo :76-100 | — | none — exemplary |
| CAL never stored (derived) | schema | docs+code | — | none (correct) |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Clinical-role write gate incl. hygienist; staff_scheduling 403 pinned | write guards | coverage tests | — | none |
| Branch scoping uniform | tenancy | handlers | — | none |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Lock cascade + append-only readings | exam record | BR-P02 pins | — | none |
| Completion audited (with diagnosis in metadata) | audit trail | :155-174 | — | keep; not a substitute for GAP-1 |
| Diagnosis ephemerality | clinical record | GAP-1 | P1 | fix |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Zero orphan ops; tight module boundary (visit/patient/org facades only) | spine | healthiest wiring of audited set | none |
| Pure-utils package shape (staging/classify) cleanly testable | paths | safe GAP-1 change surface | persist at handler, not utils |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Perio staging IS the diagnosis of record for periodontitis care + insurance narratives | AAP/EFP context | GAP-1 is clinically material, not cosmetic | P1 |
| Longitudinal staging trajectory drives recall intervals | clinical practice | comparison staging row valuable post-GAP-1 | include in fix |

## 18. Webwright / Playwright Findings

Not used this round — module live-driven 2026-06-07 (comparison feature verified against seeded improving/relapsed data, Claudia #35); this round's findings are schema-level. Note from inspection: `ipad-perio-charting.spec.ts` is dev-mode-skipped (`test.skip(true,…)`) — iPad coverage relies on the chromium/keyboard spec. No new evidence saved.

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `perio-staging.test.ts` (25 clinical cases) + `perio-classify-chart.test.ts` (incl. 3 over-staging fix pins) + validation + CAL | backend/pure | AAP/EFP rules, fix regressions | High |
| `dental-perio-coverage.test.ts` (868 lines) + `dental-perio-history.test.ts` | backend/integration | handlers, RBAC, P2-1 numeric pins, lock cascade, merge no-data-loss ×3 | High |
| `dental-perio.hurl` (39) | contract | full flows + isFloat pins + stage/grade on complete response | High |
| FE ~12 files (overlay FSM, grid, summary live, comparison + logic, site cells, threshold, sequence, voice) | frontend | wired surfaces incl. string-coercion defense | High |
| E2E: perio-charting (full keyboard flow), voice, journey-03 (real API), ipad (skipped) | E2E | core journey | High (ipad Medium) |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Diagnosis persisted: complete → GET returns stage/grade/extent; survives reload | backend + contract | GAP-1 RED-first | Before |
| Risk factors persisted + grade reproducible from stored inputs | backend | GAP-2 | Before |
| Comparison/history renders staging chip per exam | frontend | GAP-1 surface | During |
| Re-enable or replace dev-skipped iPad spec in CI project matrix | E2E | device-coverage honesty | Anytime |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| GAP-1 migration touches TypeSpec → regen → SDK (PerioChart model) | shared/platform `[SHARED DEPENDENCY]` | tsp :240-255 | regen pipeline discipline | spec-first, then handler, then pins |
| Visit lock cascade (dental-visit) | cross-module | BR-P02 | unchanged | none |
| br-registry consolidation (GAP-4) | docs/tooling | traceability script | registry is load-bearing | small doc PR |
| Voice stance owned at product level | product decision | GAP-5 | doc alignment | confirm |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Migration: stage/grade/extent + riskFactors JSONB on perio chart; persist at complete; TypeSpec + regen; GET/history read-back | GAP-1+2 | P1 | V1 REQUIRED | backend RED + contract + FE chip | one coherent batch |
| Staging chip in history/comparison | GAP-1 | P2 | V1 REQUIRED | FE | rides batch |
| Doc fixes: WF-P05 deferred note, BR-P registry, stale comparison line, voice alignment | GAP-3/4/5/6 | P3 | V1 RECOMMENDED | none | quick docs batch |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| PDF export (WF-P05) | V2 DEFERRED | standards-doc deferral stands |
| Per-site calculus + MGJ/keratinized tissue | V2 DEFERRED | standards backlog |
| AI auto-anything (perio) | DO NOT ADD | binding non-goal |
| Voice-charting expansion | `[NEEDS CONFIRMATION]` then decide | GAP-5 first |
| New comparison analytics beyond shipped trends | DO NOT ADD `[DO NOT OVERBUILD]` | no anchor |

## 24. Audit Decision

**PARTIAL PASS.**

Everything about capture and computation is exemplary: validated merge-safe 6-site readings, the full AAP/EFP 2017 engine with 25 clinical test cases and both prior bugs (over-staging, per-site data loss) verified fixed with regression pins, lock cascades, role gates, numeric wire-shape conformance, a shipped longitudinal comparison, and zero orphan operations.

It is not a PASS because of one clinically material seam: the diagnosis the module exists to produce — Stage/Grade/extent — is computed, displayed once, logged into audit metadata, and **never persisted on the exam record** (GAP-1), with its risk-factor evidence discarded (GAP-2). Until the diagnosis is on the chart row and readable on GET/history, the perio record is incomplete as a clinical document.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Voice charting — sanctioned (local speech, not "AI") or non-goal? Align MODULE_SPEC vs STANDARDS | `[NEEDS CONFIRMATION]` / `[NEEDS PRODUCT DECISION]` | GAP-5; stance consistency with imaging GAP-1 | Product |
| Q2: Should persisted diagnosis be recomputed-on-amend or frozen-at-completion? | `[NEEDS CONFIRMATION]` (lean: frozen; new exam = new diagnosis) | GAP-1 semantics | Eng/Clinical |

## 26. Notes for Gap Plan Organizer

- **Truly V1:** GAP-1+2 as ONE batch (migration + TypeSpec + persist + read-back + history chip + pins). It's the module's only substantive work.
- **Likely batch shape:** Batch A = GAP-1/2 full seam; Batch B = docs (GAP-3/4/6 + GAP-5 after Q1).
- **Blocked until confirmed:** GAP-5 (Q1); GAP-1 semantics detail (Q2 — lean frozen-at-completion, consistent with imaging report pinning).
- **Must NOT implement:** PDF export, calculus/MGJ, AI features, comparison expansion.
- **Tests first:** persistence RED (complete→GET stage), risk-factor reproducibility RED.
- **Cross-module:** TypeSpec regen discipline (same hazard class as dental-visit GAP-6 — reconcile-then-regen); voice stance pairs with imaging Q1 (one product conversation).
- **Do not re-litigate:** over-staging fix, merge fix, P2-1 coercion, RBAC, lock cascade, comparison feature — all source-verified with pins.

---

Next recommended step:
Module/group: Dental Perio
Module slug: dental-perio
Primary PRD/spec: docs/product/modules/dental-perio/ + STANDARDS_COMPLIANCE perio section
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/dental-perio-gap-plan.md
