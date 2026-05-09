/**
 * Drizzle schema for consent form templates (FR8.4b)
 *
 * Clinics define reusable consent form templates with title, body, and signature fields.
 * These are printed and signed before procedures.
 */

import { pgTable, uuid, text, boolean, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const dentalConsentTemplates = pgTable('dental_consent_template', {
  ...baseEntityFields,
  branchId: uuid('branch_id').notNull(),
  name: text('name').notNull(),
  body: text('body').notNull(),
  requiresWitnessSignature: boolean('requires_witness_signature').notNull().default(false),
  active: boolean('active').notNull().default(true),
}, (table) => ({
  branchIdx: index('dental_consent_template_branch_id_idx').on(table.branchId),
}));

export type DentalConsentTemplate = typeof dentalConsentTemplates.$inferSelect;
export type NewDentalConsentTemplate = typeof dentalConsentTemplates.$inferInsert;
