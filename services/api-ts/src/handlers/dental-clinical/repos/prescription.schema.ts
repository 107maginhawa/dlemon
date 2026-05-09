/**
 * Drizzle schema for prescriptions (RxNorm coded)
 */

import { pgTable, uuid, text, boolean } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const prescriptions = pgTable('prescription', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  prescriberMemberId: uuid('prescriber_member_id').notNull(),
  rxNormCode: text('rx_norm_code'),
  drugName: text('drug_name').notNull(),
  dosage: text('dosage').notNull(),
  frequency: text('frequency').notNull(),
  duration: text('duration'),
  quantity: text('quantity'),
  instructions: text('instructions'),
  dispenseAsWritten: boolean('dispense_as_written').notNull().default(false),
});

export type Prescription = typeof prescriptions.$inferSelect;
export type NewPrescription = typeof prescriptions.$inferInsert;
