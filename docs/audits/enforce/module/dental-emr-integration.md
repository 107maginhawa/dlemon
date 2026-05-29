<!-- oli-enforce-module v1.1 | run: run-7-2026-05-29 | FUTURE_PHASE -->

# dental-emr-integration — Module Enforcement

**Audit Date:** 2026-05-29
**Run ID:** run-7-2026-05-29
**Auditor:** oli-enforce-module v1.1
**Module Spec:** `docs/product/modules/dental-emr-integration/MODULE_SPEC.md`
**Handler Path:** `services/api-ts/src/handlers/dental-emr-integration/` — DOES NOT EXIST (future phase)
**Shadow Implementation:** `services/api-ts/src/handlers/emr/` — EXISTS (wrong domain; consultation notes)
**Implementation Status:** FUTURE_PHASE — no spec-compliant handler directory; wrong-domain `emr/` handler present
**Prior Run:** run-6-strict-2026-05-29 — P0:3 (EM-EMR-001/002/003), P1:7, P2:3, score:20
**Wave3 Sprint:** Claimed 56 P0 fixes across 9 modules. dental-emr-integration findings were explicitly BLOCKED (see ENFORCEMENT_FIX_REPORT.md §Blocked Findings: "EF-EMR-001 / EM-EMR-001–003 — BLOCKED — architectural rename").

---

## Summary

- **Compliance Score:** 18/100 (down 2 from run-6; new P0 EM-EMR-004 discovered)
- **V1 Status:** NOT_READY (FUTURE_PHASE — expected)
- **Service Layer:** ABSENT (consultation notes `emr/` has inline repo instantiation; no service class)
- **Total Findings:** 14 (P0: 4, P1: 7, P2: 3, P3: 0)
- **New findings (run-7):** 1 (EM-EMR-004 — DB FK constraint violation in wrong-domain schema)
- **Resolved findings:** 0 (all run-6 findings remain OPEN; Wave3 explicitly blocked dental-emr-integration)
- **Run-6 → Run-7 delta:** +1 finding (P0), −2 score points

---

## Executive Summary

The `dental-emr-integration` module (external EMR/EHR import bridge: Open Dental, Dentrix, Eaglesoft, HL7/FHIR) has **no implementation**. This is expected per `implementation_status: future_phase (Phase 3+)`.

Wave3 did **not fix any dental-emr-integration findings.** The ENFORCEMENT_FIX_REPORT.md explicitly classifies all three EM-EMR P0s as BLOCKED pending architectural rename. Wave3 instead made improvements to the wrong-domain `handlers/emr/` consultation notes system (N+1 batch fix, FSM property tests, 39-test coverage suite, finalizedBy FK comment). Those improvements are correct for the consultation notes module but are orthogonal to dental-emr-integration compliance.

Run-7 adds **EM-EMR-004 (P0)**: the `emr.schema.ts` file uses DB-level FK references to `patients` and `providers` tables (lines 38–42), directly violating MODULE_SPEC §20 AI Instruction #1: "No DB FKs to other modules — UUID refs only." This was partially addressed via a loose-coupling comment for `finalizedBy` (commit 5def6c0b) but the primary patient/provider FKs were not fixed.

The three run-6 P0 blockers (route collision, delete permission contradiction, identity collision rename) remain open and continue to block safe Phase 3+ scheduling.

---

## §1 Identity Collision — P0 Findings (ALL OPEN)

### Dimension 1: Public API Completeness

**MODULE_SPEC §10 declares 3 endpoints:**

| Endpoint | Specced | Implemented | Status |
|---------|---------|-------------|--------|
| `POST /dental/emr/import` | YES | NO | MISSING (expected — future phase) |
| `GET /dental/emr/:patientId` | YES | NO | MISSING (expected) |
| `GET /dental/emr/:id` | YES | NO | MISSING (expected) |

**Live routes in `handlers/emr/` (wrong domain — consultation notes):**

| Route | Registered | Domain |
|-------|-----------|--------|
| `POST /emr/consultations` | YES (routes.ts:1441) | Consultation notes — WRONG MODULE |
| `GET /emr/consultations` | YES (routes.ts:1448) | Consultation notes — WRONG MODULE |
| `GET /emr/consultations/:consultation` | YES (routes.ts:1455) | Consultation notes — WRONG MODULE |
| `PATCH /emr/consultations/:consultation` | YES (routes.ts:1462) | Consultation notes — WRONG MODULE |
| `POST /emr/consultations/:consultation/finalize` | YES (routes.ts:1470) | Consultation notes — WRONG MODULE |
| `GET /emr/patients` | YES (routes.ts:1477) | Consultation notes — WRONG MODULE |

**Finding EM-EMR-001 (P0) — KNOWN-OPEN:**

| Field | Value |
|-------|-------|
| **ID** | EM-EMR-001 |
| **Severity** | P0 |
| **Title** | Handler directory `services/api-ts/src/handlers/emr/` implements wrong domain |
| **Description** | `handlers/emr/` implements a consultation notes system (SOAP notes, provider-scoped visit documentation, `consultation_note` table). This is wholly different from the dental-emr-integration spec (external file import bridge, `emr_record` table). All 12 files confirmed present. |
| **Spec Section** | MODULE_SPEC §1, §3, §7, §20 |
| **Files** | `services/api-ts/src/handlers/emr/` (12 files) |
| **Confidence** | HIGH |
| **Status** | KNOWN-OPEN (run-5 → run-6 → run-7) |
| **Wave3 Action** | BLOCKED — architectural rename required |

**Finding EM-EMR-002 (P0) — KNOWN-OPEN:**

| Field | Value |
|-------|-------|
| **ID** | EM-EMR-002 |
| **Severity** | P0 |
| **Title** | Live implementation violates MODULE_SPEC §20 AI Instruction #3 prohibition |
| **Description** | MODULE_SPEC §20 states: "This is a FUTURE PHASE module. Do not implement handler files until explicitly scheduled." The `handlers/emr/` directory contains 12 files including 6 registered route handlers. Wave3 added further files (emr-coverage.test.ts, consultation-note.fsm.property.test.ts, N+1 fix in listEMRPatients.ts, getBatchConsultationStats in emr.repo.ts), deepening the unauthorized implementation. |
| **Spec Section** | MODULE_SPEC §20 AI Instruction #3 |
| **Files** | `services/api-ts/src/handlers/emr/createConsultation.ts`, `finalizeConsultation.ts`, `getConsultation.ts`, `listConsultations.ts`, `listEMRPatients.ts`, `updateConsultation.ts` |
| **Confidence** | HIGH |
| **Status** | KNOWN-OPEN; deepened by Wave3 additions |
| **Wave3 Action** | BLOCKED — architectural rename required |

**Finding EM-EMR-003 (P0) — KNOWN-OPEN:**

| Field | Value |
|-------|-------|
| **ID** | EM-EMR-003 |
| **Severity** | P0 |
| **Title** | Namespace collision blocks Phase 3+ implementation |
| **Description** | The `handlers/emr/` directory + `/emr/consultations` routes occupy the `emr` namespace. The spec-compliant dental-emr-integration handler must be placed at `handlers/dental-emr/` or `handlers/dental-emr-integration/` and serve `/dental/emr/*` routes. Until `handlers/emr/` is renamed (to `handlers/consultation-notes/` or `handlers/dental-consultation/`), any Phase 3+ implementation attempt risks overwriting or routing conflicts with the live consultation notes system. |
| **Spec Section** | MODULE_SPEC §10 API Expectations, MODULE_MAP.md M9 |
| **Files** | `services/api-ts/src/handlers/emr/`, `services/api-ts/src/generated/openapi/routes.ts:1441–1480` |
| **Confidence** | HIGH |
| **Status** | KNOWN-OPEN |
| **Wave3 Action** | BLOCKED — architectural rename required |

**Finding EM-EMR-004 (P0) — NEW in run-7:**

| Field | Value |
|-------|-------|
| **ID** | EM-EMR-004 |
| **Severity** | P0 |
| **Title** | DB-level FK constraints violate MODULE_SPEC §20 AI Instruction #1 |
| **Description** | `emr.schema.ts` lines 36–42 use `.references(() => patients.id, { onDelete: 'cascade' })` and `.references(() => providers.id, { onDelete: 'cascade' })` — hard DB-level FKs from `consultation_note` to the `patient` and `provider` tables of other modules. MODULE_SPEC §20 AI Instruction #1 states: "No DB FKs to other modules — UUID refs only (loose coupling)." The `finalizedBy` field received a loose-coupling comment in commit 5def6c0b but the primary patient/provider FKs remain as cascade-delete DB constraints, creating tight coupling between the wrong-domain `emr/` implementation and the core patient/provider modules. When `handlers/emr/` is eventually renamed, the migration required to drop these FKs will be disruptive. |
| **Spec Section** | MODULE_SPEC §20 AI Instruction #1, §7b Aggregate Boundaries |
| **Files** | `services/api-ts/src/handlers/emr/repos/emr.schema.ts:36–42` |
| **Confidence** | HIGH |
| **Status** | NEW — first identified in run-7 |
| **Wave3 Action** | Not addressed; Wave3 added FK comment only for `finalizedBy` column |

---

## §2 Dimension 2: Workflow Implementation

**MODULE_SPEC §3 declares 2 workflows:**

| Workflow | Assignment | Code Path | Status |
|---------|-----------|-----------|--------|
| WF-100: Import external patient record from file (CSV/HL7/FHIR) | dental-emr-integration (confirmed in WORKFLOW_MAP.md:515) | NONE — `POST /dental/emr/import` not implemented | MISSING (expected) |
| WF-101: View imported EMR records alongside native dental records | dental-emr-integration | NONE — no read-only EMR record viewer | MISSING (expected) |

**Note:** WORKFLOW_MAP.md:516 maps WF-101 to `dental-pmd → dental-patient (BR-022)` for the PMD variant. The dental-emr-integration WF-101 assignment at line 515 (`dental-emr → dental-patient + dental-clinical`) is a distinct workflow.

Both workflows are missing as expected for FUTURE_PHASE. No finding raised (P3 deferred — known future phase).

---

## §3 Dimension 3: Domain Term Consistency

**MODULE_SPEC §2 declares 3 terms:** EMR Record, Import Source, Treatment History.

**Cross-check against `handlers/emr/` source:**

| Domain Term | Spec Definition | Found in emr/ source | Assessment |
|------------|----------------|---------------------|------------|
| EMR Record | External health record imported from third-party PMS; read-only after import | NOT FOUND — `handlers/emr/` uses `ConsultationNote` / `consultation_note` terminology | DRIFT — wrong domain |
| Import Source | External EHR/EMR system identifier (open-dental, dentrix, eaglesoft, hl7-fhir) | NOT FOUND — `handlers/emr/` uses `source_system` only in a comment context; no `import_source` field | MISSING |
| Treatment History | Imported prior treatment records from external system | NOT FOUND | MISSING |

**Finding EM-EMR-005 (P2) — KNOWN-OPEN (was §2 gap in run-6):**

| Field | Value |
|-------|-------|
| **ID** | EM-EMR-005 |
| **Severity** | P2 |
| **Title** | Domain terms from MODULE_SPEC §2 absent from implementation; wrong-domain terms present |
| **Description** | The `handlers/emr/` codebase uses consultation-notes domain vocabulary (`ConsultationNote`, `consultation_note`, `draft/finalized/amended` status, `chiefComplaint`, `assessment`, `plan`, `vitals`, `prescriptions`). None of the three dental-emr-integration domain terms (EMR Record, Import Source, Treatment History) appear anywhere in the handler source. This is coherent with the identity collision but confirms the domain model is entirely misaligned. |
| **Spec Section** | MODULE_SPEC §2 |
| **Files** | `services/api-ts/src/handlers/emr/repos/emr.schema.ts` |
| **Confidence** | HIGH |
| **Status** | KNOWN-OPEN |

---

## §4 Dimension 4: State Machine Enforcement

**MODULE_SPEC §8 declares:** `imported (terminal — read-only, no transitions)`

| State | Specced | Implemented | Status |
|-------|---------|-------------|--------|
| `imported` (terminal) | YES | NO — no `emr_record` state machine | MISSING (expected — future phase) |

**Wrong-domain state machine present in `handlers/emr/`:**
The consultation notes system (`emr.repo.ts:310–325`) implements a `draft → finalized → amended → finalized` FSM with `validateStatusTransition()`. This is coherent for consultation notes but has no relationship to the terminal `imported` state declared in MODULE_SPEC §8.

**Finding EM-EMR-006 (P1) — KNOWN-OPEN:**

| Field | Value |
|-------|-------|
| **ID** | EM-EMR-006 |
| **Severity** | P1 |
| **Title** | Spec-declared terminal `imported` state not implemented; undeclared FSM active in wrong-domain code |
| **Description** | MODULE_SPEC §8 requires a terminal `imported` state with no transitions. No such enforcement exists. The active `emr.repo.ts` FSM (`draft/finalized/amended`) is not declared in any MODULE_SPEC and belongs to the consultation notes module (wrong domain). |
| **Spec Section** | MODULE_SPEC §8 |
| **Files** | `services/api-ts/src/handlers/emr/repos/emr.repo.ts:310–325` |
| **Confidence** | HIGH |
| **Status** | KNOWN-OPEN (expected for future phase) |

---

## §5 Dimension 5: Event Publishing

**MODULE_SPEC §10b:** Not defined (missing section — G-EMR-06).
**EVENT_CONTRACTS.md:** No `EMRImported@1` event defined (confirmed in prior run, unchanged).

| Event | Specced | Emitted | Status |
|-------|---------|---------|--------|
| `EMRImported@1` | NOT IN SPEC (gap — G-EMR-06) | NO | DOUBLE MISSING: not in spec AND not emitted |

No domain events declared or emitted. Expected for FUTURE_PHASE. Becomes P1 once module reaches implementation scheduling.

---

## §6 Dimension 6: Unprotected Route Detection

**Routes discovered in `handlers/emr/` (wrong-domain consultation notes):**

All 6 routes have `authMiddleware({roles:[...]})` registered at the route level in `routes.ts:1441–1480`. No unprotected routes detected.

| Route | Auth Middleware | Roles |
|-------|---------------|-------|
| `POST /emr/consultations` | YES | ["provider"] |
| `GET /emr/consultations` | YES | ["provider","admin","patient"] |
| `GET /emr/consultations/:consultation` | YES | ["admin","provider:owner","patient:owner"] |
| `PATCH /emr/consultations/:consultation` | YES | ["provider:owner"] |
| `POST /emr/consultations/:consultation/finalize` | YES | ["provider:owner"] |
| `GET /emr/patients` | YES | ["provider","admin"] |

**Role vocabulary mismatch (P1):** Routes use generic roles `provider`, `admin`, `patient`. MODULE_SPEC §6 declares dental roles: `dentist_owner`, `dentist_associate`, `staff_full`. These role namespaces are incompatible — the wrong-domain module's role model does not match the spec-declared permissions.

**Finding EM-EMR-007 (P1) — KNOWN-OPEN:**

| Field | Value |
|-------|-------|
| **ID** | EM-EMR-007 |
| **Severity** | P1 |
| **Title** | Route permission roles use wrong-domain vocabulary (provider/admin vs dentist_owner/dentist_associate/staff_full) |
| **Description** | MODULE_SPEC §6 declares import/view for `dentist_owner`, `dentist_associate`; view for `staff_full`; delete for `dentist_owner`. The live `handlers/emr/` routes use `provider`, `admin`, `patient` role tokens — generic platform roles, not dental domain roles. When the spec-compliant implementation is built, it must use the declared dental role tokens and assert `assertBranchAccess` (dependency §14). |
| **Spec Section** | MODULE_SPEC §6, §14 |
| **Files** | `services/api-ts/src/generated/openapi/routes.ts:1441–1480` |
| **Confidence** | HIGH |
| **Status** | KNOWN-OPEN |

---

## §7 API Contract Spec-Level Defects (Unchanged from run-6)

| ID | Location | Issue | Priority | Status |
|----|---------|-------|----------|--------|
| EM-EMR-API-D1 | `GET /dental/emr/:patientId` vs `GET /dental/emr/:id` | Route collision — router cannot distinguish `:patientId` from `:id`. One must be `/dental/emr/patient/:patientId` or `/dental/emr/records/:id`. | **P0** | KNOWN-OPEN (counted as G-EMR-01) |
| EM-EMR-API-D2 | `POST /dental/emr/import` `source_system` enum | Enum values (`hl7_fhir, cda, pdf, csv, other`) do not include `open-dental`, `dentrix`, `eaglesoft` named in MODULE_SPEC §1. | P1 | KNOWN-OPEN |
| EM-EMR-API-D3 | Import response vs detail response | Import response has `file_url` but no `expires_at`; detail has `expires_at`. Inconsistency. | P2 | KNOWN-OPEN |
| EM-EMR-API-D4 | `branch_id` consistency | Required on list endpoint; absent from import + detail. Inconsistent with `assertBranchAccess` dependency in §14. | P1 | KNOWN-OPEN |
| EM-EMR-API-D5 | PATCH/DELETE → 405 | AC-EMR-001 requires 405 EMR_IMMUTABLE, but MODULE_SPEC §6 grants delete to `dentist_owner`. Directly contradictory. | **P0** | KNOWN-OPEN (counted as G-EMR-02) |

---

## §8 Permission/Role Compliance

MODULE_SPEC §6 declares:
- `dentist_owner`: import + view + delete
- `dentist_associate`: import + view
- `staff_full`: view only

**ROLE_PERMISSION_MATRIX.md:** No `dental-emr-integration` entries (confirmed unchanged).

**Contradiction (P0 — G-EMR-02):** §6 grants `delete` to `dentist_owner`. AC-EMR-001 states "PATCH/DELETE → 405 EMR_IMMUTABLE". These are directly contradictory. Counts against compliance score.

**Branch access gap (P1 — G-EMR-07):** §14 declares `dental-org (assertBranchAccess)` dependency, but §6 and §5 have no branch isolation clause. Cross-branch access is a HIPAA requirement — unspecified in the module boundary.

---

## §9 Acceptance Criteria Gap Analysis

| AC | Text | Testable? | Gap |
|----|------|-----------|-----|
| AC-EMR-001 | PATCH/DELETE → 405 | YES | Contradicts §6 delete permission; no test |
| AC-EMR-002 | Import creates read-only record; editable records unchanged | YES | No test |
| AC-EMR-003 | source_system absent → 422 | YES | No test |
| MISSING | Invalid format → IMPORT_PARSE_ERROR(422) | YES | No AC, no test |
| MISSING | Unauthorized role → 403 | YES | No AC, no test |
| MISSING | Cross-branch access → 403 | YES | No AC, no test |
| MISSING | File > 10MB → rejection | YES | No AC, no test |
| MISSING | UNSUPPORTED_SOURCE_SYSTEM → 422 | YES | No AC, no test |

Only 3 of ~9 required ACs present. No test coverage for any AC.

---

## §10 Service Layer / DI Assessment

**Pattern: ABSENT in `handlers/emr/` (wrong-domain consultation notes)**

All 6 handlers instantiate repositories inline on every request:
```typescript
// createConsultation.ts:36-38 (representative pattern)
const consultationRepo = new ConsultationNoteRepository(db, logger);
const providerRepo = new ProviderRepository(db, logger);
const patientRepo = new PatientRepository(db, logger);
```

Same pattern in: `listEMRPatients.ts`, `getConsultation.ts`, `listConsultations.ts`, `updateConsultation.ts`, `finalizeConsultation.ts`.

Repository export: `export const consultationNoteRepo = ConsultationNoteRepository` — exports class reference, not a singleton instance.

No service wrapper class exists. No DI container. No singleton registration at app startup.

| Layer | Status |
|-------|--------|
| Repository | Inline `new` on every request |
| Service | None |
| DI/singleton | None — class export only |
| Test isolation | Requires real DB; cannot stub repo methods |

**Finding EM-EMR-008 (P3) — KNOWN-OPEN:**

| Field | Value |
|-------|-------|
| **ID** | EM-EMR-008 |
| **Severity** | P3 |
| **Title** | Wrong-domain `handlers/emr/` has no service layer, DI, or singleton pattern |
| **Description** | All 6 consultation-note handlers use inline `new Repository(db, logger)` instantiation. No service class wrapping the repo. This is a code quality issue in the wrong-domain implementation that will need fixing if the consultation notes module is properly renamed and given its own spec. |
| **Spec Section** | ARCHITECTURE.md (service layer pattern) |
| **Files** | `services/api-ts/src/handlers/emr/*.ts` (×6) |
| **Confidence** | HIGH |
| **Status** | KNOWN-OPEN (explicitly BLOCKED in ENFORCEMENT_FIX_REPORT.md F2 sprint row) |

---

## §11 Spec Section Completeness

| Section | Required | Present | Status | Gap Priority |
|---------|---------|---------|--------|-------------|
| §1 Module Overview | YES | YES | PRESENT | — |
| §2 Domain Terms | YES | YES (3 terms) | PARTIAL — missing `format_version`, `imported_by_member_id` definitions | P2 |
| §3 Workflows | YES | YES (WF-100, WF-101) | PRESENT | — |
| §4 Integration Points | YES | MISSING | ABSENT | P1 |
| §5 Business Rules | YES | PARTIAL | PARTIAL — missing BR-EMR-003 (file size), BR-EMR-004 (duplicate), BR-EMR-005 (branch isolation) | P1 |
| §6 Permissions | YES | YES (terse) | CONTRADICTION — delete grant vs AC-EMR-001 | P0 (G-EMR-02) |
| §7 Data Requirements | YES | YES | PRESENT | — |
| §7b Aggregate Boundaries | YES | YES | PRESENT | — |
| §8 State Transitions | YES | YES (terminal) | PRESENT | — |
| §9 UI/UX Expectations | YES | ABSENT | MISSING | P1 |
| §10 API Expectations | YES | YES (terse) | PRESENT — route collision defect | P0 (G-EMR-01) |
| §10b Domain Events | YES | ABSENT | MISSING | P1 |
| §11 Acceptance Criteria | YES | PARTIAL (3/9) | PARTIAL | P1 |
| §12 Open Questions | YES | ABSENT | MISSING | P2 |
| §13 Error Taxonomy | YES | ABSENT from spec (in API_CONTRACTS only) | MISSING | P2 |
| §14 Dependencies | YES | YES | PRESENT | — |
| §15 Migration Notes | YES | ABSENT | MISSING | P2 |
| §16 Performance Expectations | YES | YES | PRESENT | — |
| §17 Security Considerations | YES | ABSENT | MISSING | P1 |
| §18 Compliance/HIPAA | YES | ABSENT | MISSING | P1 |
| §19 Vertical Slice Plan | YES | YES | PRESENT | — |
| §20 AI Instructions | YES | YES | PRESENT | — |

---

## §12 Prioritized Gap Register

| ID | Gap | Priority | Blocking? | Run-7 Status |
|----|-----|----------|-----------|--------------|
| G-EMR-01 | Route collision: `GET /dental/emr/:patientId` vs `GET /dental/emr/:id` | **P0** | YES — Phase 3+ | OPEN |
| G-EMR-02 | Spec contradiction: §6 grants delete to dentist_owner; AC-EMR-001 blocks all DELETE → 405 | **P0** | YES | OPEN |
| G-EMR-03 | `emr/` handler (consultation notes) name-collides with future dental-emr-integration; must rename before Phase 3+ | **P0** | YES | OPEN (BLOCKED — Wave3) |
| G-EMR-04 (NEW) | DB-level FK constraints on `patient` and `provider` in `emr.schema.ts` violate MODULE_SPEC §20 #1 loose-coupling requirement | **P0** | YES — disruptive migration | **NEW run-7** |
| G-EMR-05 | `EMRImported@1` domain event not defined in EVENT_CONTRACTS.md | P1 | YES — audit trail | OPEN |
| G-EMR-06 | §9 UI/UX section missing from MODULE_SPEC | P1 | YES | OPEN |
| G-EMR-07 | §10b events section missing from MODULE_SPEC | P1 | YES | OPEN |
| G-EMR-08 | Branch isolation business rule not explicit in spec (BR-EMR-005) | P1 | YES — HIPAA | OPEN |
| G-EMR-09 | `imported_by_member_id` not surfaced in API response (audit trail gap) | P1 | YES | OPEN |
| G-EMR-10 | Permissions not added to ROLE_PERMISSION_MATRIX.md | P1 | Before impl | OPEN |
| G-EMR-11 | `source_system` enum missing `open-dental`, `dentrix`, `eaglesoft` | P1 | Feature gap | OPEN |
| G-EMR-12 | `branch_id` consistency: required on list but not on import/detail | P1 | API design | OPEN |
| G-EMR-13 | Field mismatch: spec says `import_date`, contract says `imported_at` | P2 | Rename | OPEN |
| G-EMR-14 | `content (JSONB)` in spec §7, absent from API responses — intent undocumented | P2 | Clarify | OPEN |
| G-EMR-15 | `handlers/emr/` test files (emr.handlers.test.ts, emr.repo.test.ts, consultation-note.fsm.property.test.ts, emr-coverage.test.ts) misleadingly named; must rename with G-EMR-03 | P2 | — | OPEN (deepened by Wave3 additions) |
| G-EMR-16 | Import duplicate behavior (same file+source+patient) not defined | P2 | — | OPEN |
| G-EMR-17 | Presigned URL refresh policy not documented | P2 | — | OPEN |
| G-EMR-18 | §12/§13/§15/§17/§18 missing (open questions, error taxonomy, migration, security, compliance) | P2 | — | OPEN |
| G-EMR-19 | UNSUPPORTED_SOURCE_SYSTEM and IMPORT_PARSE_ERROR in contract but no AC/test mapping | P2 | — | OPEN |

---

## §13 Wave3 Impact Analysis

Wave3 explicitly blocked all dental-emr-integration P0 findings (see ENFORCEMENT_FIX_REPORT.md:84):
> `"EF-EMR-001 / EM-EMR-001–003 — BLOCKED — architectural rename — emr/ directory is consultation-notes integration, not an EMR import module; rename requires spec-phase decision"`

Wave3 activities that touched `handlers/emr/` (all improvements to wrong-domain consultation notes, not dental-emr-integration):

| Commit | Description | EMR Compliance Impact |
|--------|-------------|----------------------|
| 5def6c0b | Add loose-coupling comment to `finalizedBy` in emr.schema.ts | Partial — patient/provider FKs NOT addressed (new EM-EMR-004) |
| 21585cc9 | Fix N+1 in listEMRPatients via getBatchConsultationStats | None — wrong domain improvement |
| 0730194b | Add emr handler coverage tests (39 tests, emr-coverage.test.ts) | None — wrong domain; deepens unauthorized impl |
| 569c7279 | Add FSM property tests (consultation-note.fsm.property.test.ts) | None — wrong domain; deepens unauthorized impl |

**Net result:** Wave3 deepened the unauthorized consultation notes implementation (added 2 new files, 600+ lines of test code) while correctly blocking the architectural rename. This makes G-EMR-03 (rename) more disruptive as there are now more files to migrate.

---

## §14 Compliance Score Computation

**P0 finding cap: max 3/10 per dimension when P0 present.**

| Dimension | Raw Score | P0 Cap Applied | Final |
|-----------|-----------|---------------|-------|
| D1: Public API Completeness | 0/10 (0 spec endpoints implemented; +4 P0 findings) | 3/10 cap (P0 present) → 0 | **0** |
| D2: Workflow Implementation | 0/10 (0 workflows implemented) | 0 (future phase; P0 identity collision) | **0** |
| D3: Domain Term Consistency | 0/10 (all 3 terms absent; wrong-domain terms present) | 0 | **0** |
| D4: State Machine Enforcement | 0/10 (terminal `imported` state not implemented) | 3/10 (no P0 in this dim specifically) | **3** |
| D5: Event Publishing | 3/10 (no P0 directly; spec §10b missing) | — | **3** |
| D6: Unprotected Routes | 7/10 (all 6 wrong-domain routes have authMiddleware; role vocab wrong) | — | **7** |

**Raw composite:** (0+0+0+3+3+7)/60 × 100 = 13/60 × 100 = **21.7%**

**P0 global penalty:** 4 P0 findings → cap at 18/100 (−2 from run-6 due to new P0).

**Final score: 18/100**

---

## §15 V1 Readiness

**NOT_READY** — Expected for FUTURE_PHASE.

Four P0 blockers must be resolved **before Phase 3+ can be safely scheduled:**

1. **G-EMR-01** — Fix route collision in API_CONTRACTS.md (`GET /dental/emr/:patientId` vs `GET /dental/emr/:id`)
2. **G-EMR-02** — Resolve delete permission contradiction (MODULE_SPEC §6 vs AC-EMR-001)
3. **G-EMR-03** — Rename `handlers/emr/` → `handlers/consultation-notes/` (or `handlers/dental-consultation/`) and update all imports, routes.ts references, registry.ts, and test file names
4. **G-EMR-04** (NEW) — Resolve DB FK cascade constraints on `patient`/`provider` in `emr.schema.ts` (either drop and replace with UUID-only refs, or accept they belong to the consultation-notes module and enforce loose-coupling in the future dental-emr-integration schema)

Until G-EMR-03 is resolved, Phase 3+ scheduling is unsafe. G-EMR-04 is a dependency of G-EMR-03 (the rename migration should also fix FK constraints).

---

## §16 Stabilization Plan

| Priority | Action | Owner | When |
|----------|--------|-------|------|
| **P0 — Fix now (before Phase 3+ scheduling)** | Rename `handlers/emr/` → `handlers/consultation-notes/`; update routes.ts, registry.ts, all test imports | Arch decision required | Before Phase 3+ sprint planning |
| **P0 — Fix now** | Drop cascade FK constraints on `patient`/`provider` in what will become `consultation-notes/repos/consultation-note.schema.ts`; add loose-coupling UUID-only refs | Schema migration | With rename |
| **P0 — Fix in spec** | Resolve route collision (`:patientId` vs `:id`) in API_CONTRACTS.md | Spec author | Before Phase 3+ |
| **P0 — Fix in spec** | Resolve delete permission contradiction (§6 vs AC-EMR-001) | Spec author | Before Phase 3+ |
| **P1 — Fix before new work** | Add §9 UI/UX, §10b events, §17 security, §18 compliance to MODULE_SPEC | Spec author | Before Phase 3+ scheduling |
| **P1 — Fix before new work** | Add `EMRImported@1` to EVENT_CONTRACTS.md | Event registry owner | Before Phase 3+ |
| **P1 — Fix before new work** | Add `dental-emr-integration` entries to ROLE_PERMISSION_MATRIX.md | Permissions owner | Before Phase 3+ |
| **P2 — Fix when touching** | Align `import_date` vs `imported_at` naming; document `content (JSONB)` intent; add missing ACs | Spec author | Phase 3+ spec spike |
| **P3 — Track** | Consultation notes service-layer refactor (F2 sprint) | F2 sprint lead | Post-rename |

---

## §17 What's Next

```bash
# Before Phase 3+ scheduling, resolve P0 spec-level bugs:
# 1. Fix route collision in docs/product/modules/dental-emr-integration/API_CONTRACTS.md
# 2. Resolve delete permission contradiction in MODULE_SPEC §6 vs §11

# Architectural rename (G-EMR-03 + G-EMR-04):
# 3. Move handlers/emr/ → handlers/consultation-notes/
# 4. Update services/api-ts/src/generated/openapi/routes.ts (6 route registrations)
# 5. Update services/api-ts/src/generated/openapi/registry.ts (6 imports)
# 6. Drop DB cascade FKs; add loose-coupling UUID refs in consultation-note schema
# 7. Generate new migration: bun run db:generate

# Then re-run enforcement for the renamed module:
# /oli-enforce-module --module dental-emr-integration
```

---

## §18 Findings Delta (run-6 → run-7)

| Change | Count | IDs |
|--------|-------|-----|
| New findings | 1 | EM-EMR-004 (P0 — DB FK constraint violation) |
| Resolved findings | 0 | — |
| Severity changes | 0 | — |
| Score change | −2 | 20→18 (new P0 adds to global P0 cap) |
| Wave3 impact on this module | BLOCKED (0 fixes) | All dental-emr-integration findings explicitly blocked |
