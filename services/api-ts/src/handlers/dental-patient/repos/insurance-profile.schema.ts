import { pgTable, uuid, text, boolean, date, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';

/**
 * P1-26: PH payer landscape. `hmo` is the dominant model (Maxicare/Intellicare/…);
 * `philhealth` is modelled minimally (recordable, no eClaims); the rest cover
 * corporate accounts, self-pay assistance, and a catch-all.
 */
export const PAYER_TYPES = ['hmo', 'philhealth', 'corporate', 'self_pay_assist', 'other'] as const;
export type PayerType = typeof PAYER_TYPES[number];

export const dentalPayerTypeEnum = pgEnum('dental_payer_type', PAYER_TYPES);

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
  // P1-26 PH payer extension (additive, nullable / defaulted).
  payerType: dentalPayerTypeEnum('payer_type').notNull().default('hmo'),
  accredited: boolean('accredited'),
  annualLimitCents: integer('annual_limit_cents'),
  annualLimitUsedCents: integer('annual_limit_used_cents'),
}, (table) => ({
  patientIdx: index('dental_insurance_profile_patient_idx').on(table.patientId),
  activeIdx: index('dental_insurance_profile_active_idx').on(table.active),
}));

export type DentalInsuranceProfile = typeof dentalInsuranceProfiles.$inferSelect;
export type NewDentalInsuranceProfile = typeof dentalInsuranceProfiles.$inferInsert;
