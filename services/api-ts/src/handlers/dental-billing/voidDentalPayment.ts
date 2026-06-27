/**
 * voidDentalPayment handler
 *
 * POST /dental/billing/invoices/:invoiceId/payments/:paymentId/void
 * Voids a payment record and reverses the invoice paid amount.
 */

import type { ValidatedContext } from '@/types/app';
import type { VoidDentalPaymentBody, VoidDentalPaymentParams } from '@/generated/openapi/validators';
import { sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { DentalPatientCreditRepository } from './repos/dental-patient-credit.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getActiveMembershipId, getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { withTenantTx } from '@/core/tenant-tx';
import { logAuditEvent } from '@/core/audit-logger';

export async function voidDentalPayment(
  ctx: ValidatedContext<VoidDentalPaymentBody, never, VoidDentalPaymentParams>
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

  // §g F-01 (re-review #2): voiding a DEPOSIT payment must reverse the mirrored
  // deposit credit — exactly like refundDentalPayment — or the patient keeps the
  // spendable credit while the invoice is restored to unpaid (money from nothing).
  const invoice = await new DentalInvoiceRepository(db).findOneById(invoiceId);
  const isDeposit = invoice?.kind === 'deposit';

  // Resolve membership ID from personId + branchId
  const membership = await getActiveMembershipId(db, session.userId, payment.branchId);
  if (!membership) {
    throw new BusinessLogicError('No active membership found for current user in this branch', 'NO_ACTIVE_MEMBERSHIP');
  }

  // RLS P1b activation: route the two payload writes (the dental_payment void +
  // the dental_invoice balance reversal) through a SINGLE withTenantTx so the
  // app_rls policies enforce the branch scope as a second wall — and so the
  // reversal is atomic. Entity fetch + authz + membership resolution + audit
  // stay on db to preserve the exact 403/404/422 behavior.
  const voided = await withTenantTx(db, { branchIds: [payment.branchId] }, async (tx) => {
    const txVoided = await new DentalPaymentRepository(tx).voidPayment(paymentId, body.voidReason, membership.id);
    // Lost the void race: voidPayment's `is_void = false` predicate matched 0 rows
    // because a concurrent void already flipped this payment. Abort BEFORE removePayment
    // so the invoice is reversed exactly once (throwing rolls back this tx).
    if (!txVoided) {
      throw new BusinessLogicError('Payment is already voided', 'ALREADY_VOIDED');
    }
    await new DentalInvoiceRepository(tx).removePayment(invoiceId, payment.amountCents);

    // F-01: reverse the mirrored deposit credit (capped at the still-available
    // global wallet; blocked if already applied — refund/un-apply from the
    // performed invoice instead). Same conservation rule as refundDentalPayment.
    if (isDeposit) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(1001, hashtext(${payment.patientId}))`);
      const availableCredit = await new DentalPatientCreditRepository(db).getBalance(payment.patientId);
      if (availableCredit < payment.amountCents) {
        throw new BusinessLogicError(
          `Deposit already applied — its credit (only ${Math.max(0, availableCredit)} cents left) can no longer be voided; reverse it from the performed-work invoice`,
          'DEPOSIT_ALREADY_APPLIED',
        );
      }
      await new DentalPatientCreditRepository(tx).create({
        patientId: payment.patientId,
        branchId: payment.branchId,
        amountCents: -payment.amountCents,
        source: 'deposit_reversed',
        invoiceId,
        createdBy: session.userId,
        updatedBy: session.userId,
      });
    }
    return txVoided;
  });

  // V-BIL-013: financial reversal must leave an audit trail.
  // P1-C: fail-closed — a void must never silently commit without an audit row.
  // P2-A (AUD-BR-004): capture before/after + reason (non-PHI; sanitized at the sink).
  const logger = ctx.get('logger');
  const branchForAudit = await getBranchOrgId(db, payment.branchId);
  await logAuditEvent(db, logger, {
    personId: session.userId,
    tenantId: branchForAudit?.organizationId ?? payment.branchId,
    branchId: payment.branchId,
    eventType: 'data-modification',
    action: 'payment.void',
    resourceType: 'dental_payment',
    resourceId: paymentId,
    reason: body.voidReason,
    before: { isVoid: false, amountCents: payment.amountCents },
    after: { isVoid: true, voidReason: body.voidReason },
    metadata: { invoiceId, amountCents: payment.amountCents, voidReason: body.voidReason },
  }, { failClosed: true });

  return ctx.json(voided);
}
