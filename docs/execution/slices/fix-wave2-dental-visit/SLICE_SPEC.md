# SLICE_SPEC — fix-wave2-dental-visit

**Wave:** 2 (P1 structural fixes)
**Module:** dental-visit
**Date:** 2026-05-29
**Executor:** Claude Sonnet 4.6

---

## Findings in Scope

| ID | Sev | Status | Action |
|----|-----|--------|--------|
| EM-VIS-002 | P1 | FIXED | Accept `source_visit_id` from body in `carryOverTreatments` |
| EM-VIS-012 | P1 | FIXED | Document `declined` terminal state in MODULE_SPEC §2 §5 §7 §8 |
| EF-VIS-006 | P1 | BLOCKED | F2 service-layer sprint — see below |

---

## EM-VIS-002: carryOverTreatments — source_visit_id from body

### Problem
`API_CONTRACTS §POST /carry-over` declares `source_visit_id` as a required body field.
The implementation ignored it, always auto-discovering the source by scanning the
patient's recent visits. Callers following the contract were silently ignored.

### Fix
`services/api-ts/src/handlers/dental-visit/treatments/carryOverTreatments.ts`

- Extended `carryOverBodySchema` with `sourceVisitId?: z.string().uuid()`
- When `sourceVisitId` is provided: validates the source visit exists (404) and
  belongs to the same patient (422 `INVALID_SOURCE_VISIT`), then carries over
  treatments exclusively from that visit
- Legacy auto-discovery path retained when `sourceVisitId` is omitted (backward
  compatible)
- Fixed `restoredDismissed` type from `any[]` → `DentalTreatment[]` (also closes
  EM-VIS-009 style finding)
- Logger now records `sourceVisitId` for observability

### Tests added
`services/api-ts/src/handlers/dental-visit/dental-treatment.test.ts` — new
describe block `EM-VIS-002: carry-over with explicit sourceVisitId`:
1. Filters to only the specified source visit's treatments (isolates from other visits)
2. Returns 404 when `sourceVisitId` does not exist
3. Returns 422 `INVALID_SOURCE_VISIT` when source visit belongs to different patient
4. Returns empty `carriedOver` array when source visit has no pending treatments

### Commits
`30242380` — fix(dental-visit): EM-VIS-002 — accept source_visit_id from body in carryOverTreatments

---

## EM-VIS-012: declined terminal state — MODULE_SPEC documentation

### Problem
`declined` treatment terminal state is implemented in `TREATMENT_TRANSITIONS`
(`repos/treatment.schema.ts` line 92–98) and the DB enum but is absent from
spec §2 Domain Terms, §5 BR-006, §7 data requirements enum, and §8 State
Transitions. Spec consumers were unaware the state exists.

### Fix
`docs/product/modules/dental-visit/MODULE_SPEC.md`

- **§2 Domain Terms**: Added `Declined` row explaining patient-initiated refusal
  vs clinician-initiated `dismissed`
- **§5 BR-006**: Updated to include `declined` as a terminal state reachable from
  `diagnosed` or `planned` (not from `performed`/`verified`)
- **§7 Data Requirements**: Extended `dental_treatment` status enum to include
  `declined`; added `refusal_reason` field
- **§8 State Transitions**: Replaced the terse 2-line summary with a full FSM
  showing every valid arc, including `declined` paths and the semantic distinction
  between `dismissed` (clinician-initiated) and `declined` (patient refusal)

### Commits
`c8b530f3` — fix(dental-visit): EM-VIS-012 — document declined terminal state in MODULE_SPEC

---

## EF-VIS-006: F2 Service-Layer/DI Sprint — BLOCKED

**Reason for block:** EF-VIS-006 requires creating `TreatmentTemplateRepository`,
`TreatmentPlanRepository`, and moving inline Drizzle queries in
`getTreatmentPlan.ts`, `acceptTreatmentPlan.ts`, and the two `db.select()` calls
in `carryOverTreatments.ts` into repositories. This is an F2 service-layer sprint
with broad handler changes and its own test surface. It must be scoped, planned,
and executed in a dedicated wave with regression coverage for all affected handlers.

**Do not execute in this wave.**
**Prerequisite:** F2 pattern validated in a reference module first; then apply to
dental-visit as part of the F2 rollout sprint.

---

## Definition of Done

- [x] EM-VIS-002: `carryOverTreatments` accepts `sourceVisitId` from body; 4 new tests pass
- [x] EM-VIS-012: MODULE_SPEC §2/§5/§7/§8 document `declined` state
- [x] `bun test dental-treatment.test.ts` — 37 pass, 0 fail
- [x] No new TypeScript errors in changed files
- [x] Two atomic commits on `main`
- [x] EF-VIS-006 documented as BLOCKED in this spec
