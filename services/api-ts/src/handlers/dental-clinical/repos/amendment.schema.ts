/**
 * Drizzle schema for amendments (additive-only, links to original record)
 */

import { pgTable, uuid, text } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalMemberships } from '../../dental-org/repos/membership.schema';

export const amendments = pgTable('amendment', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull().references(() => dentalVisits.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  authorMemberId: uuid('author_member_id').notNull().references(() => dentalMemberships.id),
  originalRecordType: text('original_record_type').notNull(),
  // not a FK — polymorphic reference; originalRecordType determines which table this ID belongs to (no DB FK possible)
  originalRecordId: uuid('original_record_id').notNull(),
  reason: text('reason').notNull(),
  content: text('content').notNull(),
});

export type Amendment = typeof amendments.$inferSelect;
export type NewAmendment = typeof amendments.$inferInsert;
