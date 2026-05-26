<!-- oli-version: 1.1 | generated: 2026-05-24 | skill: oli-module-specs --all | updated: 2026-05-25 SBT-010 -->

# Module Specification: dental-emr

---
Spec Version: 1.1 | Last Updated: 2026-05-25
implementation_status: future_phase (Phase 3+)
---

## 1. Module Overview
**Purpose:** External EMR data import bridge from third-party practice management systems (Open Dental, Dentrix, Eaglesoft, HL7/FHIR sources). Allows dentists to pull historical patient records from external practices into a patient's cabinet for clinical reference. Imported records are read-only; data is NOT auto-merged into editable dental records.

**NOT an alias for dental-visit.** The active EMR for visit records, charts, and treatments is `dental-visit`. This module handles external practice data portability only.

**Implementation status:** Future phase (Phase 3+). No handler directory exists. Spec defines the planned boundary.

**Users:** dentist_owner, dentist_associate (import + view), staff_full (view only)

**Related:** dental-org (assertBranchAccess), dental-patient (patient link), dental-visit (active EMR — see that module for current visit/chart/treatment records)

---

## 2. Domain Terms
| Term | Definition |
|------|-----------|
| EMR Record | External health record imported from a third-party practice management system; read-only after import |
| Import Source | External EHR/EMR system identifier (e.g., "open-dental", "dentrix", "hl7-fhir") |
| Treatment History | Imported prior treatment records from external system |

---

## 3. Workflows
WF-100: Import external patient record from file (CSV/HL7/FHIR) — dentist imports prior visit history from another practice
WF-101: View imported EMR records alongside native dental records — dental team views external records in patient cabinet

---

## 5. Business Rules
EMR records are read-only after import (same pattern as ImportedPMD, BR-022 analog). No auto-merge into dental records. Source system identifier is required for audit trail. Records reference patient by UUID — no DB foreign key to dental tables.

---

## 6. Permissions
Import: dentist_owner, dentist_associate | View: all dental roles | Delete: dentist_owner only

---

## 7. Data Requirements
**`emr_record`:** id, patient_id (UUID — loose coupling, no FK), branch_id, source_system, import_date, content (JSONB), imported_by_member_id, format_version

---

## 7b. Aggregate Boundaries
EMRRecord is an aggregate root. Read-only after creation. References Patient by UUID (loose coupling — no DB FK to dental_patient table).

---

## 8. State Transitions
imported (terminal — read-only, no transitions)

---

## 10. API Expectations
POST /dental/emr/import (patient_id, source_system, file/data), GET /dental/emr/:patientId (list), GET /dental/emr/:id (detail)

---

## 11. Acceptance Criteria
**AC-EMR-001:** PATCH/DELETE imported EMR → 405.
**AC-EMR-002:** Import creates read-only record; patient's editable records unchanged.
**AC-EMR-003:** Import requires source_system identifier → 422 if absent.

---

## 14. Dependencies
**Internal:** dental-org (assertBranchAccess), dental-patient (patient link)
**Note:** dental-visit is the active EMR for native records. This module does NOT depend on dental-visit.

---

## 16. Performance Expectations
Import < 5s. View < 1s. Volume: low (occasional imports per patient).

---

## 19. Vertical Slice Plan
EMR-S1: Import + read-only store | EMR-S2: View + patient link
(Phase 3+ — do not schedule until dental-visit, dental-clinical, dental-pmd modules are stable)

---

## 20. AI Instructions
1. No DB FKs to other modules — UUID refs only (loose coupling).
2. No PATCH/DELETE routes on imported records.
3. This is a FUTURE PHASE module. Do not implement handler files until explicitly scheduled.
4. Follow ARCHITECTURE.md, CONTRIBUTING.md, VERTICAL_TDD.md.
