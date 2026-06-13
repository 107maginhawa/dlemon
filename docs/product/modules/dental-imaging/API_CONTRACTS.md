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

### GET /api/v1/dental/imaging/studies/:studyId

Get a single imaging study.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `studyId` (study uuid)

**Response 200:** `{ data: ImagingStudy }`

**Errors:** `STUDY_NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### GET /api/v1/dental/patients/:patientId/images

Patient-scoped union of imaging images and legacy clinical attachments surfaced in the imaging workspace.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `patientId` (patient uuid)

**Response 200:** Collection of image records (each tagged `source: 'imaging' | 'legacy'`)

**Errors:** `FORBIDDEN(403)`

---

> **V-IMG-009 — image-centric surface.** Ceph state and clinical findings hang off an **image**, not a
> standalone `ceph-analyses` resource, and there is no `studies/:id/images` or `studies/:id/annotations`
> resource (those were stale earlier docs). The routes below match `generated/openapi/routes.ts` and
> MODULE_SPEC §10. Auth for all of them: `dentist_associate`, `dentist_owner` (read endpoints also `staff_full`).

### Image lifecycle

| Method | Path | Purpose |
|--------|------|---------|
| DELETE | /api/v1/dental/imaging/images/:imageId | Delete an image (soft-delete → `status='archived'`) |
| PATCH | /api/v1/dental/imaging/images/:imageId/calibration | Set calibration — scalar `pixelSpacingMm`, **or** the 2-point ruler (`pointA`,`pointB`,`knownDistanceMm`) → server derives mm/px + persists a versioned `imaging_calibration` record (G6) |
| PATCH | /api/v1/dental/imaging/images/:imageId/metadata | **G5a** — partial update of library metadata: `isDiagnostic`, `qualityStatus`(ok\|retake), `retakeReason`, `tags[]` (trim/dedupe/clamp50/cap30) |
| PATCH | /api/v1/dental/imaging/images/:imageId/modality | Set/correct the image modality |

**Calibration body (G6):** the 2-point ruler is all-or-nothing — supplying any of `pointA`/`pointB`/`knownDistanceMm` requires all three and a positive, non-coincident distance (else `VALIDATION_ERROR(400)`). `pixelSpacingMm` is derived server-side (`knownDistanceMm / hypot(pointA,pointB)`); a client-supplied scalar is honored only on the no-ruler legacy path.

### Library metadata & context links (G5)

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/v1/dental/imaging/images/:imageId/links | **G5b** — link an image to a `treatment_plan`/`ortho_case`/`report` (`linkType` + `targetId` uuid). Idempotent on (image, type, target) |
| GET | /api/v1/dental/imaging/images/:imageId/links | List an image's context links |
| DELETE | /api/v1/dental/imaging/links/:linkId | Remove a context link (204) |

`targetId` is **loose-coupled** — a uuid referencing another module's row with no DB-level FK. `listPatientImages` batch-loads links (no N+1) and accepts `isDiagnostic`/`qualityStatus`/`tag`/`linkType`/`linkTargetId` filters.

**Errors:** `VALIDATION_ERROR(400)`, `IMAGE_NOT_FOUND(404)`, `LINK_NOT_FOUND(404)`, `FORBIDDEN(403)`. Metadata + link writes are gated to `dentist_owner`/`dentist_associate`.

### Findings (image-centric)

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/v1/dental/imaging/images/:imageId/findings | Add a clinical finding to an image |
| GET | /api/v1/dental/imaging/images/:imageId/findings | List an image's findings |
| PATCH | /api/v1/dental/imaging/findings/:findingId | Update a finding (e.g. status) |
| DELETE | /api/v1/dental/imaging/findings/:findingId | Delete a finding |

**Errors:** `FINDING_NOT_FOUND(404)`, `INVALID_STATUS_TRANSITION(422)`, `FORBIDDEN(403)`
**Events emitted:** DE-019 ImagingFindingConfirmed (when a finding is confirmed)

### Measurements (image-centric)

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/v1/dental/imaging/images/:imageId/measurements | Add a measurement to an image |
| GET | /api/v1/dental/imaging/images/:imageId/measurements | List an image's measurements |
| DELETE | /api/v1/dental/imaging/measurements/:measurementId | Delete a measurement |

**Errors:** `NOT_CALIBRATED(422)`, `NOT_FOUND(404)`, `FORBIDDEN(403)`

### Cephalometric (hangs off the image)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/v1/dental/imaging/images/:imageId/ceph/analysis | Get the image's ceph analysis (angles, classification) |
| POST | /api/v1/dental/imaging/images/:imageId/ceph/analysis/recompute | Recompute measurements (requires calibration + min landmarks) |
| GET | /api/v1/dental/imaging/images/:imageId/ceph/landmarks | List landmarks |
| POST | /api/v1/dental/imaging/images/:imageId/ceph/landmarks | Batch upsert landmarks |
| PATCH | /api/v1/dental/imaging/images/:imageId/ceph/landmarks/:landmarkCode | Adjust one landmark |
| DELETE | /api/v1/dental/imaging/images/:imageId/ceph/landmarks/:landmarkCode | Remove one landmark |
| GET | /api/v1/dental/imaging/images/:imageId/ceph/reports | List ceph reports |
| POST | /api/v1/dental/imaging/images/:imageId/ceph/reports | Generate a ceph report |

**Errors:** `NOT_CALIBRATED(422)`, `INSUFFICIENT_LANDMARKS(422)`, `NOT_FOUND(404)`, `FORBIDDEN(403)`, `IMAGING_TIER_REQUIRED(403)`
**Events emitted:** DE-020 CephAnalysisComputed (on recompute completion)
