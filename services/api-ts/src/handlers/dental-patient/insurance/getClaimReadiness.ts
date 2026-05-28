/**
 * getClaimReadiness — GET /dental/patients/:patientId/claims/:claimId/readiness
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { ClaimDraftRepository } from '../repos/claim-draft.repo';
import { InsuranceProfileRepository } from '../repos/insurance-profile.repo';
import type { DatabaseInstance } from '@/core/database';

export async function getClaimReadiness(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, claimId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const claimRepo = new ClaimDraftRepository(db, logger);
  const claim = await claimRepo.findOneById(claimId, patientId);
  if (!claim) throw new NotFoundError('Claim draft not found');

  const hasCdtCode = !!(claim.cdtCode && claim.cdtCode.trim().length > 0);
  const hasIcd10Code = !!(claim.icd10Code && claim.icd10Code.trim().length > 0);
  const hasFee = claim.feeAmountCents > 0;

  // Check if insurance profile is active
  const profileRepo = new InsuranceProfileRepository(db, logger);
  const profile = await profileRepo.findOneByIdOnly(claim.insuranceProfileId);
  const hasInsuranceProfile = !!(profile && profile.active);

  const ready = hasCdtCode && hasIcd10Code && hasInsuranceProfile && hasFee;

  return ctx.json({
    claimId: claim.id,
    hasCdtCode,
    hasIcd10Code,
    hasInsuranceProfile,
    hasFee,
    ready,
  }, 200);
}
