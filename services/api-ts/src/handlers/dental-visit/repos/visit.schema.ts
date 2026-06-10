/**
 * Drizzle schema for dental visits
 *
 * Visit lifecycle: draft → active → completed → locked
 *                        active → discarded (empty visit auto-discard, BR-005)
 */

import { pgTable, uuid, text, integer, timestamp, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields, syncableEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';
import { dentalMemberships } from '../../dental-org/repos/membership.schema';

export const dentalVisitStatusEnum = pgEnum('dental_visit_status', [
  'draft',
  'active',
  'completed',
  'locked',
  'discarded',
]);

// E3: visit type scopes which roles may create/own/sign a visit.
//   'general'  → dentist-led (owner/associate only), the default for all existing rows
//   'hygiene'  → hygienist-led recall/prophy/perio; hygienist may create, check-in, draft AND sign
export const dentalVisitTypeEnum = pgEnum('dental_visit_type', [
  'general',
  'hygiene',
]);

export const dentalVisits = pgTable('dental_visit', {
  ...baseEntityFields,
  ...syncableEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
  dentistMemberId: uuid('dentist_member_id').notNull().references(() => dentalMemberships.id),
  status: dentalVisitStatusEnum('status').notNull().default('draft'),
  // E3: hygiene-typed visits unlock hygienist authority (create/check-in/sign).
  // Existing rows backfill to 'general' (dentist-led, unchanged gates).
  visitType: dentalVisitTypeEnum('visit_type').notNull().default('general'),
  activatedAt: timestamp('activated_at'),
  completedAt: timestamp('completed_at'),
  lockedAt: timestamp('locked_at'),
  chiefComplaint: text('chief_complaint'),
  appointmentId: uuid('appointment_id'),
}, (table) => ({
  patientIdx: index('dental_visit_patient_id_idx').on(table.patientId),
  branchIdx: index('dental_visit_branch_id_idx').on(table.branchId),
  // EC7: Only one active visit per patient
  activePatientUnique: uniqueIndex('dental_visit_active_patient_unique')
    .on(table.patientId, table.status)
    .where(sql`status = 'active'`),
  // SL-01 / F-G02: offline-replay idempotency backstop — a (branch, localId) pair
  // may exist at most once. The handler pre-check returns the existing row on
  // replay; this index guards against a concurrent-retry race.
  branchLocalIdUnique: uniqueIndex('dental_visit_branch_local_id_unique')
    .on(table.branchId, table.localId)
    .where(sql`local_id is not null`),
}));

export type DentalVisit = typeof dentalVisits.$inferSelect;
export type NewDentalVisit = typeof dentalVisits.$inferInsert;

export const VALID_VISIT_STATUSES = ['draft', 'active', 'completed', 'locked', 'discarded'] as const;
export type DentalVisitStatus = typeof VALID_VISIT_STATUSES[number];

export const VALID_VISIT_TYPES = ['general', 'hygiene'] as const;
export type DentalVisitType = typeof VALID_VISIT_TYPES[number];

export const VISIT_TRANSITIONS: Record<DentalVisitStatus, DentalVisitStatus[]> = {
  draft: ['active'],
  // 'discarded' is a server-only auto-discard (BR-005); clients request 'completed'
  // and the server redirects to 'discarded' when the visit is empty.
  active: ['completed', 'discarded'],
  completed: ['locked'],
  locked: [],
  discarded: [],
};
