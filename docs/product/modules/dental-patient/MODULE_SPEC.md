<!-- oli-version: 1.1 -->
<!-- generated: 2026-05-24 | skill: oli-module-specs --all -->
<!-- based-on: PRD v3, DOMAIN_MODEL.md, WORKFLOW_MAP.md, existing docs/modules/dental-patient/MODULE_SPEC.md -->

# Module Specification: dental-patient

---
Spec Version: 1.0 | Last Updated: 2026-05-24
Last Validated Against: PRD v3-dentalemon.md
---

## 1. Module Overview

### Purpose
Manages the dental-specific patient registry. Wraps the platform `patient` table with dental enrichments: follow-up notes, safety floor (allergies/medications/conditions), recall scheduling, treatment plan management, itemized financial statements, and dentition initialization. The entry point for all patient record access.

### Users
- `staff_full`, `staff_scheduling` — registration, search
- `dentist_owner`, `dentist_associate` — clinical views, merge (owner only)
- `admin` (platform) — GDPR erasure [WFG-006]

### Related Modules
- `dental-org` (assertBranchAccess)
- `dental-visit` (visit history, safety floor aggregation)
- `dental-clinical` (conditions, prescriptions for safety floor)
- `dental-billing` (financial statement, payment plan flag)
- `person` platform (PII storage)

### In Scope
Patient CRUD, bulk archive, CSV/JSON import/export, safety floor aggregation, recall scheduling, treatment plan view, financial statement, dentition chart init, GDPR erasure request tracking.

### Out of Scope
Visit/treatment records (dental-visit), billing invoices (dental-billing), clinical records (dental-clinical).

---

## 2. Domain Terms

| Term | Definition |
|------|-----------|
| Patient | Dental-domain extension of platform `person`; linked one-to-one via `patient` table |
| Cabinet | All clinical + admin records for one patient (navigation metaphor) |
| Safety Floor | Aggregated allergies, medications, conditions shown at top of workspace |
| Recall | Scheduled follow-up reminder for preventive care |
| Follow-up Notes | Append-only dentist notes on patient profile (not tied to a visit) |
| Dentition | Full tooth set; adult (FDI 11–48) or pediatric (FDI 51–85) |
| Patient Status | active / archived |

---

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-005 | staff_full, dentist_owner | Patient registration | P0 |
| WF-044 | staff_full | Consent capture at registration | P0 |
| WF-023 | All dental roles | Patient search | P0 |
| WF-055 [INFERRED] | All dental roles | View patient profile | P0 |
| WF-056 [INFERRED] | staff_full, dentist_owner | Update demographics | P1 |
| WF-057 [INFERRED] | dentist_owner | Patient merge (BR-020 — not implemented) | P2 |
| WF-058 [INFERRED] | dentist_owner, admin | Patient archive / GDPR erasure | P2 |
| WF-088 [INFERRED] | admin | GDPR patient erasure (WFG-006) | P2 |

---

## 4. Workflow Details

### WF-005: Patient Registration
**Actor:** staff_full, dentist_owner
**Preconditions:** Branch membership active
**Steps:**
1. Staff opens "New Patient" form
2. Enter name, DOB, contact info, gender
3. Present marketing/data-sharing/SMS/email consent checkboxes (BR-015)
4. Save → creates `person` record + `patient` record
**Exception:** Duplicate person (same name+DOB+phone) → prompt staff to search first

### WF-023: Patient Search
**Actor:** All dental roles
**Preconditions:** Branch membership
**Steps:**
1. Staff enters name, DOB, or phone
2. Results filtered to branch scope
3. Select → open patient workspace
**Performance:** < 1s for up to 10,000 patients/branch

---

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-015 | IF registering patient THEN explicit marketing consent required | Registration | Checkbox required; defaults to unchecked |
| BR-015b | IF patient.status = archived THEN record is read-only | All write handlers | 403 |
| BR-015c | IF follow-up note added THEN append-only (no edit/delete) | Follow-up notes | 405 on PATCH/DELETE |
| BR-020 | Patient merge not implemented — manual deduplication only | Merge endpoint | 501 NOT IMPLEMENTED |
| TP-BR-005 | Completing one treatment-plan item must NOT complete the whole plan unless ALL items are complete | Treatment-plan completion (derived) | Plan status derived from linked treatments: all done→`completed`, some done→`partially_completed`, none→`approved`; `dismissed`/`declined` excluded |

### Treatment plans (TR-P1-08)

Plan FSM: `draft → presented → approved → partially_completed → completed` (`cancelled`
reachable from any non-terminal state). The completion states (`partially_completed`,
`completed`) are **derived**, not manually set: a treatment is linked to a plan
(`dental_treatment.treatment_plan_id`) at approval time, and any treatment status change
recomputes the parent plan per **TP-BR-005**. `approved`+ plans only.

**CR-05 — approval record:** approving a plan writes an append-only
`dental_treatment_plan_approval` row (`approved_by_person_id`, `method` =
signature/verbal/portal, optional `consent_form_id` / `plan_version_id` /
`signature_data`). Approval also links the patient's pending (diagnosed/planned)
treatments as the plan's items.

---

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Create patient | staff_full, dentist_owner, dentist_associate | staff_scheduling | — |
| View patient | all dental roles | — | Branch-scoped |
| Update demographics | staff_full, dentist_owner | staff_scheduling | — |
| Archive patient | dentist_owner | all others | — |
| Export / bulk ops | dentist_owner | all others | — |
| GDPR erasure | admin (platform) | — | — |
| Patient merge | dentist_owner | all others | Not yet implemented |

---

## 7. Data Requirements

### `patient` (platform, extended by this module)
| Field | Required | Description | Validation |
|-------|---------|-------------|-----------|
| id | Yes | UUID PK | — |
| person_id | Yes | FK → person | — |
| branch_id | Yes | FK → dental_branch | Branch scope |
| date_of_birth | Yes | Date | — |
| gender | No | enum | — |
| has_active_payment_plan | No | Boolean | Synced from dental-billing |
| archived_at | No | Timestamp | null = active |
| follow_up_notes | No | JSONB array | Append-only |
| recall_due_at | No | Date | Recall scheduling |

### Safety Floor (in-memory aggregation — no separate table)
Aggregated at query time from:
- `allergies` → clinical chart entries
- `medications` → active prescriptions
- `conditions` → clinical conditions

---

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Patient | Dentition (tooth set) | — | One Patient per Person per Branch; archived = read-only (BR-015b) |

External refs by ID: Visit, Invoice, ImagingStudy all reference Patient by UUID only.

---

## 8. State Transitions

### Patient Status
```
active ──► archived
archived ──► active  (reactivation by dentist_owner)
```

---

## 9. UI/UX Requirements

### Screen: Patient Registration Form
**States:** Empty, Filling, Validation error (consent required), Success → redirect to workspace

### Screen: Patient Search / List
**States:** Loading, Empty (no results), Results list, Error

### Screen: Patient Profile / Cabinet
**States:** Loading, Full profile, Archived notice (read-only badge)
**Components:** Safety Floor banner, demographics, recall section, treatment plan summary, statement summary

---

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /dental/patients | Create patient | person fields, consent, branch_id | patient | 422 (BR-015) |
| GET /dental/patients | Search patients | q, branch_id | patient[] | — |
| GET /dental/patients/:id | Patient profile | — | patient + safety floor | 404 |
| PATCH /dental/patients/:id | Update demographics | fields | patient | 403, 422 |
| POST /dental/patients/:id/archive | Archive | reason | patient | 403 |
| GET /dental/patients/:id/statement | Financial statement | — | statement | — |
| POST /dental/patients/:id/follow-up | Add follow-up note | text | note | 403 |
| POST /dental/patients/bulk-archive | Bulk archive | ids[] | count | 403 |
| POST /dental/patients/import | CSV/JSON import | file | result | 422 |
| GET /dental/patients/:id/export | Export record | — | JSON/CSV | — |
| POST /dental/patients/:id/treatment-plans/:planId/approval | CR-05: approve plan, link items, write approval record | approvedByPersonId, method, consentFormId?, planVersionId?, signatureData? | { approval, plan } | 404, 422 (PLAN_NOT_APPROVABLE) |

---

## 10b. Domain Events

Per ADR-006 (domain-events-descope), domain events here are audit-log-only semantic markers — there is NO event bus. Producers satisfy them by writing the corresponding dental_audit_log row synchronously via logAuditEvent(); reactive consumers (e.g. notifs) are deferred to a future phase. No publisher/emit scaffolding is required.

### Published
| Event | Trigger | Consumers |
|-------|---------|-----------|
| DE-021 PatientRegistered | Patient created (written as `patient.registered` audit row) | dental-audit, notifs (deferred) |

### Consumed
| Event | Source | Side Effect |
|-------|--------|------------|
| DE-008 InvoicePaid | dental-billing | Update `has_active_payment_plan` flag |

---

## 11. Acceptance Criteria

### AC-PAT-001: Registration requires consent
Given staff registers new patient without checking marketing consent
When form is submitted
Then 422 returned with `CONSENT_REQUIRED` error code

### AC-PAT-002: Archived patient is read-only
Given patient.status = archived
When any write operation attempted
Then 403 returned

### AC-PAT-003: Safety floor aggregation
Given patient has 2 allergies in clinical records and 1 active prescription
When GET /dental/patients/:id requested
Then safety floor contains 2 allergies and 1 medication

### AC-PAT-004: Search is branch-scoped
Given two branches with patients of same name
When staff from branch A searches
Then only branch A patients returned

---

## 12. Test Expectations

- Unit: registration validation (consent required)
- Unit: archived = read-only gate
- Unit: follow-up note append-only
- Integration: safety floor aggregation from clinical + billing
- Integration: patient search branch isolation
- E2E: full registration → workspace open flow

---

## 13. Edge Cases

- Same person registered at multiple branches → separate Patient records, shared Person
- CSV import with duplicate phone → flag duplicates, skip or merge based on config [VERIFY]
- Patient with no visits → workspace shows empty cabinet
- GDPR erasure request while active invoices exist → anonymize patient link; retain financial records
- Pediatric patient (age < 18) → FDI notation 51–85 dentition

---

## 14. Dependencies

### Internal
- `person` (platform) — PII fields
- `dental-org` — `assertBranchAccess`
- `dental-visit` — visit history, safety floor source
- `dental-clinical` — conditions, prescriptions for safety floor
- `dental-billing` — `has_active_payment_plan` flag, statement data

### External
- Storage (S3/MinIO) — patient profile photo [INFERRED]

---

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| No consent checkbox | 422 CONSENT_REQUIRED | "Patient consent is required to register" |
| Archived write attempt | 403 PATIENT_ARCHIVED | "This patient record is archived" |
| Duplicate patient | 409 DUPLICATE_PATIENT | "A patient with this information may already exist" |
| Patient not found | 404 | "Patient not found" |
| Merge not implemented | 501 | "Patient merge is not yet available" |

---

## 16. Performance Expectations

- Patient search: < 1s (10k patients/branch, full-text on name/DOB/phone)
- Patient profile: < 2s (with safety floor aggregation)
- Bulk archive: < 10s (≤500 patients)
- Import: < 30s (≤1000 rows CSV)
- Expected volume: 10k patients/branch per PRD NFR

---

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|-------|-------|------|--------|------|
| dental-patient.created | INFO | Patient registered | patientId, branchId | No |
| dental-patient.archived | INFO | Patient archived | patientId, branchId, reason | No |
| dental-patient.consent.captured | INFO | Consent recorded | patientId, consentType | No |
| dental-patient.safety-floor.empty | WARN | Safety floor empty | patientId | No |

---

## 18. Feature Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| dental_patient_merge_enabled | release | false | Enable BR-020 patient merge (not implemented) |
| dental_patient_csv_import | ops | true | Enable bulk CSV import |

---

## 19. Vertical Slice Plan

| Slice ID | Name | Description | Dependencies | Priority |
|----------|------|-------------|-------------|----------|
| PAT-S1 | Registration | Create patient + consent capture | dental-org, person | P0 |
| PAT-S2 | Search + Profile | Search by name/DOB, view cabinet | PAT-S1 | P0 |
| PAT-S3 | Safety Floor | Aggregate allergies, meds, conditions | dental-visit, dental-clinical | P1 |
| PAT-S4 | Recall + Follow-up | Recall scheduling, append-only notes | PAT-S1 | P1 |
| PAT-S5 | Archive + GDPR | Archive, reactivate, erasure request | — | P2 |
| PAT-S6 | Import/Export | CSV import, JSON export | PAT-S1 | P2 |

---

## 20. AI Instructions

1. Implement one slice at a time per PAT-S1 → PAT-S6.
2. Safety floor is an in-memory aggregation — do NOT create a separate table.
3. `has_active_payment_plan` is a flag synced from dental-billing, not computed here.
4. All queries must include `branch_id` in WHERE clause (branch-scoped).
5. Consent fields stored as JSONB on `person` (not on patient table).
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, CLAUDE.md, VERTICAL_TDD.md.
