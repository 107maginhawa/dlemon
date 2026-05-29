<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC external-records-import, API_CONVENTIONS.md, ERROR_TAXONOMY.md -->

# API Contracts — external-records-import (/dental/emr-import)

> All responses wrap in `{ data, meta }`.
> Imported EMR records are read-only after import — no PATCH/DELETE.
> No auto-merge into editable dental records (BR-022 analog).

---

## Endpoints

### POST /api/v1/dental/emr-import

Import an external EMR/EHR record for a patient.

**Auth:** `dentist_associate`, `dentist_owner`
**Content-Type:** `multipart/form-data`

**Request body:**

| Field | Type | Required | Format | Enum / Constraints | Example |
|-------|------|----------|--------|-------------------|---------|
| `patient_id` | string | YES | uuid | — | `"01JX..."` |
| `branch_id` | string | YES | uuid | — | `"01JX..."` |
| `source_system` | string | YES | — | `hl7_fhir`, `cda`, `pdf`, `csv`, `other` | `"hl7_fhir"` |
| `file` | file | YES | FHIR JSON, CDA XML, PDF | Max 10 MB | — |
| `description` | string | NO | — | max:200 | `"GP referral notes"` |

**Response 201:** `{ data: EMRRecord }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `patient_id` | string (uuid) | NO | |
| `branch_id` | string (uuid) | NO | |
| `source_system` | string | NO | |
| `description` | string | YES | |
| `status` | string | NO | `imported` (terminal) |
| `imported_at` | string (date-time) | NO | |
| `file_url` | string (uri) | NO | Presigned URL, 24h TTL |

**PATCH/DELETE:** Returns `405 EMR_IMMUTABLE`

**Errors:** `UNSUPPORTED_SOURCE_SYSTEM(422)`, `IMPORT_PARSE_ERROR(422)`, `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### GET /api/v1/dental/emr-import/:patientId

List imported EMR records for a patient.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `patientId` (uuid)
**Query params:** `branch_id` (uuid, required), `page`, `per_page`

**Response 200:** Standard paginated collection of EMRRecord summary objects

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `source_system` | string | NO | |
| `description` | string | YES | |
| `imported_at` | string (date-time) | NO | |

**Sort:** `imported_at DESC`

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### GET /api/v1/dental/emr-import/:id

Get full detail of an imported EMR record.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (emr record uuid)

**Response 200:** `{ data: EMRRecord }` (full object with download URL)

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `patient_id` | string (uuid) | NO | |
| `branch_id` | string (uuid) | NO | |
| `source_system` | string | NO | |
| `description` | string | YES | |
| `status` | string | NO | `imported` |
| `imported_at` | string (date-time) | NO | |
| `file_url` | string (uri) | NO | Fresh presigned URL, 24h TTL |
| `expires_at` | string (date-time) | NO | |

**Errors:** `EMR_NOT_FOUND(404)`, `FORBIDDEN(403)`
