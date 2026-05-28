<!-- oli-enforce-module v1.0 | run: run-6-strict-2026-05-29 | FUTURE_PHASE -->

# dental-emr-integration — Module Enforcement

**Audit Date:** 2026-05-29
**Run ID:** run-6-strict-2026-05-29
**Auditor:** oli-enforce-module v1.0 --strict
**Module Spec:** `docs/product/modules/dental-emr-integration/MODULE_SPEC.md`
**API Contracts:** `docs/product/modules/dental-emr-integration/API_CONTRACTS.md`
**Implementation Status:** FUTURE_PHASE — handler directory unexpectedly EXISTS; wrong-domain implementation present
**Prior Run:** run-5-f2-service-layer-di (2026-05-28) — P0:2, P1:7, P2:3, score:22

---

## Summary

- **Status:** FUTURE_PHASE
- **Findings:** 13 (P0: 3, P1: 7, P2: 3)
- **New findings (run-6):** 1 (EM-EMR-014 — consultation notes tests exist but are scoped to wrong module)
- **Resolved findings:** 0
- **Service-Layer Pattern (F2):** ABSENT — inline `new Repository(db, logger)` in all 6 handlers; no DI; no service wrapper
- **Compliance Score:** 20/100 (P0 count increased from 2→3; exempted from gate — FUTURE_PHASE)

---

## Executive Summary

The `dental-emr-integration` module (external EMR/EHR import bridge: Open Dental, Dentrix, Eaglesoft, HL7/FHIR) is **NOT IMPLEMENTED**. This is expected per `implementation_status: future_phase (Phase 3+)`.

The **critical identity collision** first flagged in run-5 **remains unresolved**. A live handler directory `services/api-ts/src/handlers/emr/` implements a **consultation notes system** (SOAP notes, provider-scoped visit documentation) — a wholly different domain from the dental-emr-integration spec. This run-6 strict pass elevates the collision to **3 P0 findings** because a previously P1-classified wrong-domain implementation finding is reclassified P0 on strict mode (see EM-EMR-002).

No commits touching `handlers/emr/` or `docs/product/modules/dental-emr-integration/` have occurred since run-5. All run-5 findings are **KNOWN-OPEN**.

**V1 Readiness:** RED — module not implemented (expected); spec has unresolved P0 contradictions; identity collision with unrelated `emr/` module blocks safe Phase 3+ execution.

---

## §1 Identity Collision — CRITICAL FINDING (KNOWN-OPEN, run-5)

| ID | Item | Finding | Priority | Status |
|----|------|---------|----------|--------|
| EM-EMR-001 | Handler dir `services/api-ts/src/handlers/emr/` | EXISTS but implements consultation notes (SOAP/visit documentation), NOT the dental-emr-integration spec (file import bridge) | **P0** | KNOWN-OPEN |
| EM-EMR-002 | Wrong-domain implementation in live app | `handlers/emr/` violates MODULE_SPEC §20 AI Instruction #3: "Do not implement handler files until explicitly scheduled." 12 files exist; 6 route handlers + 3 test files + 1 repo + 1 schema + 1 FSM test. App registration status unverifiable (no grep match in `src/index.ts` or `src/app.ts`). | **P0** | KNOWN-OPEN (was P1 in run-5; **upgraded P0 in run-6-strict**) |
| EM-EMR-003 | Module name overlap | `emr/` handler implements `consultation_note` table + providers/patients model. Future dental-emr-integration handler at `handlers/dental-emr/` will create router collision under `/emr/` prefix unless `emr/` is renamed first. Must rename to `consultation-notes/` or `dental-consultation/` before Phase 3+. | **P0** | KNOWN-OPEN |

**Run-6 note on EM-EMR-002 upgrade:** In strict mode, any implementation that violates a spec's explicit AI instruction prohibition is P0 regardless of registration status. The prior P1 classification was insufficiently strict.

**`handlers/emr/` file inventory (12 files, wrong domain):**
```
createConsultation.ts        — SOAP note creation
finalizeConsultation.ts      — finalize consultation lifecycle
getConsultation.ts           — single consultation fetch
listConsultations.ts         — list consultations for a patient
listEMRPatients.ts           — list patients with consultations
updateConsultation.ts        — update draft consultation
repos/emr.repo.ts            — ConsultationNoteRepository (wrong class name)
repos/emr.schema.ts          — consultation_note table schema
repos/emr.repo.test.ts       — repo unit tests
emr.handlers.test.ts         — handler integration tests
emr-coverage.test.ts         — coverage test scaffold
consultation-note.fsm.property.test.ts  — FSM property tests
```

**Live routes (from OpenAPI):** `/emr/consultations`, `/emr/consultations/{consultation}`, `/emr/consultations/{consultation}/finalize`, `/emr/patients`

---

## §2 Spec Completeness Audit

### 2.1 Required Sections vs Present

| Section | Required | Present | Status | Priority |
|---------|---------|---------|--------|----------|
| §1 Module Overview | YES | YES | PRESENT | — |
| §2 Domain Terms | YES | YES (3 terms) | PARTIAL — missing `format_version`, `imported_by_member_id` | P2 |
| §3 Workflows | YES | YES (WF-100, WF-101) | PRESENT (minimal) | — |
| §4 Integration Points | YES | MISSING | MISSING | P1 |
| §5 Business Rules | YES | YES (partial) | PARTIAL | P1 |
| §6 Permissions | YES | YES (terse) | PRESENT | P2 |
| §7 Data Requirements | YES | YES | PRESENT | — |
| §7b Aggregate Boundaries | YES | YES | PRESENT | — |
| §8 State Transitions | YES | YES (terminal-only) | PRESENT | — |
| **§9 UI/UX Expectations** | YES | **MISSING** | **MISSING** | **P1** |
| §10 API Expectations | YES | YES (terse) | PRESENT | — |
| **§10b Domain Events** | YES | **MISSING** | **MISSING** | **P1** |
| §11 Acceptance Criteria | YES | YES (3 ACs) | PARTIAL — only 3 of ~9 required | P1 |
| §12 Open Questions | YES | MISSING | MISSING | P2 |
| §13 Error Taxonomy | YES | MISSING from spec (in API_CONTRACTS only) | MISSING | P2 |
| §14 Dependencies | YES | YES | PRESENT | — |
| §15 Migration Notes | YES | MISSING | MISSING | P2 |
| §16 Performance Expectations | YES | YES | PRESENT | — |
| §17 Security Considerations | YES | MISSING | MISSING | P1 |
| §18 Compliance/HIPAA | YES | MISSING | MISSING | P1 |
| §19 Vertical Slice Plan | YES | YES | PRESENT | — |
| §20 AI Instructions | YES | YES | PRESENT | — |

**Spec version:** 1.1 | **Last updated:** 2026-05-25 | **implementation_status:** `future_phase (Phase 3+)`

### 2.2 Missing §9 UI/UX (KNOWN-OPEN, P1)

MODULE_SPEC has no §9 UI/UX section. For an import bridge this must define: import dialog flow, progress states, read-only record viewer, error display for IMPORT_PARSE_ERROR, and file picker size constraints (10MB limit mentioned in business rules but not in UI).

### 2.3 Missing §10b Events (KNOWN-OPEN, P1)

No domain events section in MODULE_SPEC. `EMRImported@1` event is needed (dental-audit subscribes to ALL module events per EVENT_CONTRACTS.md §4). Without this, import audit trails are broken by design.

---

## §3 API Contract Compliance Audit

### 3.1 Endpoint Coverage

| Endpoint | Specced | Implemented | Gap |
|---------|---------|-------------|-----|
| `POST /api/v1/dental/emr/import` | YES | NO | MISSING (expected — future phase) |
| `GET /api/v1/dental/emr/:patientId` | YES | NO | MISSING (expected) |
| `GET /api/v1/dental/emr/:id` | YES | NO | MISSING (expected) |
| `dental-emr-integration` handler dir | EXPECTED at `handlers/dental-emr/` | NO | MISSING (expected) |

### 3.2 API Contract Defects (spec-level bugs)

| ID | Location | Issue | Priority | Status |
|----|---------|-------|----------|--------|
| EM-EMR-API-D1 | `GET /dental/emr/:patientId` vs `GET /dental/emr/:id` | **Route collision**: router cannot distinguish `:patientId` from `:id`. One must be `/dental/emr/patient/:patientId` or `/dental/emr/records/:id`. | **P0** | KNOWN-OPEN |
| EM-EMR-API-D2 | `POST /dental/emr/import` `source_system` enum | Enum values are `hl7_fhir, cda, pdf, csv, other`. MODULE_SPEC §1 names `open-dental`, `dentrix`, `eaglesoft` as import sources — none in enum. | P1 | KNOWN-OPEN |
| EM-EMR-API-D3 | `POST /dental/emr/import` response | Has `file_url` (presigned, 24h TTL) but no `expires_at`. Detail endpoint GET /:id has `expires_at`. Inconsistency. | P2 | KNOWN-OPEN |
| EM-EMR-API-D4 | `branch_id` consistency | Required on list endpoint; absent from import + detail. Inconsistent with `assertBranchAccess` dependency in §14. | P1 | KNOWN-OPEN |
| EM-EMR-API-D5 | PATCH/DELETE → 405 | Contract says "Returns 405 EMR_IMMUTABLE" but does not specify whether routes must be registered or merely absent. AC-EMR-001 implies route registration required. | P1 | KNOWN-OPEN |
| EM-EMR-API-D6 | Error code naming | `EMR_NOT_FOUND(404)` on detail vs `NOT_FOUND(404)` on list. Should be consistent. | P2 | KNOWN-OPEN |

---

## §4 Permission/Role Compliance Audit

### 4.1 Spec §6 vs ROLE_PERMISSION_MATRIX.md

MODULE_SPEC §6 defines:
- `dentist_owner`: import + view
- `dentist_associate`: import + view
- `staff_full`: view only

**ROLE_PERMISSION_MATRIX.md has no `dental-emr-integration` entries.** (Confirmed: grep returns no matches.)

| Gap | Priority |
|-----|----------|
| Permissions not added to ROLE_PERMISSION_MATRIX.md | P1 |

### 4.2 Delete Permission Contradiction (KNOWN-OPEN, P0 → captured in G-EMR-02)

§6 grants `delete` to `dentist_owner`. AC-EMR-001 states "PATCH/DELETE → 405 EMR_IMMUTABLE". These are directly contradictory. One must be removed before implementation.

### 4.3 Branch Access Not Enforced in Spec (KNOWN-OPEN, P1)

§14 declares `dental-org (assertBranchAccess)` dependency, but §6 Permissions, §5 Business Rules, and §11 Acceptance Criteria have no branch isolation clause. Cross-branch data access is a HIPAA isolation requirement — this invariant is unspecified.

---

## §5 Business Rule Completeness

| ID | Business Rule | Specced | Status |
|----|--------------|---------|--------|
| BR-EMR-001 | Imported records are read-only (no PATCH/DELETE) | YES (§5, AC-EMR-001) | Conflicts with §6 delete permission |
| BR-EMR-002 | source_system required for audit trail | YES (§5) | Missing from AC |
| BR-EMR-003 | File size limit (10MB implied) | Not explicit in §5 | MISSING from BR section |
| BR-EMR-004 | Duplicate import behavior (same file+source+patient) | Not defined | MISSING |
| **BR-EMR-005** | **Branch isolation: provider in Branch A cannot access Branch B patient records** | **Not in §5** | **MISSING — HIPAA** |
| BR-EMR-006 | Presigned URL refresh policy | Not defined | MISSING |

---

## §6 Acceptance Criteria Gap Analysis

| AC | Text | Testable? | Gap |
|----|------|-----------|-----|
| AC-EMR-001 | PATCH/DELETE → 405 | YES | Contradicts §6 delete permission for dentist_owner |
| AC-EMR-002 | Import creates read-only record; editable records unchanged | YES | No cross-module assertion spec'd |
| AC-EMR-003 | source_system absent → 422 | YES | No test exists |
| MISSING | Invalid format → IMPORT_PARSE_ERROR(422) | YES | API_CONTRACTS defines this; no AC |
| MISSING | Unauthorized role → 403 | YES | No permission AC |
| MISSING | Cross-branch access → 403 | YES | No branch isolation AC |
| MISSING | File > 10MB → rejection | YES | No file size AC |
| MISSING | UNSUPPORTED_SOURCE_SYSTEM → 422 | YES | API_CONTRACTS defines; no AC |

Only 3 of ~9 required ACs present.

---

## §7 Event Contract Compliance

No domain events defined for this module. `EVENT_CONTRACTS.md` (DE-001..DE-024) has no `EMRImported` event. `dental-audit` subscribes to ALL module events — audit coverage for EMR imports is broken by design until `EMRImported@1` is defined.

Required event:
- `EMRImported@1` — trigger: `POST /dental/emr/import` success; consumers: `dental-audit`

---

## §8 Domain Model Compliance

MODULE_SPEC §7 tables:
- `emr_record` — id, patient_id, source_system, format_version, content (JSONB), file_url, imported_at, imported_by_member_id, branch_id

**Gaps:**
| Field | In Spec §7 | In API Response | Gap |
|-------|-----------|-----------------|-----|
| `imported_by_member_id` | YES | NO | MISSING from API response (audit trail gap) |
| `content (JSONB)` | YES | NO | Intent undocumented — internal only or filterable? |
| `import_date` (spec) vs `imported_at` (contract) | Inconsistent naming | — | Rename to align |

No `emr_record` schema file exists at `handlers/emr/repos/emr.schema.ts` — that file defines `consultation_note`, confirming the identity collision.

---

## §9 Test Coverage

| Test Type | Required | Present (dental-emr-integration) | Status |
|-----------|---------|----------------------------------|--------|
| Unit tests (emr_record business rules) | YES | NONE | MISSING |
| Integration tests (import/view routes) | YES | NONE | MISSING |
| Permission tests (role-based deny) | YES | NONE | MISSING |
| Branch isolation tests | YES | NONE | MISSING |
| Immutability tests (405 response) | YES | NONE | MISSING |
| E2E tests | YES | NONE | MISSING |

**Note (NEW finding EM-EMR-014):** Test files at `handlers/emr/` (`emr.handlers.test.ts`, `emr.repo.test.ts`, `consultation-note.fsm.property.test.ts`, `emr-coverage.test.ts`) cover the consultation notes system — NOT dental-emr-integration. These tests are valid for their own module but are misleadingly namespaced under `emr/` and will require renaming as part of the namespace resolution (G-EMR-03).

All dental-emr-integration test coverage is MISSING (expected for FUTURE_PHASE). Tests must be written before implementation per VERTICAL_TDD.md.

---

## §10 Seed Data

No seed data for `emr_record` table. Confirmed: no `emr` or `emr_record` entries in seed scripts. Expected for FUTURE_PHASE.

---

## §11 F2: Service-Layer / DI Assessment (KNOWN-OPEN, run-5)

**Pattern: ABSENT in `handlers/emr/` (consultation notes — wrong module)**

All 6 handlers instantiate repos inline on every request:
```typescript
// createConsultation.ts:36-38 (representative)
const consultationRepo = new ConsultationNoteRepository(db, logger);
const providerRepo = new ProviderRepository(db, logger);
const patientRepo = new PatientRepository(db, logger);
```

Same pattern in: `listEMRPatients.ts`, `getConsultation.ts`, `listConsultations.ts`, `updateConsultation.ts`, `finalizeConsultation.ts`.

Repo export: `export const consultationNoteRepo = ConsultationNoteRepository` — exports class, not instance.

| Layer | Status |
|-------|--------|
| Repository | Inline `new` on every request — no injection |
| Service | None — no service wrapper class |
| Context injection | `ctx.get('database')` only; repos not injected |
| Test isolation | Requires real DB; cannot stub repo methods |

**Note:** F2 findings apply to the consultation notes module (wrong domain). The correct dental-emr-integration module will need a `emr.service.ts` wrapping `EmrRecordRepository` with singleton registration at app startup.

| ID | Sev | Description | File |
|----|-----|-------------|------|
| EM-EMR-F2-001 | P3 | Inline repo instantiation in all 6 handlers; no DI, no service layer, no singleton export | `handlers/emr/createConsultation.ts` (×6) |

---

## §12 Prioritized Gap Register

| ID | Gap | Priority | Blocking? | Status |
|----|-----|----------|-----------|--------|
| G-EMR-01 | Route collision: `GET /dental/emr/:patientId` vs `GET /dental/emr/:id` | **P0** | YES | KNOWN-OPEN |
| G-EMR-02 | Spec contradiction: §6 grants delete to dentist_owner; AC-EMR-001 blocks all DELETE → 405 | **P0** | YES | KNOWN-OPEN |
| G-EMR-03 | `emr/` handler (consultation notes) name-collides with future dental-emr-integration; must rename before Phase 3+ | **P0** | YES | KNOWN-OPEN |
| G-EMR-04 | `EMRImported@1` domain event not defined in EVENT_CONTRACTS.md | **P1** | YES — audit trail | KNOWN-OPEN |
| G-EMR-05 | §9 UI/UX section missing from MODULE_SPEC | **P1** | YES | KNOWN-OPEN |
| G-EMR-06 | §10b events section missing from MODULE_SPEC | **P1** | YES | KNOWN-OPEN |
| G-EMR-07 | Branch isolation business rule not explicit in spec (BR-EMR-005) | **P1** | YES — HIPAA | KNOWN-OPEN |
| G-EMR-08 | `imported_by_member_id` not surfaced in API response (audit trail gap) | **P1** | YES | KNOWN-OPEN |
| G-EMR-09 | Permissions not added to ROLE_PERMISSION_MATRIX.md | **P1** | Before impl | KNOWN-OPEN |
| G-EMR-10 | `source_system` enum missing `open-dental`, `dentrix`, `eaglesoft` | **P1** | Feature gap | KNOWN-OPEN |
| G-EMR-11 | `branch_id` consistency: required on list but not on import/detail | **P1** | API design | KNOWN-OPEN |
| G-EMR-12 | Field mismatch: spec says `import_date`, contract says `imported_at` | P2 | Rename | KNOWN-OPEN |
| G-EMR-13 | `content (JSONB)` field in spec §7, absent from all API responses — intent undocumented | P2 | Clarify | KNOWN-OPEN |
| G-EMR-14 | `handlers/emr/` test files misleadingly named (cover consultation notes, not dental-emr-integration); must rename with G-EMR-03 | P2 | — | **NEW** |
| G-EMR-15 | Import duplicate behavior (same file+source+patient) not defined | P2 | — | KNOWN-OPEN |
| G-EMR-16 | Presigned URL refresh policy not documented | P2 | — | KNOWN-OPEN |
| G-EMR-17 | §12/§13/§15/§17/§18 missing (open questions, error taxonomy, migration, security, compliance) | P2 | — | KNOWN-OPEN |
| G-EMR-18 | UNSUPPORTED_SOURCE_SYSTEM and IMPORT_PARSE_ERROR in contract but no AC/test mapping | P2 | — | KNOWN-OPEN |

---

## §13 V1 Readiness Rating

**RED** — Module not implemented (expected per FUTURE_PHASE). Three P0 blockers must be resolved before Phase 3+ scheduling:

1. **G-EMR-01**: Fix route collision in API_CONTRACTS
2. **G-EMR-02**: Resolve delete permission contradiction in MODULE_SPEC
3. **G-EMR-03**: Rename `handlers/emr/` to `handlers/consultation-notes/` (or `dental-consultation/`) before dental-emr-integration handler creation

Until G-EMR-03 is resolved, any attempt to scaffold the dental-emr-integration handler risks overwriting or colliding with the live consultation notes system.

---

## Findings Delta (run-5 → run-6)

| Change | Count | IDs |
|--------|-------|-----|
| New findings | 1 | G-EMR-14 / EM-EMR-014 |
| Resolved findings | 0 | — |
| Severity upgrades | 1 | EM-EMR-002: P1→P0 (strict mode reclassification) |
| Score change | −2 | 22→20 (P0 count 2→3 applies stricter cap) |
