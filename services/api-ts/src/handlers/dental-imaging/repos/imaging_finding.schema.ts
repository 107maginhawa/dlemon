/**
 * Drizzle schema for imaging findings
 *
 * Separate from imaging.schema.ts per schema-per-entity pattern.
 * Represents structured radiographic findings linked to an imaging study image.
 */

import { pgEnum, pgTable, uuid, text, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { imagingStudyImages, imagingAnnotations } from './imaging.schema';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';

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

export const imagingFindingStatusEnum = pgEnum('imaging_finding_status', [
  'suspected',
  'confirmed',
  'monitoring',
  'resolved',
]);

export type ImagingFindingStatus = (typeof imagingFindingStatusEnum.enumValues)[number];

export const FINDING_TRANSITIONS: Record<ImagingFindingStatus, ImagingFindingStatus[]> = {
  suspected: ['confirmed', 'monitoring', 'resolved'],
  confirmed: ['monitoring', 'resolved'],
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
    treatmentId: uuid('treatment_id'),                                    // cross-module FK — no .references()
    visitId: uuid('visit_id').references(() => dentalVisits.id),         // denormalized; nullable
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
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
