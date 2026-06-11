# AHA Module/Group Gap Plan: Dental Visit & Charting

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

> **Erratum (2026-06-11, data-governance audit round):** GAP-4's claim "no scheduler exists in api-ts" is **wrong in mechanism** — `services/api-ts/src/core/jobs.ts` provides `registerCron` (wired `app.ts:286-290`; 7 modules use it). The finding stands: no visit-lock job is registered, so completed visits never reach `locked` (WF-046). The fix shrinks to registering a lock-sweep cron on the existing scheduler; the `[SHARED DEPENDENCY]` is the existing `core/jobs.ts`, not a new mechanism.

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Dental Visit & Charting |
| Module slug | dental-visit |
| Type | Business Module |
| Output file | `docs/aha/module-gap-plans/dental-visit-gap-plan.md` |
| Primary PRD/spec used | `docs/prd/v3-dentalemon.md` §6.1 (FR1.1–FR1.24) + §3/§4 (carousel, per-tooth) |
| Supporting PRDs/specs used | `docs/prd/BUSINESS_RULES.md` BR-001..008, BR-016; `docs/prd/ACCEPTANCE_CRITERIA.md` AC-VISIT/AC-CHART/AC-TREAT/AC-TXPLAN; `docs/product/modules/dental-visit/MODULE_SPEC.md` + `API_CONTRACTS.md`; `docs/context/DENTALEMON-DENTAL-WORKSPACE-REFERENCE-SPEC.md`; `docs/audits/dental-charting/CHARTING_RESEARCH_RECONCILIATION.md`; `docs/product/WORKFLOW_MAP.md` WF-007/012/046 |
| PRD/spec coverage quality | Strong |
| Paths inspected | `services/api-ts/src/handlers/dental-visit/` (36 handlers + repos/facades, 27 test files); `apps/dentalemon/src/features/workspace/` (88 FE test files); contract `dental-visit.hurl`; E2E workspace/charting specs |
| PRDs/specs inspected | All above; 60-item requirement checklist extracted before code comparison |
| KG used | Yes — `contract-spine.json` (2026-06-10); zero-consumer claims grep-verified; **agent-reported negatives independently re-verified by orchestrator greps this round** (several were stale) |
| KG refreshed | No |
| `/understand-domain` used | Yes (cross-check only) |
| `/understand-domain` refreshed | No |
| Webwright used | No — module had a live-drive ≤1 day old (charting P0 slice verification 2026-06-10) and all new claims are statically conclusive |
| Playwright/E2E inspected | Yes (inspected, not run): `returning-patient-visit`, `workspace-readonly`, `visit-active-conflict`, `ipad-workspace`, journeys |
| Existing tests inspected | 27 backend files (10K+ LOC), 35-request hurl, 88 FE files, 5+ E2E |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | No tests executed; `CHARTING_RESEARCH_RECONCILIATION.md` itself is now stale (predates 2026-06-10 slice landing) — superseded statements ignored in favor of source |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| v3 PRD §6.1/§3/§4 | `docs/prd/v3-dentalemon.md` | PRD | Current | FR1.1–1.24: carousel, chart, slideout, treatments, notes, templates, plan, gestures, read-only history |
| Business rules | `docs/prd/BUSINESS_RULES.md` | business rules | Current (load-bearing) | BR-001 concurrency, BR-002 linear FSM, BR-003 immutability, BR-005 auto-discard (deferred), BR-006/007 treatment FSM/immutability, BR-008 carry-over, BR-016 branch access |
| Acceptance criteria | `docs/prd/ACCEPTANCE_CRITERIA.md` | acceptance criteria | Current | AC-VISIT/AC-CHART-01..05/AC-TREAT/AC-TXPLAN |
| Module spec + API contracts | `docs/product/modules/dental-visit/` | module spec | Current, **but §API_CONTRACTS documents known TypeSpec↔handler shape drift** (see GAP-6) | endpoints, FSMs, V-VIS validations |
| Workspace reference spec | `docs/context/DENTALEMON-DENTAL-WORKSPACE-REFERENCE-SPEC.md` | workflow spec | Current | drove SL-01..12 offline chain |
| Charting reconciliation | `docs/audits/dental-charting/CHARTING_RESEARCH_RECONCILIATION.md` | prior reconciliation | **Stale (pre-slice-landing)** | Its 4 "P0 missing" items shipped 2026-06-10 — re-verified in source this round (§3) |
| Prior module audit + gap plan + matrix | `MODULE_dental-visit_AUDIT_2026-06-08.md`, prior gap plan, matrix rows | prior audit (pre-AHA) | Partially superseded | 5 security fixes verified landed; G1/G2/G3 re-verified still open |

## 3. Expected vs Actual

**Expected (PRD §6.1 + workspace ref spec):** the product's core surface — visit FSM (draft→active→completed→locked) with concurrency guard, interactive 32-tooth chart with per-surface conditions and cumulative cross-visit layers, forward-only treatment FSM feeding billing, SOAP notes with sign+addendum, treatment templates, carry-over of unperformed work, offline-first idempotent/clock-aware writes with visible conflict resolution, read-only history, iPad gestures.

**Actual:** This module absorbed the heaviest recent investment and it shows. Verified landed and wired end-to-end this round (orchestrator-grepped after one researcher returned stale negatives):

- **All four charting P0 slices (2026-06-10) are SHIPPED:** conflict read/resolve (`listChartConflicts.ts`, `resolveChartConflict.ts` + FE `use-chart-conflicts.ts`, `chart-conflict-banner.tsx`); chart export (`exportDentalChart.ts` + `chart-export-overlay.tsx`); condition vocabulary + finding→treatment (`createDentalFinding.ts`, `convertFindingToTreatment.ts` + `use-findings.ts`; `dental_finding` table, migration 0100); selected-tooth panel (`treatment-table.tsx:91-94` filters by `selectedTooth`; `treatment-table.tooth-filter.test.ts`).
- **Offline chain verified:** localId idempotency on visit/treatment/chart (`createDentalVisit.ts:45-48`, `treatment.repo.ts:69-75` + partial unique indexes), clock-aware LWW (`dental-chart-baseline.repo.ts:79-88`), monotonic treatment-status merge (`treatment.schema.ts:189-214`), durable conflicts (`upsertDentalChart.ts:70-77`).
- **Visit lifecycle hardening verified:** New-Visit gating + owner-only Discard with safe-to-discard checks and fail-closed audit (`discardVisit.ts:25-105`).
- **Prior security fixes verified:** applyTemplate RBAC + cross-clinic 404, treatment-plan patient-branch auth (3 handlers), pinned by `dental-visit.cross-tenant-rbac.test.ts`.
- **Chart model:** per-patient baseline (`dental_patient_chart_baseline`, LWW per tooth) + per-visit charts with `syncStatus`/`conflictPayload`; export aggregates treatments across all visits (living-document pattern).

What remains is a small, sharp set:

1. **Carry-over has no FE trigger (G1, unchanged):** `carryOverTreatments` (BR-008, with source-status guard + content idempotency per SL-04) has zero FE consumers — the "Carried Over" section renders items but nothing in the product invokes the carry-over action.
2. **Treatment templates fully built+seeded, zero FE (G3, unchanged):** 5 ops, 59 backend assertions, seeded demo data — no "Apply template" affordance or management screen.
3. **Accepted plan versions unviewable (G2, unchanged):** `getTreatmentPlanVersion` zero consumers — e-signed snapshots can't be read back.
4. **WF-046 visit-lock job missing:** completed→locked transition has no scheduler — same platform-wide scheduler absence as billing GAP-1 `[SHARED DEPENDENCY]`. (BR-003 already makes completed immutable, so risk is bounded.)
5. **TypeSpec↔handler response-shape drift** documented in API_CONTRACTS for `TreatmentPlanResponse`, `ApplyTemplateResponse`, `CarryOverTreatmentsResponse` (+ missing `restoreDismissedIds` request field) — SDK regen hazard.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BR-001/EC7 single active visit | 409 on concurrent | ✓ + offline replay returns existing first | visit-active-conflict E2E | `createDentalVisit.ts:50-58` (guard), :45-48 (localId pre-check) | partial unique index | idempotency + FSM tests | Implemented | No |
| BR-002/003 visit FSM + immutability | linear; completed/locked immutable | ✓ | read-only workspace | FSM guards | — | `visit.fsm.property.test.ts`, `workspace-readonly.spec.ts` | Implemented | No |
| Visit discard (lifecycle hardening) | owner-only escape hatch, safe-checks, audited | ✓ | discard affordance | `discardVisit.ts:40-102` | — | tests landed with e1fa900f | Implemented | No |
| FR1.17/WF-046 lock after review period | completed → locked via scheduled job | **No scheduler exists** | — | no job runner in api-ts (same as billing GAP-1) | `locked` status exists | — | Partially Implemented | **GAP-4** |
| FR1.4–1.6/AC-CHART chart + per-surface + slideout | SVG chart, surfaces, 3/4-step slideout | ✓ | `dental-chart.tsx`, `tooth-slideout.tsx` | chart handlers | chart schemas | 88 FE files + E2E + surface tests | Implemented | No |
| Cumulative cross-visit layers (Proposed/Completed/Declined, carried amber ring) | layers derive from all visits | ✓ (30fbc0b7) | `dental-chart.tsx` layer logic + toggles | `deriveChartLayerSets`/`resolveToothLayer` | — | layer tests | Implemented | No |
| Chart offline conflict visibility (charting P0-A) | persist + list + resolve + banner | ✓ SHIPPED 2026-06-10 | `chart-conflict-banner.tsx`, `use-chart-conflicts.ts` | `listChartConflicts.ts:27-57`, `resolveChartConflict.ts:35-130` | `syncStatus`/`conflictPayload` | `chart-conflict.test.ts`, `upsertDentalChart.conflict.test.ts` | Implemented | full-journey E2E missing → §20 |
| Chart export (P0-B) | structured export/print | ✓ SHIPPED | `chart-export-overlay.tsx` | `exportDentalChart.ts:28-93` + `chart/chart-export.ts` | — | `chart-export.test.ts` | Implemented | No |
| Condition vocab + finding→treatment (P0-C) | curated findings, convert/link | ✓ SHIPPED | `use-findings.ts` (create/list/convert wired) | `convertFindingToTreatment.ts:56-72` atomic | `dental-finding.schema.ts` (mig 0100) | `dental-finding` tests (39) | Implemented | `updateDentalFinding` orphan (P3, §12) |
| Selected-tooth panel + why-visible (P0-D) | table filters by tooth; explains layer | ✓ SHIPPED | `treatment-table.tsx:91-94` | — | — | `treatment-table.tooth-filter.test.ts` | Implemented | No |
| BR-006/007 treatment FSM + immutability | forward-only; performed locks fields | ✓ | treatment table | `TREATMENT_TRANSITIONS` map | rank enum | property tests | Implemented | No |
| SL-02/09/12 offline merge semantics | LWW, monotonic status, durable conflicts | ✓ | banner | `dental-chart-baseline.repo.ts:79-88`, `treatment.schema.ts:209-214` | conflictPayload jsonb | LWW + merge tests | Implemented | No |
| BR-008/AC-TREAT carry-over | discover prior unperformed → carriedOver=true; explicit action; not auto-billed | ✓BE (guard+idempotent) — **no FE trigger** | "Carried Over" renders items; grep `carryOverTreatments` FE = 0 | `carryOverTreatments.ts:64-90` | sourceVisitId | BR-008 tests | Partially Implemented | **GAP-1** |
| FR1.8 treatment templates | multi-tooth template apply | ✓BE+seed — **zero FE** | grep 5 ops FE = 0 | `templates/` handlers (RBAC fixed 2026-06-08) | template schema | 59 assertions | Partially Implemented | **GAP-2** |
| FR1.22/AC-TXPLAN plan aggregation + versions | cross-visit plan; immutable accepted versions readable | aggregate ✓ wired; **version read-back zero FE** | plan tab; grep `getTreatmentPlanVersion` = 0 | handlers (cross-tenant fixed) | version table | backend+contract | Partially Implemented | **GAP-3** |
| FR1.9 SOAP notes + sign + addendum | single record, lock, append-only | ✓ | `soap-notes-sheet.tsx` | notes handlers + Batch-2 audit events | — | signed-notes tests | Implemented | No |
| FR1.19 dentition init (peds 51-85) | idempotent, age-derived | ✓ | — | `initializeDentition.ts` (needs DOB — known gotcha) | — | tests | Implemented | No |
| FR1.1–1.3/1.20 carousel, divider, baseline picker | swipe, collapse, picker sync | ✓ (divider resize = documented no-op ADR-005) | carousel components | — | — | FE tests + E2E | Implemented | resize V2 |
| FR1.15 read-only past visits | visual distinction + 422 writes | ✓ | isReadOnly flag | BR-003 guards | — | E2E | Implemented | No |
| BR-005 auto-discard empty visits | flagged OFF by default | stub behind `DENTAL_VISIT_AUTO_DISCARD` | — | `updateDentalVisit.ts:113-133` | — | **flag-ON path untested** | Not Required for V1 | §20 (P3) |
| API_CONTRACTS shape drift | TypeSpec == handler shapes | **3 response models + 1 request field diverge** | — | API_CONTRACTS §352-365 | — | — | Unclear | **GAP-6** |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| BR-008 carry-over trigger | **GAP-1**: `carryOverTreatments` zero FE consumers — carry-over decision (2026-06-10: POST /carry-over canonical) implemented backend-only; carried items render but action unreachable | P1 | V1 REQUIRED | grep = 0; handler complete with source-status guard | "Carry over from previous visit" affordance in workspace (treatment table header or new-visit flow); RED-first FE test |
| FR1.8 templates | **GAP-2**: 5 template ops built+seeded+tested, zero FE — multi-tooth quick-charting unreachable; seeded data orphaned | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` (wire-vs-park was left open in matrix) | grep = 0 | If wire: "Apply template" in slideout/treatment table; if park: unseed + document dormant |
| Plan versions | **GAP-3**: `getTreatmentPlanVersion` zero FE — e-signed plan snapshots not reviewable (legal artifact invisible) `[CROSS-MODULE RISK]` (handler owned by dental-patient plans) | P2 | V1 REQUIRED | grep = 0 | Version viewer in treatment-plans sheet / case-presentation history |
| FR1.17/WF-046 lock job | **GAP-4**: no scheduler → completed visits never lock | P2 | V1 RECOMMENDED `[SHARED DEPENDENCY]` | no job runner (same evidence as billing GAP-1) | Same boot-interval runner as billing overdue; add lock sweep + RED caller test |
| Offline E2E | **GAP-5**: no end-to-end browser journey for conflict resolve (unit/FE-component tests only) | P2 | V1 RECOMMENDED `[TEST GAP]` | slice-A tests are component-level | E2E: stale offline write → banner → resolve (candidate for prompt 05 offline group) |
| Contract drift | **GAP-6**: TypeSpec models for plan/apply-template/carry-over responses diverge from real handler shapes; `restoreDismissedIds` missing from request model — SDK regen would break FE | P2 | V1 REQUIRED | `API_CONTRACTS.md` §352-365 documents the drift | Reconcile TypeSpec to real shapes → regen → contract pins; do NOT regen before reconciling |
| FE RBAC parity | **GAP-7**: chart/treatment affordances not role-gated FE-side (`canEditChart`/`canAddTreatment` helpers exist, unused) | P3 | V1 RECOMMENDED | `tooth-slideout.tsx`, `treatment-table.tsx` no rbac imports | Wire existing helpers |
| Redundant ops | **GAP-8**: `getDentalVisit`, `listPatientVisits` (alias), `updateDentalFinding` orphans | P3 | V1 RECOMMENDED | spine + grep | Document intentional or remove from spec |
| UI state persistence | **GAP-9**: chart layer toggles + year filter reset on reload | P3 | V2 DEFERRED | local React state | defer |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Treatment templates backend+seed (if product decides park) | `templates/` + seed-demo | FR1.8 anchors it — not overbuild, but FE-pending | seeded-orphan confusion in demos | Wire or unseed (GAP-2 decision) |
| `getDentalVisit` single-read endpoint | spine 0 consumers | spec-listed | none | Keep; document list-covers-it |
| Hygiene visit type w/ hygienist RBAC branch | `createDentalVisit.ts:32-36` | E3-hygiene tests exist; PRD mention thin | low | Keep `[NEEDS CONFIRMATION]` PRD anchor |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Check-in → visit → chart → treat → complete → pay (WF-007/012) | dentist/staff | appointment | FSM + chart + treatments + footer handoff | Implemented | No | golden-path smoke + J04 |
| Offline edit → sync → conflict → resolve | dentist (iPad) | reconnect | idempotent replay → LWW → banner → resolve | Implemented (component-proven) | GAP-5 (E2E) | slice-A artifacts |
| Carry over unperformed work | dentist | returning patient | discover → carriedOver rows → complete later | Backend only | **GAP-1** | 0 consumers |
| Quick-chart with template | dentist | common procedure | pick template → planned treatments | Backend only | **GAP-2** | 0 consumers |
| Review e-signed plan snapshot | dentist/patient | dispute/follow-up | open accepted version | Backend only | **GAP-3** | 0 consumers |
| Visit aging → lock | system | review period passes | completed → locked | Missing (no scheduler) | **GAP-4** | WF-046 |
| Export/print chart | dentist | referral/records request | export overlay | Implemented | No | slice B |
| Record finding → convert to treatment | dentist | exam | finding → linked treatment | Implemented | No | slice C |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Active-visit guard + replay | 409 / idempotent return | Implemented | :45-58 | V1 REQUIRED | done |
| Chart write w/ clock gate | stale rejected + conflict persisted | Implemented | LWW repo | V1 REQUIRED | done |
| Conflict resolve | accept/dismiss + clock re-bump | Implemented | `resolveChartConflict.ts` | V1 REQUIRED | E2E pending (GAP-5) |
| Treatment status merge | monotonic | Implemented | rank map | V1 REQUIRED | done |
| Carry-over action | explicit, guarded, idempotent | Partially Implemented (BE only) | GAP-1 | V1 REQUIRED | FE trigger |
| Template apply | role-gated, branch-scoped | Partially Implemented (BE only) | GAP-2 | V1 RECOMMENDED | decision |
| Plan version read-back | immutable snapshot viewable | Missing (BE ready) | GAP-3 | V1 REQUIRED | |
| Lock after review period | scheduled transition | Missing | GAP-4 | V1 RECOMMENDED | shared scheduler |
| Notes sign + addendum | lock + append-only + audit | Implemented | Batch-2 events | V1 REQUIRED | done |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Run a chairside visit end-to-end | dentist | chart→treat→complete→pay | Implemented | No | V1 REQUIRED | E2E |
| Work offline on iPad and reconcile | dentist | replay-safe + visible conflicts | Implemented | GAP-5 (proof) | V1 REQUIRED | SL chain |
| Resume unfinished work next visit | dentist | carry-over in 1 tap | Missing (BE ready) | GAP-1 | V1 REQUIRED | 0 consumers |
| Chart a 4-surface restoration fast | dentist | template apply | Missing (BE ready) | GAP-2 | V1 RECOMMENDED | 0 consumers |
| Show patient what they signed | dentist | version viewer | Missing (BE ready) | GAP-3 | V1 REQUIRED | 0 consumers |
| Print/export the odontogram | dentist | structured export | Implemented | No | V1 REQUIRED | slice B |
| Trust record finality | compliance | completed immutable; locked after period | Partially (immutable ✓; lock job ✗) | GAP-4 | V1 RECOMMENDED | WF-046 |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-1 carry-over trigger | FE affordance | P1 | V1 REQUIRED | 0 consumers of decided-canonical endpoint | Continuity of care (the returning-patient core loop); decision already made 2026-06-10 — only wiring remains | Workspace affordance + RED-first test |
| GAP-3 plan version viewer | FE affordance / legal | P2 | V1 REQUIRED | 0 consumers | E-sign trust artifact unreadable — undermines case-presentation chain | Viewer in plans sheet |
| GAP-6 TypeSpec shape drift | contract | P2 | V1 REQUIRED | API_CONTRACTS §352-365 | Any SDK regen silently breaks plan/template/carry-over consumers — the platform's known worst bug class | Reconcile spec→regen→pins before any other TypeSpec change in module |
| GAP-2 templates FE | FE affordance | P2 | V1 RECOMMENDED (decision) | 0 consumers, seeded | Demo shows data that UI can't create | Wire or unseed |
| GAP-4 lock job | lifecycle | P2 | V1 RECOMMENDED `[SHARED DEPENDENCY]` | no scheduler | Records never reach locked; bounded by BR-003 | Shared runner w/ billing GAP-1 |
| GAP-5 conflict E2E | test proof | P2 | V1 RECOMMENDED `[TEST GAP]` | component tests only | Offline trust is the product's headline promise | Browser journey (prompt 05 candidate) |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Returning patient → resume planned work | Carry-over action | Carried section can render but action unreachable | GAP-1 | P1 | FE-unit + E2E carry-over |
| Patient asks "what did I sign?" | Version viewer | Nothing renders snapshots | GAP-3 | P2 | FE-unit viewer |
| Demo: templates seeded but uncreatable/unappliable from UI | Template flow | Seed-only illusion | GAP-2 | P2 | decision-dependent |
| Completed visit ages → locked | Auto-lock | Stays completed forever | GAP-4 | P2 | job caller test |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `carryOverTreatments` | API, 0 FE | spine+grep | core loop unreachable | Wire (GAP-1) |
| `applyTemplate`, `listTreatmentTemplates`, create/update/delete template | API ×5, 0 FE | same | seeded-orphan | GAP-2 decision |
| `getTreatmentPlanVersion` | API, 0 FE | same | legal artifact invisible | Wire (GAP-3) |
| `getDentalVisit`, `listPatientVisits` (alias) | API, 0 FE | same | none | document (GAP-8) |
| `updateDentalFinding` | API, 0 FE | same | low | document or wire with findings iteration |
| `canEditChart`/`canAddTreatment` rbac helpers | FE helpers unused | grep | UX parity | GAP-7 |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Chart model: per-patient baseline (LWW/tooth) + per-visit charts + conflictPayload | schema | baseline/chart schemas + repos | — | none (sound; ADR-008 read-time-interim documented) |
| localId partial unique indexes on visit/treatment/chart | schema | `dental_treatment_visit_local_id_unique` etc. | — | none |
| CHART-BR-002 baseline immutability vs sync-conflict separation | backend | `dental-chart-baseline.repo.ts:72-88` | — | none (clean separation) |
| TypeSpec response models diverge from handlers (3 models + 1 req field) | API/contract | API_CONTRACTS §352-365 | P2 | GAP-6 reconcile-then-regen |
| BR-005 auto-discard flag-ON path untested | backend | `updateDentalVisit.ts:113-133` | P3 | flag-ON test if ever enabled |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| 2026-06-08 fixes verified: applyTemplate role gate + foreign-branch 404; plan handlers patient-branch auth | tenancy/RBAC | `dental-visit.cross-tenant-rbac.test.ts` (7 adversarial) | — | none — do not re-litigate |
| Discard owner-only with fail-closed audit | write guards | `discardVisit.ts:40,102` | — | none |
| Hygiene-visit hygienist allowance | role matrix | `createDentalVisit.ts:32-36` | — | confirm PRD anchor (§6 note) |
| FE affordance gating absent (backend is real gate) | UX parity | GAP-7 | P3 | wire helpers |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Completed/locked immutability uniform (BR-003) | clinical record | guards + E2E | — | none |
| Notes sign/addendum audited (Batch 2) | clinical notes | audit events tests | — | none |
| Discard preserves audit (reason + before/after) | visit lifecycle | `discardVisit.ts:102` | — | none |
| Conflicts durable (no silent loss) | offline integrity | SL-12 artifacts | — | none — E2E proof pending (GAP-5) |
| Plan versions append-only but unviewable | legal snapshot | GAP-3 | P2 | wire viewer |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| In-module orphans reduce to exactly: carry-over, templates ×5, plan-version read, getDentalVisit/listPatientVisits, updateDentalFinding | spine + grep (re-verified after stale agent negatives) | Gap surface is small and precise | §5 |
| 6 facades export visit state to billing/patient/org/perio/pmd/plan | `repos/*.facade.ts` | wide blast radius on FSM changes | keep FSM semantics frozen during FE wiring |
| **Process note:** one research agent reported slice A/B/C/D artifacts as NOT-FOUND from the stale reconciliation doc; orchestrator grep disproved all four | this audit | prior-doc-trust is a real failure mode | prompt 03 should trust THIS plan's §3 source citations over older docs |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Returning-patient continuity (carry-over) is the difference between a charting toy and an EHR | PRD §6.1 + workspace spec | GAP-1 is the module's remaining P1 | fix first |
| Offline-first is the product's stated differentiator (no-AI, local-first) | STANDARDS_COMPLIANCE non-goals | conflict chain done; browser-level proof missing | GAP-5 |
| Templates accelerate the highest-frequency clinical action | FR1.8 | GAP-2 wiring is cheap leverage if product confirms | decision |

## 18. Webwright / Playwright Findings

Not used this round — the module's wired surfaces were live-driven 2026-06-10 during slice verification (≤1 day before this audit), and every new claim is statically conclusive. No new evidence saved under `docs/aha/evidence/`.

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `dental-visit.test.ts` (54KB) + FSM property tests (visit, treatment) | backend | lifecycle, transitions, RBAC | High |
| `dental-visit.cross-tenant-rbac.test.ts` (7 adversarial) | backend/security | 2026-06-08 fixes pinned | High |
| idempotency tests (visit/treatment/chart) + `dental-chart-baseline.lww.test.ts` + `chart-conflict.test.ts` + `upsertDentalChart.conflict.test.ts` | backend/offline | SL-01/02/03/12 chain | High |
| `treatment-templates.test.ts` (59) | backend | unreachable surface | High (backend-only reach) |
| `dental-finding` tests (39) + `chart-export.test.ts` | backend | slices B/C | High |
| `dental-visit.hurl` (35 req) | contract | visit/chart/treatment/notes | High |
| FE: 88 workspace files incl. `treatment-table.tooth-filter.test.ts`, chart-conflict-banner, soap-notes, carousel, payment-summary-bar | frontend | wired surfaces + coherence oracle | High |
| E2E: returning-patient-visit, workspace-readonly, visit-active-conflict, ipad-workspace, journeys | E2E | core journeys | High |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Carry-over FE: affordance renders, invokes endpoint, carried rows appear | frontend/component + E2E | GAP-1 RED-first | Before |
| Plan-version viewer renders immutable snapshot | frontend/component | GAP-3 RED-first | Before |
| Template apply FE (if wired) | frontend/component | GAP-2 | Before (post-decision) |
| Visit-lock job: completed+aged → locked; active untouched | backend | GAP-4 | Before |
| Offline conflict full browser journey | E2E/Playwright | GAP-5 headline-promise proof | Prompt 05 / during |
| Contract pins for reconciled plan/template/carry-over shapes | contract | GAP-6 regen safety | During GAP-6 |
| BR-005 flag-ON auto-discard path | backend | only if flag ever enabled | Deferred |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| Scheduler (none exists) — visit lock + billing overdue + plan-Behind + retention | shared/platform `[SHARED DEPENDENCY]` | GAP-4 = billing GAP-1 evidence | one mechanism, four consumers | Build once in billing batch; visit lock joins it `[DO NOT OVERBUILD]` |
| Plan/version handlers owned by dental-patient | cross-module `[CROSS-MODULE RISK]` | GAP-3 | viewer wiring touches patient-owned ops | coordinate; read-only |
| Treatment FSM feeds billing line items (visit-billing.facade) | cross-module | facade | status semantics frozen | no FSM edits during wiring |
| Carry-over branch-scope drift (patient-scoped discovery vs strict branch isolation) | product decision (recorded 2026-06-08) | handler :64-90 | cross-branch continuity policy | already-decided direction; organizer should not reopen unless product flags |
| TypeSpec regen pipeline | shared/platform | GAP-6 | regen breaks consumers if spec reconciled late | reconcile first |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Carry-over affordance in workspace (header action on treatment table / new-visit flow) | GAP-1 | P1 | V1 REQUIRED | FE RED + E2E | backend untouched |
| Plan-version viewer (read-only dialog from plans sheet) | GAP-3 | P2 | V1 REQUIRED | FE RED | coordinate dental-patient |
| TypeSpec reconcile (3 response models + restoreDismissedIds) → regen → contract pins | GAP-6 | P2 | V1 REQUIRED | contract | do before any module TypeSpec work |
| Template wire-or-unseed | GAP-2 | P2 | V1 RECOMMENDED (decision) | FE RED if wired | |
| Visit-lock sweep on shared runner | GAP-4 | P2 | V1 RECOMMENDED | backend RED | rides billing scheduler batch |
| Offline-conflict browser E2E | GAP-5 | P2 | V1 RECOMMENDED | E2E | prompt 05 |
| FE role-gating via existing helpers | GAP-7 | P3 | V1 RECOMMENDED | FE | quick |
| Document/remove redundant ops | GAP-8 | P3 | V1 RECOMMENDED | none | docs |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Divider resize functionality (ADR-005 no-op) | V2 DEFERRED | spec-acknowledged deferral |
| BR-005 auto-discard enablement (WebSocket heartbeat) | V2 DEFERRED | ADR-010; flag OFF |
| Chart layer/year-filter persistence | V2 DEFERRED | GAP-9 polish |
| Patient merge cascade onto visits | V2 DEFERRED | BR-020 (patient module) |
| Job-queue framework for GAP-4 | DO NOT ADD `[DO NOT OVERBUILD]` | shared interval runner suffices |
| New chart layers/notation systems beyond FDI+Universal | DO NOT ADD | no PRD anchor |
| Re-opening carry-over branch-scope policy | DO NOT ADD (unprompted) | decided 2026-06-08/10; reopen only on product request |

## 24. Audit Decision

**PARTIAL PASS.**

This is the platform's strongest module by evidence volume: the visit/treatment FSMs, chart model (baseline+deltas with LWW and durable conflicts), all four 2026-06-10 charting P0 slices, the offline idempotency chain, and the prior security fixes are all source-verified, heavily tested (27 backend files, 35 contract requests, 88 FE files, genuine E2E), and wired end-to-end. A researcher-reported regression of the charting slices was disproven by direct source verification — the slices are in.

It is not a PASS because the returning-patient core loop is incomplete from the product: carry-over (BR-008, decision already made) has no FE trigger (P1), e-signed plan versions can't be read back, templates remain seeded-but-unreachable, and the documented TypeSpec↔handler shape drift is a standing SDK-regen hazard. None of these are data-unsafe.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Treatment templates — wire FE now or park (and unseed)? | `[NEEDS PRODUCT DECISION]` | GAP-2; demo coherence | Product |
| Q2: Carry-over affordance placement — treatment-table header vs new-visit prompt? | `[NEEDS CONFIRMATION]` | GAP-1 shape | Product/Design |
| Q3: Hygiene visit type — confirm PRD anchor for hygienist-led visits | `[NEEDS CONFIRMATION]` | role matrix coherence | Product |
| Q4: Visit-lock review period default (24h vs 48h appears in different docs) | `[NEEDS CONFIRMATION]` | GAP-4 config | Product |

## 26. Notes for Gap Plan Organizer

- **Truly V1 (decision-free):** GAP-1 (carry-over trigger — module's only P1), GAP-3 (version viewer), GAP-6 (TypeSpec reconcile — sequence FIRST if any TypeSpec work is planned in this module), GAP-7/8 (cheap).
- **Likely batch shape:** Batch A = GAP-6 reconcile+regen+pins (protects everything after); Batch B = GAP-1 carry-over FE + E2E; Batch C = GAP-3 viewer (coordinate dental-patient); Batch D = GAP-4 lock sweep riding the billing scheduler batch; GAP-5 E2E with prompt-05 offline group.
- **Blocked until decided:** GAP-2 (Q1).
- **Must NOT implement:** §23 — no job framework, no carry-over policy reopen, no new chart layers.
- **Tests first:** carry-over FE RED; version-viewer FE RED; lock-job caller RED; contract pins with GAP-6.
- **Cross-module:** scheduler shared with billing/governance; plan ops owned by dental-patient; treatment FSM frozen (billing facade).
- **Do not re-litigate:** charting P0 slices A–D (shipped, source-cited §3), SL-01/02/03/09/12 chain, 2026-06-08 security fixes, visit FSM. **Ignore `CHARTING_RESEARCH_RECONCILIATION.md` status claims — superseded by this plan.**

---

Next recommended step:
Module/group: Dental Visit & Charting
Module slug: dental-visit
Primary PRD/spec: docs/prd/v3-dentalemon.md §6.1 + docs/product/modules/dental-visit/
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/dental-visit-gap-plan.md
