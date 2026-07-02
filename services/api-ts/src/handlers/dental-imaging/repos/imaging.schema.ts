/**
 * Drizzle schema for dental imaging module
 *
 * 4 tables:
 *   imaging_study           — study-level record (one upload session)
 *   imaging_study_image     — individual image file within a study
 *   imaging_study_tooth     — JOIN TABLE mapping image → tooth number(s)
 *   imaging_annotation      — per-image annotations (lines, labels, shapes)
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  real,
  jsonb,
  pgEnum,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

// V-IMG-010: `cbct` (cone-beam CT) added per spec WF-019 / §7. Adding a pg-enum value
// requires an additive migration (ALTER TYPE ... ADD VALUE), produced on the next
// `db:generate`; the value is non-default so existing rows are unaffected.
export const modalityEnum = pgEnum('imaging_modality', [
  'periapical',
  'bitewing',
  'panoramic',
  'cephalometric',
  'cbct',
  'intraoral_photo',
  'extraoral_photo',
  'other',
]);

export const imagingStatusEnum = pgEnum('imaging_status', ['active', 'archived']);

// G5: per-image acquisition quality. 'ok' = usable; 'retake' = flagged for re-acquisition
// (with an optional retakeReason). Additive, non-default-changing.
export const imagingQualityStatusEnum = pgEnum('imaging_quality_status', ['ok', 'retake']);

// G5b: context-link target kinds. An image can be linked to a treatment plan or a
// cephalometric report (loose-coupled — targetId references the other module's row
// id with NO DB-level FK, mirroring the existing cross-module pattern).
// ponytail: 'ortho_case' is a DEAD value (#48) — removed from the API surface
// (TypeSpec + handler + FE). Kept in the pg enum as a harmless orphan; nothing
// writes it, and dropping a pg enum value needs a destructive type-recreate
// migration for zero benefit. Re-add to the API only if an ortho module ships.
export const imagingLinkTypeEnum = pgEnum('imaging_link_type', [
  'treatment_plan',
  'ortho_case',
  'report',
]);

export const imagingAnnotationTypeEnum = pgEnum('imaging_annotation_type', [
  'line',
  'angle',
  'area',
  'label',
  'arrow',
  'freehand',
  'shape',
  'tooth',
]);

// §capture-date: provenance of an image's `capturedAt`. Distinguishes a REAL
// acquisition date from an upload-time default — a medico-legal question ("is this
// June 1 a true capture date or the upload date wearing a costume?"). Mirrors the
// `calibrationMethod: 'dicom_tag'` provenance precedent. 'exif' is reserved for a
// future non-DICOM extraction; 'visit' for a visit-date default; 'defaulted_upload'
// is the migration backfill + the no-date-supplied create fallback.
export const imagingCapturedAtSourceEnum = pgEnum('imaging_captured_at_source', [
  'dicom_tag',
  'exif',
  'visit',
  'manual',
  'defaulted_upload',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const imagingStudies = pgTable('imaging_study', {
  ...baseEntityFields,
  // loose-coupling: references patients.id (cross-module — no DB-level FK to avoid coupling dental-imaging to patient module)
  patientId: uuid('patient_id').notNull(),
  // loose-coupling: references dental_visit.id (cross-module — nullable; imaging can exist without a visit)
  visitId: uuid('visit_id'),
  // loose-coupling: references dental_branch.id (cross-module — no DB-level FK to avoid coupling dental-imaging to dental-org)
  branchId: uuid('branch_id').notNull(),
  // loose-coupling: references dental_membership.id (cross-module — who acquired the study)
  acquiredBy: uuid('acquired_by').notNull(),
  modality: modalityEnum('modality').notNull().default('other'),
  status: imagingStatusEnum('status').notNull().default('active'),
});

export const imagingStudyImages = pgTable('imaging_study_image', {
  ...baseEntityFields,
  studyId: uuid('study_id')
    .notNull()
    .references(() => imagingStudies.id),
  // loose-coupling: references storage file.id (cross-module — no DB-level FK to avoid coupling dental-imaging to storage module)
  fileId: uuid('file_id').notNull(),
  pixelSpacingMm: real('pixel_spacing_mm'),
  sequenceNumber: integer('sequence_number').notNull().default(0),
  dicomMetadata: jsonb('dicom_metadata').$type<DicomMetadata | null>(),
  modality: modalityEnum('modality').notNull().default('other'),
  status: imagingStatusEnum('status').notNull().default('active'),
  // P2-7 CBCT: volume descriptor (all nullable / default-false — additive, non-breaking).
  // A `cbct`/multi-frame DICOM is a VOLUME, not a flat raster. is_volume drives the
  // truthful frontend affordance (volume card + viewer handoff, never a flat <img>).
  isVolume: boolean('is_volume').notNull().default(false),
  // DICOM (0018,0050) SliceThickness in mm.
  sliceThicknessMm: real('slice_thickness_mm'),
  // DICOM (0028,0008) NumberOfFrames — slice count of the multi-frame volume.
  frameCount: integer('frame_count'),
  // DICOM (0020,000E) SeriesInstanceUID / (0020,000D) StudyInstanceUID — identity for
  // dedupe + viewer deep-link (Phase 2). No DB-level uniqueness in v1.
  seriesInstanceUid: text('series_instance_uid'),
  studyInstanceUid: text('study_instance_uid'),
  // G5 library metadata (all additive / non-breaking — §4 organization & filtering):
  // isDiagnostic defaults true (most images are diagnostic); qualityStatus flags retakes;
  // retakeReason explains a flagged retake; tags are free-text organizational labels.
  isDiagnostic: boolean('is_diagnostic').notNull().default(true),
  qualityStatus: imagingQualityStatusEnum('quality_status').notNull().default('ok'),
  retakeReason: text('retake_reason'),
  tags: jsonb('tags').notNull().$type<string[]>().default([]),
  // §capture-date: when the image was ACQUIRED, distinct from createdAt (upload
  // time) — so chronology sorts by capture, not upload. Nullable column, but the
  // create handler always writes a value (DICOM AcquisitionDate → today) and the
  // migration backfills existing rows to created_at, so live rows are effectively
  // non-null; consumers coalesce (capturedAt ?? createdAt) for legacy safety.
  // timestamptz keeps sub-day ordering (FMX bursts) + timezone.
  capturedAt: timestamp('captured_at', { withTimezone: true }),
  capturedAtSource: imagingCapturedAtSourceEnum('captured_at_source'),
});

/**
 * G6: first-class VERSIONED calibration record (guide §6).
 *
 * The image carries the latest derived `pixelSpacingMm` (mirrored for all the
 * measurement/math consumers that read it directly), but that single scalar
 * cannot be reproduced or explained. This append-only table persists the actual
 * 2-point ruler calibration — the two image-space points + the known real-world
 * distance — once per calibration event, with a monotonic `version` per image.
 * A finalized ceph report pins the LATEST version so the calibration it was
 * traced against is exactly reproducible (couples with G2 report version-pinning).
 *
 * Append-only: a re-calibration mints a new version row, never mutates a prior one.
 * `version` here is a monotonic snapshot revision (1, 2, 3…) set via
 * createSnapshotVersion — NOT baseEntityFields' optimistic-lock counter.
 */
export const imagingCalibrations = pgTable(
  'imaging_calibration',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    createdBy: uuid('created_by'),
    version: integer('version').notNull(),
    imageId: uuid('image_id')
      .notNull()
      .references(() => imagingStudyImages.id),
    // Two ruler points in image-space pixels (D-C convention).
    pointA: jsonb('point_a').notNull().$type<{ x: number; y: number }>(),
    pointB: jsonb('point_b').notNull().$type<{ x: number; y: number }>(),
    // The real-world length the operator entered for that ruler line.
    knownDistanceMm: real('known_distance_mm').notNull(),
    // Euclidean pixel length of A→B — retained so pixelSpacingMm is reproducible.
    pixelDistance: real('pixel_distance').notNull(),
    // Derived authoritatively server-side: knownDistanceMm / pixelDistance (mm per px).
    pixelSpacingMm: real('pixel_spacing_mm').notNull(),
    // Provenance; v1 only ever 'manual_ruler' (the 2-point ruler flow).
    method: text('method').notNull().default('manual_ruler'),
  },
  (table) => ({
    uniqueImageVersion: unique('imaging_calibration_image_version_uniq').on(
      table.imageId,
      table.version,
    ),
    imageIdx: index('imaging_calibration_image_idx').on(table.imageId),
  }),
);

/**
 * G5b: context links (guide §4) — an image's relationships to a treatment plan,
 * ortho case, or cephalometric report. Loose-coupled: targetId references another
 * module's row id with NO DB-level FK (matches the cross-module convention used by
 * imaging_study.patientId/visitId). One row per (image, type, target); re-linking
 * the same pair is idempotent.
 */
export const imagingLinks = pgTable(
  'imaging_link',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    createdBy: uuid('created_by'),
    imageId: uuid('image_id')
      .notNull()
      .references(() => imagingStudyImages.id),
    linkType: imagingLinkTypeEnum('link_type').notNull(),
    // loose-coupling: references treatment-plan / ortho-case / ceph-report id (cross-module — no DB FK)
    targetId: uuid('target_id').notNull(),
  },
  (table) => ({
    uniqueLink: unique('imaging_link_image_type_target_uniq').on(
      table.imageId,
      table.linkType,
      table.targetId,
    ),
    imageIdx: index('imaging_link_image_idx').on(table.imageId),
    targetIdx: index('imaging_link_target_idx').on(table.targetId),
  }),
);

/** JOIN TABLE: one image → many tooth numbers */
export const imagingStudyTeeth = pgTable('imaging_study_tooth', {
  id: uuid('id').primaryKey().defaultRandom(),
  imageId: uuid('image_id')
    .notNull()
    .references(() => imagingStudyImages.id),
  toothNumber: integer('tooth_number').notNull(),
  numberingSystem: text('numbering_system').notNull().default('universal'),
});

export const imagingAnnotations = pgTable(
  'imaging_annotation',
  {
    ...baseEntityFields,
    imageId: uuid('image_id')
      .notNull()
      .references(() => imagingStudyImages.id),
    type: imagingAnnotationTypeEnum('type').notNull(),
    geometry: jsonb('geometry').notNull(),
    measurementValue: real('measurement_value'),
    measurementUnit: text('measurement_unit'),
    toothNumber: integer('tooth_number'),
    visible: boolean('visible').notNull().default(true),
  },
  (table) => ({
    imageVisibleIdx: index('imaging_annotation_image_visible_idx').on(
      table.imageId,
      table.visible,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Allowed MIME types (BR-034)
// ---------------------------------------------------------------------------

export const ALLOWED_IMAGING_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/bmp',
  // P1-9: DICOM ingest. application/dicom is the standard radiology interchange
  // type; large DICOM/CBCT payloads route through the S3 multipart upload path.
  'application/dicom',
] as const;

export type AllowedImagingMimeType = (typeof ALLOWED_IMAGING_MIME_TYPES)[number];

export type ImagingModality = (typeof modalityEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// P2-7 / P1-9: typed dicomMetadata JSONB shape
// ---------------------------------------------------------------------------

/**
 * Formalized `dicom_metadata` JSONB contents (replaces the `{ fileName }`-only stub).
 * All fields optional: a flat 2-D upload populates only fileName/mimeType; a parsed
 * DICOM/CBCT volume populates the geometry + identity tags. Spacing is [x, y, z] mm
 * (z = slice thickness) so a future MPR phase has the full voxel geometry, never guessed.
 */
export interface DicomMetadata {
  fileName?: string;
  mimeType?: string;
  isDicom?: boolean;
  /** mm/px persisted as the calibration value (also mirrored onto pixelSpacingMm). */
  pixelSpacingMm?: number;
  /** Provenance of pixelSpacingMm — only ever 'dicom_tag' here (matches ceph enum). */
  calibrationMethod?: 'dicom_tag';
  // --- parsed DICOM tags (P1-9 server-side parse) ---
  modality?: string;        // (0008,0060)
  manufacturer?: string;    // (0008,0070)
  rows?: number;            // (0028,0010)
  columns?: number;         // (0028,0011)
  frameCount?: number;      // (0028,0008) NumberOfFrames
  /** voxel spacing [x, y, z] in mm (z = SliceThickness). */
  spacing?: [number | null, number | null, number | null];
  studyInstanceUid?: string;   // (0020,000D)
  seriesInstanceUid?: string;  // (0020,000E)
  /** field-of-view in mm [width, height] when derivable from rows×cols×spacing. */
  fovMm?: [number | null, number | null];
  // Additional raw DICOM header fields may be retained (and are PHI-scrubbed by the
  // erasure facade). The known fields above are strongly typed; everything else is
  // an opaque JSON value.
  [key: string]: unknown;
}

/**
 * Frontend affordance discriminator. `volume` → CBCT/3-D card + "Open in viewer"
 * handoff (never a flat <img>); `image` → ordinary 2-D raster viewer.
 */
export type ImagingViewerKind = 'image' | 'volume';

export function viewerKindFor(opts: { isVolume?: boolean | null; modality?: string | null }): ImagingViewerKind {
  return opts.isVolume === true || opts.modality === 'cbct' ? 'volume' : 'image';
}

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type ImagingStudy = typeof imagingStudies.$inferSelect;
export type NewImagingStudy = typeof imagingStudies.$inferInsert;
export type ImagingStudyImage = typeof imagingStudyImages.$inferSelect;
export type NewImagingStudyImage = typeof imagingStudyImages.$inferInsert;
export type ImagingStudyTooth = typeof imagingStudyTeeth.$inferSelect;
export type NewImagingStudyTooth = typeof imagingStudyTeeth.$inferInsert;
export type ImagingAnnotation = typeof imagingAnnotations.$inferSelect;
export type NewImagingAnnotation = typeof imagingAnnotations.$inferInsert;
export type ImagingCalibration = typeof imagingCalibrations.$inferSelect;
export type NewImagingCalibration = typeof imagingCalibrations.$inferInsert;
export type ImagingLink = typeof imagingLinks.$inferSelect;
export type NewImagingLink = typeof imagingLinks.$inferInsert;
export type ImagingLinkType = (typeof imagingLinkTypeEnum.enumValues)[number];
