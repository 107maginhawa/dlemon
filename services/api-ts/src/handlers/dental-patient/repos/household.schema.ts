/**
 * household.schema.ts — P1-27 household / guarantor (family file)
 *
 * A household groups patients in one family for shared billing, mirroring the
 * "Family File" of incumbent PMS (Dentrix). One member is the guarantor — the
 * party financially responsible for the household's balances.
 *
 *   dental_household        — the family unit (name, branch, guarantor ref)
 *   dental_household_member — patient ↔ household membership + relationship
 *
 * Guarantor is referenced by patient id (loose ref; the row also lives in
 * dental_household_member with isGuarantor=true). Exactly one guarantor per
 * household is enforced in the handler layer, not by a DB constraint, to keep
 * member swaps a single transaction.
 */

import { pgTable, uuid, text, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';

export const dentalHouseholds = pgTable('dental_household', {
  ...baseEntityFields,
  /**
   * Branch the household is scoped to (loose cross-module ref to dental_branch.id —
   * no DB FK, mirroring patient.preferredBranchId).
   */
  branchId: uuid('branch_id').notNull(),
  /** Family / household display name, e.g. "Santos Family". */
  name: text('name').notNull(),
  /**
   * The guarantor — the patient financially responsible for the household.
   * Loose ref to patient.id (no FK so a guarantor can be reassigned without
   * cascade surprises); the same patient also has a member row with isGuarantor.
   */
  guarantorPatientId: uuid('guarantor_patient_id').notNull(),
  notes: text('notes'),
}, (table) => ({
  branchIdx: index('dental_household_branch_idx').on(table.branchId),
  guarantorIdx: index('dental_household_guarantor_idx').on(table.guarantorPatientId),
}));

export const dentalHouseholdMembers = pgTable('dental_household_member', {
  ...baseEntityFields,
  householdId: uuid('household_id')
    .notNull()
    .references(() => dentalHouseholds.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  /** Relationship to the guarantor, e.g. "self", "spouse", "child", "dependent". */
  relationship: text('relationship').notNull().default('dependent'),
  /** True for the guarantor member (exactly one per household, enforced in handlers). */
  isGuarantor: boolean('is_guarantor').notNull().default(false),
}, (table) => ({
  householdIdx: index('dental_household_member_household_idx').on(table.householdId),
  patientIdx: index('dental_household_member_patient_idx').on(table.patientId),
  // A patient belongs to at most one household.
  uniquePatient: uniqueIndex('dental_household_member_patient_uniq').on(table.patientId),
}));

export type DentalHousehold = typeof dentalHouseholds.$inferSelect;
export type NewDentalHousehold = typeof dentalHouseholds.$inferInsert;
export type DentalHouseholdMember = typeof dentalHouseholdMembers.$inferSelect;
export type NewDentalHouseholdMember = typeof dentalHouseholdMembers.$inferInsert;
