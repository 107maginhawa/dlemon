/**
 * Drizzle schema for dental payments
 *
 * Payments track individual cash/card/bank payments against invoices.
 * Void is a soft-delete pattern: isVoid=true with reason and timestamp.
 */

import { pgTable, uuid, text, timestamp, integer, boolean, pgEnum, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const paymentMethodEnum = pgEnum('dental_payment_method', [
  'cash', 'card', 'bankTransfer',
]);

export const dentalPayments = pgTable('dental_payment', {
  ...baseEntityFields,
  invoiceId: uuid('invoice_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  amountCents: integer('amount_cents').notNull(),
  method: paymentMethodEnum('method').notNull(),
  receiptNumber: text('receipt_number').notNull(),
  recordedByMemberId: uuid('recorded_by_member_id').notNull(),
  notes: text('notes'),
  isVoid: boolean('is_void').notNull().default(false),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidReason: text('void_reason'),
  voidedByMemberId: uuid('voided_by_member_id'),
}, (table) => ({
  invoiceIdx: index('dental_payment_invoice_id_idx').on(table.invoiceId),
  patientIdx: index('dental_payment_patient_id_idx').on(table.patientId),
}));

export type DentalPayment = typeof dentalPayments.$inferSelect;
export type NewDentalPayment = typeof dentalPayments.$inferInsert;
