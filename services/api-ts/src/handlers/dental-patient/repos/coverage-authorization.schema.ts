/**
 * P1-26 — Coverage Authorization (LOA) schema
 *
 * The PH analogue of US eligibility + preauth: a Letter of Authorization /
 * approval code captured BEFORE treatment. Approval-driven (approved amount /
 * covered-procedure list), never fee-schedule-driven. No external payer API.
 */

import { pgTable, uuid, text, integer, date, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { baseEntityFields, syncableEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';
import { dentalInsuranceProfiles } from './insurance-profile.schema';

export const COVERAGE_AUTH_STATUSES = ['requested', 'approved', 'partial', 'denied', 'expired'] as const;
export type CoverageAuthStatus = typeof COVERAGE_AUTH_STATUSES[number];

/**
 * Authorization FSM (PH HMO):
 *   requested → approved | denied
 *   approved  → partial  | expired
 *   partial   → expired
 *   denied, expired : terminal
 */
export const COVERAGE_AUTH_FSM: Record<CoverageAuthStatus, CoverageAuthStatus[]> = {
  requested: ['approved', 'denied'],
  approved: ['partial', 'expired'],
  partial: ['expired'],
  denied: [],
  expired: [],
};

export const dentalCoverageAuthStatusEnum = pgEnum('dental_coverage_auth_status', COVERAGE_AUTH_STATUSES);

/** One covered-procedure entry on an itemized authorization. */
export interface CoveredProcedure {
  cdtCode: string;
  approvedAmountCents?: number;
  note?: string;
}

export const dentalCoverageAuthorizations = pgTable('dental_coverage_authorization', {
  ...baseEntityFields,
  ...syncableEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  insuranceProfileId: uuid('insurance_profile_id').notNull().references(() => dentalInsuranceProfiles.id),
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
  visitId: uuid('visit_id'),
  treatmentPlanId: uuid('treatment_plan_id'),
  loaNumber: text('loa_number'),
  status: dentalCoverageAuthStatusEnum('status').notNull().default('requested'),
  approvedAt: date('approved_at'),
  validUntil: date('valid_until'),
  approvedAmountCents: integer('approved_amount_cents'),
  coveredProcedures: jsonb('covered_procedures').$type<CoveredProcedure[]>(),
  attachmentFileId: uuid('attachment_file_id'),
  notes: text('notes'),
}, (table) => ({
  patientIdx: index('dental_coverage_auth_patient_idx').on(table.patientId),
  profileIdx: index('dental_coverage_auth_profile_idx').on(table.insuranceProfileId),
  branchIdx: index('dental_coverage_auth_branch_idx').on(table.branchId),
  statusIdx: index('dental_coverage_auth_status_idx').on(table.status),
}));

export type DentalCoverageAuthorization = typeof dentalCoverageAuthorizations.$inferSelect;
export type NewDentalCoverageAuthorization = typeof dentalCoverageAuthorizations.$inferInsert;
