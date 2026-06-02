/**
 * updateInsuranceClaimStatus — PATCH /dental/billing/claims/:claimId/status
 *
 * FSM-validated transition (INSURANCE_CLAIM_FSM). On `submitted` we stamp
 * submittedAt and may capture submissionChannel + payerReference. Submitting
 * WITHOUT an approved LOA WARNS (does not block) — some PH HMOs reconcile
 * post-hoc (plan §3.3).
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getCoverageAuthorizationForBilling } from '@/handlers/dental-patient/repos/insurance-billing.facade';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';
import { INSURANCE_CLAIM_FSM, type InsuranceClaimStatus } from './repos/dental-insurance-claim.schema';

export async function updateInsuranceClaimStatus(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { claimId } = ctx.req.valid('param');
  const body = ctx.req.valid('json') as {
    status: InsuranceClaimStatus;
    payerReference?: string;
    submissionChannel?: string;
    denialReason?: string;
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

  const current = claim.status as InsuranceClaimStatus;
  const allowed = INSURANCE_CLAIM_FSM[current];
  if (!allowed.includes(body.status)) {
    throw new BusinessLogicError(
      `Invalid status transition: ${current} → ${body.status}. Allowed: ${allowed.length > 0 ? allowed.join(', ') : 'none'}`,
      'INVALID_STATUS_TRANSITION',
    );
  }

  const updateFields: Parameters<DentalInsuranceClaimRepository['update']>[1] = {
    status: body.status,
    updatedBy: user.id,
  };

  const warnings: string[] = [];

  if (body.status === 'submitted') {
    updateFields.submittedAt = new Date();
    if (body.payerReference !== undefined) updateFields.payerReference = body.payerReference;
    if (body.submissionChannel !== undefined) updateFields.submissionChannel = body.submissionChannel as any;

    // Warn-not-block: no approved LOA backing the claim.
    let hasApprovedLoa = false;
    if (claim.authorizationId) {
      const auth = await getCoverageAuthorizationForBilling(db, claim.authorizationId, claim.patientId);
      hasApprovedLoa = !!auth && (auth.status === 'approved' || auth.status === 'partial');
    }
    if (!hasApprovedLoa) {
      warnings.push('NO_APPROVED_LOA');
    }
  }

  if (body.status === 'denied') {
    updateFields.decisionAt = new Date();
    if (body.denialReason !== undefined) updateFields.denialReason = body.denialReason;
  }
  if (body.status === 'approved') {
    updateFields.decisionAt = new Date();
  }
  if (body.status === 'paid') {
    updateFields.paidAt = new Date();
  }

  const updated = await repo.update(claimId, updateFields);
  logger?.info(
    { action: 'updateInsuranceClaimStatus', claimId, from: current, to: body.status, warnings },
    'Insurance claim status updated',
  );
  return ctx.json({ ...updated, warnings }, 200);
}
