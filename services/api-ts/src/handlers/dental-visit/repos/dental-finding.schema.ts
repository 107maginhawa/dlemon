/**
 * Drizzle schema for dental findings (P0-C).
 *
 * A finding is a structured clinical observation from a curated vocabulary,
 * recorded on a tooth (and optionally a surface). Distinct from the odontogram's
 * per-tooth `state` (the visual layer) and from a treatment (the planned action):
 * a tooth can carry multiple findings, each tooth- or surface-level, each
 * active/resolved, and each convertible into a treatment.
 */
import { pgTable, uuid, text, integer, index, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields, syncableEntityFields } from '@/core/database.schema';
import { dentalVisits } from './visit.schema';
import { patients } from '../../patient/repos/patient.schema';

/** Curated v1 findings vocabulary. `other` requires a note. */
export const conditionCodeEnum = pgEnum('dental_condition_code', [
  'caries',
  'abscess',
  'calculus',
  'gingival_recession',
  'impacted_unerupted',
  'retained_root',
  'sensitive_dentin',
  'fracture_crack',
  'wear_erosion',
  'developmental_anomaly',
  'other',
]);

export type ConditionCode = typeof conditionCodeEnum.enumValues[number];

export const findingStatusEnum = pgEnum('dental_finding_status', ['active', 'resolved']);
export type FindingStatus = typeof findingStatusEnum.enumValues[number];

export const dentalFindings = pgTable('dental_finding', {
  ...baseEntityFields,
  ...syncableEntityFields,
  visitId: uuid('visit_id').notNull().references(() => dentalVisits.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  toothNumber: integer('tooth_number').notNull(),
  surface: text('surface'),
  conditionCode: conditionCodeEnum('condition_code').notNull(),
  note: text('note'),
  status: findingStatusEnum('status').notNull().default('active'),
  linkedTreatmentId: uuid('linked_treatment_id'),
}, (table) => ({
  visitIdx: index('dental_finding_visit_id_idx').on(table.visitId),
  patientIdx: index('dental_finding_patient_id_idx').on(table.patientId),
  // GAP-001: offline-replay idempotency backstop — a (visit, localId) pair may
  // exist at most once.
  visitLocalIdUnique: uniqueIndex('dental_finding_visit_local_id_unique')
    .on(table.visitId, table.localId)
    .where(sql`local_id is not null`),
}));

export type DentalFinding = typeof dentalFindings.$inferSelect;
export type NewDentalFinding = typeof dentalFindings.$inferInsert;
