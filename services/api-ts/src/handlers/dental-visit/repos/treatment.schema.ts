/**
 * Drizzle schema for dental treatments and visit notes
 *
 * Treatment lifecycle: diagnosed → planned → performed → verified → dismissed
 */

import { pgTable, uuid, text, integer, boolean, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const dentalTreatmentStatusEnum = pgEnum('dental_treatment_status', [
  'diagnosed',
  'planned',
  'performed',
  'verified',
  'dismissed',
]);

export const dentalTreatments = pgTable('dental_treatment', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  toothNumber: integer('tooth_number'),
  surfaces: jsonb('surfaces').$type<string[]>(),
  cdtCode: text('cdt_code').notNull(),
  description: text('description').notNull(),
  conditionCode: text('condition_code'),
  status: dentalTreatmentStatusEnum('status').notNull().default('diagnosed'),
  dismissReason: text('dismiss_reason'),
  /** Price in cents, locked at recording time (EC4) */
  priceCents: integer('price_cents').notNull(),
  carriedOver: boolean('carried_over').notNull().default(false),
  sourceVisitId: uuid('source_visit_id'),
  autoDismissed: boolean('auto_dismissed').default(false),
}, (table) => ({
  visitIdx: index('dental_treatment_visit_id_idx').on(table.visitId),
  patientIdx: index('dental_treatment_patient_id_idx').on(table.patientId),
}));

export const visitNotes = pgTable('visit_notes', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull(),
  authorMemberId: uuid('author_member_id').notNull(),
  subjective: text('subjective'),
  objective: text('objective'),
  assessment: text('assessment'),
  plan: text('plan'),
  notes: text('notes'),
}, (table) => ({
  visitIdx: index('visit_notes_visit_id_idx').on(table.visitId),
}));

export type DentalTreatment = typeof dentalTreatments.$inferSelect;
export type NewDentalTreatment = typeof dentalTreatments.$inferInsert;
export type VisitNotes = typeof visitNotes.$inferSelect;
export type NewVisitNotes = typeof visitNotes.$inferInsert;

export const VALID_TREATMENT_STATUSES = ['diagnosed', 'planned', 'performed', 'verified', 'dismissed'] as const;
export type DentalTreatmentStatus = typeof VALID_TREATMENT_STATUSES[number];
