/**
 * Drizzle schema for imaging findings
 *
 * Separate from imaging.schema.ts per schema-per-entity pattern.
 * Represents structured radiographic findings linked to an imaging study image.
 */

import { pgEnum, pgTable, uuid, text, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { imagingStudyImages, imagingAnnotations } from './imaging.schema';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const imagingFindingTypeEnum = pgEnum('imaging_finding_type', [
  'caries',
  'secondary_caries',
  'bone_loss',
  'furcation_involvement',
  'periapical_lesion',
  'root_resorption',
  'calculus',
  'crown_fracture',
  'root_fracture',
  'impacted_tooth',
  'over_eruption',
  'open_contact',
  'overhang',
  'crown_needed',
  'implant_needed',
]);

// V-IMG-007: SM-01 is `draft → confirmed → resolved` (spec §8 / §11). The code
// historically shipped `suspected/monitoring` as extra working states that diverged
// from the spec. The DB pg-enum keeps all five values (dropping enum values requires
// a destructive migration), but the APPLICATION-level state machine, the create
// default, and the API zod enums are constrained to the spec set. `suspected` and
// `monitoring` are no longer reachable through the API.
export const imagingFindingStatusEnum = pgEnum('imaging_finding_status', [
  'draft',
  'suspected', // legacy DB value — not exposed via API (V-IMG-007)
  'confirmed',
  'monitoring', // legacy DB value — not exposed via API (V-IMG-007)
  'resolved',
]);

export type ImagingFindingStatus = (typeof imagingFindingStatusEnum.enumValues)[number];

/** V-IMG-007: spec-compliant status set exposed through the API (SM-01). */
export const FINDING_STATUSES = ['draft', 'confirmed', 'resolved'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

/** V-IMG-007: initial state per SM-01. */
export const FINDING_INITIAL_STATUS: FindingStatus = 'draft';

// SM-01: draft → confirmed → resolved (spec §8). `draft` is the initial state.
// There is no back-edge into `draft` — reverting `confirmed → draft` is rejected
// (422 INVALID_STATUS_TRANSITION), satisfying AC-IMG-002. Legacy `suspected`/
// `monitoring` states are intentionally absent from the transition map.
export const FINDING_TRANSITIONS: Record<FindingStatus, FindingStatus[]> = {
  draft: ['confirmed', 'resolved'],
  confirmed: ['resolved'], // no back-edge to draft → AC-IMG-002 422
  resolved: [], // terminal — findings don't revert once resolved
};

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const imagingFindings = pgTable(
  'imaging_finding',
  {
    ...baseEntityFields,
    imageId: uuid('image_id').notNull().references(() => imagingStudyImages.id),
    annotationId: uuid('annotation_id').references(() => imagingAnnotations.id),
    treatmentId: uuid('treatment_id'),                                    // loose-coupling: cross-module UUID ref, no DB-level FK
    visitId: uuid('visit_id'),                                            // loose-coupling: cross-module UUID ref, no DB-level FK
    patientId: uuid('patient_id').notNull(),                              // loose-coupling: cross-module UUID ref, no DB-level FK
    branchId: uuid('branch_id').notNull(),                                // loose-coupling: cross-module UUID ref, no DB-level FK
    type: imagingFindingTypeEnum('type').notNull(),
    // No DB-level default: the create handler always sets the initial status
    // (FINDING_INITIAL_STATUS = 'draft'). A DB DEFAULT on a freshly-added enum
    // value ('draft' was added in migration 0068) breaks fresh migration replay
    // because the migrator runs all pending migrations in one transaction
    // ("unsafe use of new enum value"). See V-IMG-007.
    status: imagingFindingStatusEnum('status').notNull(),
    toothNumber: integer('tooth_number'),
    surfaces: jsonb('surfaces').$type<string[]>(),
    note: text('note'),
    // P2-7 CBCT: the slice/frame index a finding was placed on (multi-frame volume),
    // so a CBCT finding is reproducible. Nullable — flat 2-D findings leave it null.
    frameIndex: integer('frame_index'),
  },
  (table) => ({
    imageStatusIdx: index('imaging_finding_image_status_idx').on(table.imageId, table.status),
    patientIdx: index('imaging_finding_patient_idx').on(table.patientId),
    branchIdx: index('imaging_finding_branch_idx').on(table.branchId),
  }),
);

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type ImagingFinding = typeof imagingFindings.$inferSelect;
export type NewImagingFinding = typeof imagingFindings.$inferInsert;
