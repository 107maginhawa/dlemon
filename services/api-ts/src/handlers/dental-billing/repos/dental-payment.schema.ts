/**
 * Drizzle schema for dental payments
 *
 * Payments track individual cash/card/bank payments against invoices.
 * Void is a soft-delete pattern: isVoid=true with reason and timestamp.
 */

import { pgTable, uuid, text, timestamp, integer, boolean, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalInvoices } from './dental-invoice.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';
import { dentalMemberships } from '../../dental-org/repos/membership.schema';

export const paymentMethodEnum = pgEnum('dental_payment_method', [
  'cash', 'card', 'bank_transfer',
]);

export const dentalPayments = pgTable('dental_payment', {
  ...baseEntityFields,
  invoiceId: uuid('invoice_id').notNull().references(() => dentalInvoices.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
  amountCents: integer('amount_cents').notNull(),
  method: paymentMethodEnum('method').notNull(),
  receiptNumber: text('receipt_number').notNull(),
  recordedByMemberId: uuid('recorded_by_member_id').notNull().references(() => dentalMemberships.id),
  notes: text('notes'),
  isVoid: boolean('is_void').notNull().default(false),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidReason: text('void_reason'),
  voidedByMemberId: uuid('voided_by_member_id').references(() => dentalMemberships.id),
}, (table) => ({
  invoiceIdx: index('dental_payment_invoice_id_idx').on(table.invoiceId),
  patientIdx: index('dental_payment_patient_id_idx').on(table.patientId),
  receiptUnique: uniqueIndex('dental_payment_receipt_number_unique').on(table.receiptNumber),
}));

export type DentalPayment = typeof dentalPayments.$inferSelect;
export type NewDentalPayment = typeof dentalPayments.$inferInsert;
