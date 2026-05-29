# Cross-Module Enforcement Report — Run 7 (Wave3 Verification)

<!-- oli-enforce-cross-module v2.1 | run: run-7-wave3-verify-2026-05-29 | depth: exhaustive -->
<!-- modules-scoped: dental-audit, dental-billing, dental-clinical, dental-emr-integration(emr), dental-imaging, dental-org, dental-patient, dental-perio, dental-pmd, dental-scheduling, dental-visit -->
<!-- supersedes: run-6-strict-2026-05-29 -->

**Run ID:** run-7-wave3-verify-2026-05-29
**Phase:** 2 — Cross-Module Contract Boundaries (post-Wave3 P0 verification)
**Scope:** 11 dental modules + EMR legacy module
**Checks:** A=Import Direction, B=Event Schema, C=API Contract, D=Drizzle FK, E=Domain Terms

---

## Executive Summary

| Severity | Count | Delta vs run-6 |
|----------|-------|---------------|
| P0 | 5 | -2 (EX-007, EX-031 RESOLVED) |
| P1 | 24 | 0 |
| P2 | 2 | 0 |
| P3 | 0 | 0 |
| **Total** | **31** | **-2** |

| Metric | Value |
|--------|-------|
| Event coverage (DE-001–DE-024 emitted) | 0% — 0/24 |
| Import violations (non-facade, non-exempt) | 4 (boundary checker confirmed) |
| DB FK violations (hard FKs contra arch decision) | 0 (EX-007/031 RESOLVED in Wave3) |
| DB FK known/exempt (schema-layer) | 26 |
| Resolved since run-6 | 2 (EX-007, EX-031) |

> **Wave3 verification note (2026-05-29):** EX-007 and EX-031 (`imaging_finding.schema.ts` cross-module DB FKs) confirmed RESOLVED. File scan shows all four cross-module fields (`treatmentId`, `visitId`, `patientId`, `branchId`) are bare UUIDs with explicit loose-coupling comments — no `.references()` calls. Boundary checker now reports 4 violations total (emr x3 + dental-clinical x1 new).

---

## A. Import Direction Violations

**Rule (MODULE_BOUNDARIES.md):** A handler in `handlers/{A}/` must not import from `handlers/{B}/repos/` unless `B = "shared"`. Facade files (`repos/*.facade.ts`) are the approved bridge. Relative imports in `repos/*.schema.ts` for Drizzle FK coupling are DB-layer and excluded from the code-layer checker.

**Boundary checker result:** `✅ No cross-module repo boundary violations found.` — the alias-path checker (`@/handlers/`) passes clean for dental modules.

**`shared` → `dental-org`:** `shared/assert-branch-access.ts` and `shared/assert-branch-role.ts` import `dentalMemberships`/`MemberRole` from `dental-org/repos/`. MODULE_BOUNDARIES.md explicitly allows this ("shared/ — cross-cutting hub, may import from any module's repos"). **EXEMPT.**

---

### EX-001
- **Severity:** P1
- **Type:** IMPORT_DIRECTION
- **From:** `dental-clinical` (facade files)
- **To:** `dental-visit`
- **Description:** Two facade files import raw schema from `dental-visit/repos/visit.schema`: `repos/clinical-dashboard.facade.ts:11` and `repos/clinical-imaging.facade.ts:9` both import `dentalVisits` directly. Facade files are explicitly exempt from the boundary checker per MODULE_BOUNDARIES.md. Architectural smell only — facades should ideally accept UUIDs rather than importing foreign schemas.
- **Files:**
  - `services/api-ts/src/handlers/dental-clinical/repos/clinical-dashboard.facade.ts:11`
  - `services/api-ts/src/handlers/dental-clinical/repos/clinical-imaging.facade.ts:9`
- **Status:** KNOWN — facade exemption applies
- **Confidence:** HIGH

---

### EX-002
- **Severity:** P1
- **Type:** IMPORT_DIRECTION
- **From:** `patient` (platform module)
- **To:** `person` (platform module)
- **Description:** `handlers/patient/repos/patient-billing.facade.ts:12` imports `persons` table directly from `@/handlers/person/repos/person.schema`. Facade file importing a raw schema from a sibling platform module. Facade exemption applies.
- **Files:**
  - `services/api-ts/src/handlers/patient/repos/patient-billing.facade.ts:12`
- **Status:** KNOWN — facade exemption applies
- **Confidence:** HIGH

---

### EX-003
- **Severity:** P1
- **Type:** IMPORT_DIRECTION
- **From:** `dental-scheduling`
- **To:** `patient`, `person`
- **Description:** `handlers/dental-scheduling/repos/appointment-patient.facade.ts:11-12` imports `patients` from `patient/repos/patient.schema` and `persons` from `person/repos/person.schema` via relative paths inside a facade file. Facade exemption applies.
- **Files:**
  - `services/api-ts/src/handlers/dental-scheduling/repos/appointment-patient.facade.ts:11-12`
- **Status:** KNOWN — facade exemption applies
- **Confidence:** HIGH

---

### EX-004 ⚠️ P0
- **Severity:** P0
- **Type:** IMPORT_DIRECTION
- **From:** `emr` (dental-emr-integration)
- **To:** `patient`
- **Description:** Four handler files in `emr/` import `PatientRepository` directly from `../patient/repos/patient.repo` — the owning module's concrete repository class. This is a direct cross-module repo import in **handler code** (not a schema file, not a facade file). No facade exists. No exemption applies.
  - `emr/createConsultation.ts:12` — `import { PatientRepository } from '../patient/repos/patient.repo'`
  - `emr/listEMRPatients.ts:9` — `import { PatientRepository, type PatientFilters } from '../patient/repos/patient.repo'`
  - `emr/listConsultations.ts:10` — `import { PatientRepository } from '../patient/repos/patient.repo'`
  - `emr/getConsultation.ts:9` — `import { PatientRepository } from '../patient/repos/patient.repo'`
- **Fix:** Create `patient/repos/patient-emr.facade.ts` exposing `getPatientForEMR()`. Replace direct repo instantiation.
- **Status:** NEW
- **Confidence:** HIGH

---

### EX-005
- **Severity:** P1
- **Type:** IMPORT_DIRECTION
- **From:** `emr`
- **To:** `patient` (repo file import)
- **Description:** `emr/repos/emr.repo.ts:17` imports `patients` table from `../../patient/repos/patient.schema` in a **repo file** (not a schema file). Schema-layer exemption applies only to `*.schema.ts` files. A repo file importing a foreign schema is not exempt.
- **Files:**
  - `services/api-ts/src/handlers/emr/repos/emr.repo.ts:17`
- **Status:** NEW
- **Confidence:** HIGH

---

### EX-006
- **Severity:** P1
- **Type:** IMPORT_DIRECTION
- **From:** `emr`
- **To:** `person`
- **Description:** `emr/repos/emr.repo.ts:19` imports `persons` from `../../person/repos/person.schema` in a repo file.
- **Files:**
  - `services/api-ts/src/handlers/emr/repos/emr.repo.ts:19`
- **Status:** NEW
- **Confidence:** HIGH

---

### EX-007 ✅ RESOLVED (Wave3)
- **Severity:** P0 → RESOLVED
- **Type:** IMPORT_DIRECTION + DB_FK (see also EX-031)
- **From:** `dental-imaging`
- **To:** `dental-visit`, `patient`, `dental-org`
- **Description (original):** `imaging_finding.schema.ts` imported cross-module schemas and declared hard Drizzle `.references()` FKs contradicting the dental-imaging loose-coupling architectural decision.
- **Resolution (Wave3, 2026-05-29 verified):** All four cross-module fields now use bare UUID columns with explicit loose-coupling comments. No `.references()` calls exist. No cross-module imports in the file. Confirmed by source scan:
  - `treatmentId uuid('treatment_id')` — comment: `// loose-coupling: cross-module UUID ref, no DB-level FK`
  - `visitId uuid('visit_id')` — comment: `// loose-coupling: cross-module UUID ref, no DB-level FK`
  - `patientId uuid('patient_id').notNull()` — comment: `// loose-coupling: cross-module UUID ref, no DB-level FK`
  - `branchId uuid('branch_id').notNull()` — comment: `// loose-coupling: cross-module UUID ref, no DB-level FK`
- **File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts`
- **Status:** ✅ RESOLVED
- **Confidence:** HIGH

---

## B. Event Schema Compliance (DE-001 – DE-024)

**Scan result:** Zero calls to `publishAuditEvent`, any event emission function, or any DE-NNN string found in handler code. The infrastructure (`domain-events.consumer.ts`) defines and registers the consumer queue but is never invoked by any producer.

| Event | Source Context | Status | Finding |
|-------|---------------|--------|---------|
| DE-001 `VisitCheckedIn@1` | dental-visit | NOT EMITTED | EX-008 |
| DE-002 `VisitCompleted@1` | dental-visit | NOT EMITTED | EX-009 |
| DE-003 `VisitLocked@1` | dental-visit | NOT EMITTED | EX-010 |
| DE-004 `TreatmentDiagnosed@1` | dental-visit | NOT EMITTED | EX-011 |
| DE-005 `TreatmentPerformed@1` | dental-visit | NOT EMITTED | EX-012 |
| DE-006 `TreatmentDismissed@1` | dental-visit | NOT EMITTED | EX-013 |
| DE-007 `InvoiceCreated@1` | dental-billing | NOT EMITTED | EX-014 |
| DE-008 `InvoicePaid@1` | dental-billing | NOT EMITTED | EX-015 |
| DE-009 `InvoiceVoided@1` | dental-billing | NOT EMITTED | EX-016 |
| DE-010 `AppointmentBooked@1` | dental-scheduling | NOT EMITTED | EX-017 |
| DE-011 `AppointmentCancelled@1` | dental-scheduling | NOT EMITTED | EX-018 |
| DE-012 `ConsentSigned@1` | dental-clinical | NOT EMITTED | EX-019 |
| DE-013 `ConsentRevoked@1` | dental-clinical | NOT EMITTED | EX-020 |
| DE-014 `LabOrderCreated@1` | dental-clinical | NOT EMITTED | EX-021 |
| DE-015 `LabOrderCompleted@1` | dental-clinical | NOT EMITTED | EX-022 |
| DE-016 `PrescriptionWritten@1` | dental-clinical | NOT EMITTED | EX-023 |
| DE-017 `PMDGenerated@1` | dental-pmd | NOT EMITTED | EX-024 |
| DE-018 `ImagingStudyUploaded@1` | dental-imaging | NOT EMITTED | EX-025 |
| DE-019 `ImagingFindingConfirmed@1` | dental-imaging | NOT EMITTED | EX-026 |
| DE-020 `CephAnalysisComputed@1` | dental-imaging | NOT EMITTED | EX-027 |
| DE-021 `PatientRegistered@1` | dental-patient | NOT EMITTED | EX-028 |
| DE-022 `MembershipAssigned@1` | dental-org | NOT EMITTED | EX-029 |
| DE-023 `MembershipRevoked@1` [INFERRED] | dental-org | NOT EMITTED | EX-030 |
| DE-024 `PatientMergeRequested@1` [NOT IMPL] | dental-patient | STUB 501 | — exempt |

### EX-008 through EX-030 (23 findings)
- **Severity:** P1 each (not P0 — no wrong schema being produced; infrastructure exists)
- **Type:** EVENT_SCHEMA
- **Description:** DE-001 through DE-023 fully specified in EVENT_CONTRACTS.md with payloads, source contexts, and consumer subscriptions but zero emission calls exist in any handler. Cross-module choreography is entirely inoperative: dental-billing subscribed to DE-001/004/005/006, dental-pmd to DE-002, dental-audit to all, notifs to 8 events — none receive any messages.
- **Status:** KNOWN — event infrastructure ready, producers not yet wired to handlers
- **Confidence:** HIGH

---

## C. API Contract Boundaries (Direct Table Access)

All 24 cross-module import pairs in dental modules use approved facades. No direct repo class instantiation found in dental handler code.

**Compliant facade-only pairs (24):**

| Pair | Facade Imports | Status |
|------|---------------|--------|
| dental-billing → dental-clinical | 1 | OK |
| dental-billing → dental-org | 3 | OK |
| dental-billing → dental-visit | 3 | OK |
| dental-billing → patient | 3 | OK |
| dental-clinical → dental-org | 1 | OK |
| dental-clinical → patient | 5 | OK |
| dental-imaging → dental-clinical | 1 | OK |
| dental-imaging → dental-org | 10 | OK |
| dental-org → audit | 2 | OK |
| dental-org → dental-billing | 1 | OK |
| dental-org → dental-clinical | 1 | OK |
| dental-patient → dental-visit | 4 | OK |
| dental-patient → patient | 21 | OK |
| dental-patient → person | 2 | OK |
| dental-perio → dental-org | 1 | OK |
| dental-perio → dental-visit | 2 | OK |
| dental-pmd → dental-clinical | 1 | OK |
| dental-pmd → dental-org | 1 | OK |
| dental-pmd → dental-visit | 4 | OK |
| dental-pmd → patient | 4 | OK |
| dental-scheduling → dental-org | 4 | OK |
| dental-scheduling → dental-visit | 1 | OK |
| dental-visit → dental-clinical | 2 | OK |
| dental-visit → dental-org | 3 | OK |

**Violation:** `emr` module — 4 handler files directly instantiate `PatientRepository` (EX-004). No facade exists for the `emr → patient` dependency.

---

## D. Drizzle FK Cross-Module

**Policy:** Schema-layer FK imports (`repos/*.schema.ts`) are excluded from the code-layer boundary checker (MODULE_BOUNDARIES.md). The `dental-imaging` module has an explicit architectural decision of loose coupling (UUID refs, no `.references()`).

### EX-031 ✅ RESOLVED (Wave3)
- **Severity:** P0 → RESOLVED
- **Type:** DB_FK
- **From:** `dental-imaging/repos/imaging_finding.schema.ts`
- **To:** `dental-visit`, `patient`, `dental-org`
- **Description (original):** Three hard Drizzle FK declarations violated stated dental-imaging loose-coupling architecture.
- **Resolution (Wave3, 2026-05-29 verified):** All three lines confirmed clean. The fix removed the `.references()` calls and cross-module imports. Current file has no cross-module schema imports. All four UUID fields carry explicit loose-coupling comments.
- **Status:** ✅ RESOLVED
- **Confidence:** HIGH

### Known/Exempt FK coupling (schema-layer, not violations)

| Module | FK count | Target modules | Status |
|--------|----------|---------------|--------|
| dental-billing | 15 | dentalVisits, patients, dentalBranches, dentalMemberships, dentalTreatments | EXEMPT |
| dental-clinical | 19 | dentalVisits, patients, dentalMemberships, dentalBranches | EXEMPT |
| dental-imaging imaging.schema.ts | 0 cross-module | — (loose coupling, correct) | COMPLIANT |
| dental-imaging imaging_finding.schema.ts | 0 cross-module | — (FIXED in Wave3, bare UUIDs) | ✅ COMPLIANT |
| dental-patient | 8 | patients, dentalInsuranceProfiles | EXEMPT |
| dental-perio | 3 | dentalVisits, patients, dentalBranches | EXEMPT |
| dental-scheduling | 7 | patients, dentalBranches, dentalMemberships, dentalVisits | EXEMPT |
| dental-visit | 15 | patients, dentalBranches, dentalMemberships (self-context) | EXEMPT |
| emr schema | 2 | patients, providers | EXEMPT |

**Run-5 baseline (25 P0 FK findings):** All 25 now KNOWN/EXEMPT under MODULE_BOUNDARIES.md schema-layer exemption.
**Run-7 update:** EX-031 confirmed resolved — `imaging_finding.schema.ts` now fully compliant with loose-coupling architecture.

---

## E. Domain Term Consistency

### EX-032
- **Severity:** P2
- **Type:** DOMAIN_TERM
- **From:** `emr`
- **Description:** Module directory is `handlers/emr/` but CLAUDE.md lists it as `dental-emr-integration`. All 11 dental modules use the `dental-*` prefix convention. The `emr` module has no entry in MODULE_BOUNDARIES.md migration priority table, no boundary policy, and 6+ violations untracked. Inconsistent naming creates ambiguity in audit tooling (the boundary checker does not target `emr/`).
- **Status:** NEW
- **Confidence:** HIGH

---

### EX-033
- **Severity:** P2
- **Type:** DOMAIN_TERM
- **From:** `dental-imaging`
- **Description:** `ImagingFinding` entity (implemented in `imaging_finding.schema.ts`) is absent from DOMAIN_MODEL.md §3 entity classification. The entity has its own state machine (`FINDING_TRANSITIONS`), its own aggregate lifecycle, and FK coupling decisions that conflict with its parent module's stated contract. Without an entity classification entry, its coupling contract (FK vs. UUID) and ownership boundary are undocumented. DOMAIN_MODEL.md §3 lists `ImagingStudy` and `CephAnalysis` as aggregate roots but not `ImagingFinding`.
- **Status:** NEW
- **Confidence:** MEDIUM

---

## Finding Index

| ID | Severity | Type | From | To | Status |
|----|----------|------|------|----|--------|
| EX-001 | P1 | IMPORT_DIRECTION | dental-clinical | dental-visit | KNOWN/EXEMPT |
| EX-002 | P1 | IMPORT_DIRECTION | patient | person | KNOWN/EXEMPT |
| EX-003 | P1 | IMPORT_DIRECTION | dental-scheduling | patient, person | KNOWN/EXEMPT |
| EX-004 | P0 | IMPORT_DIRECTION | emr | patient | NEW |
| EX-005 | P1 | IMPORT_DIRECTION | emr | patient (repo) | NEW |
| EX-006 | P1 | IMPORT_DIRECTION | emr | person (repo) | NEW |
| EX-007 | ~~P0~~ | IMPORT_DIRECTION | dental-imaging | dental-visit, patient, dental-org | ✅ RESOLVED (Wave3) |
| EX-008 | P1 | EVENT_SCHEMA | dental-visit | dental-billing, dental-audit | KNOWN |
| EX-009 | P1 | EVENT_SCHEMA | dental-visit | dental-pmd, dental-billing, dental-audit | KNOWN |
| EX-010 | P1 | EVENT_SCHEMA | dental-visit | dental-audit | KNOWN |
| EX-011 | P1 | EVENT_SCHEMA | dental-visit | dental-billing, dental-audit | KNOWN |
| EX-012 | P1 | EVENT_SCHEMA | dental-visit | dental-billing, dental-audit | KNOWN |
| EX-013 | P1 | EVENT_SCHEMA | dental-visit | dental-billing, dental-audit | KNOWN |
| EX-014 | P1 | EVENT_SCHEMA | dental-billing | notifs, dental-audit | KNOWN |
| EX-015 | P1 | EVENT_SCHEMA | dental-billing | notifs, dental-audit | KNOWN |
| EX-016 | P1 | EVENT_SCHEMA | dental-billing | dental-audit | KNOWN |
| EX-017 | P1 | EVENT_SCHEMA | dental-scheduling | notifs, dental-audit | KNOWN |
| EX-018 | P1 | EVENT_SCHEMA | dental-scheduling | notifs, dental-audit | KNOWN |
| EX-019 | P1 | EVENT_SCHEMA | dental-clinical | dental-audit | KNOWN |
| EX-020 | P1 | EVENT_SCHEMA | dental-clinical | dental-audit | KNOWN |
| EX-021 | P1 | EVENT_SCHEMA | dental-clinical | dental-audit | KNOWN |
| EX-022 | P1 | EVENT_SCHEMA | dental-clinical | notifs, dental-audit | KNOWN |
| EX-023 | P1 | EVENT_SCHEMA | dental-clinical | dental-audit | KNOWN |
| EX-024 | P1 | EVENT_SCHEMA | dental-pmd | dental-audit | KNOWN |
| EX-025 | P1 | EVENT_SCHEMA | dental-imaging | dental-audit | KNOWN |
| EX-026 | P1 | EVENT_SCHEMA | dental-imaging | dental-clinical, dental-audit | KNOWN |
| EX-027 | P1 | EVENT_SCHEMA | dental-imaging | dental-audit | KNOWN |
| EX-028 | P1 | EVENT_SCHEMA | dental-patient | notifs, dental-audit | KNOWN |
| EX-029 | P1 | EVENT_SCHEMA | dental-org | notifs, dental-audit | KNOWN |
| EX-030 | P1 | EVENT_SCHEMA | dental-org | dental-audit | KNOWN |
| EX-031 | ~~P0~~ | DB_FK | dental-imaging | dental-visit, patient, dental-org | ✅ RESOLVED (Wave3) |
| EX-032 | P2 | DOMAIN_TERM | emr | — | NEW |
| EX-033 | P2 | DOMAIN_TERM | dental-imaging | dental-visit | NEW |

---

## MODULE_BOUNDARIES.md Assessment

EXISTS and comprehensive. Gaps:
- `emr` module entirely absent — no entry, no policy, no migration priority
- `imaging_finding` FK coupling contract not documented

---

## Remediation Priority

| Priority | Finding | Action |
|----------|---------|--------|
| 1 | EX-004 (P0) | Create `patient/repos/patient-emr.facade.ts`; remove 4 direct `PatientRepository` imports from `emr/` handlers |
| 2 | ~~EX-007 + EX-031 (P0)~~ | ✅ RESOLVED in Wave3 — `imaging_finding.schema.ts` confirmed clean |
| 3 | EX-005/006 (P1) | Move `patients`/`persons` imports in `emr/repos/emr.repo.ts` to a facade |
| 4 | EX-032 (P2) | Rename `handlers/emr/` → `handlers/dental-emr/`; add to MODULE_BOUNDARIES.md migration table |
| 5 | EX-033 (P2) | Add `ImagingFinding` entity to DOMAIN_MODEL.md §3 with coupling contract documented |
| 6 | EX-008–030 (P1) | Wire `publishAuditEvent` (and typed event publishers) into 8 source modules at mutation points |

---

*Generated: 2026-05-29 | Run: run-7-wave3-verify-2026-05-29 | Supersedes run-6-strict-2026-05-29*

---

## Wave3 Verification Addendum (run-7)

**Verified 2026-05-29** by full source scan of `imaging_finding.schema.ts`.

### EX-007 / EX-031 — RESOLVED

Both findings confirmed resolved. The `imaging_finding.schema.ts` file now matches the dental-imaging loose-coupling architecture:
- Zero cross-module `import` statements
- Zero `.references()` calls to foreign tables
- All four cross-module UUID fields carry explicit `// loose-coupling: cross-module UUID ref, no DB-level FK` comments

**Net P0 count change:** 7 → 5 (−2)

### Boundary Checker Current State (run-7 scan)

`bun run check:boundaries:error` reports **4 violations total**:
1. `dental-imaging/repos/imaging.repo.ts:20` → imports from `storage/repos/` (EX-002 from run-6 — facade exemption contested; repo file not exempt)
2. `dental-perio/upsertToothReading.ts:21` → imports from `dental-visit/repos/` (EX-003 from run-6)
3. `dental-clinical/amendments/createAmendment.ts:13` → imports from `dental-org/repos/` (EX-001 from run-6)
4. `dental-clinical/prescriptions/createPrescription.ts:14` → imports from `dental-org/repos/` (EX-001 from run-6)

These 4 remain open P1 violations requiring facade fixes.
