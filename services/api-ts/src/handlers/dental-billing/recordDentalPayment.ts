/**
 * recordDentalPayment handler
 *
 * POST /dental/billing/invoices/:invoiceId/payments
 * Creates a payment record and updates the invoice paid/balance amounts.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';

export async function recordDentalPayment(
  ctx: ValidatedContext<any, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const invoiceRepo = new DentalInvoiceRepository(db);
  const paymentRepo = new DentalPaymentRepository(db);

  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');

  // Branch-level authorization
  await assertBranchAccess(db, session.userId, invoice.branchId);

  if (invoice.status === 'voided') {
    throw new BusinessLogicError('Cannot record payment on a voided invoice', 'VOIDED_INVOICE');
  }

  if (invoice.status === 'paid') {
    throw new BusinessLogicError('Invoice is already fully paid', 'ALREADY_PAID');
  }

  if (body.amountCents > invoice.balanceCents) {
    throw new BusinessLogicError(
      `Payment amount (${body.amountCents}) exceeds remaining balance (${invoice.balanceCents})`,
      'OVERPAYMENT',
    );
  }

  // Create the payment
  const payment = await paymentRepo.createOne({
    invoiceId,
    patientId: invoice.patientId,
    branchId: invoice.branchId,
    amountCents: body.amountCents,
    method: body.method,
    receiptNumber: body.receiptNumber,
    recordedByMemberId: body.recordedByMemberId,
    notes: body.notes,
  });

  // Update invoice totals
  await invoiceRepo.addPayment(invoiceId, body.amountCents);

  return ctx.json(payment, 201);
}
