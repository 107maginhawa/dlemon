<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC dental-imaging, API_CONVENTIONS.md, ERROR_TAXONOMY.md, DOMAIN_MODEL §5 -->

# API Contracts — dental-imaging

> All responses wrap in `{ data, meta }`.
> Loose coupling: no DB-level FKs to other modules — UUID references only.
> Tier gating: imaging features require `imagingTier` on branch configuration.

---

## Endpoints

### POST /api/v1/dental/imaging/studies

Create a new imaging study.

**Auth:** `dentist_associate`, `dentist_owner`
**Rate limit:** Default

**Request body:**

| Field | Type | Nullable | Required | Format | Enum | Constraints | Example |
|-------|------|----------|----------|--------|------|-------------|---------|
| `branch_id` | string | NO | YES | uuid | — | — | `"01JX..."` |
| `patient_id` | string | NO | YES | uuid | — | — | `"01JX..."` |
| `visit_id` | string | YES | NO | uuid | — | — | `"01JX..."` |
| `modality` | string | NO | YES | — | `periapical`, `panoramic`, `bitewing`, `cephalometric`, `cbct`, `intraoral_photo` | — | `"panoramic"` |
| `study_date` | string | NO | YES | date (YYYY-MM-DD) | — | — | `"2026-05-24"` |
| `notes` | string | YES | NO | — | — | max:500 | `"Baseline panoramic"` |

**Response 201:** `{ data: ImagingStudy }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `branch_id` | string (uuid) | NO | |
| `patient_id` | string (uuid) | NO | |
| `visit_id` | string (uuid) | YES | |
| `modality` | string | NO | |
| `status` | string | NO | `pending` |
| `image_count` | integer | NO | `0` initially |
| `study_date` | string (date) | NO | |
| `created_at` | string (date-time) | NO | |

**Errors:** `IMAGING_TIER_REQUIRED(403)`, `VALIDATION_ERROR(400)`, `FORBIDDEN(403)`
**Events emitted:** DE-018 ImagingStudyUploaded (after first image added)

---

### GET /api/v1/dental/imaging/studies

List imaging studies (patient-scoped).

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Query params:**

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `branch_id` | uuid | YES | Branch scope |
| `patient_id` | uuid | YES | Patient filter (required) |
| `modality` | string | NO | Filter by modality |
| `date_from` | date | NO | |
| `date_to` | date | NO | |
| `page` | integer | NO | Default: 1 |
| `per_page` | integer | NO | Default: 20, max: 100 |

**Response 200:** Standard paginated collection of ImagingStudy objects

**Sort:** `study_date DESC` (default)

**Errors:** `FORBIDDEN(403)`, `IMAGING_TIER_REQUIRED(403)`

---

### POST /api/v1/dental/imaging/studies/:id/images

Upload image(s) to a study.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (study uuid)
**Content-Type:** `multipart/form-data`
**Rate limit:** 10 req/min

**Request body:**

| Field | Type | Required | Format | Constraints |
|-------|------|----------|--------|-------------|
| `files` | file[] | YES | DICOM, JPEG, PNG, TIFF | Max 50 MB per file; max 20 files per request |
| `tooth_numbers` | integer[] | NO | — | FDI notation, one per file (optional) |

**Response 201:**

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `uploaded` | integer | NO | Count of successfully uploaded images |
| `image_ids` | string[] | NO | UUIDs of created image records |
| `study_id` | string (uuid) | NO | |

**Errors:** `NOT_FOUND(404)`, `UNSUPPORTED_MIME_TYPE(422)`, `FORBIDDEN(403)`, `IMAGING_TIER_REQUIRED(403)`
**Events emitted:** DE-018 ImagingStudyUploaded

---

### POST /api/v1/dental/imaging/studies/:id/annotations

Create an annotation on a study image.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (study uuid)

**Request body:**

| Field | Type | Nullable | Required | Enum | Constraints | Example |
|-------|------|----------|----------|------|-------------|---------|
| `image_id` | string | NO | YES | — | uuid | `"01JX..."` |
| `annotation_type` | string | NO | YES | `region`, `measurement`, `finding`, `arrow`, `text` | — | `"finding"` |
| `coordinates` | object | NO | YES | — | `{ x, y, width?, height? }` | `{x:120,y:80,width:30,height:20}` |
| `label` | string | YES | NO | — | max:200 | `"Caries - mesial" ` |
| `finding_code` | string | YES | NO | — | ICD/dental code | `"K02.1"` |
| `status` | string | NO | YES | `draft`, `confirmed` | — | `"draft"` |

**Response 201:** `{ data: ImagingAnnotation }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `study_id` | string (uuid) | NO | |
| `image_id` | string (uuid) | NO | |
| `annotation_type` | string | NO | |
| `status` | string | NO | `draft` |
| `created_at` | string (date-time) | NO | |

**Errors:** `NOT_FOUND(404)`, `INVALID_STATUS_TRANSITION(422)`, `FORBIDDEN(403)`

---

### PATCH /api/v1/dental/imaging/studies/:id/annotations/:aid

Update annotation (promote to confirmed, edit label).

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (study uuid), `aid` (annotation uuid)

**Request body:**

| Field | Type | Nullable | Required | Enum | Example |
|-------|------|----------|----------|------|---------|
| `status` | string | YES | NO | `confirmed`, `dismissed` | `"confirmed"` |
| `label` | string | YES | NO | — | `"Caries confirmed"` |
| `finding_code` | string | YES | NO | — | `"K02.1"` |

**Response 200:** `{ data: ImagingAnnotation }`

**Errors:** `NOT_FOUND(404)`, `INVALID_STATUS_TRANSITION(422)`, `FORBIDDEN(403)`
**Events emitted:** DE-019 ImagingFindingConfirmed (when status → confirmed)

---

### POST /api/v1/dental/imaging/studies/:id/findings

Add a structured clinical finding to a study.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (study uuid)

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `tooth_number` | integer | YES | NO | FDI notation | `14` |
| `finding_code` | string | NO | YES | max:20 | `"K02.1"` |
| `description` | string | NO | YES | max:500 | `"Occlusal caries, moderate depth"` |
| `severity` | string | NO | YES | enum: `minimal`, `moderate`, `severe` | `"moderate"` |
| `annotation_id` | string | YES | NO | uuid | `"01JX..."` |

**Response 201:** `{ data: ImagingFinding }`

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### POST /api/v1/dental/imaging/ceph-analyses

Create a new cephalometric analysis.

**Auth:** `dentist_associate`, `dentist_owner`

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `branch_id` | string | NO | YES | uuid | `"01JX..."` |
| `patient_id` | string | NO | YES | uuid | `"01JX..."` |
| `study_id` | string | NO | YES | uuid (imaging study with ceph modality) | `"01JX..."` |
| `image_id` | string | NO | YES | uuid | `"01JX..."` |
| `analysis_type` | string | NO | YES | enum: `steiner`, `ricketts`, `tweed`, `mcnamara` | `"steiner"` |

**Response 201:** `{ data: CephAnalysis }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `study_id` | string (uuid) | NO | |
| `patient_id` | string (uuid) | NO | |
| `analysis_type` | string | NO | |
| `status` | string | NO | `pending_landmarks` |
| `is_calibrated` | boolean | NO | `false` |
| `landmark_count` | integer | NO | `0` |
| `created_at` | string (date-time) | NO | |

**Errors:** `IMAGING_TIER_REQUIRED(403)`, `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### PUT /api/v1/dental/imaging/ceph-analyses/:id/landmarks

Batch upsert landmarks for a ceph analysis.

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (ceph analysis uuid)

**Request body:**

| Field | Type | Nullable | Required | Notes |
|-------|------|----------|----------|-------|
| `landmarks` | Landmark[] | NO | YES | Array of landmark points |
| `calibration` | object | YES | NO | `{ pixels_per_mm: number }` |

**Landmark fields:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `landmark_code` | string | NO | YES | max:20, e.g., `"N"`, `"S"`, `"A"` | `"N"` |
| `x` | number | NO | YES | — | `234.5` |
| `y` | number | NO | YES | — | `189.2` |
| `confidence` | number | YES | NO | 0.0–1.0 (AI-assisted) | `0.95` |

**Response 200:** `{ data: { analysis_id: "uuid", landmark_count: N, is_calibrated: true } }`

**Errors:** `NOT_FOUND(404)`, `CEPH_ANALYSIS_NOT_FOUND(404)`, `FORBIDDEN(403)`, `IMAGING_TIER_REQUIRED(403)`

---

### POST /api/v1/dental/imaging/ceph-analyses/:id/recompute

Trigger measurement recomputation (requires calibration and minimum landmarks).

**Auth:** `dentist_associate`, `dentist_owner`
**Path params:** `id` (ceph analysis uuid)

**Response 202:** `{ data: { analysis_id: "uuid", status: "computing", estimated_seconds: 5 } }`

**Errors:** `NOT_FOUND(404)`, `NOT_CALIBRATED(422)`, `INSUFFICIENT_LANDMARKS(422)`, `FORBIDDEN(403)`, `IMAGING_TIER_REQUIRED(403)`
**Events emitted:** DE-020 CephAnalysisComputed (async, on completion)
