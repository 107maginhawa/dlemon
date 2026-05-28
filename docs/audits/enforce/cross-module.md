# Cross-Module Enforcement Report — Run 6 (Strict)

<!-- oli-enforce-cross-module v2.0 | run: run-6-strict-2026-05-29 | depth: exhaustive -->
<!-- modules-scoped: dental-audit, dental-billing, dental-clinical, dental-emr-integration(emr), dental-imaging, dental-org, dental-patient, dental-perio, dental-pmd, dental-scheduling, dental-visit -->

**Run ID:** run-6-strict-2026-05-29
**Phase:** 2 — Cross-Module Contract Boundaries
**Scope:** 11 dental modules + EMR legacy module
**Checks:** A=Import Direction, B=Event Schema, C=API Contract, D=Drizzle FK, E=Domain Terms

---

## Executive Summary

| Severity | Count |
|----------|-------|
| P0 | 7 |
| P1 | 24 |
| P2 | 2 |
| P3 | 0 |
| **Total** | **33** |

| Metric | Value |
|--------|-------|
| Event coverage (DE-001–DE-024 emitted) | 0% — 0/24 |
| Import violations (non-facade, non-exempt) | 7 |
| DB FK violations (hard FKs contra arch decision) | 3 |
| DB FK known/exempt (schema-layer) | 26 |
| New findings (vs run-5 baseline) | 8 |

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

### EX-007 ⚠️ P0
- **Severity:** P0
- **Type:** IMPORT_DIRECTION + DB_FK (see also EX-031)
- **From:** `dental-imaging`
- **To:** `dental-visit`, `patient`, `dental-org`
- **Description:** `dental-imaging/repos/imaging_finding.schema.ts:11-13` imports raw schema tables from three foreign modules via relative paths to declare hard Drizzle `.references()` FKs. This contradicts the `dental-imaging` architectural decision in DOMAIN_MODEL.md ("Loose coupling — UUID refs only, no DB-level FKs"). The `imaging.schema.ts` file in the same module correctly comments each cross-module UUID field as "loose-coupling: no DB-level FK to avoid coupling." The `imaging_finding.schema.ts` imports and uses `.references()` for `visitId`, `patientId`, and `branchId` — inconsistent with the stated contract. (`treatmentId` in the same file correctly uses bare UUID with comment "cross-module FK — no .references()".)
- **Files:**
  - `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts:11` (import dentalVisits)
  - `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts:12` (import patients)
  - `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts:13` (import dentalBranches)
  - `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts:64` — `visitId: uuid('visit_id').references(() => dentalVisits.id)`
  - `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts:65` — `patientId: uuid('patient_id').notNull().references(() => patients.id)`
  - `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts:66` — `branchId: uuid('branch_id').notNull().references(() => dentalBranches.id)`
- **Status:** NEW
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

### EX-031 ⚠️ P0
- **Severity:** P0
- **Type:** DB_FK
- **From:** `dental-imaging/repos/imaging_finding.schema.ts`
- **To:** `dental-visit`, `patient`, `dental-org`
- **Description:** Three hard Drizzle FK declarations in `imaging_finding.schema.ts` violate the stated `dental-imaging` architecture (DOMAIN_MODEL.md: "Loose coupling — UUID refs only, no DB-level FKs"). The same file correctly handles `treatmentId` as a bare UUID with a "cross-module FK — no .references()" comment. The `imaging.schema.ts` in the same module handles ALL cross-module refs as bare UUIDs with explicit comments. `imaging_finding.schema.ts` is inconsistent with both the contract and its sibling schema.
  - Line 64: `visitId: uuid('visit_id').references(() => dentalVisits.id)` — VIOLATES
  - Line 65: `patientId: uuid('patient_id').notNull().references(() => patients.id)` — VIOLATES
  - Line 66: `branchId: uuid('branch_id').notNull().references(() => dentalBranches.id)` — VIOLATES
- **Status:** NEW
- **Confidence:** HIGH

### Known/Exempt FK coupling (schema-layer, not violations)

| Module | FK count | Target modules | Status |
|--------|----------|---------------|--------|
| dental-billing | 15 | dentalVisits, patients, dentalBranches, dentalMemberships, dentalTreatments | EXEMPT |
| dental-clinical | 19 | dentalVisits, patients, dentalMemberships, dentalBranches | EXEMPT |
| dental-imaging imaging.schema.ts | 0 cross-module | — (loose coupling, correct) | COMPLIANT |
| dental-imaging imaging_finding.schema.ts | 3 cross-module | dentalVisits, patients, dentalBranches | VIOLATION (EX-031) |
| dental-patient | 8 | patients, dentalInsuranceProfiles | EXEMPT |
| dental-perio | 3 | dentalVisits, patients, dentalBranches | EXEMPT |
| dental-scheduling | 7 | patients, dentalBranches, dentalMemberships, dentalVisits | EXEMPT |
| dental-visit | 15 | patients, dentalBranches, dentalMemberships (self-context) | EXEMPT |
| emr schema | 2 | patients, providers | EXEMPT |

**Run-5 baseline (25 P0 FK findings):** All 25 now KNOWN/EXEMPT under MODULE_BOUNDARIES.md schema-layer exemption.

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
| EX-007 | P0 | IMPORT_DIRECTION | dental-imaging | dental-visit, patient, dental-org | NEW |
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
| EX-031 | P0 | DB_FK | dental-imaging | dental-visit, patient, dental-org | NEW |
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
| 2 | EX-007 + EX-031 (P0) | Remove `.references()` from `imaging_finding.schema.ts` lines 64-66; replace with bare `uuid()` per `imaging.schema.ts` pattern; generate migration |
| 3 | EX-005/006 (P1) | Move `patients`/`persons` imports in `emr/repos/emr.repo.ts` to a facade |
| 4 | EX-032 (P2) | Rename `handlers/emr/` → `handlers/dental-emr/`; add to MODULE_BOUNDARIES.md migration table |
| 5 | EX-033 (P2) | Add `ImagingFinding` entity to DOMAIN_MODEL.md §3 with coupling contract documented |
| 6 | EX-008–030 (P1) | Wire `publishAuditEvent` (and typed event publishers) into 8 source modules at mutation points |

---

*Generated: 2026-05-29 | Run: run-6-strict-2026-05-29 | Supersedes run-5*
