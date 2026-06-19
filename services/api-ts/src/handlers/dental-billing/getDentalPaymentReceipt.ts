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
import { getBranchBirInfo } from '@/handlers/dental-org/repos/org-billing.facade';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';

// BR-055 (PH): the BIR-required non-VAT statement.
const NON_VAT_STATEMENT = 'Non-VAT registered. THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.';
const VAT_STATEMENT = 'VAT-registered. Price is VAT-inclusive; VAT is shown above.';

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

  // BR-055 (PH): BIR receipt header + VAT breakdown. The VAT amounts are derived
  // from the invoice's stored tax fields (BR-054); a non-VAT clinic shows the
  // full gross as VAT-exempt with the BIR non-VAT statement.
  const bir = await getBranchBirInfo(db, invoice.branchId);
  const tax = bir.isVatRegistered
    ? {
        vatRate: Number(invoice.taxRate),
        vatableCents: invoice.totalCents - invoice.taxCents,
        vatExemptCents: 0,
        zeroRatedCents: 0,
        vatCents: invoice.taxCents,
      }
    : {
        vatRate: 0,
        vatableCents: 0,
        vatExemptCents: invoice.totalCents,
        zeroRatedCents: 0,
        vatCents: 0,
      };

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
    // BR-055 (PH): BIR official-receipt fields.
    orNumber: payment.receiptNumber,
    clinic: {
      registeredName: bir.registeredName,
      businessStyle: bir.businessStyle,
      tin: bir.tin,
      address: bir.address,
      isVatRegistered: bir.isVatRegistered,
    },
    tax,
    taxStatement: bir.isVatRegistered ? VAT_STATEMENT : NON_VAT_STATEMENT,
    generatedAt: new Date().toISOString(),
  }, 200);
}
