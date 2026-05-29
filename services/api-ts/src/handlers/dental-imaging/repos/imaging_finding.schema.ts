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

// Spec §8 SM-01 declares `draft → confirmed → resolved`. The code historically
// shipped `suspected/monitoring` as additional working states. Per EM-IMG-008 the
// spec value `draft` (initial state) is added so AC-IMG-002 (`confirmed → draft → 422`)
// is structurally testable. Legacy states retained for backward compatibility.
export const imagingFindingStatusEnum = pgEnum('imaging_finding_status', [
  'draft',
  'suspected',
  'confirmed',
  'monitoring',
  'resolved',
]);

export type ImagingFindingStatus = (typeof imagingFindingStatusEnum.enumValues)[number];

// SM-01: draft → confirmed → resolved (spec §8). `draft` is the initial state.
// There is no back-edge into `draft` — reverting `confirmed → draft` is rejected
// (422 INVALID_STATUS_TRANSITION), satisfying AC-IMG-002.
export const FINDING_TRANSITIONS: Record<ImagingFindingStatus, ImagingFindingStatus[]> = {
  draft: ['suspected', 'confirmed', 'monitoring', 'resolved'],
  suspected: ['confirmed', 'monitoring', 'resolved'],
  confirmed: ['monitoring', 'resolved'], // no back-edge to draft → AC-IMG-002 422
  monitoring: ['confirmed', 'resolved'],
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
    status: imagingFindingStatusEnum('status').notNull().default('suspected'),
    toothNumber: integer('tooth_number'),
    surfaces: jsonb('surfaces').$type<string[]>(),
    note: text('note'),
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
