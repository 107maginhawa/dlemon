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
import { getActiveMembershipId, getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';

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
  if (!membership) {
    throw new BusinessLogicError('No active membership found for current user in this branch', 'NO_ACTIVE_MEMBERSHIP');
  }

  // Void the payment
  const voided = await paymentRepo.voidPayment(paymentId, body.voidReason, membership.id);

  // Reverse the amount on the invoice
  const invoiceRepo = new DentalInvoiceRepository(db);
  await invoiceRepo.removePayment(invoiceId, payment.amountCents);

  // V-BIL-013: financial reversal must leave an audit trail.
  const logger = ctx.get('logger');
  const branchForAudit = await getBranchOrgId(db, payment.branchId);
  await logAuditEvent(db, logger, {
    personId: session.userId,
    tenantId: branchForAudit?.organizationId ?? payment.branchId,
    branchId: payment.branchId,
    action: 'payment.void',
    resourceType: 'dental_payment',
    resourceId: paymentId,
    metadata: { invoiceId, amountCents: payment.amountCents, voidReason: body.voidReason },
  });

  return ctx.json(voided);
}
