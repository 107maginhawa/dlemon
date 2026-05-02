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

export async function getDentalPaymentPlan(
  ctx: ValidatedContext<never, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  const repo = new DentalPaymentPlanRepository(db);
  const plan = await repo.findByInvoice(invoiceId);
  if (!plan) throw new NotFoundError('Payment plan');

  const installments = await repo.findInstallmentsByPlan(plan.id);

  return ctx.json({ ...plan, installments });
}
