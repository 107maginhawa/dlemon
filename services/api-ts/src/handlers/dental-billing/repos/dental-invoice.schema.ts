/**
 * Drizzle schema for dental invoices and line items
 *
 * Invoice lifecycle: draft -> issued -> partial -> paid | overdue | voided
 * Line items are derived from dental treatments (performed/verified).
 */

import { pgTable, uuid, text, timestamp, integer, numeric, boolean, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const dentalInvoiceStatusEnum = pgEnum('dental_invoice_status', [
  'draft', 'issued', 'partial', 'paid', 'overdue', 'voided',
]);

export const dentalInvoices = pgTable('dental_invoice', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  dentistMemberId: uuid('dentist_member_id').notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  status: dentalInvoiceStatusEnum('status').notNull().default('draft'),
  subtotalCents: integer('subtotal_cents').notNull().default(0),
  discountCents: integer('discount_cents').notNull().default(0),
  taxCents: integer('tax_cents').notNull().default(0),
  taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).notNull().default('0'),
  totalCents: integer('total_cents').notNull().default(0),
  paidCents: integer('paid_cents').notNull().default(0),
  balanceCents: integer('balance_cents').notNull().default(0),
  dueDate: timestamp('due_date', { withTimezone: true }),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
}, (table) => ({
  invoiceNumberUniq: uniqueIndex('dental_invoice_number_uniq').on(table.invoiceNumber),
  patientIdx: index('dental_invoice_patient_id_idx').on(table.patientId),
  branchIdx: index('dental_invoice_branch_id_idx').on(table.branchId),
  statusIdx: index('dental_invoice_status_idx').on(table.status),
}));

export const dentalInvoiceLineItems = pgTable('dental_invoice_line_item', {
  ...baseEntityFields,
  invoiceId: uuid('invoice_id').notNull(),
  treatmentId: uuid('treatment_id'),
  cdtCode: text('cdt_code'),
  description: text('description').notNull(),
  toothNumber: integer('tooth_number'),
  unitPriceCents: integer('unit_price_cents').notNull(),
  quantity: integer('quantity').notNull().default(1),
  amountCents: integer('amount_cents').notNull(),
  isDone: boolean('is_done').notNull().default(false),
}, (table) => ({
  invoiceIdx: index('dental_invoice_line_item_invoice_id_idx').on(table.invoiceId),
}));

export type DentalInvoice = typeof dentalInvoices.$inferSelect;
export type NewDentalInvoice = typeof dentalInvoices.$inferInsert;
export type DentalInvoiceLineItem = typeof dentalInvoiceLineItems.$inferSelect;
export type NewDentalInvoiceLineItem = typeof dentalInvoiceLineItems.$inferInsert;
