/**
 * updateInsuranceClaimLine — PATCH /dental/billing/claims/:claimId/lines/:lineId
 *
 * Update a claim line's approved/paid amount or status (e.g. after a payer
 * decision), then recompute the claim's billed/patient-portion totals.
 */

import type { HandlerContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { withTenantTx } from '@/core/tenant-tx';
import { logAuditEvent } from '@/core/audit-logger';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';
import type { ClaimLineStatus, InsuranceClaimStatus } from './repos/dental-insurance-claim.schema';

/**
 * The clinic-controlled (billed) line fields. They are only mutable while the claim
 * is pre-submission (draft/ready). Once a claim is submitted/adjudicated/paid/
 * written_off only the payer-decision fields (approved/paid/status) may change —
 * mirrors addInsuranceClaimLine's CLAIM_IMMUTABLE guard so the billed amount on an
 * in-flight or settled claim cannot be silently rewritten.
 */
function isClaimEditable(status: InsuranceClaimStatus): boolean {
  return status === 'draft' || status === 'ready';
}

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

  // G1 (plan 014 S1): the billed fields (billedAmountCents/description) are clinic-
  // controlled and must be frozen once the claim leaves draft/ready, or a submitted/
  // paid claim's billed amount could be silently rewritten (recalculateBilled then
  // propagates it to the claim total). Reject pre-tx for a fast 422; re-check under the
  // lock below because the status can flip mid-flight.
  const touchesBilledFields = body.billedAmountCents !== undefined || body.description !== undefined;
  if (touchesBilledFields && !isClaimEditable(claim.status)) {
    throw new BusinessLogicError('Cannot edit billed fields on a submitted claim', 'CLAIM_IMMUTABLE');
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
    const locked = await txRepo.lockClaim(claimId);
    // G1: re-assert billed-field immutability against the committed status under the lock
    // (it conflicts with updateInsuranceClaimStatus's UPDATE) — a claim submitted mid-flight
    // would otherwise still accept a billed edit read against the pre-tx draft status.
    if (touchesBilledFields && (!locked || !isClaimEditable(locked.status))) {
      throw new BusinessLogicError('Cannot edit billed fields on a submitted claim', 'CLAIM_IMMUTABLE');
    }
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

  // G1: claim-line mutations are a money path → must leave an audit trail (was untraceable).
  const org = await getBranchOrgId(db, claim.branchId);
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: org?.organizationId ?? claim.branchId,
    branchId: claim.branchId,
    action: 'insurance_claim_line.update',
    resourceType: 'dental_insurance_claim_line',
    resourceId: lineId,
    metadata: {
      claimId,
      ...(body.approvedAmountCents !== undefined && { approvedAmountCents: body.approvedAmountCents }),
      ...(body.paidAmountCents !== undefined && { paidAmountCents: body.paidAmountCents }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.billedAmountCents !== undefined && { billedAmountCents: body.billedAmountCents }),
    },
  });

  return ctx.json(updated, 200);
}
