/**
 * updateClaimStatus — PATCH /dental/patients/:patientId/claims/:claimId/status
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { ClaimDraftRepository } from './repos/claim-draft.repo';
import { CLAIM_DRAFT_FSM, type ClaimDraftStatus } from './repos/claim-draft.schema';
import type { DatabaseInstance } from '@/core/database';

export async function updateClaimStatus(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, claimId } = ctx.req.valid('param');
  const { status: newStatus } = ctx.req.valid('json') as { status: ClaimDraftStatus };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new ClaimDraftRepository(db, logger);
  const claim = await repo.findOneById(claimId, patientId);
  if (!claim) throw new NotFoundError('Claim draft not found');

  const currentStatus = claim.status as ClaimDraftStatus;
  const allowed = CLAIM_DRAFT_FSM[currentStatus];

  if (!allowed.includes(newStatus)) {
    throw new BusinessLogicError(
      `Invalid status transition: ${currentStatus} → ${newStatus}. Allowed: ${allowed.length > 0 ? allowed.join(', ') : 'none'}`,
      'INVALID_STATUS_TRANSITION',
    );
  }

  const updateFields: Record<string, any> = { status: newStatus };
  if (newStatus === 'submitted') {
    updateFields.submittedAt = new Date();
  }

  const updated = await repo.update(claimId, patientId, updateFields);

  logger?.info({ action: 'updateClaimStatus', patientId, claimId, from: currentStatus, to: newStatus }, 'Claim status updated');

  return ctx.json(updated, 200);
}
