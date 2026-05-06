/**
 * createDentalPaymentPlan handler
 *
 * POST /dental/billing/invoices/:invoiceId/plan
 * Creates a payment plan with auto-generated installments.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentPlanRepository } from './repos/dental-payment-plan.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';

export async function createDentalPaymentPlan(
  ctx: ValidatedContext<any, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');

  // Branch-level authorization
  await assertBranchAccess(db, session.userId, invoice.branchId);

  if (invoice.status === 'voided') {
    throw new BusinessLogicError('Cannot create payment plan for a voided invoice', 'VOIDED_INVOICE');
  }

  if (invoice.balanceCents <= 0) {
    throw new BusinessLogicError('No balance remaining to create a payment plan', 'NO_BALANCE');
  }

  const planRepo = new DentalPaymentPlanRepository(db);

  // Check for existing plan
  const existing = await planRepo.findByInvoice(invoiceId);
  if (existing) {
    throw new BusinessLogicError('Invoice already has a payment plan', 'PLAN_EXISTS');
  }

  const totalCents = invoice.balanceCents;
  const amountPerInstallmentCents = Math.floor(totalCents / body.numberOfInstallments);

  const { plan, installments } = await planRepo.createWithInstallments({
    invoiceId,
    patientId: body.patientId,
    totalCents,
    numberOfInstallments: body.numberOfInstallments,
    frequency: body.frequency,
    startDate: new Date(body.startDate),
    amountPerInstallmentCents,
  });

  return ctx.json({ ...plan, installments }, 201);
}
