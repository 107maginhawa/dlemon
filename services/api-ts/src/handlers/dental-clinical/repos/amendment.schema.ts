/**
 * Drizzle schema for amendments (additive-only, links to original record)
 */

import { pgTable, uuid, text } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const amendments = pgTable('amendment', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  authorMemberId: uuid('author_member_id').notNull(),
  originalRecordType: text('original_record_type').notNull(),
  originalRecordId: uuid('original_record_id').notNull(),
  reason: text('reason').notNull(),
  content: text('content').notNull(),
});

export type Amendment = typeof amendments.$inferSelect;
export type NewAmendment = typeof amendments.$inferInsert;
