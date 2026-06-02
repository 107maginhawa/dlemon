/**
 * addInsuranceClaimLine — POST /dental/billing/claims/:claimId/lines
 *
 * Add a per-procedure line to a draft claim and recompute the billed total.
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';

export async function addInsuranceClaimLine(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { claimId } = ctx.req.valid('param');
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

  const line = await repo.addLine({
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
  await repo.recalculateBilled(claimId);

  return ctx.json(line, 201);
}
