/**
 * Drizzle schema for dental visits
 *
 * Visit lifecycle: draft → active → completed → locked
 */

import { pgTable, uuid, text, integer, timestamp, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const dentalVisitStatusEnum = pgEnum('dental_visit_status', [
  'draft',
  'active',
  'completed',
  'locked',
]);

export const dentalVisits = pgTable('dental_visit', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  dentistMemberId: uuid('dentist_member_id').notNull(),
  status: dentalVisitStatusEnum('status').notNull().default('draft'),
  activatedAt: timestamp('activated_at'),
  completedAt: timestamp('completed_at'),
  lockedAt: timestamp('locked_at'),
  chiefComplaint: text('chief_complaint'),
}, (table) => ({
  patientIdx: index('dental_visit_patient_id_idx').on(table.patientId),
  branchIdx: index('dental_visit_branch_id_idx').on(table.branchId),
  // EC7: Only one active visit per patient
  activePatientUnique: uniqueIndex('dental_visit_active_patient_unique')
    .on(table.patientId, table.status)
    .where(sql`status = 'active'`),
}));

import { sql } from 'drizzle-orm';

export type DentalVisit = typeof dentalVisits.$inferSelect;
export type NewDentalVisit = typeof dentalVisits.$inferInsert;

export const VALID_VISIT_STATUSES = ['draft', 'active', 'completed', 'locked'] as const;
export type DentalVisitStatus = typeof VALID_VISIT_STATUSES[number];
