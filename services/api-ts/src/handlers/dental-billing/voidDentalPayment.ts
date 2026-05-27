/**
 * voidDentalPayment handler
 *
 * POST /dental/billing/invoices/:invoiceId/payments/:paymentId/void
 * Voids a payment record and reverses the invoice paid amount.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getActiveMembershipId } from '@/handlers/dental-org/repos/org-billing.facade';

export async function voidDentalPayment(
  ctx: ValidatedContext<any, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId, paymentId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const paymentRepo = new DentalPaymentRepository(db);
  const payment = await paymentRepo.findOneById(paymentId);
  if (!payment) throw new NotFoundError('Payment');

  // Branch-level authorization
  await assertBranchRole(db, session.userId, payment.branchId, ['dentist_owner']);

  if (payment.invoiceId !== invoiceId) {
    throw new BusinessLogicError('Payment does not belong to this invoice', 'PAYMENT_MISMATCH');
  }

  if (payment.isVoid) {
    throw new BusinessLogicError('Payment is already voided', 'ALREADY_VOIDED');
  }

  // Resolve membership ID from personId + branchId
  const membership = await getActiveMembershipId(db, session.userId, payment.branchId);

  // Void the payment
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const voided = await paymentRepo.voidPayment(paymentId, body.voidReason, membership!.id);

  // Reverse the amount on the invoice
  const invoiceRepo = new DentalInvoiceRepository(db);
  await invoiceRepo.removePayment(invoiceId, payment.amountCents);

  return ctx.json(voided);
}
