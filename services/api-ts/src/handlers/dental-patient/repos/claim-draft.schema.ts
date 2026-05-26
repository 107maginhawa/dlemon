import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalInsuranceProfiles } from './insurance-profile.schema';

export const CLAIM_DRAFT_STATUSES = ['draft', 'ready', 'submitted', 'accepted', 'rejected'] as const;
export type ClaimDraftStatus = typeof CLAIM_DRAFT_STATUSES[number];

export const CLAIM_DRAFT_FSM: Record<ClaimDraftStatus, ClaimDraftStatus[]> = {
  draft: ['ready'],
  ready: ['submitted'],
  submitted: ['accepted', 'rejected'],
  accepted: [],
  rejected: ['draft'],
};

export const dentalClaimDrafts = pgTable('dental_claim_draft', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  insuranceProfileId: uuid('insurance_profile_id').notNull().references(() => dentalInsuranceProfiles.id),
  visitId: uuid('visit_id'),
  cdtCode: text('cdt_code').notNull(),
  icd10Code: text('icd_10_code'),
  diagnosisDescription: text('diagnosis_description'),
  feeAmountCents: integer('fee_amount_cents').notNull().default(0),
  status: text('status').notNull().default('draft').$type<ClaimDraftStatus>(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  notes: text('notes'),
}, (table) => ({
  patientIdx: index('dental_claim_draft_patient_idx').on(table.patientId),
  statusIdx: index('dental_claim_draft_status_idx').on(table.status),
  insuranceIdx: index('dental_claim_draft_insurance_idx').on(table.insuranceProfileId),
}));

export type DentalClaimDraft = typeof dentalClaimDrafts.$inferSelect;
export type NewDentalClaimDraft = typeof dentalClaimDrafts.$inferInsert;
