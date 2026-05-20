# Dental Patient Module Specification

**Module:** `dental-patient`
**Version:** 1.0
**Status:** Implemented

## Overview

The dental-patient module manages the dental-specific patient registry. It wraps the base `patient` table (from the `patient` handler) with dental-domain enrichments: follow-up notes, safety floor (allergies, medications, conditions), recall scheduling, treatment plan management, itemized financial statements, and dentition chart initialization.

A `DentalPatient` record links one-to-one to a Better-Auth `person` via the `patient` table. The module provides full CRUD plus bulk operations (bulk-archive, import CSV/JSON, export) and read-only views aggregated from clinical and billing modules.

Primary users: All branch members (create/view); dentist roles (clinical views); front desk (`staff_full`, `staff_scheduling`) for registration and recall.

## Schema

### Tables

The dental-patient module does not own its own schema tables. It operates on:

| Table | Owner | Purpose |
|-------|-------|---------|
| `patient` | `patient` handler | Core patient record with dental extensions |
| `person` | `person` handler | PII: name, DOB, gender, contact info |

### `patient` (dental extensions)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `baseEntityFields` |
| `person_id` | uuid NOT NULL | FK → `person` (CASCADE DELETE); unique |
| `primary_provider` | jsonb | `{ name, specialty?, phone?, fax? }` |
| `primary_pharmacy` | jsonb | `{ name, address?, phone?, fax? }` |
| `preferred_branch_id` | uuid | FK → `dental_branch` |
| `dental_history_summary` | text | Free-text clinical notes |
| `needs_follow_up` | boolean | Default `false`; drives follow-up queue |
| `has_active_payment_plan` | boolean | Denormalized flag; updated by billing module |
| `status` | text NOT NULL | `active \| archived`; default `active` |
| `archived_at` | timestamp | Set on archive |
| `emergency_contact` | jsonb | `{ name, relationship?, phone?, email? }` |
| `communication_preferences` | jsonb | `{ preferredChannel, reminderOptIn, preferredLanguage }` |
| `recall_date` | text | ISO date string for next recall visit |
| `recall_note` | text | Optional note for recall |
| `follow_up_notes` | jsonb | Append-only array of `{ id, text, createdAt, createdBy }` |

### Safety Floor (in-memory aggregation)

The safety floor is not a separate table. `getDentalPatientSafetyFloor` aggregates:
- `allergies` — from clinical chart entries
- `medications` — from active prescriptions
- `conditions` — from clinical conditions list

Returned as `DentalPatientSafetyFloor { allergies: SafetyEntry[], medications: SafetyEntry[], conditions: SafetyEntry[] }`.

## Business Rules

### BR-015: Patient registration requires explicit consent
**Rule:** BR-015 — Patient registration requires `consentGiven: true` in the create request. Attempting to register a patient without explicit consent is rejected.

**HTTP:** `422` — missing or `false` consent returns a validation error.

**Implementation:** `createDentalPatient.ts` — validates `body.consentGiven === true` before inserting. UI enforces via consent checkbox in `patient-registration-modal.tsx`.

---

### BR-020: Patient merge not implemented — manual deduplication only
**Rule:** BR-020 — Patient merge and unmerge are not implemented. Duplicate patients (detected at creation via `DuplicateWarning`) must be manually managed.

**HTTP:** N/A — `createDentalPatient` returns a `warning: { hasDuplicates, count, duplicateIds }` field when potential duplicates exist, but does not block creation.

**Implementation:** `createDentalPatient.ts` — runs a fuzzy name + DOB check and populates `warning`. `mergePatients.ts` and `unmergePatients.ts` are TODO stubs.

---

### BR-015b: Archived patient — read-only
**Rule:** Archived (`status = 'archived'`) patients cannot have new visits, treatments, or invoices created against them. Restore via `POST /:id/restore`.

**Implementation:** `archiveDentalPatient.ts` sets `status = 'archived'` and `archived_at`. Downstream modules check patient status before creating linked records.

---

### BR-015c: Follow-up notes are append-only
**Rule:** Follow-up notes stored in `patient.follow_up_notes` (JSONB array) are append-only. Individual notes cannot be edited or deleted.

**Implementation:** `addFollowUpNote.ts` pushes to the JSONB array. No delete/update endpoint exists for individual notes.

## State Transitions

### SM-01: Patient Status

`active` ↔ `archived`

Both directions are permitted:
- `active → archived`: via `POST /:id/archive`
- `archived → active`: via `POST /:id/restore`

Bulk archive: `POST /bulk-archive` (body: `{ patientIds: UUID[] }`).

No terminal state — patients can be restored at any time.

## Permission Matrix

| Operation | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|-----------|:---:|:---:|:---:|:---:|
| Create patient | Yes | Yes | Yes | Yes |
| Get patient | Yes | Yes | Yes | Yes |
| List patients | Yes | Yes | Yes | Yes |
| Update patient fields | Yes | Yes | Yes | Yes |
| Archive / restore patient | Yes | Yes | Yes | No |
| Bulk archive | Yes | Yes | Yes | No |
| Import patients | Yes | No | Yes | No |
| Export patients | Yes | Yes | Yes | No |
| Add follow-up note | Yes | Yes | Yes | Yes |
| List follow-up notes | Yes | Yes | Yes | Yes |
| Get safety floor | Yes | Yes | Yes | No |
| Get statement | Yes | Yes | Yes | Yes |
| Get / accept treatment plan | Yes | Yes | No | No |
| Initialize dentition | Yes | Yes | No | No |
| List patient visits | Yes | Yes | Yes | No |
| List patient conditions | Yes | Yes | Yes | No |

**Default-deny:** All endpoints require an active branch membership (`assertBranchAccess`). Operations not listed as "Yes" for a role return `403`.

## API Endpoints

| Method | Path | Handler | Notes / BRs |
|--------|------|---------|-------------|
| `POST` | `/dental/patients` | `createDentalPatient` | BR-015; returns `warning` on duplicates |
| `GET` | `/dental/patients` | `listDentalPatients` | Query: `branchId?`, `status?`, `search?` |
| `POST` | `/dental/patients/import` | `importPatients` | JSON array of patient rows |
| `GET` | `/dental/patients/export` | `exportDentalPatients` | Query: `branchId?`, `format?`, `status?` |
| `POST` | `/dental/patients/bulk-archive` | `bulkArchiveDentalPatients` | Body: `{ patientIds }` |
| `GET` | `/dental/patients/:id` | `getDentalPatient` | Embeds `person` details |
| `PATCH` | `/dental/patients/:id` | `updateDentalPatient` | Partial update |
| `POST` | `/dental/patients/:id/archive` | `archiveDentalPatient` | Sets `status = 'archived'` |
| `POST` | `/dental/patients/:id/restore` | `restoreDentalPatient` | Sets `status = 'active'` |
| `GET` | `/dental/patients/:id/follow-up-notes` | `listFollowUpNotes` | |
| `POST` | `/dental/patients/:id/follow-up-notes` | `addFollowUpNote` | Append-only; BR-015c |
| `GET` | `/dental/patients/:id/safety-floor` | `getDentalPatientSafetyFloor` | Aggregated from clinical records |
| `GET` | `/dental/patients/:id/statement` | `getDentalPatientStatement` | Visits + invoices + payments |
| `GET` | `/dental/patients/:id/treatment-plan` | `getTreatmentPlan` | Current accepted treatment plan |
| `GET` | `/dental/patients/:id/treatment-plan/:version` | `getTreatmentPlanVersion` | Historical version |
| `POST` | `/dental/patients/:id/treatment-plan/accept` | `acceptTreatmentPlan` | Patient consent to plan |
| `GET` | `/dental/patients/:id/visits` | `listPatientVisits` | Visit history |
| `GET` | `/dental/patients/:id/conditions` | `listPatientConditions` | Active conditions |
| `POST` | `/dental/patients/:patientId/dentition` | `initializeDentition` | Body: `{ dateOfBirth, visitId }`; auto-detects deciduous vs permanent |

## TypeSpec Source

`specs/api/src/modules/dental-patient.tsp`

## Dependencies

- `patient` handler — owns `patient` table schema
- `person` handler — PII (name, DOB, contact)
- `dental-org` — `assertBranchAccess` for all endpoints
- `dental-billing` — `has_active_payment_plan` flag sync; statement data
- `dental-visit` — `listPatientVisits`, safety floor aggregation
- `dental-clinical` — conditions, prescriptions for safety floor

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-20 | 1.0 | Initial spec (patient + person tables, BR-015/BR-020, 19 endpoints, permission matrix) |
