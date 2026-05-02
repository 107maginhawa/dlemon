/**
 * Drizzle schema for consent forms (immutable after signing)
 */

import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const consentForms = pgTable('consent_form', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  templateId: text('template_id').notNull(),
  templateName: text('template_name').notNull(),
  signedAt: timestamp('signed_at'),
  signatureData: text('signature_data'),
  signed: boolean('signed').notNull().default(false),
});

export type ConsentForm = typeof consentForms.$inferSelect;
export type NewConsentForm = typeof consentForms.$inferInsert;
