/**
 * updateInsuranceClaimLine — PATCH /dental/billing/claims/:claimId/lines/:lineId
 *
 * Update a claim line's approved/paid amount or status (e.g. after a payer
 * decision), then recompute the claim's billed/patient-portion totals.
 */

import type { HandlerContext } from '@/types/app';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { withTenantTx } from '@/core/tenant-tx';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';
import type { ClaimLineStatus } from './repos/dental-insurance-claim.schema';

export async function updateInsuranceClaimLine(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { claimId, lineId } = ctx.req.valid('param') as { claimId: string; lineId: string };
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

  // RLS P1b activation: route the line update + claim-total recompute through a
  // single withTenantTx (recalculateBilled UPDATEs the Tier-1 dental_insurance_
  // claim) so the app_rls policy enforces the branch scope as a second wall and
  // the two writes stay atomic. Entity fetch + authz above stay on db. The
  // line-not-found 404 is preserved: recompute is skipped when updateLine misses.
  const updated = await withTenantTx(db, { branchIds: [claim.branchId] }, async (tx) => {
    const txRepo = new DentalInsuranceClaimRepository(tx, logger);
    // Serialize concurrent line edits on this claim: recalculateBilled is an unlocked
    // read-modify-write of the claim aggregate, so two PATCHes to different lines could
    // each recompute from a snapshot missing the other's edit and the last write would
    // lose one line's contribution. Locking the claim row first makes the second tx
    // re-read the first's committed line edit before recomputing.
    await txRepo.lockClaim(claimId);
    const u = await txRepo.updateLine(lineId, claimId, {
      ...(body.approvedAmountCents !== undefined && { approvedAmountCents: body.approvedAmountCents }),
      ...(body.paidAmountCents !== undefined && { paidAmountCents: body.paidAmountCents }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.billedAmountCents !== undefined && { billedAmountCents: Math.max(0, body.billedAmountCents) }),
    });
    if (u) await txRepo.recalculateBilled(claimId);
    return u;
  });
  if (!updated) throw new NotFoundError('Claim line not found');

  return ctx.json(updated, 200);
}
