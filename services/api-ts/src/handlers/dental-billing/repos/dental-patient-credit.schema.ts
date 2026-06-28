/**
 * dental_patient_credit — patient credit ledger (BR-052, Phase 4.1).
 *
 * Append-only signed ledger: a positive `amountCents` adds credit (manual
 * goodwill, overpayment, refund-to-credit); a negative row consumes it when
 * applied to an invoice. A patient's available credit is SUM(amountCents) — it
 * can never go negative because apply-credit caps the draw at the live sum
 * inside the same transaction (BR-052).
 */

import { pgTable, uuid, integer, text, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalInvoices } from './dental-invoice.schema';

export const dentalPatientCredits = pgTable('dental_patient_credit', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
  // Signed: > 0 adds credit, < 0 consumes it.
  amountCents: integer('amount_cents').notNull(),
  // deposit | deposit_reversed | refund | applied | manual | overpayment
  source: text('source').notNull(),
  // Set on a consuming (negative) row: the invoice the credit was applied to.
  invoiceId: uuid('invoice_id').references(() => dentalInvoices.id),
  note: text('note'),
  createdByMemberId: uuid('created_by_member_id'),
}, (table) => ({
  patientIdx: index('dental_patient_credit_patient_idx').on(table.patientId),
}));

export type DentalPatientCredit = typeof dentalPatientCredits.$inferSelect;
export type NewDentalPatientCredit = typeof dentalPatientCredits.$inferInsert;
