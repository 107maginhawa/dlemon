/**
 * addInsuranceClaimLine — POST /dental/billing/claims/:claimId/lines
 *
 * Add a per-procedure line to a draft claim and recompute the billed total.
 */

import type { HandlerContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { withTenantTx } from '@/core/tenant-tx';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';

export async function addInsuranceClaimLine(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { claimId } = ctx.req.valid('param') as { claimId: string };
  const body = ctx.req.valid('json') as {
    treatmentId?: string;
    invoiceLineItemId?: string;
    cdtCode: string;
    description: string;
    billedAmountCents: number;
  };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new DentalInsuranceClaimRepository(db, logger);
  const claim = await repo.findOneById(claimId);
  if (!claim) throw new NotFoundError('Insurance claim not found');

  try {
    await assertBranchAccess(db, user.id, claim.branchId);
  } catch {
    throw new NotFoundError('Insurance claim not found');
  }

  // Only mutable (pre-submission) claims may gain lines.
  if (claim.status !== 'draft' && claim.status !== 'ready') {
    throw new BusinessLogicError('Cannot add a line to a submitted claim', 'CLAIM_IMMUTABLE');
  }

  // RLS P1b activation: route the line insert + claim-total recompute through a
  // single withTenantTx (recalculateBilled UPDATEs the Tier-1 dental_insurance_
  // claim) so the app_rls policy enforces the branch scope as a second wall and
  // the two writes stay atomic. Entity fetch + authz above stay on db.
  const line = await withTenantTx(db, { branchIds: [claim.branchId] }, async (tx) => {
    const txRepo = new DentalInsuranceClaimRepository(tx, logger);
    const created = await txRepo.addLine({
      claimId,
      treatmentId: body.treatmentId ?? null,
      invoiceLineItemId: body.invoiceLineItemId ?? null,
      cdtCode: body.cdtCode,
      description: body.description,
      billedAmountCents: Math.max(0, body.billedAmountCents),
      paidAmountCents: 0,
      status: 'pending',
      createdBy: user.id,
      updatedBy: user.id,
    });
    await txRepo.recalculateBilled(claimId);
    return created;
  });

  return ctx.json(line, 201);
}
