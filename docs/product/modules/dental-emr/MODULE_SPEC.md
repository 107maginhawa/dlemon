<!-- oli-version: 1.1 | generated: 2026-05-24 | skill: oli-module-specs --all -->

# Module Specification: dental-emr

---
Spec Version: 1.0 | Last Updated: 2026-05-24
---

## 1. Module Overview
**Purpose:** External Medical Record import and storage. Allows dentists to pull in records from external health systems (EHR/EMR) into a patient's cabinet. Imported records are read-only; data is NOT auto-merged into editable dental records.

**Users:** dentist_owner, dentist_associate (import + view), staff_full (view only)

**Related:** dental-org (assertBranchAccess), dental-patient (patient link), dental-clinical (may surface allergy/medication data from EMR imports in safety floor [INFERRED])

---

## 2. Domain Terms
| Term | Definition |
|------|-----------|
| EMR Record | External health record imported from outside the system; read-only |
| Import Source | External EHR/EMR system identifier |

---

## 3. Workflows
WF-100 [INFERRED]: Import external EMR record (dentist) | WF-101 [INFERRED]: View imported EMR records for patient

---

## 5. Business Rules
EMR records are read-only after import (same pattern as ImportedPMD, BR-022 analog). No auto-merge into dental records.

---

## 6. Permissions
Import: dentist_owner, dentist_associate | View: all dental roles | Delete: dentist_owner [VERIFY]

---

## 7. Data Requirements
**`emr_record`:** id, patient_id (UUID), branch_id, source_system, import_date, content (JSONB), imported_by_member_id

---

## 7b. Aggregate Boundaries
EMRRecord is an aggregate root. Read-only after creation. References Patient by UUID (loose coupling — no DB FK).

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

---

## 14. Dependencies
**Internal:** dental-org (assertBranchAccess), dental-patient (patient link)

---

## 16. Performance Expectations
Import < 5s. View < 1s. Volume: low (occasional imports per patient).

---

## 19. Vertical Slice Plan
EMR-S1: Import + read-only store | EMR-S2: View + patient link | EMR-S3: Safety floor integration [INFERRED]

---

## 20. AI Instructions
1. No DB FKs to other modules — UUID refs only (loose coupling).
2. No PATCH/DELETE routes on imported records.
3. Follow ARCHITECTURE.md, CONTRIBUTING.md, VERTICAL_TDD.md.
