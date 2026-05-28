/**
 * getDentalPaymentReceipt — GET /dental/billing/invoices/:invoiceId/payments/:paymentId/receipt
 *
 * FR4.6: Receipt generation — structured receipt for any payment (including voided, EC5).
 * Returns a receipt object. Frontend renders it for print/PDF.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { getPatientWithPersonForInvoice } from '@/handlers/patient/repos/patient-billing.facade';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';

export async function getDentalPaymentReceipt(ctx: BaseContext) {
  const user = ctx.get('user');
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

  // Fetch patient name via billing facade (avoids direct cross-module repo import)
  const patientRow = await getPatientWithPersonForInvoice(db, invoice.patientId);
  const patientName = patientRow
    ? [patientRow.firstName, patientRow.lastName].filter(Boolean).join(' ')
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
