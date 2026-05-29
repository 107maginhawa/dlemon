<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC dental-patient, API_CONVENTIONS.md, ERROR_TAXONOMY.md -->

# API Contracts — dental-patient

> All responses wrap in `{ data, meta }`.
> Auth: Bearer JWT required. All endpoints require branch membership.
> Search is always branch-scoped (AC-PAT-004).

---

## Endpoints

### POST /api/v1/dental/patients

Create a new patient record.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Rate limit:** Default

> **Single-consent model (V-PAT-004).** Registration captures ONE consent flag,
> not a 4-consent split. The earlier `marketing_consent` / `data_sharing_consent`
> / `sms_consent` / `email_consent` shape (and split first/last name) was never
> implemented and has been removed. The wire body is the real handler body:
> `{ displayName, dateOfBirth?, gender?, consentGiven, branchId }`.

**Request body:**

| Field | Type | Nullable | Required | Format | Constraints | Example |
|-------|------|----------|----------|--------|-------------|---------|
| `displayName` | string | NO | YES | — | min:1 (split into firstName + lastName server-side) | `"Jane Smith"` |
| `dateOfBirth` | string | YES | NO | date (YYYY-MM-DD) | past date | `"1985-03-15"` |
| `gender` | string | YES | NO | — | — | `"female"` |
| `consentGiven` | boolean | NO | YES | — | must be `true` (else `CONSENT_REQUIRED(422)`) | `true` |
| `branchId` | string | NO | YES | uuid | branch membership required | `"01JX..."` |

The captured consent is persisted as a JSONB `consent` object on the underlying
person record: `{ registrationConsent: true, capturedAt: <ISO timestamp> }`
(V-PAT-005).

**Response 201:** `{ data: Patient }` (also includes `displayName`, embedded
`person` subset, and a `warning` object when duplicates are detected).

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | Patient ID |
| `preferredBranchId` | string (uuid) | NO | |
| `displayName` | string | NO | |
| `person` | object | NO | `{ id, firstName, lastName, dateOfBirth, gender }` |
| `status` | string | NO | `active`, `archived` |
| `createdAt` | string (date-time) | NO | |

**Errors:** `VALIDATION_ERROR(400)`, `CONSENT_REQUIRED(422)`, `DUPLICATE_PATIENT(409)`
**Events emitted:** DE-021 PatientRegistered (audit-log-only marker per ADR-006 — written synchronously as a `patient.registered` `dental_audit_log` row; no event bus)

---

### GET /api/v1/dental/patients

Search patients in branch.

**Auth:** `dentist_owner`, `dentist_associate`, `hygienist`, `staff_full`, `staff_scheduling`, `dental_assistant`, `front_desk`, `billing_staff`, `read_only` (V-PAT-008: patient list/search READ is the clinic-wide floor — all four clinical roles PLUS extended staff `dental_assistant`/`front_desk`/`billing_staff`/`read_only`, scoped to the caller's branch; matches `listDentalPatients.ts`)
**Query params:**

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `branch_id` | uuid | YES | Branch scope |
| `q` | string | NO | Name/DOB search, min 2 chars |
| `status` | string | NO | `active`, `archived` (default: `active`) |
| `page` | integer | NO | Default: 1 |
| `per_page` | integer | NO | Default: 20, max: 100 |

**Response 200:** Standard paginated collection of Patient objects (without sensitive PII details).

**Sort:** `last_name ASC` (default)

**Errors:** `VALIDATION_ERROR(400)`, `FORBIDDEN(403)`

---

### GET /api/v1/dental/patients/:id

Get full patient profile including safety floor.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (uuid)

**Response 200:** `{ data: PatientProfile }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `branch_id` | string (uuid) | NO | |
| `first_name` | string | NO | |
| `last_name` | string | NO | |
| `date_of_birth` | string (date) | NO | |
| `email` | string | YES | |
| `phone` | string | YES | |
| `gender` | string | YES | |
| `address` | object | YES | |
| `status` | string | NO | `active`, `archived` |
| `safetyFloor` | object | NO | Safety floor summary counts: `{ hasAlerts, allergyCount, medicationCount, conditionCount }` (V-PAT-007 / AC-PAT-003) |
| `followUpNotes` | FollowUpNote[] | NO | |
| `consent` | object | YES | Single-consent model: `{ registrationConsent, capturedAt }` (V-PAT-005). NOT a 4-consent split. |
| `created_at` | string (date-time) | NO | |
| `updated_at` | string (date-time) | NO | |

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### PATCH /api/v1/dental/patients/:id

Update patient demographics.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (uuid)

**Request body:** Partial Patient (any subset of create fields except `branch_id`)

**Response 200:** `{ data: Patient }`

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`, `VALIDATION_ERROR(422)`

---

### POST /api/v1/dental/patients/:id/archive

Archive a patient.

**Auth:** `dentist_owner`
**Path params:** `id` (uuid)

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `reason` | string | NO | YES | min:5, max:500 | `"Patient requested archival"` |

**Response 200:** `{ data: { ok: true } }`

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`, `PATIENT_ALREADY_ARCHIVED(409)`

---

### GET /api/v1/dental/patients/:id/statement

Financial statement for patient.

**Auth:** `staff_full`, `dentist_owner`
**Path params:** `id` (uuid)

**Response 200:**

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `patient_id` | string (uuid) | NO | |
| `total_billed_cents` | integer | NO | |
| `total_paid_cents` | integer | NO | |
| `outstanding_cents` | integer | NO | |
| `invoices` | InvoiceSummary[] | NO | |
| `generated_at` | string (date-time) | NO | |

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### POST /api/v1/dental/patients/:id/follow-up

Append a follow-up note (append-only).

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (uuid)

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `text` | string | NO | YES | min:5, max:2000 | `"Patient to call for recall"` |

**Response 201:** `{ data: FollowUpNote }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `patient_id` | string (uuid) | NO | |
| `text` | string | NO | |
| `author_id` | string (uuid) | NO | |
| `created_at` | string (date-time) | NO | |

**PATCH/DELETE:** Returns `405 FOLLOW_UP_IMMUTABLE`

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`, `VALIDATION_ERROR(422)`

---

### POST /api/v1/dental/patients/bulk-archive

Archive multiple patients.

**Auth:** `dentist_owner`

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `ids` | string[] | NO | YES | max:50 items, each uuid | `["01JX...", "01JY..."]` |
| `reason` | string | NO | YES | min:5, max:500 | `"Practice closure"` |

**Response 200:** `{ data: { affected: N, errors: [...] } }`

**Errors:** `FORBIDDEN(403)`, `VALIDATION_ERROR(422)`

---

### POST /api/v1/dental/patients/import

Bulk import from CSV/JSON.

**Auth:** `dentist_owner`
**Content-Type:** `multipart/form-data`

**Request body:**

| Field | Type | Nullable | Required | Format | Notes |
|-------|------|----------|----------|--------|-------|
| `file` | file | NO | YES | `.csv` or `.json` | Max 10 MB |
| `branch_id` | string | NO | YES | uuid | |

**Response 202:** `{ data: { job_id: "uuid", status: "queued" } }`
(Async — poll via `GET /api/v1/dental/import-jobs/:id`)

**Errors:** `VALIDATION_ERROR(422)`, `INVALID_IMPORT_FORMAT(422)`, `FORBIDDEN(403)`

---

### GET /api/v1/dental/patients/:id/export

Export patient record as JSON or CSV.

**Auth:** `dentist_owner`
**Path params:** `id` (uuid)
**Query params:** `format` (enum: `json`, `csv`; default: `json`)

**Response 200:** File download (Content-Disposition: attachment)

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`
