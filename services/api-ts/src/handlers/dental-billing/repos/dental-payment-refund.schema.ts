/**
 * dental_payment_refund — payment refund record (BR-053, Phase 4.2).
 *
 * A refund returns a previously-paid amount (partial or full) on a non-void
 * payment, AFTER the same-day void window — distinct from voidDentalPayment.
 * It reverses the refunded amount from the invoice (DentalInvoiceRepository
 * .removePayment) and, when `bookedAsCredit`, books the amount to the patient's
 * credit ledger instead of a cash-out. Append-only, owner-only, audited.
 */

import { pgTable, uuid, integer, text, boolean, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalInvoices } from './dental-invoice.schema';
import { dentalPayments } from './dental-payment.schema';

export const dentalPaymentRefunds = pgTable('dental_payment_refund', {
  ...baseEntityFields,
  paymentId: uuid('payment_id').notNull().references(() => dentalPayments.id),
  invoiceId: uuid('invoice_id').notNull().references(() => dentalInvoices.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
  amountCents: integer('amount_cents').notNull(),
  reason: text('reason').notNull(),
  bookedAsCredit: boolean('booked_as_credit').notNull().default(false),
  refundedByMemberId: uuid('refunded_by_member_id'),
}, (table) => ({
  paymentIdx: index('dental_payment_refund_payment_idx').on(table.paymentId),
  invoiceIdx: index('dental_payment_refund_invoice_idx').on(table.invoiceId),
}));

export type DentalPaymentRefund = typeof dentalPaymentRefunds.$inferSelect;
export type NewDentalPaymentRefund = typeof dentalPaymentRefunds.$inferInsert;
