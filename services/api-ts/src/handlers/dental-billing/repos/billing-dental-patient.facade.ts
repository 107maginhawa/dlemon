/**
 * billing-dental-patient.facade.ts
 *
 * Facade exposing a patient's invoices / line items / payments to dental-patient
 * profile + statement handlers, which aggregate them (outstanding balance,
 * statement). dental-patient imports only this facade, never the dental-billing
 * schema directly (Phase 10 boundary lint). Queries are byte-identical to the
 * former inline reads.
 */

import { eq, desc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalInvoices, dentalInvoiceLineItems } from './dental-invoice.schema';
import { dentalPayments } from './dental-payment.schema';

/** All invoices for a patient, newest first. */
export async function getInvoicesByPatientId(db: DatabaseInstance, patientId: string) {
  return db
    .select()
    .from(dentalInvoices)
    .where(eq(dentalInvoices.patientId, patientId))
    .orderBy(desc(dentalInvoices.createdAt));
}

/** Line items for one invoice. */
export async function getInvoiceLineItemsByInvoiceId(db: DatabaseInstance, invoiceId: string) {
  return db
    .select()
    .from(dentalInvoiceLineItems)
    .where(eq(dentalInvoiceLineItems.invoiceId, invoiceId));
}

/** All payments for a patient, newest first. */
export async function getPaymentsByPatientId(db: DatabaseInstance, patientId: string) {
  return db
    .select()
    .from(dentalPayments)
    .where(eq(dentalPayments.patientId, patientId))
    .orderBy(desc(dentalPayments.createdAt));
}
