/**
 * getDentalPaymentReceipt — GET /dental/billing/invoices/:invoiceId/payments/:paymentId/receipt
 *
 * FR4.6: Receipt generation — structured receipt for any payment (including voided, EC5).
 * Returns a receipt object. Frontend renders it for print/PDF.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { PatientRepository } from '../patient/repos/patient.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { persons } from '../person/repos/person.schema';
import { eq } from 'drizzle-orm';

export async function getDentalPaymentReceipt(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const invoiceId = ctx.req.param('invoiceId');
  if (!invoiceId) throw new NotFoundError('Invoice not found');
  const paymentId = ctx.req.param('paymentId');
  if (!paymentId) throw new NotFoundError('Payment not found');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const invoiceRepo = new DentalInvoiceRepository(db);
  const paymentRepo = new DentalPaymentRepository(db);

  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice not found');

  // Branch-level authorization
  await assertBranchAccess(db, user.id, invoice.branchId);

  const payment = await paymentRepo.findOneById(paymentId);
  if (!payment || payment.invoiceId !== invoiceId) {
    throw new NotFoundError('Payment not found');
  }

  // Fetch patient name via patient → person join
  const patientRepo = new PatientRepository(db);
  const patient = await patientRepo.findOneByIdWithPerson(invoice.patientId);
  const person = patient?.person as any;
  const patientName = person
    ? [person.firstName, person.lastName].filter(Boolean).join(' ')
    : 'Unknown Patient';

  logger?.info({ action: 'getDentalPaymentReceipt', invoiceId, paymentId }, 'Receipt generated');

  return ctx.json({
    receiptNumber: payment.receiptNumber,
    isVoid: payment.isVoid,
    voidedAt: payment.voidedAt ?? null,
    voidReason: payment.voidReason ?? null,
    payment: {
      id: payment.id,
      amountCents: payment.amountCents,
      method: payment.method,
      recordedAt: payment.createdAt,
      notes: payment.notes ?? null,
    },
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalCents: invoice.totalCents,
      paidCents: invoice.paidCents,
      balanceCents: invoice.balanceCents,
      status: invoice.status,
    },
    patient: {
      id: invoice.patientId,
      name: patientName,
    },
    generatedAt: new Date().toISOString(),
  }, 200);
}
