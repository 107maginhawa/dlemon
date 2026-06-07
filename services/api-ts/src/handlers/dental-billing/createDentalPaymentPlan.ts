/**
 * createDentalPaymentPlan handler
 *
 * POST /dental/billing/invoices/:invoiceId/plan
 * Creates a payment plan with auto-generated installments.
 */

import type { ValidatedContext } from '@/types/app';
import type { CreateDentalPaymentPlanBody, CreateDentalPaymentPlanParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentPlanRepository } from './repos/dental-payment-plan.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';

export async function createDentalPaymentPlan(
  ctx: ValidatedContext<CreateDentalPaymentPlanBody, never, CreateDentalPaymentPlanParams>
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
  // V-BIL-003: per ROLE_PERMISSION_MATRIX, create payment plan = dentist_owner +
  // dentist_associate (own patients). staff_full is NOT permitted.
  await assertBranchRole(db, session.userId, invoice.branchId, ['dentist_owner', 'dentist_associate']);

  // V-BIL-002: bound installment count to the contract range (2–24). An
  // unbounded/zero count yields Math.floor(total/0) = Infinity (money-integrity
  // breach). Defended here even if the schema validator is bypassed.
  if (
    !Number.isInteger(body.numberOfInstallments) ||
    body.numberOfInstallments < 2 ||
    body.numberOfInstallments > 24
  ) {
    throw new BusinessLogicError(
      'Number of installments must be between 2 and 24',
      'INVALID_INSTALLMENT_COUNT',
    );
  }

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
