/**
 * Drizzle schema for cephalometric analysis (v1.4)
 *
 * 3 tables:
 *   imaging_ceph_landmark  — per-image landmark points (image-space px, D-C)
 *   imaging_ceph_analysis  — computed measurements + calibration provenance (D-J)
 *   imaging_ceph_report    — immutable versioned snapshots (D-I, append-only)
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  real,
  jsonb,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { baseEntityFields, versionedSnapshotFields } from '@/core/database.schema';
import { imagingStudyImages } from './imaging.schema';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const cephLandmarkSourceEnum = pgEnum('ceph_landmark_source', [
  'manual',
  'ai',
  'ai_corrected',
]);

// Spec §7/§8 SM-02 declares `not_placed → placed → locked`. Per EM-IMG-008 the
// spec value `not_placed` (initial state) is added so AC-IMG-003 (`placed → not_placed → 422`)
// is structurally testable. `confirmed` retained as a working intermediate.
// One-directional; `locked` is terminal.
export const cephLandmarkStatusEnum = pgEnum('ceph_landmark_status', [
  'not_placed',
  'placed',
  'confirmed',
  'locked',
]);

// D-G: use explicit hybrid label — never 'standard' (clinical MUST-FIX #1).
// 'ricketts' (#15) is Frankfort-referenced — a genuinely distinct protocol, keyed
// norms in @monobase/ceph-math prevent cross-analysis norm bleed.
export const cephAnalysisTypeEnum = pgEnum('ceph_analysis_type', ['steiner_hybrid_sn', 'ricketts']);

// D-J calibration provenance
export const cephCalibrationMethodEnum = pgEnum('ceph_calibration_method', [
  'dicom_tag',
  'manual_ruler',
  'assumed_default',
  'not_calibrated', // TypeSpec enum value; TypeSpec reserved 'unknown' → renamed
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

// Coordinates stored in image-space pixels (D-C, not screen-space)
export const imagingCephLandmarks = pgTable(
  'imaging_ceph_landmark',
  {
    ...baseEntityFields,
    imageId: uuid('image_id')
      .notNull()
      .references(() => imagingStudyImages.id),
    landmarkCode: text('landmark_code').notNull(),
    x: real('x').notNull(),
    y: real('y').notNull(),
    source: cephLandmarkSourceEnum('source').notNull().default('manual'),
    confidence: real('confidence'),
    status: cephLandmarkStatusEnum('status').notNull().default('placed'),
  },
  (table) => ({
    imageIdx: index('imaging_ceph_landmark_image_idx').on(table.imageId),
    uniqueImageLandmark: unique('imaging_ceph_landmark_image_code_uniq').on(
      table.imageId,
      table.landmarkCode,
    ),
  }),
);

export const imagingCephAnalyses = pgTable(
  'imaging_ceph_analysis',
  {
    ...baseEntityFields,
    imageId: uuid('image_id')
      .notNull()
      .references(() => imagingStudyImages.id),
    // D-G: default enforced at DB level; pgEnum rejects any value not in the list
    analysisType: cephAnalysisTypeEnum('analysis_type').notNull().default('steiner_hybrid_sn'),
    measurements: jsonb('measurements').notNull().$type<Record<string, number | null>>().default({}),
    // D-J calibration provenance
    calibrationValue: real('calibration_value'),
    calibrationMethod: cephCalibrationMethodEnum('calibration_method')
      .notNull()
      .default('not_calibrated'),
    calibratedAt: timestamp('calibrated_at'),
    calibratedBy: text('calibrated_by'),
  },
  (table) => ({
    uniqueImageAnalysis: unique('imaging_ceph_analysis_image_type_uniq').on(
      table.imageId,
      table.analysisType,
    ),
  }),
);

// Immutable versioned snapshot (D-I). No update/delete handlers — append-only.
// Uses versionedSnapshotFields() — see database.schema.ts for why baseEntityFields
// is deliberately avoided (semantic collision on `version`).
export const imagingCephReports = pgTable(
  'imaging_ceph_report',
  {
    ...versionedSnapshotFields(),
    // imageId is declared after the versionedSnapshotFields spread; Drizzle named-object
    // results are unaffected by physical declaration order — no positional raw SQL reads this table.
    // Parent FK — required by versionedSnapshotFields convention.
    // unique(imageId, version) + index(imageId) declared in 2nd-arg below.
    imageId: uuid('image_id')
      .notNull()
      .references(() => imagingStudyImages.id),
  },
  (table) => ({
    uniqueImageVersion: unique('imaging_ceph_report_image_version_uniq').on(
      table.imageId,
      table.version,
    ),
    imageIdx: index('imaging_ceph_report_image_idx').on(table.imageId),
  }),
);

// ---------------------------------------------------------------------------
// State machines + constants
// ---------------------------------------------------------------------------

export type CephLandmarkStatus = (typeof cephLandmarkStatusEnum.enumValues)[number];

// SM-02: not_placed → placed → locked (spec §8). `not_placed` is the initial state.
// There is no back-edge into `not_placed` — reverting `placed → not_placed` is
// rejected (422 INVALID_STATUS_TRANSITION), satisfying AC-IMG-003.
export const CEPH_LANDMARK_TRANSITIONS: Record<CephLandmarkStatus, CephLandmarkStatus[]> = {
  not_placed: ['placed'],
  placed: ['confirmed'], // no back-edge to not_placed → AC-IMG-003 422
  confirmed: ['locked'],
  locked: [], // terminal — coordinates and status are immutable once locked
};

// D-L: report generation blocked until these 4 landmarks are 'confirmed'
export const CEPH_REPORT_GATE_LANDMARKS = ['A', 'B', 'Go', 'Po'] as const;

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type ImagingCephLandmark = typeof imagingCephLandmarks.$inferSelect;
export type NewImagingCephLandmark = typeof imagingCephLandmarks.$inferInsert;
export type ImagingCephAnalysis = typeof imagingCephAnalyses.$inferSelect;
export type NewImagingCephAnalysis = typeof imagingCephAnalyses.$inferInsert;
export type ImagingCephReport = typeof imagingCephReports.$inferSelect;
export type NewImagingCephReport = typeof imagingCephReports.$inferInsert;
