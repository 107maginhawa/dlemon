# Dental PMD Module Specification

**Module:** `dental-pmd`
**Version:** 1.0
**Status:** Implemented

## Overview

The dental-pmd module manages **Portable Medical Documents (PMDs)** — immutable, versioned, digitally-signed snapshots of a completed dental visit. PMDs serve as the compliance-grade patient discharge record: once generated from a completed visit and signed, the document is never mutated.

The module also handles **imported PMDs** from external facilities: read-only records that can be linked to a patient and optionally have their Safety Floor data merged (add-only).

Primary users: Dentists (generate, sign, export); all branch members (read, list); admin staff (import).

## Schema

### Tables

| Table | Purpose |
|-------|---------|
| `pmd_document` | Immutable visit snapshot: content JSON, digital signature, checksum, supersession chain |
| `imported_pmd` | External PMD from another facility: raw content, safety floor merge flag |

### `pmd_document`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `baseEntityFields` |
| `visit_id` | uuid NOT NULL | FK → `dental_visit` |
| `patient_id` | uuid NOT NULL | FK → `patient` |
| `author_member_id` | uuid NOT NULL | FK → `dental_membership` (authoring dentist) |
| `branch_id` | uuid | FK → `dental_branch` |
| `status` | `pmd_document_status` enum NOT NULL | `generated \| signed \| superseded`; default `generated` |
| `content` | text NOT NULL | JSON snapshot of visit data (ICD-10 / CDT / RxNorm coded) |
| `signature` | text | Base64-encoded digital signature |
| `signed_at` | timestamp | Set when `status` transitions to `signed` |
| `supersedes_id` | uuid nullable | FK → `pmd_document` (self-referential); links to the prior PMD this replaces |
| `checksum` | text NOT NULL | SHA-256 of `content` |

### `imported_pmd`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `baseEntityFields` |
| `patient_id` | uuid NOT NULL | FK → `patient` |
| `source_facility` | text NOT NULL | Name of originating clinic |
| `source_reference` | text | External document reference number |
| `content` | text NOT NULL | Raw JSON content as received |
| `imported_at` | timestamp NOT NULL | Default `now()` |
| `safety_floor_merged` | text NOT NULL | `'true' \| 'false'` (string); default `'false'` |

### Status Enum

`pmd_document_status`: `generated | signed | superseded`

## Business Rules

### BR-021: PMD is a visit snapshot — immutable post-generation
**Rule:** BR-021 — A PMD is generated per-visit and verified by checksum. Future changes to the visit record do not alter the PMD. The document content is a point-in-time snapshot.

**Implementation:** `generatePMD.ts` — serializes the full visit record (treatments, chart entries, prescriptions) into `content`, computes `SHA-256` checksum, inserts with `status = 'generated'`. No update endpoint exists for `content`.

---

### BR-022: Imported PMD is read-only
**Rule:** BR-022 — An imported external PMD is stored as-is and is never editable. Its data is not automatically merged into the patient's editable records. Safety Floor merge is an explicit, additive-only operation.

**Implementation:** `importPMD.ts` — inserts `imported_pmd` with `safety_floor_merged = 'false'`. No update endpoint. Safety Floor merge (when implemented) appends to patient's allergies/medications/conditions without removing existing entries.

---

### BR-021b: PMD supersession — append-only chain
**Rule:** A new PMD generated for a visit that already has a `signed` PMD must set `supersedes_id` pointing to the previous PMD. The previous PMD transitions to `status = 'superseded'`. This creates an auditable chain — no PMD is ever deleted.

**Implementation:** `generatePMD.ts` — checks for existing PMD on the visit; if found and `signed`, sets `supersedes_id` and marks the old record `superseded`. Both records are retained.

---

### BR-021c: Signed PMD is terminal — no re-signing
**Rule:** Once a PMD reaches `status = 'signed'`, no further status transitions are permitted on that record. A corrected document requires generating a new superseding PMD.

**Implementation:** `status` enum is forward-only: `generated → signed → superseded`. Attempting to sign an already-signed record returns `422 INVALID_STATUS_TRANSITION`.

## State Transitions

### SM-01: PMD Document Status

```
generated → signed       (dentist signs the document)
generated → superseded   (superseded by a newer PMD before signing)
signed    → superseded   (superseded by a corrected PMD)
```

Terminal states: None — `superseded` is reached only when a newer PMD is created.
`signed` is effectively terminal for that record; no further changes are made to it.

**Enforced in:** `generatePMD.ts` — supersession logic. No explicit transition endpoint for `signed`; signing is part of the generate flow when `signature` is provided.

## Permission Matrix

| Operation | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|-----------|:---:|:---:|:---:|:---:|
| Generate PMD | Yes | Yes | No | No |
| Get PMD for visit | Yes | Yes | Yes | No |
| List PMDs (patient) | Yes | Yes | Yes | No |
| Export PMD | Yes | Yes | Yes | No |
| Import external PMD | Yes | No | Yes | No |
| List imported PMDs | Yes | Yes | Yes | No |
| Get imported PMD | Yes | Yes | Yes | No |

**Default-deny:** All endpoints require active branch membership. Roles not listed as "Yes" receive `403`.

## API Endpoints

| Method | Path | Handler | Notes / BRs |
|--------|------|---------|-------------|
| `POST` | `/dental/visits/:visitId/pmd` | `generatePMD` | BR-021; body: `{ visitId, patientId }`; creates snapshot + checksum |
| `GET` | `/dental/visits/:visitId/pmd` | `getPMDForVisit` | Returns latest non-superseded PMD for visit |
| `GET` | `/dental/pmd` | `listPMDs` | Query: `patientId` — lists all PMDs for a patient |
| `GET` | `/dental/visits/:visitId/pmd/export` | `exportPMD` | Returns PMD as downloadable JSON/PDF |
| `POST` | `/dental/pmd/import` | `importPMD` | BR-022; body: `{ patientId, sourceFacility, content, sourceReference? }` |
| `GET` | `/dental/pmd/imported` | `listImportedPMDs` | Query: `patientId` |
| `GET` | `/dental/pmd/imported/:id` | `getImportedPMD` | |

## TypeSpec Source

`specs/api/src/modules/dental-pmd.tsp`

## Dependencies

- `dental-visit` — `visit_id` FK; PMD generation requires a completed visit
- `patient` handler — `patient_id` FK
- `dental-org` — `author_member_id` FK → `dental_membership`; `assertBranchAccess`

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-20 | 1.0 | Initial spec (2 tables, BR-021/BR-022, SM-01 state transitions, 7 endpoints, permission matrix) |
