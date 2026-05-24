<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC dental-visit, API_CONVENTIONS.md, ERROR_TAXONOMY.md, DOMAIN_MODEL SM-VISIT -->

# API Contracts — dental-visit

> All responses wrap in `{ data, meta }`.
> Key business rules: BR-001 (one active visit), BR-003 (locked visit immutable), BR-006/BR-007 (treatment transitions).
> Visit FSM: `scheduled` → `active` → `completed` → `locked`

---

## Endpoints

### POST /api/v1/dental/visits

Create a new visit (check-in creates active visit).

**Auth:** `staff_full`, `staff_scheduling`, `dentist_associate`, `dentist_owner`
**Rate limit:** Default

**Request body:**

| Field | Type | Nullable | Required | Format | Constraints | Example |
|-------|------|----------|----------|--------|-------------|---------|
| `branch_id` | string | NO | YES | uuid | — | `"01JX..."` |
| `patient_id` | string | NO | YES | uuid | — | `"01JX..."` |
| `appointment_id` | string | YES | NO | uuid | — | `"01JX..."` |
| `visit_type` | string | NO | YES | — | enum: `checkup`, `treatment`, `emergency`, `recall` | `"checkup"` |
| `provider_id` | string | NO | YES | uuid (membership) | — | `"01JX..."` |

**Response 201:** `{ data: Visit }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `branch_id` | string (uuid) | NO | |
| `patient_id` | string (uuid) | NO | |
| `provider_id` | string (uuid) | NO | |
| `status` | string | NO | `active` |
| `visit_type` | string | NO | |
| `started_at` | string (date-time) | NO | |
| `completed_at` | string (date-time) | YES | null until completion |
| `locked_at` | string (date-time) | YES | null until locked |

**Errors:** `ACTIVE_VISIT_EXISTS(409)`, `NOT_FOUND(404)` (patient/provider), `VALIDATION_ERROR(400)`
**Events emitted:** DE-001 VisitCheckedIn (if appointment_id provided)

---

### GET /api/v1/dental/visits/:id

Get visit details.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (uuid)

**Response 200:** `{ data: Visit }` (full object including treatments array)

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### PATCH /api/v1/dental/visits/:id

Update visit status or metadata. Blocked on locked/completed visits.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (uuid)

**Request body:**

| Field | Type | Nullable | Required | Enum | Notes |
|-------|------|----------|----------|------|-------|
| `status` | string | NO | NO | `completed` | Only valid transition from `active` |
| `notes` | string | YES | NO | — | Max 5000 chars |

**Response 200:** `{ data: Visit }`

**Errors:** `NOT_FOUND(404)`, `VISIT_IMMUTABLE(422)`, `INVALID_STATUS_TRANSITION(422)`, `FORBIDDEN(403)`
**Events emitted:** DE-002 VisitCompleted (when status → completed)

---

### POST /api/v1/dental/visits/:id/treatments

Add a treatment (CDT code) to the visit chart.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (uuid)

**Request body:**

| Field | Type | Nullable | Required | Format | Constraints | Example |
|-------|------|----------|----------|--------|-------------|---------|
| `cdt_code` | string | NO | YES | — | ADA CDT format (D + 4 digits) | `"D0150"` |
| `tooth_number` | integer | YES | NO | — | FDI: 11-48, Universal: 1-32, or null for arch-level | `14` |
| `surface` | string[] | YES | NO | — | enum values: `M`, `D`, `O`, `B`, `L`, `F`, `I` | `["M","D"]` |
| `status` | string | NO | YES | — | enum: `diagnosed`, `planned` | `"diagnosed"` |
| `fee_override_cents` | integer | YES | NO | — | min:0 | `15000` |
| `notes` | string | YES | NO | — | max:500 | `"Patient requested" ` |

**Response 201:** `{ data: Treatment }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `visit_id` | string (uuid) | NO | |
| `cdt_code` | string | NO | |
| `tooth_number` | integer | YES | |
| `surface` | string[] | YES | |
| `status` | string | NO | `diagnosed`, `planned`, `performed`, `dismissed` |
| `fee_cents` | integer | NO | From fee schedule or override |
| `created_at` | string (date-time) | NO | |

**Errors:** `NOT_FOUND(404)`, `VISIT_IMMUTABLE(422)`, `INVALID_CDT_CODE(422)`, `FORBIDDEN(403)`
**Events emitted:** DE-004 TreatmentDiagnosed

---

### PATCH /api/v1/dental/visits/:id/treatments/:tid

Update treatment status. Enforces state machine (BR-006, BR-007).

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (visit uuid), `tid` (treatment uuid)

**Request body:**

| Field | Type | Nullable | Required | Enum | Notes |
|-------|------|----------|----------|------|-------|
| `status` | string | NO | YES | `planned`, `performed`, `dismissed` | Cannot change from `performed` |
| `notes` | string | YES | NO | — | max:500 |

**Response 200:** `{ data: Treatment }`

**Errors:** `NOT_FOUND(404)`, `TREATMENT_IMMUTABLE(422)`, `INVALID_STATUS_TRANSITION(422)`, `VISIT_IMMUTABLE(422)`, `FORBIDDEN(403)`
**Events emitted:** DE-005 TreatmentPerformed, DE-006 TreatmentDismissed

---

### POST /api/v1/dental/visits/:id/chart

Initialize or update the dental chart (dentition state).

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (uuid)

**Request body:**

| Field | Type | Nullable | Required | Notes |
|-------|------|----------|----------|-------|
| `tooth_states` | ToothState[] | NO | YES | Array of tooth-level conditions |
| `notation_system` | string | NO | YES | enum: `fdi`, `universal`, `palmer` |

**Response 201/200:** `{ data: DentalChart }`

**Errors:** `NOT_FOUND(404)`, `VISIT_IMMUTABLE(422)`, `FORBIDDEN(403)`

---

### GET /api/v1/dental/visits/:id/chart

Get dental chart for visit.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (uuid)

**Response 200:** `{ data: DentalChart }`

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### POST /api/v1/dental/visits/:id/initialize-dentition

Initialize dentition template (adult/pediatric/mixed) — idempotent.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (uuid)

**Request body:**

| Field | Type | Nullable | Required | Enum | Example |
|-------|------|----------|----------|------|---------|
| `dentition_type` | string | NO | YES | `adult`, `pediatric`, `mixed` | `"adult"` |

**Response 201:** `{ data: { ok: true, dentition_type: "adult" } }`

**Errors:** `DENTITION_ALREADY_INITIALIZED(409)`, `FORBIDDEN(403)`

---

### GET /api/v1/dental/visits/:id/notes

Get clinical notes for visit.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (uuid)

**Response 200:** `{ data: ClinicalNote[] }`

---

### POST /api/v1/dental/visits/:id/notes

Add a clinical note.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (uuid)

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `content` | string | NO | YES | min:1, max:10000 | `"Patient reports sensitivity..."` |
| `note_type` | string | NO | YES | enum: `clinical`, `soap`, `progress` | `"soap"` |

**Response 201:** `{ data: ClinicalNote }`

**Errors:** `NOT_FOUND(404)`, `VISIT_IMMUTABLE(422)`, `FORBIDDEN(403)`

---

### POST /api/v1/dental/visits/:id/notes/:nid/sign

Sign a clinical note (locks it).

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (visit uuid), `nid` (note uuid)

**Response 200:** `{ data: { ok: true, signed_at: "ISO8601" } }`

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### GET /api/v1/dental/patients/:id/treatment-plan

Get cross-visit treatment plan for patient.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (patient uuid)
**Query params:** `branch_id` (uuid, required), `status` (enum: `diagnosed`, `planned`, `performed`)

**Response 200:** `{ data: Treatment[] }` (all non-dismissed treatments, sorted by visit date)

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### POST /api/v1/dental/visits/:id/carry-over

Carry over unperformed treatments from a previous visit.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (new visit uuid)

**Request body:**

| Field | Type | Nullable | Required | Notes |
|-------|------|----------|----------|-------|
| `source_visit_id` | string | NO | YES | uuid of previous visit |

**Response 200:** `{ data: { carried_over: N } }`

**Errors:** `NOT_FOUND(404)`, `VISIT_IMMUTABLE(422)`, `FORBIDDEN(403)`
