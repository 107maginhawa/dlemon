# Dental Imaging Module Specification

**Module:** `dental-imaging`
**Version:** 2.0 (Phase 4 — Ceph Workspace)
**Status:** Implemented

## Overview

The dental-imaging module provides structured storage, retrieval, and management of dental radiographs and clinical photographs. It operates alongside the legacy `dental_attachment` module via a union adapter, ensuring historical X-ray records appear alongside new imaging study records.

## Schema

### Tables

| Table | Purpose |
|-------|---------|
| `imaging_study` | Study container: patient, visit, branch, modality, status |
| `imaging_study_image` | Individual image file linked to a study |
| `imaging_study_tooth` | JOIN TABLE: image ↔ tooth number (not JSONB array) |
| `imaging_annotation` | Overlay data: geometry, measurements, labels — never burned into image |
| `imaging_ceph_landmark` | Per-image landmark placement: `landmarkCode`, `x`, `y`, `status` (`placed\|confirmed\|locked`) |
| `imaging_ceph_analysis` | Derived measurements for an image: angles, distances, `analysisType`, `pixelSpacingMm`, `calibratedAt` |
| `imaging_ceph_report` | Immutable versioned snapshot of landmarks + analysis at report generation time (`version` monotonically incrementing per image) |

### Modality Enum

`periapical` | `bitewing` | `panoramic` | `cephalometric` | `intraoral_photo` | `extraoral_photo` | `other`

Default: `other` (non-nullable — reclassify post-upload via PATCH /dental/imaging/images/:id/modality)

## Business Rules

### BR-023: Annotations are non-destructive
**Rule:** BR-023 — Annotations are stored as structured overlay data in `imaging_annotation.geometry` (JSONB Zod discriminated union). They are **never burned into the image**. The original image file is immutable.

**Implementation:** `imaging_annotation` table stores geometry separately from `imaging_study_image`. No pixel manipulation on stored files.

---

### BR-024: Panoramic measurement accuracy warning
**Rule:** BR-024 — Panoramic images require a visual warning when measurement tools are used, as geometric distortion makes pixel-to-mm calibration unreliable.

**Implementation:** Phase 3a (measurement tools). Viewer must check `modality === 'panoramic'` and surface a warning banner when measurement mode is active.

---

### BR-025: Image linked to patient + optional visit + optional tooth
**Rule:** BR-025 — Each imaging study must link to a patient (`patient_id` NOT NULL). Visit linkage (`visit_id`) is optional (study may be acquired outside a visit). Tooth linkage is via `imaging_study_tooth` JOIN TABLE.

**Implementation:** `imaging_study.visit_id` nullable. Tooth numbers stored in `imaging_study_tooth` (one row per tooth, supporting multi-tooth images).

---

### BR-026: Delete is role-gated (default-deny)
**Rule:** BR-026 — Image deletion requires explicit role authorization. Roles not in the allowed list receive 403.

| Role | Delete Permission |
|------|------------------|
| Dentist | Any image in own branch |
| Associate | Own images only (acquiredBy === user.id) |
| Hygienist | Forbidden |
| Front Desk | Forbidden |

**Implementation:** `deleteImage.ts` — default-deny pattern: `if (!allowedRoles.includes(role)) throw new ForbiddenError(...)`. Associate path checks `study.acquiredBy === user.id`.

---

### BR-027: Associates can only delete their own images
**Rule:** BR-027 — Associates have upload rights but may only delete images they uploaded (`imaging_study.acquired_by === user.id`).

**Implementation:** See BR-026 above. Separate check after role gate: if `role === 'associate' && study.acquiredBy !== user.id` → ForbiddenError.

---

### BR-028: Soft delete only
**Rule:** BR-028 — Images are never hard-deleted from the database or storage. Deletion sets `imaging_study_image.status = 'archived'`. Storage files are retained.

**Implementation:** `ImagingRepository.archiveImage(id)` sets status to 'archived'. `listImagingImagesForPatient` filters `status = 'active'` only.

---

### BR-029: Branch isolation
**Rule:** BR-029 — All imaging endpoints enforce branch-level access. Users without an active membership in the study's branch receive 403.

**Implementation:** All 5 handlers call `assertBranchAccess(db, user.id, branchId)` from `@/handlers/shared/assert-branch-access`. Branch ID sourced from the study record (not user input).

---

### BR-030: Union adapter — legacy dental_attachment compatibility
**Rule:** BR-030 — Legacy `dental_attachment` records with `image_type IN ('xray', 'photo', 'scan')` appear in `GET /dental/patients/:id/images` alongside new imaging study records.

**Source discriminator mapping:**

| dental_attachment.imageType | PatientImageItem.modality | PatientImageItem.source |
|-----------------------------|---------------------------|------------------------|
| `xray` | `other` | `legacy` |
| `photo` | `intraoral_photo` | `legacy` |
| `scan` | `other` | `legacy` |

Records with `imageType IN ('document', 'other')` or `deleted_at IS NOT NULL` are excluded from the union.

**Implementation:** `listPatientImages.ts` runs two queries (imaging_study_image + dental_attachment) and merges, sorted by `created_at DESC`.

---

### BR-031: Offline caching via IndexedDB
**Rule:** BR-031 — Image blobs and annotation JSON are cached in IndexedDB (`dentalemon-imaging` database). On load, the viewer checks IndexedDB before fetching from the network. This enables offline viewing of previously accessed images.

**Implementation:** `use-offline-cache.ts` — two stores: `image-blobs` (Blob by imageId) and `annotations` (JSON by imageId). Raw IndexedDB API — no additional library dependency.

---

### BR-032: Modality is non-nullable with default 'other'
**Rule:** BR-032 — The `modality` column on both `imaging_study` and `imaging_study_image` is non-nullable with a database default of `'other'`. Post-upload reclassification is supported via PATCH endpoint.

**Implementation:** Drizzle schema: `modality: modalityEnum('modality').notNull().default('other')`.

---

### BR-033: Maximum file size 100MB
**Rule:** BR-033 — Image uploads are limited to 100MB. Larger files are rejected.

**Implementation:** Enforced at storage layer (Phase 1.5 chunked upload infrastructure). Handler validates MIME type (BR-034); storage provider enforces size.

---

### BR-034: Allowed image formats: JPEG, PNG, TIFF, BMP
**Rule:** BR-034 — Only these MIME types are accepted for imaging uploads:
- `image/jpeg`
- `image/png`
- `image/tiff`
- `image/bmp`

Other formats (e.g., PDF, DICOM, WebP) are rejected with 400.

**Implementation:** `createImagingStudy.ts` validates against `ALLOWED_IMAGING_MIME_TYPES` constant before calling storage. Client-side `ImageUpload` component also filters file picker to `.jpg,.jpeg,.png,.tif,.tiff,.bmp`.

---

### BR-035: Concurrent annotation edits — last-write-wins
**Rule:** BR-035 — When two users edit annotations on the same image simultaneously, the server uses `updated_at` timestamp for last-write-wins resolution. No optimistic locking or conflict UI in Phase 2.

**Implementation:** Phase 3b (annotation tools). `imaging_annotation` table has `updated_at` from `baseEntityFields`. Resolver compares `updated_at` on write.

---

---

## Ceph Workspace (v1.4) — CIMG-001 to CIMG-008

Full rule definitions in `docs/prd/BUSINESS_RULES.md` — Ceph Workspace section. Summary:

| ID | Rule | Status |
|----|------|--------|
| CIMG-001 | Free `imagingTier` → 403 on all CephMgmt endpoints | implemented |
| CIMG-002 | Null `imagingTier` treated as free → 403 | implemented |
| CIMG-003 | Landmark state: `placed → confirmed → locked` (forward-only) | implemented |
| CIMG-004 | Locked landmark is immutable — PATCH/DELETE → 422 `LANDMARK_LOCKED` | implemented |
| CIMG-005 | Invalid status transition → 422 `INVALID_STATUS_TRANSITION` | implemented |
| CIMG-006 | Report gate: A, B, Go, Po must be `confirmed` before report creation | implemented |
| CIMG-007 | Non-member → 404 (not 403) on all CephMgmt endpoints | implemented |
| CIMG-008 | Reports are append-only versioned snapshots — no update/delete | implemented |

---

## State Transitions

### SM-01: Imaging Finding

`suspected` → `confirmed` → `resolved` (no reversal)

**Enforced in:** `updateFinding.ts` — `FINDING_TRANSITIONS` constant. Invalid transitions throw `BusinessLogicError`.

### SM-02: Ceph Landmark (v1.4)

`placed` → `confirmed` → `locked` (terminal — no further transitions)

**Enforced in:** `CephMgmt_updateCephLandmark.ts` — `CEPH_LANDMARK_TRANSITIONS` constant. `locked` → any throws 422 `LANDMARK_LOCKED`. Any backward transition throws 422 `INVALID_STATUS_TRANSITION`.

---

## Permission Matrix

| Action | Dentist | Associate | Hygienist | Front Desk |
|--------|---------|-----------|-----------|------------|
| Upload image | Yes | Yes | Yes | No |
| View images (own branch) | Yes | Yes | Yes | Yes |
| Delete any image | Yes | No | No | No |
| Delete own image | Yes | Yes (own only) | No | No |
| Reclassify modality | Yes | Yes | Yes | No |
| Ceph — any action (paid tier) | Yes | Yes | Yes | Yes |
| Ceph — any action (free tier) | No (403) | No (403) | No (403) | No (403) |
| Ceph — non-member | No (404) | No (404) | No (404) | No (404) |

**Default-deny:** Any role not explicitly listed as "Yes" receives `ForbiddenError` (HTTP 403).

## API Endpoints

| Method | Path | Handler | BR |
|--------|------|---------|----|
| POST | `/dental/imaging/studies` | createImagingStudy | BR-033, BR-034 |
| GET | `/dental/imaging/studies/:studyId` | getImagingStudy | BR-029 |
| DELETE | `/dental/imaging/images/:imageId` | deleteImage | BR-026, BR-027, BR-028 |
| PATCH | `/dental/imaging/images/:imageId/modality` | updateImageModality | BR-032 |
| GET | `/dental/patients/:patientId/images` | listPatientImages | BR-030 |
| GET | `/dental/imaging/images/:imageId/ceph/analysis` | CephMgmt_getCephAnalysis | CIMG-001, CIMG-007 |
| POST | `/dental/imaging/images/:imageId/ceph/analysis/recompute` | CephMgmt_recomputeCephAnalysis | CIMG-001, CIMG-007 |
| POST | `/dental/imaging/images/:imageId/ceph/landmarks` | CephMgmt_batchUpsertCephLandmarks | CIMG-001, CIMG-003, CIMG-007 |
| GET | `/dental/imaging/images/:imageId/ceph/landmarks` | CephMgmt_listCephLandmarks | CIMG-001, CIMG-007 |
| PATCH | `/dental/imaging/images/:imageId/ceph/landmarks/:landmarkCode` | CephMgmt_updateCephLandmark | CIMG-001, CIMG-003, CIMG-004, CIMG-005, CIMG-007 |
| DELETE | `/dental/imaging/images/:imageId/ceph/landmarks/:landmarkCode` | CephMgmt_deleteCephLandmark | CIMG-001, CIMG-004, CIMG-007 |
| POST | `/dental/imaging/images/:imageId/ceph/reports` | CephMgmt_createCephReport | CIMG-001, CIMG-006, CIMG-007, CIMG-008 |
| GET | `/dental/imaging/images/:imageId/ceph/reports/:version` | CephMgmt_getCephReport | CIMG-001, CIMG-007 |

## TypeSpec Source

`specs/api/src/modules/dental-imaging.tsp`

## Dependencies

- Phase 1.5: Chunked upload (storage multipart) + imagingTier stub
- `@/handlers/shared/assert-branch-access` — branch isolation
- `dental_attachment` schema — union adapter source
- `stored_file` table — file_id FK for imaging_study_image
- `dental_membership.imagingTier` — tier gate for all CephMgmt endpoints (CIMG-001)
- `imaging_ceph.schema.ts` — `CEPH_LANDMARK_TRANSITIONS`, `CEPH_REPORT_GATE_LANDMARKS` constants

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-16 | 1.0 | Initial spec (BR-023–035, core imaging workspace) |
| 2026-05-18 | 2.0 | Added ceph schema (3 tables), CIMG-001–008, SM-01/SM-02 state transitions, 8 CephMgmt_* API endpoints, ceph permission matrix rows |
