/**
 * recordClaimRemittance — POST /dental/billing/claims/:claimId/remittance
 *
 * P1-26: post an HMO remittance against a claim (the PH "EOB posting"). It:
 *   1. records a dental_payer_payment row,
 *   2. applies the paid amount to the anchored invoice via the EXISTING money
 *      pipeline (invoiceRepo.addPayment — same recompute as recordDentalPayment),
 *   3. writes off the disallowed delta as an invoice discount
 *      (reason 'hmo_disallowance', reusing applyDiscount mechanics),
 *   4. advances the claim FSM to partially_paid / paid and updates payer totals.
 *
 * Invariants enforced:
 *   - over-post rejected: paid + disallowance must not exceed the claim's
 *     outstanding billed-minus-already-settled amount (PAYER_OVERPOST),
 *   - idempotent on remittanceReference (same claim + ref → replay 200),
 *   - reconciliation: payer paid + patient payments + write-off must close the
 *     invoice balance (proven by the acceptance test).
 */

import type { HandlerContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError, ConflictError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { withTenantTx } from '@/core/tenant-tx';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';
import { DentalPayerPaymentRepository } from './repos/dental-payer-payment.repo';
import { PAYER_PAYMENT_METHODS, type PayerPaymentMethod } from './repos/dental-payer-payment.schema';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import type { InsuranceClaimStatus } from './repos/dental-insurance-claim.schema';
import { logAuditEvent } from '@/core/audit-logger';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';

export async function recordClaimRemittance(ctx: HandlerContext): Promise<Response> {
  const session = ctx.get('session');
  const user = ctx.get('user');
  const actorId = session?.userId ?? user?.id;
  if (!actorId) throw new UnauthorizedError('Authentication required');

  const { claimId } = ctx.req.valid('param') as { claimId: string };
  const body = ctx.req.valid('json') as {
    amountCents: number;
    remittanceReference?: string;
    remittedAt?: string;
    method?: string;
    disallowanceCents?: number;
    disallowanceReason?: string;
  };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // These db-bound repos serve the pre-tx entity fetch + idempotency guard; the
  // armed-table writes use tx-bound repos inside withTenantTx below.
  const claimRepo = new DentalInsuranceClaimRepository(db, logger);
  const payerRepo = new DentalPayerPaymentRepository(db, logger);

  const claim = await claimRepo.findOneById(claimId);
  if (!claim) throw new NotFoundError('Insurance claim not found');

  await assertBranchRole(db, actorId, claim.branchId, ['dentist_owner', 'dentist_associate', 'staff_full']);

  const paid = Math.trunc(body.amountCents);
  const disallowed = Math.max(0, Math.trunc(body.disallowanceCents ?? 0));

  if (paid < 0) {
    throw new BusinessLogicError('Remittance amount cannot be negative', 'INVALID_AMOUNT');
  }
  if (paid === 0 && disallowed === 0) {
    throw new BusinessLogicError('Remittance must post a payment or a disallowance', 'INVALID_AMOUNT');
  }

  // Idempotency: replay on (claim, remittanceReference).
  if (body.remittanceReference) {
    const existing = await payerRepo.findByClaimAndReference(claimId, body.remittanceReference);
    if (existing) {
      if (existing.amountCents !== paid) {
        throw new ConflictError(
          `Remittance reference ${body.remittanceReference} already recorded on this claim with a different amount`,
        );
      }
      return ctx.json({ payerPayment: existing, claim, replayed: true }, 200);
    }
  }

  // Over-post guard: cumulative payer paid + disallowance must not exceed billed.
  const alreadySettled = (claim.paidByPayerCents ?? 0) + (claim.disallowedCents ?? 0);
  if (alreadySettled + paid + disallowed > claim.billedAmountCents) {
    throw new BusinessLogicError(
      `Remittance (paid ${paid} + disallowed ${disallowed}) exceeds the claim's unsettled amount`,
      'PAYER_OVERPOST',
    );
  }

  // RLS P1b activation: route the full money pipeline (payer payment + invoice
  // write-off/payment + claim totals/FSM) through a SINGLE withTenantTx so the
  // app_rls policies on dental_payer_payment / dental_invoice / dental_insurance_
  // claim (all Tier-1) enforce the branch scope as a second wall — and so the
  // multi-table remittance posts atomically (it was previously non-atomic).
  // Entity fetch + authz + idempotency + over-post guards + audit stay on db.
  const { payerPayment, finalClaim } = await withTenantTx(db, { branchIds: [claim.branchId] }, async (tx) => {
    const txClaimRepo = new DentalInsuranceClaimRepository(tx, logger);
    const txPayerRepo = new DentalPayerPaymentRepository(tx, logger);
    const txInvoiceRepo = new DentalInvoiceRepository(tx);

    // 1. Record the payer payment.
    const txPayerPayment = await txPayerRepo.createOne({
      claimId,
      insuranceProfileId: claim.insuranceProfileId,
      branchId: claim.branchId,
      invoiceId: claim.invoiceId ?? null,
      amountCents: paid,
      remittanceReference: body.remittanceReference ?? null,
      remittedAt: body.remittedAt ?? null,
      method: (PAYER_PAYMENT_METHODS.includes(body.method as PayerPaymentMethod) ? body.method as PayerPaymentMethod : 'bank_transfer'),
      disallowanceCents: disallowed > 0 ? disallowed : null,
      disallowanceReason: body.disallowanceReason ?? null,
      createdBy: actorId,
      updatedBy: actorId,
    });

    // 2 + 3. Apply to the anchored invoice (payment + write-off) when present.
    if (claim.invoiceId) {
      const invoice = await txInvoiceRepo.findOneById(claim.invoiceId);
      if (invoice && invoice.status !== 'voided') {
        // Write off the disallowed delta first (cannot pay on a draft).
        if (disallowed > 0 && invoice.status !== 'paid') {
          const newDiscount = invoice.discountCents + disallowed;
          await txInvoiceRepo.applyDiscount(
            claim.invoiceId,
            newDiscount,
            Number(invoice.taxRate),
            'hmo_disallowance',
            actorId,
          );
        }
        // Then post the payer payment against the (recomputed) balance.
        if (paid > 0) {
          const fresh = await txInvoiceRepo.findOneById(claim.invoiceId);
          if (fresh && fresh.status !== 'paid' && fresh.status !== 'draft') {
            const applied = Math.min(paid, fresh.balanceCents);
            if (applied > 0) await txInvoiceRepo.addPayment(claim.invoiceId, applied);
          }
        }
      }
    }

    // 4. Update payer totals + advance the claim FSM.
    await txClaimRepo.applyRemittance(claimId, paid, disallowed);
    const refreshed = await txClaimRepo.findOneById(claimId);
    let nextStatus: InsuranceClaimStatus | undefined;
    if (refreshed) {
      const settled = (refreshed.paidByPayerCents ?? 0) + (refreshed.disallowedCents ?? 0);
      const fullySettled = settled >= refreshed.billedAmountCents;
      if (fullySettled && refreshed.status !== 'paid') {
        // approved/partially_paid → paid; otherwise leave (e.g. written-off route).
        if (refreshed.status === 'approved' || refreshed.status === 'partially_paid' || refreshed.status === 'submitted' || refreshed.status === 'under_review') {
          nextStatus = 'paid';
        }
      } else if (!fullySettled && (refreshed.status === 'approved' || refreshed.status === 'submitted' || refreshed.status === 'under_review')) {
        nextStatus = 'partially_paid';
      }
    }
    if (nextStatus) {
      await txClaimRepo.update(claimId, {
        status: nextStatus,
        paidAt: nextStatus === 'paid' ? new Date() : undefined,
        updatedBy: actorId,
      });
    }

    const txFinalClaim = await txClaimRepo.findOneById(claimId);
    return { payerPayment: txPayerPayment, finalClaim: txFinalClaim };
  });

  const branchForAudit = await getBranchOrgId(db, claim.branchId);
  await logAuditEvent(db, logger, {
    personId: actorId,
    tenantId: branchForAudit?.organizationId ?? claim.branchId,
    branchId: claim.branchId,
    action: 'payment.record',
    resourceType: 'dental_payer_payment',
    resourceId: payerPayment.id,
    metadata: { claimId, amountCents: paid, disallowanceCents: disallowed },
  });

  return ctx.json({ payerPayment, claim: finalClaim }, 201);
}
