/**
 * Drizzle schema for informed refusal records (P1-3)
 *
 * Distinct from consent forms — records a patient's explicit, attributed refusal
 * of recommended treatment. Immutable once created (no update/delete routes).
 *
 * Required by ADA guidelines and medico-legal best practice.
 */

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalMemberships } from '../../dental-org/repos/membership.schema';

export const consentRefusals = pgTable('consent_refusal', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull().references(() => dentalVisits.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  /** Member (dentist) who presented the treatment and recorded the refusal */
  refusingMemberId: uuid('refusing_member_id').notNull().references(() => dentalMemberships.id),
  procedureDescription: text('procedure_description').notNull(),
  refusalReason: text('refusal_reason').notNull(),
  /** Verbatim patient acknowledgement that they understand risks of non-treatment */
  patientAcknowledgement: text('patient_acknowledgement').notNull(),
  refusedAt: timestamp('refused_at').notNull().defaultNow(),
});

export type ConsentRefusal = typeof consentRefusals.$inferSelect;
export type NewConsentRefusal = typeof consentRefusals.$inferInsert;
