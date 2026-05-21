/**
 * Drizzle schema for dental memberships (staff in a branch)
 */

import { pgTable, text, boolean, integer, timestamp, pgEnum, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields } from '@/core/database.schema';
import { dentalBranches } from './branch.schema';

export const memberRoleEnum = pgEnum('member_role', [
  'dentist_owner',
  'dentist_associate',
  'staff_full',
  'staff_scheduling',
]);

export const memberStatusEnum = pgEnum('member_status', ['active', 'inactive']);

export const dentalMemberships = pgTable('dental_membership', {
  ...baseEntityFields,
  branchId: uuid('branch_id')
    .notNull()
    .references(() => dentalBranches.id, { onDelete: 'cascade' }),
  // loose-coupling: references person.id (cross-module — no DB-level FK; nullable: PIN-only staff don't have cloud accounts)
  personId: uuid('person_id'),
  displayName: text('display_name').notNull(),
  role: memberRoleEnum('role').notNull(),
  pinHash: text('pin_hash'),
  pinLockedUntil: timestamp('pin_locked_until'),
  pinFailedAttempts: integer('pin_failed_attempts').notNull().default(0),
  status: memberStatusEnum('status').notNull().default('active'),
  avatarUrl: text('avatar_url'),
  // FR6.4: Activity visibility — track when member last logged in via PIN
  lastLoginAt: timestamp('last_login_at'),
  // FR9.7: PIN recovery — security question
  securityQuestion: text('security_question'),
  securityAnswerHash: text('security_answer_hash'),
}, (table) => ({
  // A person can only have one membership per branch (only enforced when personId is set)
  personBranchUnique: uniqueIndex('dental_membership_person_branch_unique')
    .on(table.personId, table.branchId)
    .where(sql`${table.personId} IS NOT NULL`),
}));

export type DentalMembership = typeof dentalMemberships.$inferSelect;
export type NewDentalMembership = typeof dentalMemberships.$inferInsert;

export const VALID_MEMBER_ROLES = [
  'dentist_owner',
  'dentist_associate',
  'staff_full',
  'staff_scheduling',
] as const;
export type MemberRole = typeof VALID_MEMBER_ROLES[number];

export const VALID_MEMBER_STATUSES = ['active', 'inactive'] as const;
export type MemberStatus = typeof VALID_MEMBER_STATUSES[number];
