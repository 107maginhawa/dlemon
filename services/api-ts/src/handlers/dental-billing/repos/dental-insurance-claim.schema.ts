/**
 * P1-26 — Invoice-anchored, multi-line HMO claim (the submittable unit).
 *
 * Supersedes the legacy single-procedure `dental_claim_draft` (kept read-only in
 * the patient module). PH-shaped: submission = "mark submitted + attach
 * reference" (portal/email/fax/in_person), NOT EDI 837. Coverage is
 * approval-driven (approved-amount vs billed delta → write-off), never a PPO
 * fee schedule.
 */

import { pgTable, uuid, text, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { baseEntityFields, syncableEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';
import { dentalInvoices } from './dental-invoice.schema';

export const INSURANCE_CLAIM_STATUSES = [
  'draft',
  'ready',
  'submitted',
  'under_review',
  'approved',
  'partially_paid',
  'paid',
  'denied',
  'appealed',
  'written_off',
] as const;
export type InsuranceClaimStatus = typeof INSURANCE_CLAIM_STATUSES[number];

/**
 * Claim FSM (PH HMO workflow) — extends the legacy draft→ready→submitted→
 * accepted|rejected map. `accepted`→`approved`, `rejected`→`denied`.
 *
 *   draft → ready → submitted → under_review → approved → partially_paid → paid
 *                               ↘ denied (→ appealed → submitted | → written_off)
 *                   approved → denied (post-review disallowance)
 */
export const INSURANCE_CLAIM_FSM: Record<InsuranceClaimStatus, InsuranceClaimStatus[]> = {
  draft: ['ready'],
  ready: ['submitted'],
  submitted: ['under_review', 'approved', 'denied'],
  under_review: ['approved', 'denied'],
  approved: ['partially_paid', 'paid', 'denied'],
  partially_paid: ['paid', 'denied'],
  paid: [],
  denied: ['appealed', 'written_off'],
  appealed: ['submitted', 'written_off'],
  written_off: [],
};

export const SUBMISSION_CHANNELS = ['portal', 'email', 'fax', 'in_person', 'other'] as const;
export type SubmissionChannel = typeof SUBMISSION_CHANNELS[number];

export const CLAIM_LINE_STATUSES = ['pending', 'covered', 'partial', 'disallowed'] as const;
export type ClaimLineStatus = typeof CLAIM_LINE_STATUSES[number];

export const dentalInsuranceClaimStatusEnum = pgEnum('dental_insurance_claim_status', INSURANCE_CLAIM_STATUSES);
export const dentalSubmissionChannelEnum = pgEnum('dental_submission_channel', SUBMISSION_CHANNELS);
export const dentalClaimLineStatusEnum = pgEnum('dental_claim_line_status', CLAIM_LINE_STATUSES);

export const dentalInsuranceClaims = pgTable('dental_insurance_claim', {
  ...baseEntityFields,
  ...syncableEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  insuranceProfileId: uuid('insurance_profile_id').notNull(),
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
  invoiceId: uuid('invoice_id').references(() => dentalInvoices.id),
  visitId: uuid('visit_id'),
  authorizationId: uuid('authorization_id'),
  claimNumber: text('claim_number').notNull(),
  payerReference: text('payer_reference'),
  status: dentalInsuranceClaimStatusEnum('status').notNull().default('draft'),
  submissionChannel: dentalSubmissionChannelEnum('submission_channel'),
  billedAmountCents: integer('billed_amount_cents').notNull().default(0),
  approvedAmountCents: integer('approved_amount_cents'),
  paidByPayerCents: integer('paid_by_payer_cents').notNull().default(0),
  disallowedCents: integer('disallowed_cents'),
  patientPortionCents: integer('patient_portion_cents').notNull().default(0),
  denialReason: text('denial_reason'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  decisionAt: timestamp('decision_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
}, (table) => ({
  claimNumberUniq: index('dental_insurance_claim_number_idx').on(table.claimNumber),
  patientIdx: index('dental_insurance_claim_patient_idx').on(table.patientId),
  branchIdx: index('dental_insurance_claim_branch_idx').on(table.branchId),
  statusIdx: index('dental_insurance_claim_status_idx').on(table.status),
  invoiceIdx: index('dental_insurance_claim_invoice_idx').on(table.invoiceId),
  profileIdx: index('dental_insurance_claim_profile_idx').on(table.insuranceProfileId),
}));

export const dentalInsuranceClaimLines = pgTable('dental_insurance_claim_line', {
  ...baseEntityFields,
  claimId: uuid('claim_id').notNull().references(() => dentalInsuranceClaims.id, { onDelete: 'cascade' }),
  treatmentId: uuid('treatment_id'),
  invoiceLineItemId: uuid('invoice_line_item_id'),
  cdtCode: text('cdt_code').notNull(),
  description: text('description').notNull(),
  billedAmountCents: integer('billed_amount_cents').notNull().default(0),
  approvedAmountCents: integer('approved_amount_cents'),
  paidAmountCents: integer('paid_amount_cents').notNull().default(0),
  status: dentalClaimLineStatusEnum('status').notNull().default('pending'),
}, (table) => ({
  claimIdx: index('dental_insurance_claim_line_claim_idx').on(table.claimId),
}));

export type DentalInsuranceClaim = typeof dentalInsuranceClaims.$inferSelect;
export type NewDentalInsuranceClaim = typeof dentalInsuranceClaims.$inferInsert;
export type DentalInsuranceClaimLine = typeof dentalInsuranceClaimLines.$inferSelect;
export type NewDentalInsuranceClaimLine = typeof dentalInsuranceClaimLines.$inferInsert;
