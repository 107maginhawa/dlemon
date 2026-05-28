<!-- oli-version: 1.1 -->
<!-- based-on: docs/product/modules/dental-emr-integration/MODULE_SPEC.md, docs/product/modules/dental-emr-integration/API_CONTRACTS.md -->
<!-- generated: 2026-05-27 -->

# File-Level Enforcement Report: dental-emr-integration

**Generated:** 2026-05-27
**Module:** dental-emr-integration
**Implementation Status:** NOT IMPLEMENTED (Future Phase 3+)
**Source Directories Checked:**
  - Backend: `services/api-ts/src/handlers/dental-emr-integration/` — **DOES NOT EXIST**
  - Frontend: `apps/dentalemon/src/` — no emr-integration routes or components found
**Spec:** `docs/product/modules/dental-emr-integration/MODULE_SPEC.md`
**Contracts:** `docs/product/modules/dental-emr-integration/API_CONTRACTS.md`

---

## Compliance Summary

| | |
|-|-|
| **Overall Score** | **0.0/10** |
| **Compliance Label** | **NOT IMPLEMENTED** |
| **Total Findings** | 12 (P0: 3, P1: 6, P2: 3) |
| **Blocking Issues** | 9 (3 P0 + 6 P1) |
| **Score Cap Applied** | P0 cap (score floored at 0) |

---

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | Status |
|-----------|-------|----|----|----|----|
| Handler Directory Existence | 0.0/10 | 1 | 0 | 0 | MISSING |
| Schema / Repo Files | 0.0/10 | 1 | 0 | 0 | MISSING |
| Public API Endpoints | 0.0/10 | 1 | 0 | 0 | MISSING |
| Route Registration | 0.0/10 | 0 | 2 | 0 | MISSING |
| Auth / Permission Enforcement | 0.0/10 | 0 | 2 | 0 | MISSING |
| Business Rules (Immutability) | 0.0/10 | 0 | 2 | 0 | MISSING |
| Test Coverage | 0.0/10 | 0 | 0 | 3 | MISSING |

---

## Critical Note: Name Collision with `emr` Handler

A directory `services/api-ts/src/handlers/emr/` **does exist** but implements a **different domain**: it is a general consultation-notes module (draft/finalized/amended lifecycle, vitals, prescriptions, provider-patient relationships). This is the upstream Monobase EMR primitive — it is **NOT** the `dental-emr-integration` module.

The `dental-emr-integration` module's purpose (external practice data import from Open Dental, Dentrix, Eaglesoft, HL7/FHIR sources into read-only patient cabinet records) has **zero implementation** anywhere in the codebase.

---

## Findings

### P0 — Critical (Blocking — No Code Ships Without These)

| ID | Finding | Expected Path | Status |
|----|---------|--------------|--------|
| FE-DEMR-001 | Handler directory missing. `services/api-ts/src/handlers/dental-emr-integration/` does not exist. All handler files, validators, and route registration are absent. | `services/api-ts/src/handlers/dental-emr-integration/` | MISSING |
| FE-DEMR-002 | Schema file missing. No `emr_record` table defined anywhere. MODULE_SPEC §7 requires: `id`, `patient_id` (UUID loose-ref), `branch_id`, `source_system`, `import_date`, `content` (JSONB), `imported_by_member_id`, `format_version`. | `services/api-ts/src/handlers/dental-emr-integration/repos/emr-record.schema.ts` | MISSING |
| FE-DEMR-003 | Repository file missing. No `EmrRecordRepository` or equivalent. Zero database operations exist for this domain. | `services/api-ts/src/handlers/dental-emr-integration/repos/emr-record.repo.ts` | MISSING |

---

### P1 — Major (Fix Before New Work)

| ID | Finding | Expected Path | Status |
|----|---------|--------------|--------|
| FE-DEMR-004 | Import handler missing. `POST /api/v1/dental/emr/import` (multipart/form-data) handler required by API_CONTRACTS. Accepts `patient_id`, `branch_id`, `source_system`, `file` (max 10 MB). Returns `201 { data: EMRRecord }`. | `services/api-ts/src/handlers/dental-emr-integration/importEMR.ts` | MISSING |
| FE-DEMR-005 | List handler missing. `GET /api/v1/dental/emr/:patientId` paginated list handler required by API_CONTRACTS. Requires `branch_id` query param. Returns summary objects sorted `imported_at DESC`. | `services/api-ts/src/handlers/dental-emr-integration/listEMRRecords.ts` | MISSING |
| FE-DEMR-006 | Detail handler missing. `GET /api/v1/dental/emr/:id` handler required by API_CONTRACTS. Returns full `EMRRecord` with fresh presigned `file_url` (24h TTL) and `expires_at`. | `services/api-ts/src/handlers/dental-emr-integration/getEMRRecord.ts` | MISSING |
| FE-DEMR-007 | Immutability enforcement missing. AC-EMR-001 requires `PATCH /dental/emr/*` and `DELETE /dental/emr/*` to return `405 EMR_IMMUTABLE`. No route handlers exist to enforce this. | `services/api-ts/src/handlers/dental-emr-integration/` | MISSING |
| FE-DEMR-008 | Auth role guards missing. API_CONTRACTS specifies: import requires `dentist_associate` or `dentist_owner`; list/detail allows `staff_full`, `dentist_associate`, `dentist_owner`; delete (MODULE_SPEC §6) restricted to `dentist_owner`. No auth middleware applied. | `services/api-ts/src/handlers/dental-emr-integration/` | MISSING |
| FE-DEMR-009 | `source_system` validation missing. AC-EMR-003 and API_CONTRACTS require `422 UNSUPPORTED_SOURCE_SYSTEM` when `source_system` absent or not in enum (`hl7_fhir`, `cda`, `pdf`, `csv`, `other`). No validator exists. | `services/api-ts/src/handlers/dental-emr-integration/` | MISSING |

---

### P2 — Minor (Fix Before Phase Complete)

| ID | Finding | Expected Path | Status |
|----|---------|--------------|--------|
| FE-DEMR-010 | Unit tests missing. No test file for import, list, or detail handlers. Vertical TDD protocol requires tests before implementation (VERTICAL_TDD.md). | `services/api-ts/src/handlers/dental-emr-integration/*.test.ts` | MISSING |
| FE-DEMR-011 | Repo tests missing. No test for `EmrRecordRepository`. | `services/api-ts/src/handlers/dental-emr-integration/repos/emr-record.repo.test.ts` | MISSING |
| FE-DEMR-012 | Frontend route missing. No patient cabinet view for imported EMR records. WF-101 (view imported records alongside native dental records) has zero frontend implementation. | `apps/dentalemon/src/routes/_workspace/` or `apps/dentalemon/src/features/` | MISSING |

---

## Expected File Inventory (All MISSING)

```
services/api-ts/src/handlers/dental-emr-integration/
├── repos/
│   ├── emr-record.schema.ts          # P0 — emr_record table, pgEnum source_system
│   ├── emr-record.repo.ts            # P0 — EmrRecordRepository (create, findByPatient, findById)
│   └── emr-record.repo.test.ts       # P2 — repo unit tests
├── importEMR.ts                       # P1 — POST /dental/emr/import handler
├── listEMRRecords.ts                  # P1 — GET /dental/emr/:patientId handler
├── getEMRRecord.ts                    # P1 — GET /dental/emr/:id handler
├── dental-emr-integration.test.ts    # P2 — handler integration tests
└── index.ts                           # P1 — route registration + 405 guards
```

---

## Implementation Notes (for Phase 3 scheduling)

Per MODULE_SPEC §20 AI Instructions:
1. No DB FKs to other modules — `patient_id` is UUID loose-ref (no FK to `dental_patient`).
2. No PATCH/DELETE routes on imported records — enforce `405 EMR_IMMUTABLE` at route level.
3. Do not schedule until `dental-visit`, `dental-clinical`, `dental-pmd` are stable.
4. Follow VERTICAL_TDD.md: write failing tests first (EMR-S1 slice: import + read-only store).

**Name collision risk:** When implementing, use directory `dental-emr-integration/` (not `emr/`) to avoid conflicting with the existing upstream `emr/` consultation-notes module.

---

_Report generated by oli-enforce-file v1.1 | Module: dental-emr-integration | Status: NOT IMPLEMENTED_
