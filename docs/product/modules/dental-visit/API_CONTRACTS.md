<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC dental-visit, API_CONVENTIONS.md, ERROR_TAXONOMY.md, DOMAIN_MODEL SM-VISIT -->

# API Contracts — dental-visit

> All responses wrap in `{ data, meta }`.
> Key business rules: BR-001 (one active visit), BR-003 (locked visit immutable), BR-006/BR-007 (treatment transitions).
> Visit FSM: `draft` → `active` → `completed` → `locked`. `draft` and `active` can transition to `discarded` (terminal). See MODULE_SPEC §8.

---

## Endpoints

### POST /api/v1/dental/visits

Create a new visit. The visit is created in `draft` status; it transitions to
`active` via PATCH (or via the dental-scheduling check-in flow). Fields are
camelCase per the TypeSpec contract (`dental-visit.tsp` → `CreateDentalVisitRequest`).

**Auth:** `dentist_owner`, `dentist_associate` (V-VIS-002 — matches ROLE_PERMISSION_MATRIX)
**Rate limit:** Default

**Request body:**

| Field | Type | Nullable | Required | Format | Constraints | Example |
|-------|------|----------|----------|--------|-------------|---------|
| `patientId` | string | NO | YES | uuid | — | `"01JX..."` |
| `branchId` | string | NO | YES | uuid | — | `"01JX..."` |
| `dentistMemberId` | string | NO | YES | uuid (membership) | — | `"01JX..."` |
| `chiefComplaint` | string | YES | NO | — | — | `"Tooth sensitivity"` |

**Response 201:** `{ data: Visit }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `patientId` | string (uuid) | NO | |
| `branchId` | string (uuid) | NO | |
| `dentistMemberId` | string (uuid) | NO | |
| `status` | string | NO | `draft` (transitions to `active`/`completed`/`locked`/`discarded`) |
| `chiefComplaint` | string | YES | |
| `activatedAt` | string (date-time) | YES | null until activated |
| `completedAt` | string (date-time) | YES | null until completion |
| `lockedAt` | string (date-time) | YES | null until locked |

**Errors:** `ACTIVE_VISIT_EXISTS(409)` (BR-001 app-level guard, V-VIS-003), `NOT_FOUND(404)` (patient/provider), `VALIDATION_ERROR(400)`
**Events emitted (audit-log-only, ADR-006):** DE-001 VisitCheckedIn is produced by the dental-scheduling check-in flow, not by this endpoint.

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
**Path params:** `visitId` (uuid)

**Request body** (camelCase per `UpdateDentalVisitRequest`):

| Field | Type | Nullable | Required | Enum | Notes |
|-------|------|----------|----------|------|-------|
| `status` | string | NO | NO | `active`, `completed`, `locked` | Linear FSM: `draft`→`active`→`completed`→`locked`. Server may redirect `completed`→`discarded` for an empty visit only when the `dental_visit_auto_discard` flag is enabled (V-VIS-004, default OFF). |
| `chiefComplaint` | string | YES | NO | — | Blocked once visit is `completed`/`locked` |

**Response 200:** `{ data: Visit }`

**Errors:** `NOT_FOUND(404)`, `VISIT_IMMUTABLE(422)`/`VISIT_LOCKED(422)`, `VISIT_TRANSITION_INVALID(422)`, `ACTIVE_VISIT_EXISTS(409)` (activate path, BR-001/V-VIS-003), `VISIT_HAS_OPEN_TREATMENTS(422)`, `VISIT_CONSENT_REQUIRED(422)`, `VISIT_NOTES_REQUIRED(422)`, `FORBIDDEN(403)`
**Events emitted (audit-log-only, ADR-006):** DE-002 VisitCompleted (status → completed), DE-003 VisitLocked (status → locked)

---

### POST /api/v1/dental/visits/:id/treatments

Add a treatment (CDT code) to the visit chart.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (uuid)

**Request body:**

Fields are camelCase per `CreateDentalTreatmentRequest`. New treatments are created
in `diagnosed` status (the create-time `status` field is ignored — V-VIS revenue-path).

| Field | Type | Nullable | Required | Format | Constraints | Example |
|-------|------|----------|----------|--------|-------------|---------|
| `patientId` | string | NO | YES | uuid | — | `"01JX..."` |
| `cdtCode` | string | NO | YES | — | ADA CDT format (D + 4 digits) | `"D0150"` |
| `description` | string | NO | YES | — | — | `"Composite restoration"` |
| `toothNumber` | integer | YES | NO | — | FDI: 11-48, or null for arch-level | `14` |
| `surfaces` | string[] | YES | NO | — | enum: `mesial`, `distal`, `buccal`, `lingual`, `occlusal`, `incisal`, `cervical` | `["mesial","distal"]` |
| `conditionCode` | string | YES | NO | — | ICD-10 | `"K02.1"` |
| `priceCents` | integer | NO | YES | — | min:0; locked at creation (EC4) | `15000` |
| `clinicalNotes` | string | YES | NO | — | — | `"Patient requested"` |

**Response 201:** `{ data: Treatment }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `visitId` | string (uuid) | NO | |
| `cdtCode` | string | NO | |
| `toothNumber` | integer | YES | |
| `surfaces` | string[] | YES | |
| `status` | string | NO | `diagnosed` at creation; FSM allows `planned`, `performed`, `verified`, `dismissed`, `declined` |
| `priceCents` | integer | NO | Locked at creation |
| `createdAt` | string (date-time) | NO | |

**Errors:** `NOT_FOUND(404)`, `VISIT_IMMUTABLE(422)`, `TOOTH_EXTRACTED(422)`, `FORBIDDEN(403)`
**Events emitted (audit-log-only, ADR-006):** DE-004 TreatmentDiagnosed (`treatment.diagnosed`, V-VIS-001)

---

### PATCH /api/v1/dental/visits/:id/treatments/:tid

Update treatment status. Enforces state machine (BR-006, BR-007).

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (visit uuid), `tid` (treatment uuid)

**Request body:**

| Field | Type | Nullable | Required | Enum | Notes |
|-------|------|----------|----------|------|-------|
| `status` | string | NO | NO | `planned`, `performed`, `verified`, `dismissed`, `declined` | Forward-only FSM (BR-006): `diagnosed`→`planned`→`performed`→`verified`; any non-terminal→`dismissed`; `diagnosed`/`planned`→`declined` (patient refusal, terminal). `performed` and `verified` treatments are field-immutable (BR-007 / AC-VIS-003): code, tooth, surface, and price cannot change once a treatment is performed; only status transitions (`performed`→`verified`/`dismissed`) remain allowed. |
| `dismissReason` | string | YES | NO | — | Recorded when status→`dismissed` |
| `refusalReason` | string | NO | YES* | — | *Required when status→`declined` (REFUSAL_REASON_REQUIRED) |
| `clinicalNotes` | string | YES | NO | — | — |

**Response 200:** `{ data: Treatment }`

**Errors:** `NOT_FOUND(404)`, `TREATMENT_IMMUTABLE(422)`, `INVALID_STATUS_TRANSITION(422)`, `TREATMENT_CONSENT_REQUIRED(422)` (→performed), `REFUSAL_REASON_REQUIRED(422)` (→declined), `VISIT_IMMUTABLE(422)`, `FORBIDDEN(403)`
**Events emitted (audit-log-only, ADR-006):** DE-005 TreatmentPerformed (→performed), DE-006 TreatmentDismissed (→dismissed); `treatment.declined` is also audited (V-VIS-006)

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

### POST /api/v1/dental/patients/:patientId/dentition

Initialize dentition for patient. Dentition type derived from `dateOfBirth`: age≤5 = `deciduous`, age 6–12 = `mixed`, else `permanent`. Idempotent on (patientId, visitId).

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `patientId` (uuid)

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `dateOfBirth` | string | NO | YES | ISO-8601 date | `"2015-04-12"` |
| `visitId` | string (uuid) | NO | YES | — | `"..."` |

**Response 201:** `{ chartId: uuid, patientId: uuid, dentitionType: "deciduous"|"mixed"|"permanent", toothCount: number, teeth: ToothChartState[] }`

**Errors:** `DENTITION_ALREADY_INITIALIZED(409)`, `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

> **SOAP note modeling (V-VIS-009):** the implementation models clinical notes as a
> **single per-visit `visit_notes` record** with four structured SOAP columns
> (`subjective`, `objective`, `assessment`, `plan`) plus a free-text `notes` field —
> NOT a `ClinicalNote[]` collection and NOT a single `content` blob. Edits before
> signing are upserts onto the same row; signing locks the row; later changes go
> through the append-only addendum/version history. The contract below reflects the
> code (`UpsertVisitNotesRequest` / `VisitNotes` in `dental-visit.tsp`).

### GET /api/v1/dental/visits/:id/notes

Get the visit's SOAP notes record.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `visitId` (uuid)

**Response 200:** `{ data: VisitNotes }` (single record — `subjective`, `objective`, `assessment`, `plan`, `notes`, `signed`, `signedAt`, `signedBy`, `lockedAt`)

---

### POST /api/v1/dental/visits/:id/notes

Upsert the visit's SOAP notes (creates on first call, updates thereafter while unsigned).

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `visitId` (uuid)

**Request body** (camelCase per `UpsertVisitNotesRequest`):

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `subjective` | string | YES | NO | — | `"Patient reports sensitivity..."` |
| `objective` | string | YES | NO | — | `"Probing depth 4mm..."` |
| `assessment` | string | YES | NO | — | `"Reversible pulpitis"` |
| `plan` | string | YES | NO | — | `"Composite restoration #14"` |
| `notes` | string | YES | NO | — | free-text |

**Response 201:** `{ data: VisitNotes }`

**Errors:** `NOT_FOUND(404)`, `VISIT_IMMUTABLE(422)`, `FORBIDDEN(403)`

---

### POST /api/v1/dental/visits/:id/notes/sign

Sign the visit's SOAP notes (locks the single per-visit note). There is one note
per visit, so the route carries no note id (V-VIS-010).

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `visitId` (uuid)
**Request body:** `{}` (empty — `SignVisitNotesRequest`)

**Response 200:** `{ data: VisitNotes }` (with `signed: true`, `signedAt`, `signedBy`, `lockedAt`)

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### GET /api/v1/dental/patients/:patientId/treatment-plan

Get the aggregated cross-visit treatment plan for a patient (all pending
`diagnosed`/`planned`/`declined` treatments across the patient's visits, phase-sorted).

**Auth:** all dental roles. **V-VIS-011:** authorization is scoped to the **patient's**
branch (`preferredBranchId`), NOT the caller-supplied `branchId` query param — a caller
passing their own `branchId` for another branch's patient gets `403` (cross-tenant guard).
**Path params:** `patientId` (uuid)
**Query params:** `branchId` (uuid, required as a contract field; not the auth boundary)

**Response 200** (real shape — NOT `Treatment[]`; the TypeSpec `TreatmentPlanResponse` model
is a stringly-typed placeholder, see Contract Drift below):
```jsonc
{
  "patientId": "…", "version": 1, "totalEstimateCents": 200000,
  "treatmentCount": 2, "toothCount": 1,
  "byTooth": { "16": [ … ], "general": [ … ] },
  "treatments": [ { "id","toothNumber","cdtCode","description","surfaces",
                    "priceCents","status","conditionCode","visitId","carriedOver",
                    "phase","priority","reason" } ]
}
```

**Errors:** `FORBIDDEN(403)` (cross-tenant / no patient-branch access), `NOT_FOUND(404)` (patient)

---

### POST /api/v1/dental/visits/:visitId/carry-over

Carry over unperformed (`diagnosed`/`planned`) treatments from a previous visit into
the current visit, optionally restoring specific dismissed treatments.

**Auth:** `dentist_owner`, `dentist_associate` (assertBranchRole on the current visit's branch)
**Path params:** `visitId` (new visit uuid)

**Request body** (camelCase — TypeSpec `CarryOverTreatmentsRequest` only models `sourceVisitId`;
`restoreDismissedIds` is accepted by the handler but missing from TypeSpec — see Contract Drift):

| Field | Type | Nullable | Required | Notes |
|-------|------|----------|----------|-------|
| `sourceVisitId` | string | YES | NO | uuid; when omitted, auto-discovers the patient's recent prior visits (across branches) |
| `restoreDismissedIds` | string[] | YES | NO | dismissed treatment ids to restore as `planned` |

**Response 200** (real shape — NOT `{ carried: N }`):
```jsonc
{ "carriedOver": [ Treatment … ], "restoredDismissed": [ Treatment … ], "message": "…" }
```

**Errors:** `NOT_FOUND(404)` (visit/source), `VISIT_IMMUTABLE(422)`, `INVALID_SOURCE_VISIT(422)` (different patient), `FORBIDDEN(403)`

---

### POST /api/v1/dental/visits/:visitId/apply-template/:templateId

Apply a treatment template's items to the visit as `planned` treatments.

**Auth:** `dentist_owner`, `dentist_associate` — **BR-VIS-009** (clinical-role gate, parity
with create-treatment). The template MUST belong to the visit's branch; a foreign-branch
template returns `404` (no cross-clinic template leak). Both fixed audit 2026-06-08.
**Path params:** `visitId`, `templateId`

**Response 201** (real shape — NOT `{ applied: int, visitId }`):
```jsonc
{ "applied": [ Treatment … ], "count": 2 }
```

**Errors:** `NOT_FOUND(404)` (visit / template / foreign-branch template), `VISIT_IMMUTABLE(422)` (completed/locked), `FORBIDDEN(403)` (non-clinical role)

---

### POST /api/v1/dental/patients/:patientId/treatment-plan/accept

Snapshot the patient's current live plan as an append-only `TreatmentPlanVersion`.
Optionally links a `consentFormId` (must belong to the same patient).

**Auth:** all dental roles, **patient-branch scoped (V-VIS-011)**; archived patient → `422 PATIENT_ARCHIVED`.
**Response 201:** `{ id, createdAt, createdBy, version, patientId, snapshot }`
**Errors:** `FORBIDDEN(403)` (cross-tenant), `NOT_FOUND(404)` (patient / consent form), `PATIENT_ARCHIVED(422)`

---

### GET /api/v1/dental/patients/:patientId/treatment-plan/versions/:versionId

Read one immutable plan snapshot. The `patientId` path segment must match the stored row
(prevents cross-patient access) AND the caller must have **patient-branch** access (V-VIS-011).
**Response 200:** `{ id, createdAt, createdBy, version, patientId, snapshot }`
**Errors:** `FORBIDDEN(403)` (cross-tenant), `NOT_FOUND(404)`

---

## Contract Drift (TypeSpec ↔ implementation — surfaced audit 2026-06-08)

Several treatment-plan / template / carry-over TypeSpec models are stringly-typed
placeholders that do NOT match the richer JSON the handlers return (and that the tests
lock). The handler shapes above are the ground truth. Reconciling the TypeSpec models
(and regenerating the SDK) is a follow-up that needs FE-consumer verification — NOT done
in this round to avoid breaking unverified SDK consumers:

| TypeSpec model | Declares | Real response |
|---|---|---|
| `TreatmentPlanResponse` | `{ patientId, visits: string, treatments: string, acceptedPlanVersionId }` | `{ patientId, version, totalEstimateCents, treatmentCount, toothCount, byTooth, treatments[] }` |
| `ApplyTemplateResponse` | `{ applied: int32, visitId }` | `{ applied: Treatment[], count: int32 }` |
| `CarryOverTreatmentsResponse` | `{ carried: int32 }` | `{ carriedOver: Treatment[], restoredDismissed: Treatment[], message }` |
| `CarryOverTreatmentsRequest` | `{ sourceVisitId? }` | also accepts `restoreDismissedIds: string[]` |
| `TreatmentTemplate` | `{ …, treatments: string }` | row uses `items: TemplateTreatmentItem[]` |
