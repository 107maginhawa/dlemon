# Compliance Report — dental-visit

---
Audit Date: 2026-05-30
Dimension: compliance (oli-check, single-module slice)
Module: dental-visit
Spec Version: MODULE_SPEC 1.0 (validated against PRD v3-dentalemon.md)
Knowledge-graph baseline: docs/audits/codebase-map/ (.map-meta 2026-05-30)
---

## Generated Code Exclusion

`services/api-ts/src/generated/**` (OpenAPI registry/routes/validators, Better-Auth schemas, SDK
types) is excluded from violation findings. It was read ONLY to confirm route wiring (registry imports,
method/path/handler binding, validator binding). Hand-written handlers, repos, schemas, and frontend
consumers ARE in scope.

## Audit Scope

| Artifact | Available | Used |
|----------|-----------|------|
| MODULE_SPEC.md (dental-visit) | YES | BR/AC/permissions/FSM/data/events/flags (Steps 3-10) |
| API_CONTRACTS.md (dental-visit) | YES | Step 8b endpoint/schema/error/auth |
| ROLE_PERMISSION_MATRIX.md | YES | Step 5 permissions |
| ERROR_TAXONOMY.md | YES | Step 6.4 / 8b error codes |
| AUDIT_CONTRACTS.md | YES | Step 9d audit-logging compliance |
| DOMAIN_GLOSSARY / DOMAIN_MODEL | YES (not re-derived) | Step 6 terminology / FSM state names |
| Knowledge graph (8 JSON maps) | YES | State machines + route wiring as structural ground truth |

Files read exhaustively (all hand-written dental-visit sources):
- visits/: createDentalVisit, updateDentalVisit, getDentalVisit, listDentalVisits
- treatments/: createDentalTreatment, updateDentalTreatment, listDentalTreatments, acceptTreatmentPlan, carryOverTreatments
- chart/: upsertDentalChart, getDentalChart, updateTooth, initializeDentition, getToothHistory
- notes/: upsertVisitNotes, getVisitNotes, signVisitNotes, createVisitNoteAddendum
- treatment-plans/: getTreatmentPlan (re-export shim), getTreatmentPlanVersion (re-export shim)
- templates/: create/list/update/delete/apply (re-exports of utils/treatmentTemplates.ts)
- utils/treatmentTemplates.ts
- repos/: visit.repo, treatment.repo (Treatment + VisitNotes repos), dental-chart.repo, visit.schema, treatment.schema, treatment-template.schema
- generated/openapi/registry.ts + routes.ts (wiring verification), core/audit-logger.ts
- Tests (name inventory for AC traceability): business-rules, treatment-status-transitions,
  treatment-fsm-http, dental-visit-events, signed-notes, visit-note-persistence,
  revenue-path-regression, repos/treatment-decline, treatment.fsm.property, visit.fsm.property

> Spec paradox disclaimer: where MODULE_SPEC and API_CONTRACTS disagree (BR-007 scope), this is
> reported as an internal spec contradiction; code follows API_CONTRACTS.

---

## Executive Summary

dental-visit is a mature, well-enforced module. Core invariants are enforced in code AND covered by
tests: BR-001 concurrent-visit guard (app-level + DB partial unique index), BR-002 linear visit FSM,
BR-003 completed/locked immutability on EVERY write handler, BR-006 forward-only treatment FSM
(property-tested), BR-005 correctly flag-gated. `assertBranchRole(['dentist_owner','dentist_associate'])`
is called at the top of every write handler; read handlers use `assertBranchAccess`. Audit rows are
written for the lifecycle events AUDIT_CONTRACTS mandates (create/complete/lock + treatment events).

Findings are dominated by ONE genuine business-rule gap (BR-007 scope: performed-treatment field
immutability — AC-VIS-003 unmet against MODULE_SPEC, though it MATCHES API_CONTRACTS → internal spec
contradiction), plus a cluster of P2/P3 spec-vs-code drifts (auth-role breadth on two endpoints,
audit action-name split, list-envelope key, visit-detail eager-load, contract field-name casing).

- Overall verdict: **WARN**
- P0: 0
- P1: 1
- P2: 5
- P3: 3

> Retractions (verified false during audit): an earlier hypothesis that `getToothHistory` calls a
> missing repo method is WITHDRAWN — it calls `treatmentRepo.findByVisit` (treatment.repo.ts:55) and
> `chartRepo.findByVisit`, both of which exist; no runtime bug. A "dead duplicate handler" hypothesis
> for dental-visit/treatment-plans/*.ts is also WITHDRAWN — those files are re-export shims that the
> generated registry resolves to the dental-patient implementations (and are referenced by an
> acceptance test). Neither is a violation.

---

## Step 3 — Business Rules

| Rule | Status | Sev | Evidence |
|------|--------|-----|----------|
| BR-001 No concurrent active visit → 409 | ENFORCED | — | createDentalVisit.ts:34-40 (findActiveByPatient → ACTIVE_VISIT_EXISTS); updateDentalVisit.ts:76-82 (activate path); DB partial unique index visit.schema.ts:39-41 |
| BR-002 Visit FSM linear draft→active→completed→locked | ENFORCED | — | updateDentalVisit.ts:44-52 via VISIT_TRANSITIONS (visit.schema.ts:50-58); VISIT_TRANSITION_INVALID 422 |
| BR-003 Visit immutable after completed/locked | ENFORCED | — | createDentalTreatment.ts:38-43; updateDentalTreatment.ts:43-45; upsertDentalChart.ts:36-38; updateTooth.ts:39-41; upsertVisitNotes.ts:35-37; carryOverTreatments.ts:56-58; applyTemplate utils:142-144 |
| BR-005 Auto-discard empty visit (deferred, flag-gated) | ENFORCED (gated) | — | updateDentalVisit.ts:121-133, DENTAL_VISIT_AUTO_DISCARD default OFF; discard() visit.repo.ts:108-115 (matches V-VIS-004) |
| BR-006 Treatment forward-only FSM; dismissed/declined terminal | ENFORCED | — | updateDentalTreatment.ts:54-63 via TREATMENT_TRANSITIONS (treatment.schema.ts:91-98); declined requires refusalReason (94-97) |
| BR-007 "Completed treatment immutable (code, tooth, surface, price)" | **PARTIAL** | **P1** | Code blocks field edits only when status==='verified' (updateDentalTreatment.ts:48-51); a `performed` treatment's cdtCode/tooth/surfaces ARE writable (patch 117-124). See V-VIS-101. |
| BR-008 Carry-over rows carriedOver=true, sourceVisitId, status diagnosed; not billed until performed | PARTIAL | P2 | carryOverTreatments.ts:104-120 sets carriedOver=true + sourceVisitId but COPIES source status (`status: t.status`, line 115) instead of forcing `diagnosed`. See V-VIS-203. |

## Step 4 — Acceptance Criteria (test existence)

| AC | Status | Sev | Test |
|----|--------|-----|------|
| AC-VIS-001 concurrent check-in → 409 | TESTED (STRONG) | — | business-rules.test.ts (second active visit → 409) |
| AC-VIS-002 write to completed visit → 422 | TESTED (STRONG) | — | business-rules.test.ts (write to completed → 422) |
| AC-VIS-003 performed + change cdt_code → 422 | **NOT ENFORCED / UNTESTED** | (counts under V-VIS-101) | Only "verified field edit" is tested; no performed-field-edit test; code returns 200 |
| AC-VIS-004 performed → diagnosed reversal → 422 | TESTED (STRONG) | — | treatment-status-transitions.test.ts (performed→planned rejected 422); FSM has no backward edge |
| AC-VIS-005 carry-over shown with indicator, not new charges | TESTED (backend) | P3 | carriedOver flag returned by getTreatmentPlan/list; UI indicator is frontend |

FSM coverage (treatment-status-transitions + fsm.property tests) is strong: rejects skips
(diagnosed→performed, diagnosed→verified), rejects backward (performed→planned, verified→performed),
allows happy path + terminal dismissed/declined, asserts refusalReason on declined.

## Step 5 — Permissions (ROLE_PERMISSION_MATRIX → code)

Matrix Clinical Write Operations are granted ONLY to dentist_owner + dentist_associate; "Read
workspace" = all dental roles.

| Action | Expected | Actual | Sev | Status |
|--------|----------|--------|-----|--------|
| Create visit | owner, associate | createDentalVisit:28 | — | COMPLIANT |
| Update/complete/lock visit | owner, associate | updateDentalVisit:36 | — | COMPLIANT |
| Add treatment | owner, associate | createDentalTreatment:35 | — | COMPLIANT |
| Update treatment | owner, associate | updateDentalTreatment:40 | — | COMPLIANT |
| Sign SOAP notes | owner, associate | signVisitNotes:33 | — | COMPLIANT |
| Upsert SOAP notes | owner, associate | upsertVisitNotes:32 | — | COMPLIANT |
| updateTooth | owner, associate | updateTooth:36 | — | COMPLIANT |
| initializeDentition | owner, associate | initializeDentition:81 | — | COMPLIANT |
| Add note addendum | owner, associate (spec §6) | owner/associate/**hygienist** (createVisitNoteAddendum:33) | **P2** | DRIFT (V-VIS-201) |
| Upsert chart | owner, associate (Clinical Write) | owner/associate/**hygienist** (upsertDentalChart:33) | **P2** | DRIFT — inconsistent with sibling updateTooth (V-VIS-201) |
| Read workspace (get/list visit, chart, notes, treatments, plan, tooth-history) | all dental roles | assertBranchAccess (membership-only) | — | COMPLIANT |
| Carry-over / templates / apply | owner, associate / branch member | carryOver assertBranchRole owner/associate (:54); templates use assertBranchAccess (utils:50,67,95,118,139) | P3 | template writes gate on membership only, not owner/associate role — see V-VIS-206 |

No write handler lacks an auth check. Only the `hygienist` over-grant and the membership-only template
writes deviate from the matrix; both are P2/P3, not P0 (hygienist is a documented role, just not
granted these specific ops).

## Step 8b — API Contract Compliance (API_CONTRACTS.md → code)

| Endpoint | Check | Result | Sev |
|----------|-------|--------|-----|
| POST /visits | request schema + 409 guard + role | matches | — |
| PATCH /visits/:id | FSM + immutability + completion gates (OPEN_TREATMENTS/CONSENT_REQUIRED/NOTES_REQUIRED) | all present | — |
| POST /treatments | created `diagnosed`, create-status ignored, price locked, TOOTH_EXTRACTED | matches | — |
| PATCH /treatments/:tid | FSM + consent-on-performed + REFUSAL_REASON_REQUIRED | matches | — |
| GET /visits | `{ data, meta }` envelope | returns `{ data, pagination }` (listDentalVisits:40) | **P2** (V-VIS-202) |
| GET /visits/:id/treatments | same | `{ data, pagination }` (listDentalTreatments:36) | **P2** (V-VIS-202) |
| GET /visits/:id | "full object including treatments array" | bare visit row, no treatments (getDentalVisit:27) | **P2** (V-VIS-204) |
| POST /carry-over | body `source_visit_id` | accepts camelCase `sourceVisitId` only (carryOverTreatments.ts:29-34) | P3 (V-VIS-302) |
| POST /:id/chart | body `tooth_states`,`notation_system` | validator binds `teeth` (upsertDentalChart:42-46) | P3 (V-VIS-303) |

## Step 9 — State Transitions

Visit + Treatment FSM constants (visit.schema.ts:50-58, treatment.schema.ts:91-98) exactly match
DOMAIN_MODEL SM-VISIT / SM-TREATMENT and MODULE_SPEC §8 (terminal dismissed/declined, server-only
active→discarded edge). Enforced in handlers; covered by property + HTTP transition tests. COMPLIANT.

## Step 9d — Audit-Logging Compliance (AUDIT_CONTRACTS.md)

AUDIT_CONTRACTS §3 mandates: Create visit (CREATED), Complete visit (UPDATED), Lock visit (UPDATED).

| Mandated | Code | Sev |
|----------|------|-----|
| Create visit | createDentalVisit:55-62 logs `visit.create`; activate logs `visit.checked_in` (updateDentalVisit:93-100) | P2 — dual action names (V-VIS-205) |
| Complete visit | updateDentalVisit:154-161 `visit.complete` | COMPLIANT |
| Lock visit | updateDentalVisit:172-179 `visit.locked` | COMPLIANT |
| Treatment diagnosed/performed/dismissed/declined | createDentalTreatment:76-84; updateDentalTreatment:80-138,103-111 | COMPLIANT (exceeds contract) |

Delivery: AUDIT_CONTRACTS §4 declares async pg-boss fire-and-forget post-commit; code writes
synchronously in-request. core/audit-logger.ts documents this as an intentional ADR-006 MVP deviation
and guarantees logAuditEvent never throws — preserving "operation succeeds / audit lag tolerated".
Reconciled → P3 (V-VIS-301).

## Step 6 — Terminology

FSM state names, entity names (dental_visit, dental_treatment, visit_notes), and audit action strings
are consistent with glossary/domain model. declined/dismissed distinction implemented exactly
(refusalReason vs dismissReason). No P1/P2 terminology drift.

## Step 11b — Data-Path Connectivity (spot)

Core tables (dental_visit, dental_treatment, visit_notes, visit_note_version, dental_chart,
treatment_plan_version, dental_treatment_template) are queried by repos, served by wired endpoints,
and consumed by the frontend (apps/dentalemon/src references dental/visits, treatment-plan, carry-over,
dentition). No dormant-table P0.

> Wiring note: there is NO manual routes.ts in dental-visit. All 26 dental-visit endpoints wire
> through generated registry.ts:167-188 + routes.ts:1106-1378 (config-based; CODE_ROUTE_MAP.json is
> empty by design). treatment-plan/accept/version + dentition wire under /dental/patients/... via
> dental-patient handlers (registry.ts:136,145-146; routes.ts:974,990,997,1005). All confirmed bound.

---

## Findings (IDs)

### P1

**V-VIS-101 — BR-007 / AC-VIS-003: performed-treatment field immutability not enforced**
`treatments/updateDentalTreatment.ts:48-51` guards field edits ONLY when `treatment.status ===
'verified'`. MODULE_SPEC BR-007 (line 75) and AC-VIS-003 (line 169) require a `performed` treatment's
cdtCode/tooth/surface/price to be immutable (422). With current code a PATCH changing cdtCode on a
performed treatment applies the patch (lines 117-124) and returns 200, and no test covers it.
HOWEVER API_CONTRACTS.md:139 reconciles BR-007 as "`verified` treatments are field-immutable", which
the code satisfies — so this is ALSO an internal spec contradiction (MODULE_SPEC says performed;
API_CONTRACTS says verified). Fix: either (a) extend the guard to
`status === 'performed' || status === 'verified'` to honor MODULE_SPEC/AC-VIS-003 and add the missing
test, OR (b) formally amend MODULE_SPEC BR-007 + AC-VIS-003 to "verified" to match the contract.
Autofixable: false (requires product decision on canonical spec).

### P2

**V-VIS-201 — Clinical-write handlers admit `hygienist` beyond ROLE_PERMISSION_MATRIX**
`upsertDentalChart.ts:33` and `createVisitNoteAddendum.ts:33` include `'hygienist'` in
assertBranchRole; MODULE_SPEC §6 and the matrix Clinical Write table grant chart/note ops to
owner/associate only. Sibling `updateTooth.ts:36` and `upsertVisitNotes.ts:32` correctly use
owner/associate — a sibling inconsistency. Fix: drop `'hygienist'` to match the matrix, OR amend the
matrix deliberately (per the matrix's own anti-drift note). Autofixable: true (remove the literal),
pending product confirmation.

**V-VIS-202 — List endpoints use `{ data, pagination }` instead of the `{ data, meta }` envelope**
`listDentalVisits.ts:40`, `listDentalTreatments.ts:36` (and getToothHistory.ts:38,83) return
`pagination` where API_CONTRACTS / API_CONVENTIONS specify `meta`. SDK/clients expecting `meta` miss
pagination. Fix: rename the wrapper key to `meta` (or align the convention doc). Autofixable: true.

**V-VIS-203 — BR-008: carry-over copies source status instead of forcing `diagnosed`**
`carryOverTreatments.ts:115` sets `status: t.status` when copying pending treatments; BR-008 specifies
carried-over rows start `status=diagnosed`. (The unused `TreatmentRepository.createCarryOver` helper
correctly forces `'planned'`, but the handler bypasses it.) Fix: set carried-over status to
`'diagnosed'` per BR-008 (or reconcile BR-008). Autofixable: true.

**V-VIS-204 — GET /visits/:id omits the treatments array promised by the contract**
API_CONTRACTS GET /visits/:id: "full object including treatments array"; `getDentalVisit.ts:27`
returns the bare visit row. Fix: eager-load treatments (and/or chart/notes) or amend the contract.
Autofixable: false.

**V-VIS-205 — Visit create/check-in audit action naming split (`visit.create` vs `visit.checked_in`)**
createDentalVisit logs `visit.create`; the DE-001 VisitCheckedIn marker is logged as `visit.checked_in`
on draft→active in updateDentalVisit. AUDIT_CONTRACTS/EVENT_CONTRACTS reference a single check-in
marker. Not a missing audit (CREATE is logged), but dual action names complicate audit queries.
Fix: standardize on the canonical event name. Autofixable: true.

### P3

**V-VIS-206 — Treatment-template write handlers gate on membership only, not the owner/associate role**
createTreatmentTemplate/updateTreatmentTemplate/deleteTreatmentTemplate/applyTemplate
(utils/treatmentTemplates.ts) use `assertBranchAccess` (any branch member) rather than
`assertBranchRole(['dentist_owner','dentist_associate'])` used by other clinical writes. Templates are
clinic config (FR1.8); MODULE_SPEC §6 implies clinical-write restriction. Low risk (branch-scoped).
Fix: tighten to owner/associate if templates are owner-managed, or document the broader grant.
Autofixable: true.

**V-VIS-301 — Audit delivery is synchronous, not the pg-boss async model in AUDIT_CONTRACTS §4**
Intentional ADR-006 MVP deviation; logAuditEvent never throws, preserving non-blocking intent. Track
for the future async-delivery phase. Autofixable: false.

**V-VIS-302 — POST /carry-over body field-name drift (`source_visit_id` contract vs `sourceVisitId` code)**
carryOverTreatments.ts:29-34 accepts only camelCase. Also POST /:id/chart drift
(`tooth_states`/`notation_system` contract vs `teeth` validator, upsertDentalChart:42-46) is part of
the same contract-casing reconciliation. Fix: align contract or accept both casings. Autofixable: true.

---

## Stabilization Plan

- Fix Now (P0): none.
- Fix Before New Work (P1): V-VIS-101 — decide canonical BR-007 scope (performed vs verified), then
  enforce + test or amend MODULE_SPEC/AC-VIS-003.
- Fix When Touching Module (P2): V-VIS-201 hygienist role, V-VIS-202 envelope key, V-VIS-203
  carry-over status, V-VIS-204 visit-detail eager-load, V-VIS-205 audit action naming.
- Track (P3): V-VIS-206 template write role, V-VIS-301 async audit, V-VIS-302 contract field-name drift.

## Compliance Rate

Auditable items ≈ 8 BR + 5 AC + 12 permission rows + 9 contract endpoints + FSM + 4 audit events ≈ 39.
Violations counting against rate: 1 P1 + 5 P2 = 6. Compliance ≈ (39-6)/39 ≈ 85%.
Dimension score capped at 6/10 by the presence of a P1 finding.

Verdict: **WARN** (no P0; 1 P1 functional/spec-contradiction gap to resolve before new work).
