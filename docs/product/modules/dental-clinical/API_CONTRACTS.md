<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC dental-clinical, API_CONVENTIONS.md, ERROR_TAXONOMY.md -->

# API Contracts — dental-clinical

> All responses wrap in `{ data, meta }`.
> Key rules: BR-003 (locked visit immutable), BR-014 (consent), BR-017 (Rx prescriber), BR-018 (lab orders).
> Medical history: append-only (no PATCH/DELETE).
>
> **Field-casing note (2026-06-12 FIX-010 reconcile):** field names in this legacy
> contract are snake_case, but the live wire is camelCase (e.g. `file_size_bytes` →
> `fileSizeBytes`). The **lab-order status** and **attachment** sections below were
> reconciled to code truth in Batch F; the remaining sections may still carry
> pre-camelCase field names (separate, larger reconcile — flagged for roadmap).

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
| `status` | string | NO | initial state = `ordered` (BR-018 FSM) |
| `due_date` | string (date) | YES | |
| `created_at` | string (date-time) | NO | |

**Errors:** `VISIT_IMMUTABLE(422)`, `NOT_FOUND(404)`, `FORBIDDEN(403)`
**Events emitted:** DE-014 LabOrderCreated

---

### PATCH /api/v1/dental/visits/:id/lab-orders/:lid

Update lab order status (progression through FSM).

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (visit uuid), `lid` (lab order uuid)

**Request body:** (all fields optional — `status` routes to the FSM guard; the rest are field edits. Matches `UpdateLabOrderRequest`.)

| Field | Type | Nullable | Required | Enum / Constraints | Example |
|-------|------|----------|----------|--------------------|---------|
| `status` | string | NO | NO | `ordered`, `in_fabrication`, `delivered`, `fitted`, `cancelled` (BR-018 forward-only FSM) | `"in_fabrication"` |
| `shade` | string | YES | NO | restoration shade | `"A2"` |
| `material` | string | YES | NO | e.g. `"Zirconia"`, `"PFM"` | `"PFM"` |
| `due_date` | string (date-time) | YES | NO | chairside-needed date | |
| `expected_delivery_date` | string (date-time) | YES | NO | | |
| `cancel_reason` | string | YES | NO | required context when cancelling | `"Remake — wrong shade"` |
| `is_defective` | boolean | YES | NO | flags a defective delivery | `false` |

**Response 200:** `{ data: LabOrder }`

**Errors:** `NOT_FOUND(404)`, `INVALID_STATUS_TRANSITION(422)` (illegal/backward FSM move, V-CLN-008 — a business-rule violation, not a 400), `FORBIDDEN(403)` (write requires `dentist_owner`/`dentist_associate`)
**Events emitted:** DE-015 LabOrderCompleted — emitted on the `→ delivered` transition (the lab marking fabrication complete / handing the case back), and only when the status actually changes. There is **no** `completed` status; `delivered` is the "completed" milestone, `fitted` is the chairside-fit terminal.

---

### POST /api/v1/dental/visits/:visitId/consents

Create a consent form for signing. (Route is `/consents`, not `/consent-forms`.)

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

### POST /api/v1/dental/visits/:visitId/consents/:consentId/sign

Patient signs consent form. (Method is **POST**, not PATCH; route is `/consents`.)

**Auth:** `dentist_associate`, `dentist_owner` (assertBranchRole on the consent form's parent visit)
**Path params:** `visitId` (visit uuid), `consentId` (consent form uuid)

**Request body:**

| Field | Type | Nullable | Required | Notes |
|-------|------|----------|----------|-------|
| `signature_data` | string | NO | YES | Base64 PNG or `"witnessed"` for paper |

**Response 200:** `{ data: ConsentForm }` (signed=true, signedAt set)

**Errors:** `NOT_FOUND(404)`, `CONSENT_FORM_SIGNED(422)` (already signed — immutable, V-CLN-005), `CONSENT_FORM_REVOKED(422)` (form was revoked and cannot be signed — symmetric with revoke's signed→revoke guard, V-CLN-010), `FORBIDDEN(403)`
**Events emitted:** DE-012 ConsentSigned

---

### PATCH /api/v1/dental/visits/:visitId/consents/:cid/revoke

Revoke a consent form. (Route is `/consents`, not `/consent-forms`.) Only a
still-pending (unsigned) consent can be revoked; the signed and revoked states
are mutually exclusive terminal states (see sign's `CONSENT_FORM_REVOKED`).

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `visitId` (visit uuid), `cid` (consent form uuid)

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `reason` | string | NO | YES | min:5, max:500 | `"Patient withdrew consent"` |

**Response 200:** `{ data: { ok: true } }`

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`, `CONSENT_ALREADY_SIGNED(422)` (a signed consent form cannot be revoked — illegal signed→revoked transition), `CONFLICT(409)` (consent form has already been revoked; also covers the read-then-update revoke race) — NEW-P1-B reconciliation: codes documented to match `revokeConsentForm.ts`.
**Events emitted:** DE-013 ConsentRevoked (ADR-006: audit-log-only marker, no event bus)

---

### POST /api/v1/dental/clinical/medical-history

Append a medical history entry (append-only). The real route is
`/dental/clinical/medical-history` — the patient is identified by `patient_id`
in the **body**, not in the path. Authorization derives the branch from the
patient's `preferredBranchId` (not a caller-supplied branch).

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner` (assertBranchRole on the patient's branch)
**Path params:** none (patient_id is in the body)

**Request body:**

| Field | Type | Nullable | Required | Enum | Constraints | Example |
|-------|------|----------|----------|------|-------------|---------|
| `entry_type` | string | NO | YES | `allergy`, `medication`, `condition`, `surgery`, `family_history` | — | `"allergy"` |
| `description` | string | NO | YES | — | min:2, max:1000 | `"Penicillin - anaphylaxis"` |
| `severity` | string | YES | NO | `mild`, `moderate`, `severe` | — | `"severe"` |
| `onset_date` | string | YES | NO | date (YYYY-MM-DD) | — | `"2010-01-01"` |
| `branch_id` | string | NO | YES | uuid | — | `"01JX..."` |

**Response 201:** `{ data: MedicalHistoryEntry }`

**PATCH `/dental/clinical/medical-history/:entryId`:** the route exists but always returns `405 MEDICAL_HISTORY_IMMUTABLE` (entries are immutable; corrections flow through the amendment path). No DELETE route is registered.

**Errors:** `NOT_FOUND(404)`, `VALIDATION_ERROR(400)`, `FORBIDDEN(403)`

---

### POST /api/v1/dental/visits/:id/attachments

Register an attachment **metadata record** against a visit. This endpoint does **not**
receive bytes — it is **step 4 of the upload flow**. The client first uploads the file
to the **storage** module, then records the resulting storage key here:

1. `POST /storage/files/upload` → returns a presigned URL (storage enforces the byte
   ceiling here — see *Size & MIME enforcement* below).
2. `PUT` the bytes to the presigned URL (direct to S3/MinIO).
3. `POST /storage/files/{file}/complete`.
4. `POST /dental/visits/:id/attachments` (**this endpoint**) — store the metadata row
   (`file_path` = the storage key from step 1).

**Auth:** `dentist_owner`, `dentist_associate`, `staff_full`, `dental_assistant` (E2: assistant may upload under dentist supervision)
**Path params:** `id` (visit uuid)
**Content-Type:** `application/json` (metadata record — **not** multipart)

**Request body (JSON):**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `patient_id` | string (uuid) | NO | YES | | `"01JX..."` |
| `image_type` | string | NO | YES | enum: `xray`, `photo`, `scan`, `document`, `other` (coarse file bucket — NOT the imaging-module radiograph modality) | `"xray"` |
| `tooth_numbers` | integer[] | YES | NO | FDI notation | `[36]` |
| `file_name` | string | NO | YES | | `"panoramic.jpg"` |
| `file_path` | string | NO | YES | storage key / file id from step 1 | `"a1b2…"` |
| `file_size_bytes` | integer (int64) | NO | YES | **client-reported**; not re-verified here | `512000` |
| `mime_type` | string | NO | YES | **client-reported**; no allow-list here | `"image/jpeg"` |
| `note` | string | YES | NO | | `"Panoramic x-ray"` |

**Response 201:** `{ data: DentalAttachment }` — the full stored metadata row
(`id`, `visit_id`, `patient_id`, `image_type`, `tooth_numbers`, `file_name`,
`file_path`, `file_size_bytes`, `mime_type`, `note`, `created_at`, `updated_at`,
`version`). It does **not** return a presigned URL (downloads go through
`GET /storage/files/{file_path}/download`).

**Errors:** `UNAUTHORIZED(401)`, `NOT_FOUND(404)` (visit), `VISIT_LOCKED(422)` (visit is locked or completed — BR-003), `FORBIDDEN(403)` (branch role). There is **no** `UNSUPPORTED_MIME_TYPE` — this endpoint enforces no MIME allow-list.

**Size & MIME enforcement (FIX-010 — reconciled to code truth):**
- This metadata endpoint enforces **no** size cap and **no** MIME allow-list; it stores
  the client-reported `file_size_bytes`/`mime_type` verbatim.
- The real byte ceiling is enforced one layer up, in **storage** (`POST /storage/files/upload`,
  `maxUploadSizeForMime`): **100 MB** for images/PDF (non-DICOM), **2 GB** for
  `application/dicom`, clamped to an **8 GB** absolute hard cap — all env-configurable
  (`STORAGE_MAX_FILE_SIZE_BYTES`, `STORAGE_DICOM_MAX_FILE_SIZE_BYTES`,
  `STORAGE_ABSOLUTE_MAX_FILE_SIZE_BYTES`). Over-limit → `400 VALIDATION_ERROR`
  ("File size exceeds maximum limit of …").
- The clinic UI (`attachments-sheet.tsx`) applies a tighter **50 MB** client-side guard
  (the product-documented user-facing limit, decision Q5) and a `image/*,.pdf` file-picker
  filter. The guard is a UX convenience below the storage cap — not a server boundary.
  A cap is deliberately **not** added here: storage has already accepted the bytes by the
  time this call runs, so a lower clinical cap would orphan the stored object.
- DICOM/CBCT studies are owned by the **dental-imaging** module, not this attachment path.

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
