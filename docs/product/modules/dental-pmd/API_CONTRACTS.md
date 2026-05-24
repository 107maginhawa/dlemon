<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC dental-pmd, API_CONVENTIONS.md, ERROR_TAXONOMY.md -->

# API Contracts — dental-pmd

> All responses wrap in `{ data, meta }`.
> PMD = Patient Medical Dossier. Generated documents are immutable (BR-022).
> Generated: terminal state. Imported: read-only.

---

## Endpoints

### POST /api/v1/dental/pmd/generate

Generate a PMD for a completed visit.

**Auth:** `dentist_associate`, `dentist_owner`
**Rate limit:** Default

**Request body:**

| Field | Type | Nullable | Required | Format | Notes |
|-------|------|----------|----------|--------|-------|
| `visit_id` | string | NO | YES | uuid | Visit must be in `completed` status (BR-021) |
| `branch_id` | string | NO | YES | uuid | |
| `patient_id` | string | NO | YES | uuid | |

**Response 201:** `{ data: PMDDocument }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `visit_id` | string (uuid) | NO | |
| `patient_id` | string (uuid) | NO | |
| `branch_id` | string (uuid) | NO | |
| `status` | string | NO | `generated` (terminal) |
| `generated_at` | string (date-time) | NO | |
| `download_url` | string | NO | Presigned URL, 24h TTL |
| `expires_at` | string (date-time) | NO | URL expiry |

**Errors:** `VISIT_NOT_COMPLETED(422)`, `NOT_FOUND(404)`, `FORBIDDEN(403)`
**Events emitted:** DE-017 PMDGenerated

---

### GET /api/v1/dental/pmd/:patientId

List PMD documents for a patient.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `patientId` (uuid)
**Query params:** `branch_id` (uuid, required), `page`, `per_page`

**Response 200:** Standard paginated collection

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `visit_id` | string (uuid) | NO | |
| `generated_at` | string (date-time) | NO | |
| `visit_date` | string (date) | NO | Snapshot of visit date at generation |
| `type` | string | NO | `generated` or `imported` |

**Sort:** `generated_at DESC`

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### GET /api/v1/dental/pmd/:id/download

Get a fresh presigned download URL for a PMD.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (pmd uuid)

**Response 200:**

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `download_url` | string (uri) | NO | Presigned URL, 24h TTL |
| `expires_at` | string (date-time) | NO | |
| `filename` | string | NO | e.g., `PMD-2026-05-24-patient.pdf` |
| `size_bytes` | integer | NO | |

**Errors:** `PMD_NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### POST /api/v1/dental/pmd/import

Import an external PMD file.

**Auth:** `dentist_associate`, `dentist_owner`, `staff_full`
**Content-Type:** `multipart/form-data`

**Request body:**

| Field | Type | Required | Format | Constraints |
|-------|------|----------|--------|-------------|
| `file` | file | YES | PDF, XML | Max 10 MB |
| `patient_id` | string | YES | uuid | |
| `branch_id` | string | YES | uuid | |
| `source_description` | string | NO | — | max:200 |
| `checksum` | string | NO | SHA-256 hex | Verified server-side if provided |

**Response 201:** `{ data: ImportedPMD }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `patient_id` | string (uuid) | NO | |
| `branch_id` | string (uuid) | NO | |
| `status` | string | NO | `imported` (terminal) |
| `source_description` | string | YES | |
| `imported_at` | string (date-time) | NO | |
| `file_url` | string (uri) | NO | Presigned URL |

**PATCH/DELETE:** Returns `405 IMPORTED_PMD_IMMUTABLE`

**Errors:** `CHECKSUM_MISMATCH(422)`, `UNSUPPORTED_MIME_TYPE(422)`, `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### GET /api/v1/dental/pmd/imported/:id

Get detail of an imported PMD.

**Auth:** `dentist_associate`, `dentist_owner`, `staff_full`
**Path params:** `id` (uuid)

**Response 200:** `{ data: ImportedPMD }` (full object with download URL)

**Errors:** `PMD_NOT_FOUND(404)`, `FORBIDDEN(403)`
