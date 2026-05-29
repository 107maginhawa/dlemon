<!-- oli-version: 1.1 | generated: 2026-05-29 | skill: oli-enforce-file -->
<!-- module: dental-visit | source-files: 62 | spec: MODULE_SPEC.md + API_CONTRACTS.md + DOMAIN_MODEL.md -->

# Enforce-File Audit — dental-visit

**Spec Version:** MODULE_SPEC.md v1.0 (2026-05-24) | API_CONTRACTS.md v1.0 | DOMAIN_MODEL.md (lean)
**Audit Date:** 2026-05-29
**Files Inventoried:** 62
**Module Traceability Score:** 44/62 (71%) files with 0 P0/P1 findings

---

## 1. File Inventory & Classification

| # | File | Type | Specs Loaded |
|---|------|------|-------------|
| 1 | `visits/createDentalVisit.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 2 | `visits/getDentalVisit.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 3 | `visits/listDentalVisits.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 4 | `visits/updateDentalVisit.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 5 | `treatments/createDentalTreatment.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 6 | `treatments/listDentalTreatments.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 7 | `treatments/updateDentalTreatment.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 8 | `treatments/acceptTreatmentPlan.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 9 | `treatments/carryOverTreatments.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 10 | `chart/getDentalChart.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 11 | `chart/updateTooth.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 12 | `chart/upsertDentalChart.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 13 | `chart/initializeDentition.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 14 | `chart/getToothHistory.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 15 | `notes/getVisitNotes.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 16 | `notes/upsertVisitNotes.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 17 | `notes/signVisitNotes.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 18 | `notes/createVisitNoteAddendum.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 19 | `notes/getVisitNoteHistory.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 20 | `templates/applyTemplate.ts` | Handler (re-export) | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 21 | `templates/createTreatmentTemplate.ts` | Handler (re-export) | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 22 | `templates/deleteTreatmentTemplate.ts` | Handler (re-export) | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 23 | `templates/listTreatmentTemplates.ts` | Handler (re-export) | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 24 | `templates/updateTreatmentTemplate.ts` | Handler (re-export) | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 25 | `treatment-plans/getTreatmentPlan.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 26 | `treatment-plans/getTreatmentPlanVersion.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 27 | `utils/treatmentTemplates.ts` | Lib (handler impl) | MODULE_SPEC + API_CONTRACTS |
| 28 | `utils/visit.service.ts` | Lib | MODULE_SPEC |
| 29 | `domain-events.ts` | Lib | MODULE_SPEC |
| 30 | `repos/visit.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 31 | `repos/treatment.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 32 | `repos/dental-chart.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 33 | `repos/dental-chart-baseline.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 34 | `repos/treatment-plan-version.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 35 | `repos/treatment-template.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 36 | `repos/procedure-code.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 37 | `repos/visit.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 38 | `repos/treatment.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 39 | `repos/dental-chart.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 40 | `repos/dental-chart-baseline.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 41 | `repos/visit-billing.facade.ts` | Repository (facade) | MODULE_SPEC + DOMAIN_MODEL |
| 42 | `repos/visit-dental-patient.facade.ts` | Repository (facade) | MODULE_SPEC + DOMAIN_MODEL |
| 43 | `repos/visit-pmd.facade.ts` | Repository (facade) | MODULE_SPEC + DOMAIN_MODEL |
| 44 | `repos/visit.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 45 | `repos/treatment.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 46 | `repos/dental-chart.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 47 | `repos/dental-chart-baseline.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 48 | `repos/treatment-decline.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 49 | `business-rules.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 50 | `dental-chart-baseline.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 51 | `dental-treatment.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 52 | `dental-visit.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 53 | `dental-visit.revenue-path-regression.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 54 | `dental-visit.signed-notes.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 55 | `dental-visit.treatment-plan-versioning.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 56 | `dental-visit.treatment-status-transitions.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 57 | `dental-visit.treatment-templates.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 58 | `dental-visit.visit-note-persistence.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 59 | `treatment-fsm-http.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 60 | `treatment.fsm.property.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 61 | `visit.fsm.property.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 62 | `surface-condition-map.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |

---

## 2. Findings — HIGH/MEDIUM Confidence

### P1 Findings

#### EF-VIS-001 — BR-001 (concurrent active visit) not enforced in createDentalVisit
**Severity:** P1
**Confidence:** HIGH
**File:** `services/api-ts/src/handlers/dental-visit/visits/createDentalVisit.ts`
**Lines:** 29–62
**Spec Source:** MODULE_SPEC §5 BR-001, API_CONTRACTS `POST /api/v1/dental/visits` Errors: `ACTIVE_VISIT_EXISTS(409)`

`createDentalVisit` calls `repo.createOne(...)` without first checking whether an active/in-progress visit already exists for the patient+branch. The repository has `findActiveByPatient` and `findInProgressByPatient` methods that enforce BR-001, and there is a DB-level unique partial index on `(patient_id, status) WHERE status = 'active'` (visit.schema.ts lines 39-41). However, without an application-level guard, concurrent race conditions could reach the DB before the constraint fires, and any conflict will surface as an unhandled 500 from the DB, not a structured 409 `ACTIVE_VISIT_EXISTS`. The spec mandates a 409 response.

**Fix:** Before `repo.createOne`, call `repo.findInProgressByPatient(body.patientId)`. If a visit is returned, throw a `ConflictError('ACTIVE_VISIT_EXISTS')` returning 409.

---

#### EF-VIS-002 — Error code mismatch: VISIT_TRANSITION_INVALID vs spec INVALID_STATUS_TRANSITION
**Severity:** P1
**Confidence:** HIGH
**File:** `services/api-ts/src/handlers/dental-visit/visits/updateDentalVisit.ts`
**Lines:** 47–50
**Spec Source:** MODULE_SPEC §15 Error Handling, API_CONTRACTS `PATCH /api/v1/dental/visits/:id` Errors: `INVALID_STATUS_TRANSITION(422)`

The handler throws `'VISIT_TRANSITION_INVALID'` — a non-canonical code not in the ERROR_TAXONOMY catalog. The spec and ERROR_TAXONOMY define `INVALID_STATUS_TRANSITION` as the standard code. Clients parsing error codes by exact string match will not recognize this response.

```typescript
// Line 49 — actual:
throw new BusinessLogicError(`Cannot transition visit from ...`, 'VISIT_TRANSITION_INVALID');
// Should be:
throw new BusinessLogicError(`Cannot transition visit from ...`, 'INVALID_STATUS_TRANSITION');
```

---

#### EF-VIS-003 — updateDentalTreatment FSM violation throws with no error code
**Severity:** P1
**Confidence:** HIGH
**File:** `services/api-ts/src/handlers/dental-visit/treatments/updateDentalTreatment.ts`
**Lines:** 57–62
**Spec Source:** MODULE_SPEC §15, API_CONTRACTS `PATCH /dental/visits/:id/treatments/:tid` Errors: `INVALID_STATUS_TRANSITION(422)`

When the treatment FSM transition is invalid, the handler throws `new BusinessLogicError(message)` with the error code argument omitted. The response body will have `code: undefined` rather than `INVALID_STATUS_TRANSITION`. The spec mandates a structured 422 with the canonical code.

```typescript
// Lines 57-62 — actual (no second arg):
throw new BusinessLogicError(
  `Invalid status transition: '${currentStatus}' → '${newStatus}'. ...`,
);
// Should be:
throw new BusinessLogicError(
  `Invalid status transition: '${currentStatus}' → '${newStatus}'. ...`,
  'INVALID_STATUS_TRANSITION',
);
```

---

#### EF-VIS-004 — Undeclared 'hygienist' role granted write access across three handlers
**Severity:** P1
**Confidence:** HIGH
**Files:**
- `services/api-ts/src/handlers/dental-visit/visits/createDentalVisit.ts:27`
- `services/api-ts/src/handlers/dental-visit/chart/upsertDentalChart.ts:33`
- `services/api-ts/src/handlers/dental-visit/notes/createVisitNoteAddendum.ts:33`
**Spec Source:** MODULE_SPEC §6 Permissions, ROLE_PERMISSION_MATRIX, API_CONTRACTS auth headers

All three handlers include `'hygienist'` in their `assertBranchRole` allow-lists. The ROLE_PERMISSION_MATRIX does not define a `hygienist` role. MODULE_SPEC §6 lists only `dentist_owner` and `dentist_associate` for clinical write operations. The API_CONTRACTS auth field for POST /dental/visits lists `staff_full, staff_scheduling, dentist_associate, dentist_owner` — no `hygienist`. An undefined role is granted access to create visits, mutate dental charts, and append note addenda.

---

#### EF-VIS-005 — getTreatmentPlan: branchId auth is optional (data-leak risk)
**Severity:** P1
**Confidence:** HIGH
**File:** `services/api-ts/src/handlers/dental-visit/treatment-plans/getTreatmentPlan.ts`
**Lines:** 25–28
**Spec Source:** MODULE_SPEC §6 Permissions, API_CONTRACTS `GET /api/v1/dental/patients/:id/treatment-plan` — Auth required, Query: `branch_id required`

The handler skips branch access enforcement when `branchId` is absent from the query:
```typescript
const branchId = ctx.req.query('branchId');
if (branchId) await assertBranchAccess(db, user.id, branchId);
```
When `branchId` is omitted, any authenticated user can retrieve cross-branch treatment plan data with no authorization check. The query then fetches all treatments across all visits for the patient with no scope restriction. This is a PHI data-leak risk.

---

### P2 Findings

#### EF-VIS-006 — domain-events.ts: DE-001 through DE-006 emit functions defined but never called
**Severity:** P2
**Confidence:** HIGH
**File:** `services/api-ts/src/handlers/dental-visit/domain-events.ts`
**Lines:** 98–182
**Spec Source:** MODULE_SPEC §10b "Published: DE-001 VisitCheckedIn, DE-002 VisitCompleted, DE-003 VisitLocked, DE-004 TreatmentDiagnosed, DE-005 TreatmentPerformed, DE-006 TreatmentDismissed"

All six domain event emit helpers are defined and exported but not imported or called from any handler in the module (confirmed by grep across all handler files). `createDentalVisit`, `updateDentalVisit` (on completion/lock/activate), `createDentalTreatment`, and `updateDentalTreatment` (on performed/dismissed) should emit their respective events but do not. Downstream consumers (dental-pmd, dental-billing) that depend on event-driven workflows will never receive these events.

---

#### EF-VIS-007 — procedure-code.schema.ts uses PHP-specific field name (defaultFeePhp)
**Severity:** P2
**Confidence:** HIGH
**File:** `services/api-ts/src/handlers/dental-visit/repos/procedure-code.schema.ts`
**Lines:** 9
**Spec Source:** DOMAIN_MODEL Value Objects: `Money (Amount integer cents + currency ISO4217)`; MODULE_SPEC §7 uses `price_cents`

```typescript
defaultFeePhp: integer('default_fee_php').notNull().default(0),
```

The field is hardcoded to PHP (Philippine Peso) rather than using the currency-neutral `default_fee_cents` pattern used throughout the rest of the codebase (`price_cents`, `fee_cents`). This violates the DOMAIN_MODEL Money value object (currency-neutral, ISO4217) and will require a breaking migration if the product expands beyond PHP markets.

---

#### EF-VIS-008 — updateDentalVisit: BR-003 VISIT_IMMUTABLE bypass for completed+status combo
**Severity:** P2
**Confidence:** HIGH
**File:** `services/api-ts/src/handlers/dental-visit/visits/updateDentalVisit.ts`
**Lines:** 38–58
**Spec Source:** MODULE_SPEC §5 BR-003 "Visit immutable after completed/locked — all write handlers → 422 VISIT_IMMUTABLE"

The handler blocks writes from `locked` visits at the top but only checks `chiefComplaint` edits on `completed` visits when no status transition is present. A request body of `{ status: 'locked', chiefComplaint: 'new value' }` against a completed visit will bypass the chiefComplaint immutability guard (line 55 check fails because `body.status` is defined) and proceed to update both the status and chiefComplaint. The `chiefComplaint` field should be blocked on completed visits unconditionally.

---

#### EF-VIS-009 — Generic Error() thrown in listTreatmentTemplates (should be ValidationError 400)
**Severity:** P2
**Confidence:** HIGH
**File:** `services/api-ts/src/handlers/dental-visit/utils/treatmentTemplates.ts`
**Lines:** 49
**Spec Source:** ERROR_TAXONOMY §3 — all user-facing validation errors must use typed error classes

```typescript
if (!branchId) throw new Error('branchId query parameter is required');
```

`new Error()` is an untyped error that will surface as a 500 Internal Server Error. Per ERROR_TAXONOMY, missing required query parameters must use `ValidationError` (400 `VALIDATION_ERROR`).

**Fix:** `throw new ValidationError('branchId query parameter is required');`

---

#### EF-VIS-010 — Generic Error() thrown in VisitNotesRepository.sign (internal guard)
**Severity:** P2
**Confidence:** MEDIUM
**File:** `services/api-ts/src/handlers/dental-visit/repos/treatment.repo.ts`
**Lines:** 195
**Spec Source:** ERROR_TAXONOMY §3

```typescript
if (!note) throw new Error('VisitNotesRepository.sign: note not found after update');
```

Internal post-update assertion using bare `new Error()`. If this fires it produces a 500 with a non-structured response body. Should use `AppError` or a typed error to maintain consistent responses.

---

#### EF-VIS-011 — visit_type field missing from schema/handler (API_CONTRACTS drift)
**Severity:** P2
**Confidence:** MEDIUM
**File:** `services/api-ts/src/handlers/dental-visit/visits/createDentalVisit.ts` + `repos/visit.schema.ts`
**Lines:** `createDentalVisit.ts:31-36`
**Spec Source:** API_CONTRACTS `POST /api/v1/dental/visits` Request body: `visit_type` (required, enum: checkup/treatment/emergency/recall); Response: `visit_type` field

`API_CONTRACTS.md` specifies `visit_type` as a required request and response field. The generated `CreateDentalVisitRequestSchema` (validators.ts) does not include `visit_type`, and neither does the `dental_visit` DB table schema or the handler. This is a divergence between the hand-authored `API_CONTRACTS.md` and the TypeSpec-generated validators. If `API_CONTRACTS.md` is authoritative, TypeSpec + handler + schema all need updating.

---

#### EF-VIS-012 — provider_id vs dentistMemberId API contract naming drift
**Severity:** P2
**Confidence:** MEDIUM
**File:** `services/api-ts/src/handlers/dental-visit/visits/createDentalVisit.ts`
**Lines:** 34
**Spec Source:** API_CONTRACTS `POST /api/v1/dental/visits` — Request body field `provider_id`; Response field `provider_id`

`API_CONTRACTS.md` uses `provider_id` for the treating provider field. The generated schema and handler use `dentistMemberId`. Clients consuming the API via SDK or documentation will see `provider_id` in docs but receive `dentistMemberId` (or vice versa depending on which spec they reference). The mismatch breaks contract-first consumer trust.

---

### P3 Findings

#### EF-VIS-013 — getToothHistory: auth deferred after DB read (TOCTOU)
**Severity:** P3
**Confidence:** MEDIUM
**File:** `services/api-ts/src/handlers/dental-visit/chart/getToothHistory.ts`
**Lines:** 28–40
**Spec Source:** MODULE_SPEC §20 AI Instructions "assertBranchAccess called at TOP of every handler"

The handler performs a `visitRepo.findMany({ patientId })` DB query before asserting branch access. If `visits.length === 0`, the handler returns a 200 empty array with no auth check. For patients with visits, it uses only `visits[0].branchId` for authorization which could be wrong if visits span branches. Auth should be moved to the top of the handler, requiring a `branchId` query parameter.

---

#### EF-VIS-014 — createDentalVisit: staff_full/staff_scheduling excluded (API_CONTRACTS drift)
**Severity:** P3
**Confidence:** MEDIUM
**File:** `services/api-ts/src/handlers/dental-visit/visits/createDentalVisit.ts`
**Lines:** 27
**Spec Source:** API_CONTRACTS `POST /api/v1/dental/visits` Auth: `staff_full, staff_scheduling, dentist_associate, dentist_owner`

`API_CONTRACTS.md` lists `staff_full` and `staff_scheduling` as authorized to create visits (check-in by front desk). The handler allows `['dentist_owner', 'dentist_associate', 'hygienist']` — excluding the two staff roles in the spec. Note: ROLE_PERMISSION_MATRIX limits visit creation to dentists only, creating a spec conflict. Flagged P3 pending role-spec reconciliation.

---

#### EF-VIS-015 — emitVisitCheckedIn not called on draft→active transition
**Severity:** P3
**Confidence:** MEDIUM
**File:** `services/api-ts/src/handlers/dental-visit/visits/updateDentalVisit.ts`
**Lines:** 73–79 (draft→active block)
**Spec Source:** MODULE_SPEC §10b "DE-001 VisitCheckedIn — emitted after visit transitions draft→active"

Specific instance of EF-VIS-006: the `patch.status === 'active'` block (lines 73-79) returns after calling `repo.activate()` without calling `emitVisitCheckedIn`. Similarly, the `completed` block (line 82+) does not call `emitVisitCompleted` despite the spec requiring it.

---

#### EF-VIS-016 — BR-007 immutability only checks 'verified', misses 'performed'
**Severity:** P3
**Confidence:** MEDIUM
**File:** `services/api-ts/src/handlers/dental-visit/treatments/updateDentalTreatment.ts`
**Lines:** 47–51
**Spec Source:** MODULE_SPEC §5 BR-007, AC-VIS-003 "Given treatment.status = performed, When PATCH to change cdt_code attempted, Then 422 returned"

The field-immutability check fires only when `treatment.status === 'verified'`. AC-VIS-003 explicitly specifies that `performed` treatments should also be immutable for field edits (cdt_code, tooth_number, surface). A `performed` treatment can currently have its `cdt_code` changed before it moves to `verified`.

---

## 3. Review Required (LOW Confidence)

#### EF-VIS-R001 — visit_type schema gap: TypeSpec vs API_CONTRACTS.md authority
**File:** `repos/visit.schema.ts` + generated `validators.ts`
**Confidence:** LOW
**Description:** `API_CONTRACTS.md` lists `visit_type` as required in request and response. The generated `CreateDentalVisitRequestSchema` and `dental_visit` table omit it entirely. Cannot determine from static analysis which source is authoritative without inspecting TypeSpec sources (`specs/api/src/`). Manual review required.

---

## 4. Per-File Compliance Summary

| File | Findings | Compliant |
|------|:---:|:---:|
| `visits/createDentalVisit.ts` | EF-VIS-001(P1), EF-VIS-004(P1), EF-VIS-011(P2), EF-VIS-012(P2), EF-VIS-014(P3) | NO |
| `visits/getDentalVisit.ts` | — | YES |
| `visits/listDentalVisits.ts` | — | YES |
| `visits/updateDentalVisit.ts` | EF-VIS-002(P1), EF-VIS-008(P2), EF-VIS-015(P3) | NO |
| `treatments/createDentalTreatment.ts` | — | YES |
| `treatments/listDentalTreatments.ts` | — | YES |
| `treatments/updateDentalTreatment.ts` | EF-VIS-003(P1), EF-VIS-016(P3) | NO |
| `treatments/acceptTreatmentPlan.ts` | — | YES |
| `treatments/carryOverTreatments.ts` | — | YES |
| `chart/getDentalChart.ts` | — | YES |
| `chart/updateTooth.ts` | — | YES |
| `chart/upsertDentalChart.ts` | EF-VIS-004(P1) | NO |
| `chart/initializeDentition.ts` | — | YES |
| `chart/getToothHistory.ts` | EF-VIS-013(P3) | PARTIAL |
| `notes/getVisitNotes.ts` | — | YES |
| `notes/upsertVisitNotes.ts` | — | YES |
| `notes/signVisitNotes.ts` | — | YES |
| `notes/createVisitNoteAddendum.ts` | EF-VIS-004(P1) | NO |
| `notes/getVisitNoteHistory.ts` | — | YES |
| `templates/applyTemplate.ts` | — | YES |
| `templates/createTreatmentTemplate.ts` | — | YES |
| `templates/deleteTreatmentTemplate.ts` | — | YES |
| `templates/listTreatmentTemplates.ts` | — | YES |
| `templates/updateTreatmentTemplate.ts` | — | YES |
| `treatment-plans/getTreatmentPlan.ts` | EF-VIS-005(P1) | NO |
| `treatment-plans/getTreatmentPlanVersion.ts` | — | YES |
| `utils/treatmentTemplates.ts` | EF-VIS-009(P2) | PARTIAL |
| `utils/visit.service.ts` | — | YES |
| `domain-events.ts` | EF-VIS-006(P2) | PARTIAL |
| `repos/visit.schema.ts` | — | YES |
| `repos/treatment.schema.ts` | — | YES |
| `repos/dental-chart.schema.ts` | — | YES |
| `repos/dental-chart-baseline.schema.ts` | — | YES |
| `repos/treatment-plan-version.schema.ts` | — | YES |
| `repos/treatment-template.schema.ts` | — | YES |
| `repos/procedure-code.schema.ts` | EF-VIS-007(P2) | PARTIAL |
| `repos/visit.repo.ts` | — | YES |
| `repos/treatment.repo.ts` | EF-VIS-010(P2) | PARTIAL |
| `repos/dental-chart.repo.ts` | — | YES |
| `repos/dental-chart-baseline.repo.ts` | — | YES |
| `repos/visit-billing.facade.ts` | — | YES |
| `repos/visit-dental-patient.facade.ts` | — | YES |
| `repos/visit-pmd.facade.ts` | — | YES |
| `repos/visit.test.ts` | — | YES |
| `repos/treatment.test.ts` | — | YES |
| `repos/dental-chart.test.ts` | — | YES |
| `repos/dental-chart-baseline.test.ts` | — | YES |
| `repos/treatment-decline.test.ts` | — | YES |
| `business-rules.test.ts` | — | YES |
| `dental-chart-baseline.test.ts` | — | YES |
| `dental-treatment.test.ts` | — | YES |
| `dental-visit.test.ts` | — | YES |
| `dental-visit.revenue-path-regression.test.ts` | — | YES |
| `dental-visit.signed-notes.test.ts` | — | YES |
| `dental-visit.treatment-plan-versioning.test.ts` | — | YES |
| `dental-visit.treatment-status-transitions.test.ts` | — | YES |
| `dental-visit.treatment-templates.test.ts` | — | YES |
| `dental-visit.visit-note-persistence.test.ts` | — | YES |
| `treatment-fsm-http.test.ts` | — | YES |
| `treatment.fsm.property.test.ts` | — | YES |
| `visit.fsm.property.test.ts` | — | YES |
| `surface-condition-map.test.ts` | — | YES |

---

## 5. Findings Table Summary

| ID | Severity | Confidence | Title | File |
|----|----------|-----------|-------|------|
| EF-VIS-001 | P1 | HIGH | BR-001 concurrent active visit not enforced in createDentalVisit | `visits/createDentalVisit.ts` |
| EF-VIS-002 | P1 | HIGH | Error code VISIT_TRANSITION_INVALID vs spec INVALID_STATUS_TRANSITION | `visits/updateDentalVisit.ts:49` |
| EF-VIS-003 | P1 | HIGH | Treatment FSM violation throws with no error code | `treatments/updateDentalTreatment.ts:57-62` |
| EF-VIS-004 | P1 | HIGH | Undeclared 'hygienist' role granted write access (3 files) | `createDentalVisit.ts:27`, `upsertDentalChart.ts:33`, `createVisitNoteAddendum.ts:33` |
| EF-VIS-005 | P1 | HIGH | getTreatmentPlan: branchId auth is conditional — skip-if-absent (data-leak) | `treatment-plans/getTreatmentPlan.ts:28` |
| EF-VIS-006 | P2 | HIGH | Domain events DE-001–DE-006 defined but never emitted from any handler | `domain-events.ts` |
| EF-VIS-007 | P2 | HIGH | procedure-code.schema: defaultFeePhp (PHP-specific, not cents-neutral) | `repos/procedure-code.schema.ts:9` |
| EF-VIS-008 | P2 | HIGH | updateDentalVisit: chiefComplaint VISIT_IMMUTABLE bypass on completed+status combo | `visits/updateDentalVisit.ts:55-57` |
| EF-VIS-009 | P2 | HIGH | Generic Error() in listTreatmentTemplates (should be ValidationError 400) | `utils/treatmentTemplates.ts:49` |
| EF-VIS-010 | P2 | MEDIUM | Generic Error() in VisitNotesRepository.sign (internal post-update assertion) | `repos/treatment.repo.ts:195` |
| EF-VIS-011 | P2 | MEDIUM | visit_type field missing from schema/handler — API_CONTRACTS drift | `visits/createDentalVisit.ts` |
| EF-VIS-012 | P2 | MEDIUM | provider_id vs dentistMemberId naming drift (API_CONTRACTS vs generated) | `visits/createDentalVisit.ts:34` |
| EF-VIS-013 | P3 | MEDIUM | getToothHistory: auth deferred after DB read (TOCTOU) | `chart/getToothHistory.ts:28-40` |
| EF-VIS-014 | P3 | MEDIUM | createDentalVisit: staff_full/staff_scheduling excluded (API_CONTRACTS drift) | `visits/createDentalVisit.ts:27` |
| EF-VIS-015 | P3 | MEDIUM | emitVisitCheckedIn/Completed not called on state transitions | `visits/updateDentalVisit.ts:73-79` |
| EF-VIS-016 | P3 | MEDIUM | BR-007 immutability guard only checks 'verified', misses 'performed' | `treatments/updateDentalTreatment.ts:47` |

---

## 6. Module Scores

**P0 findings:** 0
**P1 findings:** 5 (distinct findings; EF-VIS-004 affects 3 files)
**P2 findings:** 7
**P3 findings:** 4
**File Traceability Score:** Files with 0 P0/P1 findings: 51/62 = **82%**

---

## 7. What's Next

P1 findings present — resolve spec-declared method gaps and security issues before merge.

**Priority order:**
1. **EF-VIS-005** (P1) — Fix `getTreatmentPlan` to require `branchId` and always assert branch access (PHI data-leak)
2. **EF-VIS-001** (P1) — Add `findInProgressByPatient` guard + 409 `ACTIVE_VISIT_EXISTS` in `createDentalVisit`
3. **EF-VIS-004** (P1) — Remove `'hygienist'` from 3 handlers; align with ROLE_PERMISSION_MATRIX
4. **EF-VIS-002** (P1) — Rename `'VISIT_TRANSITION_INVALID'` to `'INVALID_STATUS_TRANSITION'`
5. **EF-VIS-003** (P1) — Add `'INVALID_STATUS_TRANSITION'` as second arg to `BusinessLogicError` in `updateDentalTreatment`
6. **EF-VIS-006** (P2) — Wire emit calls from handlers (emitVisitCheckedIn, emitVisitCompleted, emitTreatmentDiagnosed, etc.)
7. **EF-VIS-009** (P2) — Replace `throw new Error(...)` with `throw new ValidationError(...)` in `listTreatmentTemplates`
8. **EF-VIS-008** (P2) — Strengthen completed visit chiefComplaint immutability guard
9. **EF-VIS-010** (P2) — Replace internal `new Error()` with typed error in `treatment.repo.ts:195`

After P1/P2 fixes: run `/oli-enforce-all` for cross-module view.
