/**
 * Drizzle schema for dental treatments and visit notes
 *
 * Treatment lifecycle: diagnosed → planned → performed → verified → dismissed
 */

import { pgTable, uuid, text, integer, boolean, jsonb, index, unique, pgEnum, timestamp } from 'drizzle-orm/pg-core';
import { baseEntityFields, syncableEntityFields, versionedSnapshotFields } from '@/core/database.schema';
import { dentalVisits } from './visit.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalMemberships } from '../../dental-org/repos/membership.schema';

export const dentalTreatmentStatusEnum = pgEnum('dental_treatment_status', [
  'diagnosed',
  'planned',
  'performed',
  'verified',
  'dismissed',
  'declined',
]);

export const dentalTreatments = pgTable('dental_treatment', {
  ...baseEntityFields,
  ...syncableEntityFields,
  visitId: uuid('visit_id').notNull().references(() => dentalVisits.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  toothNumber: integer('tooth_number'),
  surfaces: jsonb('surfaces').$type<string[]>(),
  cdtCode: text('cdt_code').notNull(),
  description: text('description').notNull(),
  conditionCode: text('condition_code'),
  status: dentalTreatmentStatusEnum('status').notNull().default('diagnosed'),
  dismissReason: text('dismiss_reason'),
  refusalReason: text('refusal_reason'),
  /** Price in cents, locked at recording time (EC4) */
  priceCents: integer('price_cents').notNull(),
  carriedOver: boolean('carried_over').notNull().default(false),
  sourceVisitId: uuid('source_visit_id').references(() => dentalVisits.id),
  autoDismissed: boolean('auto_dismissed').default(false),
  clinicalNotes: text('clinical_notes'),
  performedAt: timestamp('performed_at'),
  billedInvoiceId: uuid('billed_invoice_id'),
  /**
   * TR-P1-08: the treatment-plan this treatment belongs to (its "item" membership).
   * Loose cross-module ref (dental_treatment_plan lives in dental-patient) — no DB FK,
   * mirroring billedInvoiceId, to keep dental-visit decoupled from dental-patient.
   * NULL = not part of any plan's completion math (TP-BR-005).
   */
  treatmentPlanId: uuid('treatment_plan_id'),
}, (table) => ({
  visitIdx: index('dental_treatment_visit_id_idx').on(table.visitId),
  patientIdx: index('dental_treatment_patient_id_idx').on(table.patientId),
  treatmentPlanIdx: index('dental_treatment_treatment_plan_id_idx').on(table.treatmentPlanId),
}));

export const visitNotes = pgTable('visit_notes', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull().references(() => dentalVisits.id, { onDelete: 'cascade' }),
  authorMemberId: uuid('author_member_id').notNull().references(() => dentalMemberships.id),
  subjective: text('subjective'),
  objective: text('objective'),
  assessment: text('assessment'),
  plan: text('plan'),
  notes: text('notes'),
  // Signing/locking fields (mirrors consent-form precedent)
  signed: boolean('signed').notNull().default(false),
  signedAt: timestamp('signed_at'),
  // loose-coupling: references person.id (cross-module — cloud user who signed; no DB FK to decouple visit from core person)
  signedBy: uuid('signed_by'),
  lockedAt: timestamp('locked_at'),
}, (table) => ({
  visitIdx: index('visit_notes_visit_id_idx').on(table.visitId),
}));

/**
 * Immutable append-only version history for visit notes.
 * Each sign or addendum creates a new snapshot version.
 * Parent FK: noteId references visitNotes.id.
 */
export const visitNoteVersions = pgTable('visit_note_version', {
  ...versionedSnapshotFields(),
  noteId: uuid('note_id').notNull().references(() => visitNotes.id, { onDelete: 'cascade' }),
}, (table) => ({
  uniqueNoteVersion: unique('visit_note_version_note_version_uniq').on(table.noteId, table.version),
  noteIdx: index('visit_note_version_note_id_idx').on(table.noteId),
}));

export type DentalTreatment = typeof dentalTreatments.$inferSelect;
export type NewDentalTreatment = typeof dentalTreatments.$inferInsert;
export type VisitNotes = typeof visitNotes.$inferSelect;
export type NewVisitNotes = typeof visitNotes.$inferInsert;
export type VisitNoteVersion = typeof visitNoteVersions.$inferSelect;
export type NewVisitNoteVersion = typeof visitNoteVersions.$inferInsert;

export const VALID_TREATMENT_STATUSES = ['diagnosed', 'planned', 'performed', 'verified', 'dismissed', 'declined'] as const;
export type DentalTreatmentStatus = typeof VALID_TREATMENT_STATUSES[number];

/** Valid forward-only transitions. dismissed/declined are reachable from any non-terminal state. */
export const TREATMENT_TRANSITIONS: Record<DentalTreatmentStatus, DentalTreatmentStatus[]> = {
  diagnosed: ['planned', 'dismissed', 'declined'],
  planned: ['performed', 'dismissed', 'declined'],
  performed: ['verified', 'dismissed'],
  verified: ['dismissed'],
  dismissed: [], // terminal
  declined: [],  // terminal — patient declined recommended treatment
};
