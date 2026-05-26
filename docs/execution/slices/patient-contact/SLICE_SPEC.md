# SLICE_SPEC: patient-contact

## Metadata
- **Slice**: patient-contact
- **Gap**: PAT-BR-002 / GAP (PatientContact entity missing)
- **Priority**: P0 — V1 Required
- **Source**: IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD §3.2, §5.1, §6.2

## Scope

Implement the `PatientContact / Guardian` entity. Adds a normalized `dental_patient_contact` table and four CRUD endpoints. The existing `emergencyContact` JSONB field on `patient` is **not removed** — new table is additive.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/dental/patients/:patientId/contacts` | Create contact |
| GET | `/dental/patients/:patientId/contacts` | List contacts (active only) |
| PATCH | `/dental/patients/:patientId/contacts/:contactId` | Update contact |
| DELETE | `/dental/patients/:patientId/contacts/:contactId` | Soft-delete contact |

## Acceptance Criteria

| ID | Description |
|----|-------------|
| AC-001 | POST returns 201 with full contact object including generated id |
| AC-002 | GET returns 200 with array of non-deleted contacts for the patient |
| AC-003 | PATCH returns 200 with updated contact object |
| AC-004 | DELETE returns 204 (no body) |
| AC-005 | All endpoints return 401 when unauthenticated |
| AC-006 | POST / GET / PATCH / DELETE return 404 for non-existent patient |
| AC-007 | POST returns 400 when `name` is missing or blank |
| AC-008 | POST with `isGuardian: true` stores flag correctly |
| AC-009 | POST with `isEmergencyContact: true` stores flag correctly |
| AC-010 | PATCH returns 404 when contactId does not exist |

## Business Rules

| ID | Rule |
|----|------|
| BR-001 (PAT-BR-002) | Minor patients (calculated age < 18 from DOB) support guardian linkage via `isGuardian: true` |
| BR-002 | `name` is required on every contact; must be non-blank |
| BR-003 | Soft-deleted contacts (deleted_at IS NOT NULL) are excluded from GET list |
| BR-004 | `isGuardian` and `isEmergencyContact` are independent boolean flags, both default false |
| BR-005 | Contact belongs to exactly one patient; patient deletion cascades |

## Entity Shape

```
dental_patient_contact {
  id                 uuid PK
  patient_id         uuid FK → patient.id CASCADE
  name               text NOT NULL
  relationship       text        -- 'parent', 'spouse', 'sibling', 'guardian', 'other', etc.
  phone              text
  email              text
  is_guardian        boolean DEFAULT false NOT NULL
  is_emergency_contact boolean DEFAULT false NOT NULL
  notes              text
  deleted_at         timestamp   -- soft-delete
  created_at         timestamp
  updated_at         timestamp
  version            integer
  created_by         uuid
  updated_by         uuid
}
```
