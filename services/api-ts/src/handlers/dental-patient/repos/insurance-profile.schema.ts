import { pgTable, uuid, text, boolean, date, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';

export const dentalInsuranceProfiles = pgTable('dental_insurance_profile', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  insurerName: text('insurer_name').notNull(),
  policyNumber: text('policy_number').notNull(),
  groupNumber: text('group_number'),
  subscriberName: text('subscriber_name').notNull(),
  subscriberDob: date('subscriber_dob'),
  relationship: text('relationship').notNull().default('self'),
  active: boolean('active').notNull().default(true),
  notes: text('notes'),
}, (table) => ({
  patientIdx: index('dental_insurance_profile_patient_idx').on(table.patientId),
  activeIdx: index('dental_insurance_profile_active_idx').on(table.active),
}));

export type DentalInsuranceProfile = typeof dentalInsuranceProfiles.$inferSelect;
export type NewDentalInsuranceProfile = typeof dentalInsuranceProfiles.$inferInsert;
