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
  dicomMetadata: jsonb('dicom_metadata'),
  modality: modalityEnum('modality').notNull().default('other'),
  status: imagingStatusEnum('status').notNull().default('active'),
});

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
