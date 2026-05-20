/**
 * voidDentalPayment handler
 *
 * POST /dental/billing/invoices/:invoiceId/payments/:paymentId/void
 * Voids a payment record and reverses the invoice paid amount.
 */

import { eq, and } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';

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
  await assertBranchAccess(db, session.userId, payment.branchId);

  if (payment.invoiceId !== invoiceId) {
    throw new BusinessLogicError('Payment does not belong to this invoice', 'PAYMENT_MISMATCH');
  }

  if (payment.isVoid) {
    throw new BusinessLogicError('Payment is already voided', 'ALREADY_VOIDED');
  }

  // Resolve membership ID from personId + branchId
  const [membership] = await db
    .select({ id: dentalMemberships.id })
    .from(dentalMemberships)
    .where(and(
      eq(dentalMemberships.personId, session.userId),
      eq(dentalMemberships.branchId, payment.branchId),
      eq(dentalMemberships.status, 'active'),
    ))
    .limit(1);

  // Void the payment
  const voided = await paymentRepo.voidPayment(paymentId, body.voidReason, membership!.id);

  // Reverse the amount on the invoice
  const invoiceRepo = new DentalInvoiceRepository(db);
  await invoiceRepo.removePayment(invoiceId, payment.amountCents);

  return ctx.json(voided);
}
