/**
 * updateClaimStatus — PATCH /dental/patients/:patientId/claims/:claimId/status
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import { ClaimDraftRepository } from '../repos/claim-draft.repo';
import { CLAIM_DRAFT_FSM, type ClaimDraftStatus, type DentalClaimDraft } from '../repos/claim-draft.schema';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function updateClaimStatus(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, claimId } = ctx.req.valid('param') as { patientId: string; claimId: string };
  const { status: newStatus } = ctx.req.valid('json') as { status: ClaimDraftStatus };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // EF-PAT-001: block writes on archived patients
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

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

  const updateFields: Partial<Pick<DentalClaimDraft, 'status' | 'submittedAt'>> = { status: newStatus };
  if (newStatus === 'submitted') {
    updateFields.submittedAt = new Date();
  }

  const updated = await repo.update(claimId, patientId, updateFields);

  logger?.info({ action: 'updateClaimStatus', patientId, claimId, from: currentStatus, to: newStatus }, 'Claim status updated');

  return ctx.json(updated, 200);
}
