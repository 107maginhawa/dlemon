/**
 * updateDentalPaymentPlan handler
 *
 * PATCH /dental/billing/plans/:planId/status
 * Transitions a payment plan to a new status, enforcing FSM rules.
 * Terminal states (completed, defaulted) reject all transitions with 422.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalPaymentPlanRepository } from './repos/dental-payment-plan.repo';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';

export async function updateDentalPaymentPlan(
  ctx: ValidatedContext<{ status: 'on_track' | 'behind' | 'completed' | 'defaulted' }, never, { planId: string }>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { planId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const planRepo = new DentalPaymentPlanRepository(db);
  const plan = await planRepo.findOneById(planId);
  if (!plan) throw new NotFoundError('Payment plan');

  // Branch-level authorization via invoice
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoice = await invoiceRepo.findOneById(plan.invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');

  await assertBranchRole(db, session.userId, invoice.branchId, ['dentist_owner', 'staff_full']);

  // FSM guard: throws 422 INVALID_TRANSITION for disallowed transitions
  const updated = await planRepo.setStatus(planId, body.status);

  ctx.get('logger')?.info(
    { requestId: ctx.get('requestId'), action: 'dental_payment_plan_status_update', planId, from: plan.status, to: body.status, by: session.userId },
    'Payment plan status updated',
  );

  return ctx.json(updated);
}
