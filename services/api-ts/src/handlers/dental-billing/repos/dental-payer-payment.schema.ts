/**
 * P1-26 — Payer Payment (Remittance Posting), the PH "EOB posting" analogue.
 *
 * When the HMO remits (30–90+ days later, often with disallowances) the posting
 * increments the invoice's paidCents via the existing money pipeline and creates
 * a write-off adjustment for the disallowed delta.
 */

import { pgTable, uuid, text, integer, date, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';
import { dentalInvoices } from './dental-invoice.schema';
import { dentalInsuranceClaims } from './dental-insurance-claim.schema';

export const PAYER_PAYMENT_METHODS = ['bank_transfer', 'check', 'portal'] as const;
export type PayerPaymentMethod = typeof PAYER_PAYMENT_METHODS[number];

export const dentalPayerPaymentMethodEnum = pgEnum('dental_payer_payment_method', PAYER_PAYMENT_METHODS);

export const dentalPayerPayments = pgTable('dental_payer_payment', {
  ...baseEntityFields,
  claimId: uuid('claim_id').notNull().references(() => dentalInsuranceClaims.id, { onDelete: 'cascade' }),
  insuranceProfileId: uuid('insurance_profile_id').notNull(),
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
  invoiceId: uuid('invoice_id').references(() => dentalInvoices.id),
  amountCents: integer('amount_cents').notNull(),
  remittanceReference: text('remittance_reference'),
  remittedAt: date('remitted_at'),
  method: dentalPayerPaymentMethodEnum('method').notNull().default('bank_transfer'),
  disallowanceCents: integer('disallowance_cents'),
  disallowanceReason: text('disallowance_reason'),
}, (table) => ({
  claimIdx: index('dental_payer_payment_claim_idx').on(table.claimId),
  branchIdx: index('dental_payer_payment_branch_idx').on(table.branchId),
  // Idempotency: a remittance reference is unique per claim (NULLs allowed).
  refUniq: uniqueIndex('dental_payer_payment_claim_ref_uniq').on(table.claimId, table.remittanceReference),
}));

export type DentalPayerPayment = typeof dentalPayerPayments.$inferSelect;
export type NewDentalPayerPayment = typeof dentalPayerPayments.$inferInsert;
