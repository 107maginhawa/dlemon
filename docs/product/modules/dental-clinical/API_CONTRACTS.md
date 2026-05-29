<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC dental-clinical, API_CONVENTIONS.md, ERROR_TAXONOMY.md -->

# API Contracts — dental-clinical

> All responses wrap in `{ data, meta }`.
> Key rules: BR-003 (locked visit immutable), BR-014 (consent), BR-017 (Rx prescriber), BR-018 (lab orders).
> Medical history: append-only (no PATCH/DELETE).

---

## Endpoints

### POST /api/v1/dental/visits/:id/prescriptions

Write a prescription. Dentist role required.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (visit uuid)

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `prescriber_member_id` | string | NO | YES | uuid (dentist membership) | `"01JX..."` |
| `medication_name` | string | NO | YES | max:200 | `"Amoxicillin"` |
| `dosage` | string | NO | YES | max:100 | `"500mg"` |
| `frequency` | string | NO | YES | max:100 | `"3 times daily"` |
| `duration_days` | integer | NO | YES | min:1, max:365 | `7` |
| `instructions` | string | YES | NO | max:500 | `"Take with food"` |
| `repeats` | integer | NO | YES | min:0, max:12 | `0` |

**Response 201:** `{ data: Prescription }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `visit_id` | string (uuid) | NO | |
| `prescriber_member_id` | string (uuid) | NO | |
| `medication_name` | string | NO | |
| `dosage` | string | NO | |
| `written_at` | string (date-time) | NO | |

**Errors:** `PRESCRIBER_REQUIRED(422)`, `DENTIST_ROLE_REQUIRED(403)`, `VISIT_IMMUTABLE(422)`, `NOT_FOUND(404)`
**Events emitted:** DE-016 PrescriptionWritten

---

### GET /api/v1/dental/visits/:id/prescriptions

List prescriptions for visit.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (visit uuid)

**Response 200:** `{ data: Prescription[] }`

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### POST /api/v1/dental/visits/:id/lab-orders

Create a lab order.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (visit uuid)

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `lab_name` | string | NO | YES | max:120 | `"Central Dental Lab"` |
| `order_type` | string | NO | YES | max:100 | `"Crown - PFM"` |
| `tooth_number` | integer | YES | NO | FDI notation | `14` |
| `due_date` | string | YES | NO | date, future | `"2026-06-15"` |
| `instructions` | string | YES | NO | max:1000 | `"Match shade A2"` |
| `shade` | string | YES | NO | max:20 | `"A2"` |

**Response 201:** `{ data: LabOrder }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `visit_id` | string (uuid) | NO | |
| `lab_name` | string | NO | |
| `status` | string | NO | `pending` |
| `due_date` | string (date) | YES | |
| `created_at` | string (date-time) | NO | |

**Errors:** `VISIT_IMMUTABLE(422)`, `NOT_FOUND(404)`, `FORBIDDEN(403)`
**Events emitted:** DE-014 LabOrderCreated

---

### PATCH /api/v1/dental/visits/:id/lab-orders/:lid

Update lab order status (progression through FSM).

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (visit uuid), `lid` (lab order uuid)

**Request body:**

| Field | Type | Nullable | Required | Enum | Example |
|-------|------|----------|----------|------|---------|
| `status` | string | NO | YES | `sent`, `received`, `completed`, `rejected` | `"completed"` |
| `notes` | string | YES | NO | max:500 | |

**Response 200:** `{ data: LabOrder }`

**Errors:** `NOT_FOUND(404)`, `INVALID_STATUS_TRANSITION(422)`, `FORBIDDEN(403)`
**Events emitted:** DE-015 LabOrderCompleted (when status → completed)

---

### POST /api/v1/dental/visits/:id/consent-forms

Create a consent form for signing.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (visit uuid)

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `template_id` | string | NO | YES | uuid (branch consent template) | `"01JX..."` |
| `patient_id` | string | NO | YES | uuid | `"01JX..."` |

**Response 201:** `{ data: ConsentForm }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `visit_id` | string (uuid) | NO | |
| `template_id` | string (uuid) | NO | |
| `status` | string | NO | `pending` |
| `created_at` | string (date-time) | NO | |

**Errors:** `CONSENT_TEMPLATE_NOT_FOUND(404)`, `VISIT_IMMUTABLE(422)`, `FORBIDDEN(403)`

---

### PATCH /api/v1/dental/visits/:id/consent-forms/:cid/sign

Patient signs consent form.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (visit uuid), `cid` (consent form uuid)

**Request body:**

| Field | Type | Nullable | Required | Notes |
|-------|------|----------|----------|-------|
| `signature_data` | string | YES | NO | Base64 PNG or `"witnessed"` for paper |
| `signed_by` | string | NO | YES | `"patient"` or `"guardian"` |

**Response 200:** `{ data: { ok: true, signed_at: "ISO8601" } }`

**PATCH after signed:** Returns `CONSENT_FORM_SIGNED(422)`

**Errors:** `NOT_FOUND(404)`, `CONSENT_FORM_SIGNED(422)`, `FORBIDDEN(403)`
**Events emitted:** DE-012 ConsentSigned

---

### PATCH /api/v1/dental/visits/:id/consent-forms/:cid/revoke

Revoke a consent form.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (visit uuid), `cid` (consent form uuid)

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `reason` | string | NO | YES | min:5, max:500 | `"Patient withdrew consent"` |

**Response 200:** `{ data: { ok: true } }`

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`, `CONSENT_ALREADY_SIGNED(422)` (a signed consent form cannot be revoked — illegal signed→revoked transition), `CONFLICT(409)` (consent form has already been revoked; also covers the read-then-update revoke race) — NEW-P1-B reconciliation: codes documented to match `revokeConsentForm.ts`.
**Events emitted:** DE-013 ConsentRevoked (ADR-006: audit-log-only marker, no event bus)

---

### POST /api/v1/dental/patients/:id/medical-history

Append a medical history entry (append-only — no PATCH/DELETE).

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (patient uuid)

**Request body:**

| Field | Type | Nullable | Required | Enum | Constraints | Example |
|-------|------|----------|----------|------|-------------|---------|
| `entry_type` | string | NO | YES | `allergy`, `medication`, `condition`, `surgery`, `family_history` | — | `"allergy"` |
| `description` | string | NO | YES | — | min:2, max:1000 | `"Penicillin - anaphylaxis"` |
| `severity` | string | YES | NO | `mild`, `moderate`, `severe` | — | `"severe"` |
| `onset_date` | string | YES | NO | date (YYYY-MM-DD) | — | `"2010-01-01"` |
| `branch_id` | string | NO | YES | uuid | — | `"01JX..."` |

**Response 201:** `{ data: MedicalHistoryEntry }`

**PATCH/DELETE:** Returns `405 MEDICAL_HISTORY_IMMUTABLE`

**Errors:** `NOT_FOUND(404)`, `VALIDATION_ERROR(400)`, `FORBIDDEN(403)`

---

### POST /api/v1/dental/visits/:id/attachments

Upload a file attachment to a visit.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (visit uuid)
**Content-Type:** `multipart/form-data`

**Request body:**

| Field | Type | Required | Format | Constraints |
|-------|------|----------|--------|-------------|
| `file` | file | YES | — | Max 5 MB; MIME: `image/*`, `application/pdf` |
| `description` | string | NO | — | max:200 |

**Response 201:** `{ data: { id: "uuid", file_url: "presigned-url", expires_at: "ISO8601" } }`

**Errors:** `NOT_FOUND(404)`, `VISIT_IMMUTABLE(422)`, `UNSUPPORTED_MIME_TYPE(422)`, `FORBIDDEN(403)`

---

### POST /api/v1/dental/visits/:id/amendments

Add an amendment to a completed/locked visit record.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (visit uuid)

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `reason` | string | NO | YES | min:10, max:500 | `"Correcting tooth number documented in error"` |
| `amendment_text` | string | NO | YES | min:10, max:5000 | `"Tooth 14 was treated, not tooth 15"` |

**Response 201:** `{ data: Amendment }`

**Errors:** `NOT_FOUND(404)`, `AMENDMENT_REQUIRES_REASON(422)`, `FORBIDDEN(403)`
