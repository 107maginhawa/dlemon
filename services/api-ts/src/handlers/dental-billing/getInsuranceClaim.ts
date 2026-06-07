/**
 * getInsuranceClaim — GET /dental/billing/claims/:claimId
 */

import type { HandlerContext } from '@/types/app';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';

export async function getInsuranceClaim(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { claimId } = ctx.req.valid('param') as { claimId: string };
  const db = ctx.get('database') as DatabaseInstance;

  const repo = new DentalInsuranceClaimRepository(db);
  const found = await repo.findWithLines(claimId);
  if (!found) throw new NotFoundError('Insurance claim not found');

  // Cross-tenant isolation: a non-member of the claim's branch must NOT learn the
  // claim exists — convert the branch-access denial into a 404 (mirrors the
  // cross-tenant 404 expected by createClaimDraft-style guards).
  try {
    await assertBranchAccess(db, user.id, found.claim.branchId);
  } catch {
    throw new NotFoundError('Insurance claim not found');
  }

  return ctx.json({ ...found.claim, lines: found.lines }, 200);
}
