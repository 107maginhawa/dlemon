/**
 * Drizzle schema for medical-history review attestations (P1-4)
 *
 * Captures the ASA Physical Status classification and the date the patient's
 * medical history was last reviewed / re-confirmed. The latest review per patient
 * is the current one; earlier reviews are retained as an append-only history so
 * the "due for review" (>~6 months) prompt can be derived from reviewedAt.
 */

import { pgTable, uuid, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';

// ASA Physical Status I–VI (the "E" emergency modifier is a separate boolean)
export const asaClassificationEnum = pgEnum('asa_classification', [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
]);

export const medicalHistoryReviews = pgTable('medical_history_review', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  asaClassification: asaClassificationEnum('asa_classification'),
  asaEmergency: boolean('asa_emergency').notNull().default(false),
  reviewedAt: timestamp('reviewed_at').notNull().defaultNow(),
});

export type MedicalHistoryReview = typeof medicalHistoryReviews.$inferSelect;
export type NewMedicalHistoryReview = typeof medicalHistoryReviews.$inferInsert;

export const VALID_ASA_CLASSIFICATIONS = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const;
export type AsaClassification = typeof VALID_ASA_CLASSIFICATIONS[number];
