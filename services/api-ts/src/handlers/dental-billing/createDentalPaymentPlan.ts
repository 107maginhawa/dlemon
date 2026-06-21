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
import { withTenantTx } from '@/core/tenant-tx';

/** Postgres unique-violation (SQLSTATE 23505) detector — same shape as generatePMD.ts. */
function isUniqueViolation(err: unknown): boolean {
  const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code
    ?? (err as { code?: string })?.code;
  return code === '23505';
}

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

  // RLS P1b activation: route the idempotency check + plan/installment writes
  // through a single withTenantTx so the create stays atomic and the tenant
  // choke point is pre-routed for when the Tier-3 plan tables are armed in P4.
  // Scope is resolved via the armed invoice (authz above stays on db).
  // A request-content idempotency check (the plan has no localId): an identical re-create
  // is a dropped-ACK replay (200 with the existing plan); a different shape is a genuine
  // second-plan attempt (PLAN_EXISTS). One per invoice.
  const sameShapeAs = (plan: { numberOfInstallments: number; frequency: string; totalCents: number; startDate: Date }) =>
    plan.numberOfInstallments === body.numberOfInstallments &&
    plan.frequency === body.frequency &&
    plan.totalCents === invoice.balanceCents &&
    plan.startDate.getTime() === new Date(body.startDate).getTime();

  let result: { replay: boolean; plan: NonNullable<Awaited<ReturnType<DentalPaymentPlanRepository['findByInvoice']>>>; installments: Awaited<ReturnType<DentalPaymentPlanRepository['findInstallmentsByPlan']>> };
  try {
    // RLS P1b activation: route the idempotency check + plan/installment writes through a
    // single withTenantTx so the create stays atomic. Scope is resolved via the armed
    // invoice (authz above stays on db).
    result = await withTenantTx(db, { branchIds: [invoice.branchId] }, async (tx) => {
      const planRepo = new DentalPaymentPlanRepository(tx);
      const existing = await planRepo.findByInvoice(invoiceId);
      if (existing) {
        if (sameShapeAs(existing)) {
          const installments = await planRepo.findInstallmentsByPlan(existing.id);
          return { replay: true as const, plan: existing, installments };
        }
        throw new BusinessLogicError('Invoice already has a payment plan', 'PLAN_EXISTS');
      }
      const totalCents = invoice.balanceCents;
      const created = await planRepo.createWithInstallments({
        invoiceId,
        patientId: body.patientId,
        totalCents,
        numberOfInstallments: body.numberOfInstallments,
        frequency: body.frequency,
        startDate: new Date(body.startDate),
        amountPerInstallmentCents: Math.floor(totalCents / body.numberOfInstallments),
      });
      return { replay: false as const, plan: created.plan, installments: created.installments };
    });
  } catch (err) {
    // Concurrent create lost the race: both passed findByInvoice=null (no row to lock),
    // then the dental_payment_plan_invoice_id_unique index rejected this INSERT (23505),
    // aborting the tx. Recover on db (the tx is dead): re-read the winner's committed plan
    // and apply the SAME idempotency rule the sequential path would have.
    if (!isUniqueViolation(err)) throw err;
    const planRepo = new DentalPaymentPlanRepository(db);
    const winner = await planRepo.findByInvoice(invoiceId);
    if (!winner) throw err;
    if (!sameShapeAs(winner)) {
      throw new BusinessLogicError('Invoice already has a payment plan', 'PLAN_EXISTS');
    }
    const installments = await planRepo.findInstallmentsByPlan(winner.id);
    result = { replay: true, plan: winner, installments };
  }

  return ctx.json({ ...result.plan, installments: result.installments }, result.replay ? 200 : 201);
}
