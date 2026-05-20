# Dental EMR Module Specification

**Module:** `dental-emr`
**Version:** 1.0
**Status:** Implemented

## Overview

The dental-emr module provides structured medical consultation documentation for telemedicine and minor-ailment consultations. It captures the full SOAP-style encounter record — chief complaint, clinical assessment, treatment plan, vital signs, symptom details, prescriptions, and follow-up instructions — in a single `consultation_note` entity. Role-based access control is enforced at every endpoint: providers see only their own consultations, patients see their own records, admins see all.

This module is distinct from the dental-visit module (which tracks in-clinic visit state and treatment charting). EMR targets telehealth and quick consultation workflows. The `context` field provides idempotency for appointment- or walk-in-linked consultations.

## Schema

### Tables

| Table | Purpose |
|-------|---------|
| `consultation_note` | Core documentation entity: patient, provider, clinical fields, vitals, status |

### `consultation_note`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | NOT NULL | PK (from `baseEntityFields`) |
| `created_at` | timestamptz | NOT NULL | Auto-set |
| `updated_at` | timestamptz | NOT NULL | Auto-updated |
| `patient_id` | UUID → `patient.id` | NOT NULL | CASCADE delete |
| `provider_id` | UUID → `provider.id` | NOT NULL | CASCADE delete |
| `context` | varchar(255) | NULL | Idempotency key (unique, e.g. `appointment:123`, `walkin:456`) |
| `chief_complaint` | text | NULL | 1–500 chars; reason for visit |
| `assessment` | text | NULL | 1–2000 chars; clinical assessment |
| `plan` | text | NULL | 1–2000 chars; treatment plan |
| `vitals` | jsonb | NULL | See `VitalsData` shape below |
| `symptoms` | jsonb | NULL | See `SymptomsData` shape below |
| `prescriptions` | jsonb | NULL | Array of `PrescriptionData` objects |
| `follow_up` | jsonb | NULL | See `FollowUpData` shape below |
| `external_documentation` | jsonb | NULL | Integration data (e.g. Mapflow) |
| `status` | `consultation_status` | NOT NULL | Enum: `draft \| finalized \| amended` |
| `finalized_at` | timestamptz | NULL | Set when status → `finalized` |
| `finalized_by` | UUID | NULL | Person ID who finalized |

**Indexes:** patient_id, provider_id, status, finalized_at, finalized_by, (patient_id, status), (provider_id, status), (patient_id, created_at).  
**Partial indexes:** finalized consultations index on (patient_id, finalized_at) WHERE status = 'finalized'; draft consultations index on (provider_id, created_at) WHERE status = 'draft'.

**Check constraints:**
- `chief_complaint` length 1–500 when not NULL
- `assessment` length 1–2000 when not NULL
- `plan` length 1–2000 when not NULL
- `finalized_at` and `finalized_by` must both be non-null when `status = 'finalized'`

### JSONB Field Shapes

**`VitalsData`** (standardized metric units):
```
temperatureCelsius?: float   diastolicBp?: int     heartRate?: int
systolicBp?: int             weightKg?: float      heightCm?: float
respiratoryRate?: int        oxygenSaturation?: int  notes?: string
```

**`SymptomsData`**:
```
onset?: ISO-8601 datetime    durationHours?: int    severity?: 'mild'|'moderate'|'severe'
description?: string         associated?: string[]  denies?: string[]
```

**`PrescriptionData`** (array element):
```
id?: string                  medication: string     dosageAmount?: float
dosageUnit?: string          frequency?: string     durationDays?: int
instructions?: string        notes?: string
```

**`FollowUpData`**:
```
needed: boolean              timeframeDays?: int    instructions?: string
specialistReferral?: string
```

### Status Enum

`draft` | `finalized` | `amended`

## State Machine

### SM-01: Consultation Status

```
draft ──finalize──> finalized ──amend──> amended ──re-finalize──> finalized
```

| Transition | Trigger | Business logic |
|------------|---------|----------------|
| `draft → finalized` | `POST /emr/consultations/:id/finalize` | Only the owning provider may finalize; sets `finalized_at` + `finalized_by` |
| `finalized → amended` | status update via PATCH | Signals active amendment cycle |
| `amended → finalized` | re-finalization | Closes amendment cycle |

**Enforced in:** `emr.repo.ts` `validateStatusTransition()` — `draft → amended` and any backward transition throw an error.

## Business Rules

### BR-EMR-001: Only draft consultations can be finalized
**Rule:** `POST /emr/consultations/:id/finalize` rejects with 409 `CONSULTATION_NOT_DRAFT` if the consultation status is not `draft`.

**HTTP:** `409 Conflict`

**Implementation:** `finalizeConsultation.ts` — checks `consultation.status !== 'draft'` before calling `consultationRepo.finalizeNote()`.

---

### BR-EMR-002: Provider ownership — create and finalize
**Rule:** A provider may only create or finalize consultations for themselves. `body.provider` must match the authenticated user's linked provider profile. Providers cannot create consultations on behalf of another provider.

**HTTP:** `403 Forbidden`

**Implementation:** `createConsultation.ts` — `providerRepo.findByPersonId(user.id)` then checks `body.provider !== userProvider.id`. `finalizeConsultation.ts` checks `consultation.provider !== provider.id`.

---

### BR-EMR-003: Context uniqueness for idempotency
**Rule:** The optional `context` field (e.g. `appointment:abc123`) is enforced as UNIQUE at the database level. A duplicate `context` value returns 409.

**HTTP:** `409 Conflict`

**Implementation:** `consultation_notes_context_unique` unique constraint on `context` column. Database error propagates as a conflict response.

---

### BR-EMR-004: Role-based list filtering — providers see own, patients see own, admins see all
**Rule:** `GET /emr/consultations` automatically scopes results by role. Providers see only consultations where they are the provider. Patients see only consultations where they are the patient. Admins see all. Any other role receives 403.

**HTTP:** `403 Forbidden` for unknown roles

**Implementation:** `listConsultations.ts` — checks `isAdmin`, `isProvider`, `isPatient` from `user.role`. For providers: filters by `provider.id`; for patients: filters by `patient.id`. Non-admin, non-provider, non-patient roles throw `ForbiddenError`.

---

### BR-EMR-005: listEMRPatients scoped to authenticated provider
**Rule:** `GET /emr/patients` returns only patients who have at least one consultation with the authenticated provider. Providers cannot query other providers' patient lists.

**HTTP:** `403 Forbidden` if provider profile not found

**Implementation:** `listEMRPatients.ts` — `consultationRepo.findMany({ provider: provider.id })` to get unique patient IDs, then fetches those patients via IN query. Enriches each patient with `consultationStats` (total, draft, finalized, recent date).

---

### BR-EMR-006: Finalized consultation records finalizedBy for audit trail
**Rule:** When a consultation is finalized, `finalized_at` (current timestamp) and `finalized_by` (authenticated user's person ID) are written. A DB check constraint enforces both fields are present when `status = 'finalized'`.

**HTTP:** N/A — enforced at schema + application level

**Implementation:** `finalizeConsultation.ts` calls `consultationRepo.finalizeNote(id, user.id)`. Schema: `finalizedAtConstraint` check.

---

### BR-EMR-007: Update supports null clearing of clinical fields
**Rule:** `PATCH /emr/consultations/:id` accepts `null` values for optional clinical fields (`chiefComplaint`, `assessment`, `plan`, `vitals`, `symptoms`, `prescriptions`, `followUp`, `externalDocumentation`) to explicitly clear them. Omitted fields are unchanged.

**HTTP:** N/A — update semantics

**Implementation:** `UpdateConsultationRequest` interface — all optional fields typed as `T | null`. `updateConsultation.ts` passes values as-is to repo.

---

### BR-EMR-008: Text search across clinical fields
**Rule:** `GET /emr/consultations?q=...` performs ILIKE search across `chief_complaint`, `assessment`, and `plan` fields simultaneously.

**Implementation:** `consultationRepo.searchNotes()` — builds `OR` of three ILIKE conditions across clinical text columns.

## Permission Matrix

| Operation | provider (owner) | provider (non-owner) | patient (owner) | admin |
|-----------|:---:|:---:|:---:|:---:|
| Create consultation | Yes | No (403) | No (403) | No (403) |
| List consultations (own) | Yes | — | Yes | Yes (all) |
| Get consultation | Yes | No (403) | Yes | Yes |
| Update consultation | Yes | No (403) | No (403) | No (403) |
| Finalize consultation | Yes | No (403) | No (403) | No (403) |
| List EMR patients | Yes | — | No | Yes |

**Default-deny:** Any role not in the allowed list receives `ForbiddenError` (HTTP 403). Provider non-owners receive 403 on get/update/finalize.

## API Endpoints

| Method | Path | OperationId | Required Role | BR |
|--------|------|-------------|---------------|----|
| POST | `/emr/consultations` | `createConsultation` | `provider` | BR-EMR-002, BR-EMR-003 |
| GET | `/emr/consultations` | `listConsultations` | `provider \| patient \| admin` | BR-EMR-004, BR-EMR-008 |
| GET | `/emr/consultations/:consultation` | `getConsultation` | `admin \| provider:owner \| patient:owner` | BR-EMR-002 |
| PATCH | `/emr/consultations/:consultation` | `updateConsultation` | `provider:owner` | BR-EMR-007 |
| POST | `/emr/consultations/:consultation/finalize` | `finalizeConsultation` | `provider:owner` | BR-EMR-001, BR-EMR-002, BR-EMR-006 |
| GET | `/emr/patients` | `listEMRPatients` | `provider \| admin` | BR-EMR-005 |

**Query parameters for `listConsultations`:** `patient` (UUID filter), `status` (`draft|finalized|amended`), `q` (text search), `limit`, `offset`.  
**Query parameters for `listEMRPatients`:** `expand` (e.g. `person`), `status`, `q`, `hasRecentConsultations` (bool, filters to patients with/without a consultation in last 30 days), `limit`, `offset`.  
**Expand support:** `getConsultation` and `listConsultations` support `?expand=patient,provider` to inline related entity details.

## TypeSpec Source

`specs/api/src/modules/emr.tsp`

## Dependencies

- `patient` handler / `patient.schema.ts` — `patient_id` FK; `PatientRepository.findByPersonId()`
- `provider` handler / `provider.schema.ts` — `provider_id` FK; `ProviderRepository.findByPersonId()`
- `baseEntityFields` from `@/core/database.schema` — id, timestamps, version, audit columns
- Better-Auth `user.role` — role-based access control (`provider`, `patient`, `admin`)
- `date-fns` `subDays` — `hasRecentConsultations` filter (30-day window)

## Known Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| No branch isolation | Medium | EMR consultations are not scoped to a dental branch. Provider-level scoping only. A future multi-branch provider needs explicit `branch_id` on `consultation_note`. |
| Amended status not auto-triggered | Low | `amended` status must be set manually via PATCH. No trigger on update of a finalized record. |
| `findManyWithDetails` expansion stub | Low | `findManyWithDetails()` returns notes without full expansion for list endpoints — IN-query expansion not yet implemented (noted in repo comment). |
| No hard delete | Low | Schema has no soft-delete column; records cannot be archived. Future: add `archived_at` for GDPR erasure. |

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-21 | 1.0 | Initial spec — BR-EMR-001–008, SM-01 state machine, 6 API endpoints, permission matrix |
