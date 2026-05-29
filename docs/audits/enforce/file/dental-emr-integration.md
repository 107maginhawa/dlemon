<!-- oli-version: 1.1 | generated: 2026-05-29 | skill: oli-enforce-file --module=dental-emr-integration -->

# Enforce-File Report: dental-emr-integration

**Module slug:** dental-emr-integration  
**Handler directory:** `services/api-ts/src/handlers/emr/`  
**Spec directory:** `docs/product/modules/dental-emr-integration/`  
**Run date:** 2026-05-29  
**Files inventoried:** 12  
**Spec artifacts loaded:** MODULE_SPEC.md, API_CONTRACTS.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md, MODULE_MAP.md, ROLE_PERMISSION_MATRIX.md  

---

## Critical Context

The MODULE_SPEC.md explicitly states:

> **Implementation status:** Future phase (Phase 3+). No handler directory exists. Spec defines the planned boundary.
>
> **AI Instructions §3:** This is a FUTURE PHASE module. Do not implement handler files until explicitly scheduled.

The MODULE_MAP.md (M9) also explicitly states:

> **Handler**: No handler directory — future phase (Phase 3+). Do not implement until scheduled.

The actual implementation at `services/api-ts/src/handlers/emr/` **does not implement the spec at all.** Instead, it implements a general-purpose medical consultation note system (provider/patient consultation CRUD) that:
- Has no relationship to the spec's purpose (external EMR import bridge for dental practices)
- References `provider` and `patient` base modules (not `dental-patient`)
- Uses domain terms from a generic medical EMR, not the dental EMR import spec
- Implements endpoints (`POST /emr/consultations`, `GET /emr/consultations`, etc.) that are not in the spec
- Does NOT implement the spec's planned endpoints (`POST /dental/emr/import`, `GET /dental/emr/:patientId`)
- Was built while the spec was marked FUTURE PHASE / do not implement

---

## File Inventory & Classification

| # | File | Type (routing table) | Specs Loaded |
|---|------|---------------------|--------------|
| 1 | `createConsultation.ts` | Handler (`*Handler.*` pattern) | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 2 | `listConsultations.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 3 | `getConsultation.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 4 | `updateConsultation.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 5 | `finalizeConsultation.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 6 | `listEMRPatients.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 7 | `repos/emr.schema.ts` | Schema (`*.schema.*`) | DOMAIN_MODEL + MODULE_SPEC |
| 8 | `repos/emr.repo.ts` | Repository (`*Repo.*`) | MODULE_SPEC + DOMAIN_MODEL |
| 9 | `emr.handlers.test.ts` | Test (`*.test.*`) | Mirrors handler spec set |
| 10 | `emr-coverage.test.ts` | Test (`*.test.*`) | Mirrors handler spec set |
| 11 | `repos/emr.repo.test.ts` | Test (`*.test.*`) | Mirrors repo spec set |
| 12 | `consultation-note.fsm.property.test.ts` | Test (`*.test.*`) | Mirrors handler spec set |

---

## Findings

### P0 Findings

None. (No middleware/guard files present.)

---

### P1 Findings

#### EF-EMR-001 — P1 | Handler directory exists for a FUTURE PHASE module
**Severity:** P1  
**Confidence:** HIGH  
**Check type:** Naming conventions / Module boundary  
**Spec source:** MODULE_SPEC.md §AI Instructions item 3, MODULE_MAP.md M9  
**File:** `services/api-ts/src/handlers/emr/` (entire directory)  
**Description:** MODULE_SPEC.md §AI Instructions item 3 says "This is a FUTURE PHASE module. Do not implement handler files until explicitly scheduled." MODULE_MAP.md M9 says "No handler directory — future phase (Phase 3+). Do not implement until scheduled." The `emr/` handler directory was created and fully implemented, violating this explicit directive. This constitutes premature implementation of a spec-gated future phase module.

---

#### EF-EMR-002 — P1 | All implemented endpoints absent from spec; all spec endpoints unimplemented
**Severity:** P1  
**Confidence:** HIGH  
**Check type:** Data shapes / API endpoint mismatch  
**Spec source:** API_CONTRACTS.md, MODULE_SPEC.md §10  
**Files:** `createConsultation.ts` line 18, `listConsultations.ts` line 16, `getConsultation.ts` line 15, `updateConsultation.ts` line 17, `finalizeConsultation.ts` line 17, `listEMRPatients.ts` line 18  
**Description:** The spec defines three endpoints: `POST /api/v1/dental/emr/import`, `GET /api/v1/dental/emr/:patientId`, `GET /api/v1/dental/emr/:id`. The implementation provides six entirely different endpoints: `POST /emr/consultations`, `GET /emr/consultations`, `GET /emr/consultations/:consultation`, `PATCH /emr/consultations/:consultation`, `POST /emr/consultations/:consultation/finalize`, `GET /emr/patients`. Zero spec endpoints are implemented. Zero implemented endpoints appear in spec. Complete API surface mismatch.

---

#### EF-EMR-003 — P1 | Domain entity mismatch — ConsultationNote vs EMRRecord
**Severity:** P1  
**Confidence:** HIGH  
**Check type:** Domain terms / Data shapes  
**Spec source:** MODULE_SPEC.md §2 Domain Terms, §7 Data Requirements, DOMAIN_MODEL.md  
**File:** `repos/emr.schema.ts` lines 31–168  
**Description:** The spec's domain entity is `EMRRecord` with fields: `id`, `patient_id`, `branch_id`, `source_system`, `import_date`, `content (JSONB)`, `imported_by_member_id`, `format_version`. The implementation defines `consultationNotes` with fields: `patient`, `provider`, `chiefComplaint`, `assessment`, `plan`, `vitals`, `symptoms`, `prescriptions`, `followUp`, `finalizedAt`, `finalizedBy`, `status`. None of the spec's required fields are present. The spec's aggregate root `EMRRecord` does not exist. The implemented entity is a general medical consultation note with no relationship to the dental EMR import spec.

---

#### EF-EMR-004 — P1 | AC-EMR-001 violated — PATCH implemented as mutable update instead of 405
**Severity:** P1  
**Confidence:** HIGH  
**Check type:** Error taxonomy / Business rule  
**Spec source:** API_CONTRACTS.md (PATCH/DELETE returns `405 EMR_IMMUTABLE`), MODULE_SPEC.md §11 AC-EMR-001  
**File:** `updateConsultation.ts` lines 1–96  
**Description:** AC-EMR-001 states: "PATCH/DELETE imported EMR → 405." The spec explicitly forbids mutation of EMR records. The implementation provides a full PATCH handler that allows arbitrary field updates to consultation notes on draft status. This directly violates the spec's read-only-after-import mandate. The `updateConsultation` handler must not exist for this module; it should return 405 with error code `EMR_IMMUTABLE`.

---

#### EF-EMR-005 — P1 | source_system identifier missing from schema; AC-EMR-003 unimplemented
**Severity:** P1  
**Confidence:** HIGH  
**Check type:** Data shapes  
**Spec source:** API_CONTRACTS.md (source_system required field), MODULE_SPEC.md §11 AC-EMR-003, §7 Data Requirements  
**File:** `repos/emr.schema.ts` lines 31–168  
**Description:** AC-EMR-003 states: "Import requires source_system identifier → 422 if absent." The spec's import endpoint requires `source_system` (enum: `hl7_fhir`, `cda`, `pdf`, `csv`, `other`) as a required field. The schema has no `source_system` column. No import handler validates its presence. The error code `UNSUPPORTED_SOURCE_SYSTEM(422)` from the API contracts is never thrown anywhere in the module.

---

#### EF-EMR-006 — P1 | DB FK cross-module hard coupling violates loose-coupling mandate
**Severity:** P1  
**Confidence:** HIGH  
**Check type:** Import boundaries  
**Spec source:** MODULE_SPEC.md §AI Instructions item 1, §7b Aggregate Boundaries  
**File:** `repos/emr.schema.ts` lines 37–43  
**Description:** MODULE_SPEC.md §AI Instructions item 1: "No DB FKs to other modules — UUID refs only (loose coupling)." §7b states: "References Patient by UUID (loose coupling — no DB FK to dental_patient table)." The schema has hard DB-level cascade-delete foreign keys: `patient: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' })` and `provider: uuid('provider_id').notNull().references(() => providers.id, { onDelete: 'cascade' })`. Both violate the explicit loose-coupling mandate.

---

#### EF-EMR-007 — P1 | Role model uses generic platform roles instead of dental membership roles
**Severity:** P1  
**Confidence:** HIGH  
**Check type:** Domain terms / Data shapes  
**Spec source:** MODULE_SPEC.md §6 Permissions, ROLE_PERMISSION_MATRIX.md  
**Files:** `createConsultation.ts` line 21 (comment: `role ["provider"]`), `listConsultations.ts` lines 62–65, `getConsultation.ts` line 17 (`role ["admin", "provider:owner", "patient:owner"]`), `listEMRPatients.ts` line 63  
**Description:** MODULE_SPEC.md §6 defines permissions using dental roles: `dentist_owner`, `dentist_associate` (import + view), `staff_full` (view only). The implementation checks for generic platform roles `provider`, `admin`, `patient` (e.g. listConsultations.ts lines 62–65). These role identifiers are completely different from the spec-defined dental membership roles in ROLE_PERMISSION_MATRIX.md.

---

#### EF-EMR-008 — P1 | WF-100/WF-101 not referenced anywhere; no import handler exists
**Severity:** P1  
**Confidence:** MEDIUM  
**Check type:** Workflow annotation traceability  
**Spec source:** MODULE_SPEC.md §3 Workflows, WORKFLOW_MAP.md line 515  
**Files:** All handler files  
**Description:** MODULE_SPEC.md §3 defines WF-100 (Import external patient record from file) and WF-101 (View imported EMR records alongside native dental records). No handler implements either workflow. No `// WF-100` or `// WF-101` annotations exist in any file. WF-100 (import) has no corresponding handler at all. The spec's workflows are entirely absent from the implementation.

---

### P2 Findings

#### EF-EMR-009 — P2 | Directory slug `emr/` should follow dental-module naming convention
**Severity:** P2  
**Confidence:** HIGH  
**Check type:** Naming conventions  
**Spec source:** MODULE_SPEC.md, MODULE_MAP.md M9  
**File:** `services/api-ts/src/handlers/emr/` (directory)  
**Description:** All dental handler directories use the `dental-{feature}` prefix: `dental-audit/`, `dental-billing/`, `dental-clinical/`, `dental-imaging/`, `dental-org/`, `dental-patient/`, `dental-perio/`, `dental-pmd/`, `dental-scheduling/`, `dental-visit/`. The `emr/` directory is the sole exception. MODULE_MAP.md M9 maps this module to the slug `dental-emr-integration`. The directory naming inconsistency breaks module discoverability.

---

#### EF-EMR-010 — P2 | Generic `new Error()` throws in repo instead of typed error classes
**Severity:** P2  
**Confidence:** HIGH  
**Check type:** Error taxonomy  
**Spec source:** API_CONTRACTS.md error definitions  
**File:** `repos/emr.repo.ts` lines 273, 322, 549  
**Description:** Three locations throw generic `new Error(...)` instead of typed error classes:
- Line 273: `throw new Error(\`Consultation note ${noteId} not found\`)` — should be `NotFoundError`
- Line 322: `throw new Error(\`Invalid status transition...\`)` — should be `BusinessLogicError`  
- Line 549: `throw new Error(\`Consultation with context '${consultationData.context}' already exists\`)` — should be `ConflictError`

Generic `Error()` throws produce 500 status codes instead of the correct 404/422/409, bypassing the error taxonomy.

---

#### EF-EMR-011 — P2 | tenantId nullable with no branch isolation; branch_id absent from schema
**Severity:** P2  
**Confidence:** MEDIUM  
**Check type:** Domain terms / Data shapes  
**Spec source:** API_CONTRACTS.md (branch_id required in request and response)  
**File:** `repos/emr.schema.ts` lines 44–50  
**Description:** The spec's `POST /dental/emr/import` requires `branch_id` as a required request field and includes it in all response shapes. The implementation has `tenantId: varchar('tenant_id', { length: 255 })` as nullable with no NOT NULL constraint, and no `branch_id` column at all. The inline comment acknowledges this is by design for the cadence architecture, but for the dental-emr spec, `branch_id` is a mandatory data field.

---

#### EF-EMR-012 — P2 | externalDocumentation field not in MODULE_SPEC data model
**Severity:** P2  
**Confidence:** MEDIUM  
**Check type:** Data shapes  
**Spec source:** MODULE_SPEC.md §7 Data Requirements  
**File:** `repos/emr.schema.ts` line 107, `repos/emr.repo.ts` line 627  
**Description:** The schema exposes `externalDocumentation: jsonb('external_documentation')` as an updatable field in `UpdateConsultationRequest`. MODULE_SPEC §7 data requirements list: `id`, `patient_id`, `branch_id`, `source_system`, `import_date`, `content (JSONB)`, `imported_by_member_id`, `format_version`. `externalDocumentation` does not map to any specified field name.

---

### P3 Findings

#### EF-EMR-013 — P3 | emr-coverage.test.ts uses buildTestApp — misses real route registration bugs
**Severity:** P3  
**Confidence:** MEDIUM  
**Check type:** Domain terms (test adequacy advisory)  
**Spec source:** MODULE_SPEC.md §11 Acceptance Criteria  
**File:** `emr-coverage.test.ts` lines 98–150  
**Description:** Per project feedback (MEMORY: feedback_test_verification.md): "Handler unit tests with buildTestApp() don't catch route registration bugs; must hit real server." The coverage test builds a local Hono app rather than using the real application's registered routes. AC-EMR-001 through AC-EMR-003 cannot be verified by this test approach since actual route registration (including `405` for PATCH/DELETE) is not exercised.

---

#### EF-EMR-014 — P3 | No index.ts barrel export in handler directory
**Severity:** P3  
**Confidence:** HIGH  
**Check type:** Naming conventions  
**Spec source:** Module structural pattern (all other dental handler directories have index.ts)  
**File:** `services/api-ts/src/handlers/emr/` (directory)  
**Description:** The `emr/` directory has no `index.ts` barrel export. All other dental handler directories have an `index.ts` that re-exports handlers. This inconsistency was noted as a finding and fixed for `dental-pmd` (EF-PMD-008) but not applied to this directory.

---

## File Compliance Scores

| File | Checks Applied | Passed | Score | Notes |
|------|---------------|--------|-------|-------|
| `createConsultation.ts` | 6 | 2 | 33% | P1: wrong endpoint, wrong roles, future-phase violation |
| `listConsultations.ts` | 6 | 2 | 33% | P1: wrong endpoint, wrong roles |
| `getConsultation.ts` | 6 | 2 | 33% | P1: wrong endpoint, wrong roles |
| `updateConsultation.ts` | 6 | 1 | 17% | P1: violates AC-EMR-001, wrong endpoint, mutable update |
| `finalizeConsultation.ts` | 6 | 2 | 33% | P1: wrong endpoint, finalize not in spec |
| `listEMRPatients.ts` | 6 | 2 | 33% | P1: wrong endpoint, wrong roles |
| `repos/emr.schema.ts` | 6 | 1 | 17% | P1: wrong entity, FK coupling violation, missing branch_id |
| `repos/emr.repo.ts` | 6 | 2 | 33% | P1: FK violation; P2: generic Error throws |
| `emr.handlers.test.ts` | 6 | 4 | 67% | Tests correct but cover wrong implementation |
| `emr-coverage.test.ts` | 6 | 4 | 67% | P3: buildTestApp advisory |
| `repos/emr.repo.test.ts` | 6 | 5 | 83% | Solid repo tests |
| `consultation-note.fsm.property.test.ts` | 6 | 5 | 83% | Well-structured FSM property tests |

---

## Module Traceability Score

**Files with 0 P0/P1 findings:** 4 (test files only)  
**Total files:** 12  
**Module traceability score:** 4/12 = **33%**

---

## Summary Table

| ID | Severity | Confidence | Title |
|----|----------|------------|-------|
| EF-EMR-001 | P1 | HIGH | Handler directory exists for a FUTURE PHASE module |
| EF-EMR-002 | P1 | HIGH | All implemented endpoints absent from spec; all spec endpoints unimplemented |
| EF-EMR-003 | P1 | HIGH | Domain entity mismatch — ConsultationNote vs EMRRecord |
| EF-EMR-004 | P1 | HIGH | AC-EMR-001 violated — PATCH implemented as mutable update instead of 405 |
| EF-EMR-005 | P1 | HIGH | source_system field missing; AC-EMR-003 unimplemented |
| EF-EMR-006 | P1 | HIGH | DB FK cross-module coupling violates loose-coupling mandate |
| EF-EMR-007 | P1 | HIGH | Role model uses generic platform roles instead of dental membership roles |
| EF-EMR-008 | P1 | MEDIUM | WF-100/WF-101 not referenced; no import handler exists |
| EF-EMR-009 | P2 | HIGH | Directory slug `emr/` missing dental-module naming convention |
| EF-EMR-010 | P2 | HIGH | Generic `new Error()` throws in repo instead of typed error classes |
| EF-EMR-011 | P2 | MEDIUM | tenantId nullable, branch_id absent from schema |
| EF-EMR-012 | P2 | MEDIUM | externalDocumentation field not in MODULE_SPEC data model |
| EF-EMR-013 | P3 | MEDIUM | buildTestApp pattern misses real route registration bugs |
| EF-EMR-014 | P3 | HIGH | No index.ts barrel export |

**Total: 14 findings (P0=0, P1=8, P2=4, P3=2)**

---

## Review Required (LOW-confidence findings)

None.

---

## Root Cause Assessment

The `emr/` handler directory implements a **general-purpose medical consultation note system** that appears to come from the base `monobase` platform or an adjacent project, added to this codebase without reference to the `dental-emr-integration` MODULE_SPEC. The spec was explicitly marked as a future phase module with no handler to be created. The implementation addresses a different problem domain (general consultation notes, not dental EMR import portability), uses platform-level role abstractions rather than dental-domain roles, and violates the explicit AI Instructions in MODULE_SPEC.md.

---

## What's Next

**P1 findings require resolution before merge.** Recommended decision point:

1. **If the consultation note system is intentional**: Create a new MODULE_SPEC for a `consultation` module under a different module slug. Rename directory, fix FK violations, fix role checks, add error taxonomy, add barrel export.

2. **If it is a premature dental-emr-integration implementation**: Remove the `emr/` handler directory. The dental-emr-integration spec correctly gates implementation to Phase 3+.

Run `/oli-enforce-all` for cross-module view after resolution.
