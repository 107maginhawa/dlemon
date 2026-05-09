/**
 * getDentalPaymentPlan handler
 *
 * GET /dental/billing/invoices/:invoiceId/plan
 * Returns payment plan with installments for an invoice.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalPaymentPlanRepository } from './repos/dental-payment-plan.repo';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';

export async function getDentalPaymentPlan(
  ctx: ValidatedContext<never, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via invoice
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');
  await assertBranchAccess(db, session.userId, invoice.branchId);

  const repo = new DentalPaymentPlanRepository(db);
  const plan = await repo.findByInvoice(invoiceId);
  if (!plan) throw new NotFoundError('Payment plan');

  const installments = await repo.findInstallmentsByPlan(plan.id);

  return ctx.json({ ...plan, installments });
}
