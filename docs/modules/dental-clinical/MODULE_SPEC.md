# Dental Clinical Module Specification

**Module:** `dental-clinical`
**Version:** 1.0
**Status:** Implemented

## Overview

The dental-clinical module manages the legal and clinical documentation layer for patient care: consent forms, prescriptions, lab orders, clinical attachments, medical history, and additive amendments. All records are append-only by design. Corrections never mutate the original entry — they produce a linked amendment. Consent forms are immutable once signed. This module enforces the compliance boundary between clinical data collection and legal record-keeping.

## Schema

### Tables

| Table | Purpose |
|-------|---------|
| `consent_form` | Per-visit consent document: template reference, signature data, signed flag |
| `prescription` | RxNorm-coded medication order linked to a visit and prescribing dentist |
| `lab_order` | Prosthetics/appliance order with lifecycle state machine |
| `dental_attachment` | Clinical file upload (x-ray, photo, scan, document) tooth-tagged per visit |
| `medical_history_entry` | Patient-level ICD-10 / RxNorm / SNOMED CT record (conditions, meds, allergies, etc.) |
| `amendment` | Additive correction record that points to any original record — never replaces it |

### Column Details

#### `consent_form`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NO | PK (from baseEntityFields) |
| `created_at` | timestamp | NO | |
| `updated_at` | timestamp | NO | |
| `visit_id` | uuid | NO | FK → `dental_visit.id` (cascade delete) |
| `patient_id` | uuid | NO | FK → `patient.id` |
| `template_id` | text | NO | Template identifier (e.g. `"general-consent-v2"`) |
| `template_name` | text | NO | Human-readable template name |
| `signed` | boolean | NO | Default `false`; set to `true` on sign — immutable after |
| `signed_at` | timestamp | YES | Null until signed |
| `signature_data` | text | YES | Base64 or SVG path data; null until signed |

#### `prescription`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NO | PK |
| `created_at` | timestamp | NO | |
| `updated_at` | timestamp | NO | |
| `visit_id` | uuid | NO | FK → `dental_visit.id` (cascade delete) |
| `patient_id` | uuid | NO | FK → `patient.id` |
| `prescriber_member_id` | uuid | NO | FK → `dental_membership.id` — must be dentist role (BR-017) |
| `rx_norm_code` | text | YES | RxNorm concept identifier |
| `drug_name` | text | NO | Free-text drug name |
| `dosage` | text | NO | e.g. `"500mg"` |
| `frequency` | text | NO | e.g. `"3x daily"` |
| `duration` | text | YES | e.g. `"7 days"` |
| `quantity` | text | YES | e.g. `"21 tablets"` |
| `instructions` | text | YES | Patient-facing notes |
| `dispense_as_written` | boolean | NO | Default `false` |

#### `lab_order`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NO | PK |
| `created_at` | timestamp | NO | |
| `updated_at` | timestamp | NO | |
| `visit_id` | uuid | NO | FK → `dental_visit.id` (cascade delete) |
| `patient_id` | uuid | NO | FK → `patient.id` |
| `lab_name` | text | NO | Name of the dental laboratory |
| `description` | text | NO | Order description / work specification |
| `status` | `lab_order_status` enum | NO | Default `ordered`; see state machine SM-02 |
| `ordered_at` | timestamp | NO | Default `now()` |
| `expected_delivery_date` | timestamp | YES | |
| `delivered_at` | timestamp | YES | Set on `delivered` transition |
| `fitted_at` | timestamp | YES | Set on `fitted` transition (terminal) |
| `cancelled_at` | timestamp | YES | Set on `cancelled` transition |
| `cancel_reason` | text | YES | Required when cancelling |
| `is_defective` | boolean | NO | Default `false`; flag defective deliveries |
| `replaced_by_order_id` | uuid | YES | Self-referential FK — points to replacement order |

**`lab_order_status` enum:** `ordered` | `in_fabrication` | `delivered` | `fitted` | `cancelled`

#### `dental_attachment`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NO | PK |
| `created_at` | timestamp | NO | |
| `updated_at` | timestamp | NO | |
| `visit_id` | uuid | NO | FK → `dental_visit.id` (cascade delete) |
| `patient_id` | uuid | NO | FK → `patient.id` |
| `image_type` | `dental_attachment_image_type` enum | NO | `xray` \| `photo` \| `scan` \| `document` \| `other` |
| `tooth_numbers` | jsonb `number[]` | YES | Null if not tooth-specific |
| `file_name` | text | NO | Original filename |
| `file_path` | text | NO | Storage path / S3 key |
| `file_size_bytes` | bigint | NO | |
| `mime_type` | text | NO | |
| `note` | text | YES | Optional clinical note |
| `deleted_at` | timestamp | YES | Soft delete — null = active |

#### `medical_history_entry`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NO | PK |
| `created_at` | timestamp | NO | |
| `updated_at` | timestamp | NO | |
| `patient_id` | uuid | NO | FK → `patient.id` (not visit-scoped — patient lifetime record) |
| `entry_type` | `medical_history_entry_type` enum | NO | See enum below |
| `code_system` | text | YES | `"ICD-10"` / `"RxNorm"` / `"SNOMED CT"` |
| `code` | text | YES | Coded value (e.g. `"K08.89"`) |
| `display_name` | text | NO | Human-readable name |
| `notes` | text | YES | Clinical notes |
| `onset_date` | text | YES | ISO date string |
| `resolved_date` | text | YES | ISO date string; null = still active |
| `active` | boolean | NO | Default `true` |

**`medical_history_entry_type` enum:** `condition` | `medication` | `allergy` | `procedure` | `vaccination` | `family_history`

#### `amendment`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NO | PK |
| `created_at` | timestamp | NO | |
| `updated_at` | timestamp | NO | |
| `visit_id` | uuid | NO | FK → `dental_visit.id` (cascade delete) |
| `patient_id` | uuid | NO | FK → `patient.id` |
| `author_member_id` | uuid | NO | FK → `dental_membership.id` |
| `original_record_type` | text | NO | Discriminator: `"prescription"`, `"lab_order"`, `"medical_history_entry"`, etc. |
| `original_record_id` | uuid | NO | PK of the original record being corrected |
| `reason` | text | NO | Clinical rationale for the amendment |
| `content` | text | NO | The correction content |

---

## State Machines

### SM-01: Consent Form

```
unsigned ──(signConsentForm)──► signed  [TERMINAL]
```

- `signed = false` on creation (unsigned state)
- `signConsentForm` sets `signed = true`, `signed_at = now()`, records `signature_data`
- Once `signed = true`, **no further transitions exist** — the record is immutable (BR-014)
- There is no "revoke" or "re-sign" transition

**Enforced in:** `signConsentForm.ts` — checks `consentForm.signed === true` and throws 422 if already signed.

---

### SM-02: Lab Order

```
ordered ──► in_fabrication ──► delivered ──► fitted  [TERMINAL]
              │                    │
              └──► cancelled ◄─────┘          [TERMINAL]
```

Forward-only. Transitions defined in `LAB_ORDER_TRANSITIONS` constant:

| From | Allowed Next States |
|------|---------------------|
| `ordered` | `in_fabrication`, `cancelled` |
| `in_fabrication` | `delivered`, `cancelled` |
| `delivered` | `fitted`, `cancelled` |
| `fitted` | *(none — terminal)* |
| `cancelled` | *(none — terminal)* |

**Enforced in:** `updateLabOrder.ts` — `LAB_ORDER_TRANSITIONS[currentStatus].includes(nextStatus)`. Invalid transitions throw 422. `fitted` and `cancelled` are terminal — any transition from them is rejected (BR-018).

---

## Business Rules

### BR-014: Consent form is immutable once signed

**Rule:** BR-014 — A signed consent form cannot be edited, re-signed, or deleted. The signed record is append-only. `signed = true` is a terminal state.

**Implementation:** `signConsentForm.ts` — guard checks `consentForm.signed === true` → throws 422 `CONSENT_ALREADY_SIGNED`. No `updateConsentForm` handler exists. No delete endpoint for consent forms. The `consent_form` table has no soft-delete column.

---

### BR-015: Patient registration requires explicit consent

**Rule:** BR-015 — Patient registration is rejected unless `consentGiven: true` is passed. This is enforced at the registration boundary, not inside the clinical module.

**Implementation:** Enforced in `patient` module registration handler — the `dental-clinical` module records consent *after* registration (consent forms are per-visit). BR-015 is a pre-condition gate upstream; this module is responsible for storing the signed artifact, not gating registration.

**Known gap:** BR-015 enforcement lives in the patient/registration flow. The clinical module has no visibility into whether a patient was registered with or without consent.

---

### BR-017: Prescription creation requires a dentist prescriber

**Rule:** BR-017 — `prescriberMemberId` must identify a `dental_membership` record whose role is `dentist_owner` or `dentist_associate`. Non-dentist staff (hygienist, front desk, receptionist) cannot create prescriptions.

**Implementation:** `createPrescription.ts` — fetches the membership record for `prescriberMemberId` and asserts `membership.role IN ('dentist_owner', 'dentist_associate')`. Throws 422 `INVALID_PRESCRIBER` if role is ineligible. The caller's role is also checked independently — only dentist roles can call this endpoint at all (see Permission Matrix).

---

### BR-018: Lab order lifecycle is forward-only; terminal states are final

**Rule:** BR-018 — Lab order status transitions follow `ordered → in_fabrication → delivered → fitted` (or `cancelled` from any non-terminal state). A `fitted` or `cancelled` order cannot transition to any other state.

**Implementation:** `updateLabOrder.ts` — `LAB_ORDER_TRANSITIONS` constant. Any attempt to transition from `fitted` or `cancelled` throws 422 `INVALID_STATUS_TRANSITION`. Same pattern as imaging ceph landmarks (CIMG-005).

---

### BR-019: Clinical records are immutable — amendments are additive

**Rule:** BR-019 — Original clinical entries (prescriptions, lab orders, medical history entries) are never modified after creation. Corrections are expressed as `amendment` records that reference the original via `original_record_type` + `original_record_id`. The original entry is preserved in full.

**Implementation:** No `updatePrescription` mutation handler exists (the `updatePrescription` export updates status/dispense flags only — it does not allow free-form edits to drug/dosage). `updateMedicalHistoryEntry` updates `active` flag only (to mark resolved). Substantive corrections go through `createAmendment`. No hard deletes on any clinical record.

**Known gap:** No amendment UI exists yet. Amendments are API-only (backend implemented, frontend not built). BR-019 partial enforcement — `updateLabOrder` and `updateMedicalHistoryEntry` allow limited field mutations that should arguably route through amendments.

---

## Permission Matrix

| Operation | dentist_owner | dentist_associate | hygienist | front_desk |
|-----------|:---:|:---:|:---:|:---:|
| `createConsentForm` | Yes | Yes | Yes | Yes |
| `listConsentForms` | Yes | Yes | Yes | Yes |
| `signConsentForm` | Yes | Yes | Yes | Yes |
| `createPrescription` (BR-017) | Yes | Yes | No (403) | No (403) |
| `listPrescriptions` | Yes | Yes | Yes | Yes |
| `updatePrescription` | Yes | Yes | No (403) | No (403) |
| `createLabOrder` | Yes | Yes | No (403) | No (403) |
| `listLabOrders` | Yes | Yes | Yes | Yes |
| `updateLabOrder` | Yes | Yes | No (403) | No (403) |
| `createAttachment` | Yes | Yes | Yes | Yes |
| `listAttachments` | Yes | Yes | Yes | Yes |
| `deleteAttachment` | Yes | Yes | No (403) | No (403) |
| `createMedicalHistoryEntry` | Yes | Yes | No (403) | No (403) |
| `listMedicalHistory` | Yes | Yes | Yes | Yes |
| `updateMedicalHistoryEntry` | Yes | Yes | No (403) | No (403) |
| `createAmendment` | Yes | Yes | Yes | Yes |
| `listAmendments` | Yes | Yes | Yes | Yes |

**Default-deny:** Any role not listed as "Yes" receives `ForbiddenError` (HTTP 403). Branch membership is always required — non-members receive 403 regardless of role.

---

## API Endpoints

| Method | Path | Handler | BR |
|--------|------|---------|----|
| POST | `/dental/visits/:visitId/consent-forms` | createConsentForm | BR-014 |
| GET | `/dental/visits/:visitId/consent-forms` | listConsentForms | — |
| POST | `/dental/visits/:visitId/consent-forms/:formId/sign` | signConsentForm | BR-014 |
| POST | `/dental/visits/:visitId/prescriptions` | createPrescription | BR-017 |
| GET | `/dental/visits/:visitId/prescriptions` | listPrescriptions | — |
| PATCH | `/dental/visits/:visitId/prescriptions/:prescriptionId` | updatePrescription | BR-017, BR-019 |
| POST | `/dental/visits/:visitId/lab-orders` | createLabOrder | BR-018 |
| GET | `/dental/visits/:visitId/lab-orders` | listLabOrders | — |
| PATCH | `/dental/visits/:visitId/lab-orders/:orderId` | updateLabOrder | BR-018 |
| POST | `/dental/visits/:visitId/attachments` | createAttachment | — |
| GET | `/dental/visits/:visitId/attachments` | listAttachments | — |
| DELETE | `/dental/visits/:visitId/attachments/:attachmentId` | deleteAttachment | BR-019 |
| POST | `/dental/visits/:visitId/amendments` | createAmendment | BR-019 |
| GET | `/dental/visits/:visitId/amendments` | listAmendments | — |
| POST | `/dental/patients/:patientId/medical-history` | createMedicalHistoryEntry | BR-019 |
| GET | `/dental/patients/:patientId/medical-history` | listMedicalHistory | — |
| PATCH | `/dental/patients/:patientId/medical-history/:entryId` | updateMedicalHistoryEntry | BR-019 |

---

## Known Gaps

| ID | Description | Status |
|----|-------------|--------|
| KG-001 | **No amendment UI** — BR-019 is backend-enforced; `createAmendment` / `listAmendments` are API-only. The clinical chart UI has no amendment flow. | Not started |
| KG-002 | **BR-015 enforcement is upstream** — The clinical module has no gate to verify a patient consented at registration time. That enforcement lives in the patient registration handler. | By design (out of scope) |
| KG-003 | **`updateMedicalHistoryEntry` allows limited mutation** — Currently updates `active` / `resolved_date` flags. Substantive field edits (display name, code) are not prevented at the API layer and should route through `createAmendment` per BR-019 spirit. | Latent risk |
| KG-004 | **`updatePrescription` scope** — Allows updating `dispense_as_written` and status-adjacent fields. Full drug/dosage edits are not blocked. The amendment pattern is not yet enforced for prescriptions. | Latent risk |
| KG-005 | **No soft-delete on `dental_attachment`** — `deleteAttachment` uses `deleted_at` for soft delete; other clinical tables have no delete at all. Confirm deletion policy is intentional (no `deleted_at` on `consent_form`, `prescription`, `lab_order`, `amendment`, `medical_history_entry`). | To verify |

---

## Dependencies

- `@/handlers/shared/assert-branch-access` — branch isolation on all endpoints
- `dental_visit` schema — `visit_id` FK required by consent forms, prescriptions, lab orders, attachments, amendments
- `patient` schema — `patient_id` FK on all tables
- `dental_membership` schema — `prescriber_member_id` (BR-017), `author_member_id` (amendments)
- `stored_file` table — future: attachments should migrate to `stored_file` FK (currently uses `file_path` text)

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-19 | 1.0 | Initial spec — 6 tables, BR-014/015/017/018/019, SM-01/SM-02, 17 handlers |
