<!-- oli-version: 1.0 -->
<!-- generated: 2026-06-02 -->
<!-- skill: oli-api-contracts (manual, F7 — extract inline §10 + handler-faithful) -->
<!-- based-on: MODULE_SPEC emr-consultation §10, handlers/emr/*, emr.tsp (EMRModule), emr.schema.ts -->

# API Contracts — emr-consultation

> Telemedicine consultation-notes module. Namespace `/emr`
> (`specs/api/src/modules/emr.tsp`, `EMRModule`); table `consultation_note`.
> This is a **platform-level** module (consumes the generic `patient`/`provider`/
> `person` primitives via facades), NOT a `dental-*` domain module. The active EMR
> for native dental visit/chart/treatment records is **dental-visit**.

> **Response envelope (handler-faithful, differs from the dental modules):**
> single-resource and create/update/finalize handlers return the consultation
> object **un-wrapped** (`ctx.json(consultation, ...)`), not the dental
> `{ data, meta }` envelope. List endpoints return `{ data: [...], pagination }`.
> Fields are camelCase per the TypeSpec contract.

> Consultation FSM: `draft` → `finalized` (**terminal** — no amend-after-finalize;
> the `amended` enum value is reserved/unreachable, V-EMR-001). See MODULE_SPEC §8.

> Key business rules (MODULE_SPEC §5): note created in `draft`; `context` (when
> supplied) is unique (duplicate → `CONSULTATION_EXISTS` 409-style conflict); only
> the authoring provider may update/finalize own notes (`provider:owner`); patients
> read only their own, admins read any; finalizing a non-draft note → 422
> `CONSULTATION_NOT_DRAFT`; cross-module refs (`patient`, `provider`, `finalizedBy`)
> are bare UUIDs with **no DB-level foreign keys** (loose coupling).

> Every PHI create/read/mutation/bulk-read writes a `dental_audit_log` row via
> `logAuditEvent` using dotted-lowercase `emr.<resource>.<verb>` action names
> (V-EMR-006). When `consultation_note.tenant_id` is null, the audit `tenantId`
> uses the `EMR_AUDIT_TENANT_SENTINEL` (never the patient UUID — V-EMR-005).

---

## Endpoints

### POST /api/v1/emr/consultations

Create a draft consultation note (`createConsultation`).

**Auth:** `provider` (self only — `body.provider` must resolve to the authenticated user's own provider profile, else 403)
**Rate limit:** Default

**Request body** (camelCase per `CreateConsultationRequest`):

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `patient` | string | NO | YES | uuid (loose ref) | `"01JX..."` |
| `provider` | string | NO | YES | uuid (loose ref); must equal caller's provider id | `"01JX..."` |
| `context` | string | YES | NO | max:255; unique idempotency key (e.g. `appointment:123`) | `"appointment:123"` |
| `chiefComplaint` | string | YES | NO | 1–500 chars | `"Tooth sensitivity"` |
| `assessment` | string | YES | NO | 1–2000 chars | `"Reversible pulpitis"` |
| `plan` | string | YES | NO | 1–2000 chars | `"Composite restoration"` |
| `vitals` | object | YES | NO | jsonb (VitalsData) | `{ "heartRate": 72 }` |
| `symptoms` | object | YES | NO | jsonb (SymptomsData) | `{ "severity": "mild" }` |
| `prescriptions` | object[] | YES | NO | jsonb[] (PrescriptionData) | `[{ "medication": "Amoxicillin" }]` |
| `followUp` | object | YES | NO | jsonb (FollowUpData) | `{ "needed": true }` |
| `externalDocumentation` | object | YES | NO | jsonb; settable at create (V-EMR-008) | `{ "mapflow": "..." }` |

**Response 201:** the created `ConsultationNote` (un-wrapped)

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `patient` | string (uuid) | NO | loose ref |
| `provider` | string (uuid) | NO | loose ref |
| `tenantId` | string | YES | nullable — NOT the isolation mechanism (V-EMR-005) |
| `context` | string | YES | |
| `chiefComplaint` | string | YES | |
| `assessment` | string | YES | |
| `plan` | string | YES | |
| `vitals` | object | YES | |
| `symptoms` | object | YES | |
| `prescriptions` | object[] | YES | |
| `followUp` | object | YES | |
| `externalDocumentation` | object | YES | |
| `status` | string | NO | `draft` |
| `finalizedAt` | string (date-time) | YES | null until finalized |
| `finalizedBy` | string (uuid) | YES | null until finalized; loose ref to person |
| `createdAt` | string (date-time) | NO | from base entity fields |
| `updatedAt` | string (date-time) | NO | from base entity fields |

**Errors:** `NOT_FOUND(404)` (provider or patient), `PROVIDER_NOT_FOUND` (caller has no provider profile — BusinessLogicError) `[INFERRED status: 422]`, `FORBIDDEN(403)` (`body.provider` ≠ caller's provider id), `CONSULTATION_EXISTS(409)` (duplicate `context`) `[INFERRED status: 409]`, `VALIDATION_ERROR(400)`
**Audit:** `emr.consultation.create`

---

### GET /api/v1/emr/consultations

List consultation notes with role-based filtering (`listConsultations`).
Providers see only their own; patients see only their own; admins see all.

**Auth:** `provider` (own), `patient` (own), `admin` (all)

**Query params** (per `emr.tsp`):

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `patient` | uuid | NO | Patient filter (a patient caller may only pass their own id, else 403) |
| `status` | string | NO | enum: `draft`, `finalized`, `amended` |
| `limit` | integer | NO | Default: 25, max: 100 |
| `offset` | integer | NO | Pagination offset |

**Response 200:** `{ data: ConsultationNote[], pagination }`

**Sort:** `createdAt DESC`

**Errors:** `FORBIDDEN(403)` (no provider/patient profile, or patient cross-access), `VALIDATION_ERROR(400)` (missing user id)
**Audit:** `emr.consultation.list` (PHI bulk read — records counts/filter scope only)

---

### GET /api/v1/emr/consultations/{consultation}

Get a single consultation note, optionally expanding related entities
(`getConsultation`).

**Auth:** `admin`, `provider:owner`, `patient:owner`
**Path params:** `consultation` (uuid)
**Query params:** `expand` — any of `patient`, `provider`, `person`
(`person` only nests when `patient` or `provider` is also expanded; composed via the
patient/provider facades, never direct cross-module schema access).

**Response 200:** the `ConsultationNote` (un-wrapped). When `expand=patient`/`provider`
is requested, returns `ConsultationNoteWithDetails` — the `patient`/`provider` fields
become nested objects (each with a nested `person` when `expand=person`).

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)` (not admin and not the owning provider/patient)
**Audit:** `emr.consultation.read` (PHI read)

---

### PATCH /api/v1/emr/consultations/{consultation}

Update clinical fields on a draft note (`updateConsultation`). Only `draft` notes
are mutable. Supports explicit `null` to clear a field.

**Auth:** `provider:owner`
**Path params:** `consultation` (uuid)

**Request body** (camelCase per `UpdateConsultationRequest`; all optional, all
nullable-to-clear):

| Field | Type | Nullable | Required | Notes |
|-------|------|----------|----------|-------|
| `chiefComplaint` | string | YES (clears) | NO | 1–500 chars when set |
| `assessment` | string | YES (clears) | NO | 1–2000 chars when set |
| `plan` | string | YES (clears) | NO | 1–2000 chars when set |
| `vitals` | object | YES (clears) | NO | |
| `symptoms` | object | YES (clears) | NO | |
| `prescriptions` | object[] | YES (clears) | NO | |
| `followUp` | object | YES (clears) | NO | |
| `externalDocumentation` | object | YES (clears) | NO | |

At least one field must be present.

**Response 200:** the updated `ConsultationNote` (un-wrapped)

**Errors:** `NOT_FOUND(404)`, `PROVIDER_NOT_FOUND` (caller has no provider profile) `[INFERRED status: 422]`, `FORBIDDEN(403)` (not the owning provider), `CONSULTATION_NOT_DRAFT(422)` (note not in `draft`), `NO_UPDATE_FIELDS(422)` (empty body) `[INFERRED status: 422]`
**Audit:** `emr.consultation.update` (records changed field NAMES only, never PHI values — V-EMR-003)

---

### POST /api/v1/emr/consultations/{consultation}/finalize

Finalize a draft note (`finalizeConsultation`). Terminal transition
`draft → finalized`; sets `finalizedAt`/`finalizedBy`.

**Auth:** `provider:owner`
**Path params:** `consultation` (uuid)
**Request body:** none (no required fields)

**Response 200:** the finalized `ConsultationNote` (un-wrapped; `status: finalized`,
`finalizedAt` set, `finalizedBy` = caller's user id)

**Errors:** `NOT_FOUND(404)`, `PROVIDER_NOT_FOUND` (caller has no provider profile) `[INFERRED status: 422]`, `FORBIDDEN(403)` (not the owning provider), `CONSULTATION_NOT_DRAFT(422)` (note not in `draft`)
**Audit:** `emr.consultation.finalize` (locks the authoritative record — V-EMR-002)

---

### GET /api/v1/emr/patients

List patients who have EMR data (consultation notes), with consultation stats
(`listEMRPatients`). Providers are scoped to patients they have consulted; admins
see all.

**Auth:** `provider` (own), `admin` (all)

**Query params** (per `emr.tsp`):

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `status` | string | NO | enum: `active`, `inactive` (patient status filter) |
| `hasRecentConsultations` | boolean | NO | Filters by consultation within last 30 days |
| `dateStart` | date | NO | Consultation date-range start (pair with `dateEnd`) |
| `dateEnd` | date | NO | Consultation date-range end |
| `q` | string | NO | Free-text patient search |
| `expand` | string[] | NO | Supports `person` (nests patient's person) |
| `limit` | integer | NO | Default: 25, max: 100 |
| `offset` | integer | NO | Pagination offset |
| `page` / `pageSize` | integer | NO | Alternate pagination inputs `[INFERRED from handler query shape]` |

**Response 200:** `{ data: PatientWithStats[], pagination }` — each patient carries a
`consultationStats` object:

| Field | Type | Notes |
|-------|------|-------|
| `consultationStats.totalConsultations` | integer | |
| `consultationStats.draftConsultations` | integer | |
| `consultationStats.finalizedConsultations` | integer | |
| `consultationStats.recentConsultationDate` | string (date-time) | nullable |

**Errors:** `FORBIDDEN(403)` (non-admin caller without a provider profile), `VALIDATION_ERROR(400)` (missing user id)
**Audit:** `emr.patients.list` (PHI bulk read — records counts/scope only — V-EMR-004)

---

> **[INFERRED] notes:**
> - HTTP status codes for the `BusinessLogicError` codes (`PROVIDER_NOT_FOUND`,
>   `CONSULTATION_EXISTS`, `NO_UPDATE_FIELDS`) are inferred from the central error
>   taxonomy mapping for `BusinessLogicError`; the handler raises the code, the
>   error middleware assigns the status. Verify against `@/core/errors`.
> - The un-wrapped single-resource envelope is intentional and matches the upstream
>   `monobase-mycure` EMR port (it predates the dental `{ data, meta }` convention).
