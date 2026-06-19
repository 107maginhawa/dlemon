/**
 * Drizzle schema for dental invoices and line items
 *
 * Invoice lifecycle: draft -> issued -> partial -> paid | overdue | voided | uncollectible
 * Line items are derived from dental treatments (performed/verified).
 */

import { pgTable, uuid, text, timestamp, integer, numeric, boolean, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields, syncableEntityFields } from '@/core/database.schema';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { dentalTreatments } from '../../dental-visit/repos/treatment.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';
import { dentalMemberships } from '../../dental-org/repos/membership.schema';

export const dentalInvoiceStatusEnum = pgEnum('dental_invoice_status', [
  'draft', 'issued', 'partial', 'paid', 'overdue', 'voided', 'uncollectible',
]);

export const dentalInvoices = pgTable('dental_invoice', {
  ...baseEntityFields,
  ...syncableEntityFields,
  visitId: uuid('visit_id').references(() => dentalVisits.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
  dentistMemberId: uuid('dentist_member_id').notNull().references(() => dentalMemberships.id),
  invoiceNumber: text('invoice_number').notNull(),
  status: dentalInvoiceStatusEnum('status').notNull().default('draft'),
  subtotalCents: integer('subtotal_cents').notNull().default(0),
  discountCents: integer('discount_cents').notNull().default(0),
  taxCents: integer('tax_cents').notNull().default(0),
  taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).notNull().default('0'),
  totalCents: integer('total_cents').notNull().default(0),
  paidCents: integer('paid_cents').notNull().default(0),
  balanceCents: integer('balance_cents').notNull().default(0),
  discountReason: text('discount_reason'),
  discountedBy: uuid('discounted_by'),
  // BR-048: per-invoice payment-terms override (days). When set, wins over
  // service/clinic terms at issue. dueDate is computed = issuedAt + terms.
  paymentTermsDays: integer('payment_terms_days'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  uncollectibleAt: timestamp('uncollectible_at', { withTimezone: true }),
}, (table) => ({
  invoiceNumberUniq: uniqueIndex('dental_invoice_number_uniq').on(table.invoiceNumber),
  patientIdx: index('dental_invoice_patient_id_idx').on(table.patientId),
  branchIdx: index('dental_invoice_branch_id_idx').on(table.branchId),
  statusIdx: index('dental_invoice_status_idx').on(table.status),
  // SL-01 / E-NEW-05: offline-replay idempotency backstop — a (branch, localId)
  // pair may exist at most once. The handler pre-check returns the existing invoice
  // on replay; this index guards against a concurrent-retry race.
  branchLocalIdUnique: uniqueIndex('dental_invoice_branch_local_id_unique')
    .on(table.branchId, table.localId)
    .where(sql`local_id is not null`),
}));

export const dentalInvoiceLineItems = pgTable('dental_invoice_line_item', {
  ...baseEntityFields,
  invoiceId: uuid('invoice_id').notNull().references(() => dentalInvoices.id, { onDelete: 'cascade' }),
  treatmentId: uuid('treatment_id').references(() => dentalTreatments.id),
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
