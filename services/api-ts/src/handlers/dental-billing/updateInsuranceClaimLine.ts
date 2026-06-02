/**
 * updateInsuranceClaimLine — PATCH /dental/billing/claims/:claimId/lines/:lineId
 *
 * Update a claim line's approved/paid amount or status (e.g. after a payer
 * decision), then recompute the claim's billed/patient-portion totals.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';
import type { ClaimLineStatus } from './repos/dental-insurance-claim.schema';

export async function updateInsuranceClaimLine(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { claimId, lineId } = ctx.req.valid('param');
  const body = ctx.req.valid('json') as {
    approvedAmountCents?: number;
    paidAmountCents?: number;
    status?: ClaimLineStatus;
    description?: string;
    billedAmountCents?: number;
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

  const updated = await repo.updateLine(lineId, claimId, {
    ...(body.approvedAmountCents !== undefined && { approvedAmountCents: body.approvedAmountCents }),
    ...(body.paidAmountCents !== undefined && { paidAmountCents: body.paidAmountCents }),
    ...(body.status !== undefined && { status: body.status }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.billedAmountCents !== undefined && { billedAmountCents: Math.max(0, body.billedAmountCents) }),
  });
  if (!updated) throw new NotFoundError('Claim line not found');

  await repo.recalculateBilled(claimId);
  return ctx.json(updated, 200);
}
