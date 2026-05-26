/**
 * createClaimDraft — POST /dental/patients/:patientId/claims
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { PatientRepository } from '@/handlers/patient/repos/patient.repo';
import { InsuranceProfileRepository } from './repos/insurance-profile.repo';
import { ClaimDraftRepository } from './repos/claim-draft.repo';
import type { DatabaseInstance } from '@/core/database';

export async function createClaimDraft(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patientRepo = new PatientRepository(db, logger);
  const patient = await patientRepo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // Verify insuranceProfileId belongs to this patient
  const profileRepo = new InsuranceProfileRepository(db, logger);
  const profile = await profileRepo.findOneById(body.insuranceProfileId, patientId);
  if (!profile) throw new BusinessLogicError('Insurance profile not found for this patient');

  const claimRepo = new ClaimDraftRepository(db, logger);
  const claim = await claimRepo.create({
    patientId,
    insuranceProfileId: body.insuranceProfileId,
    visitId: body.visitId ?? null,
    cdtCode: body.cdtCode,
    icd10Code: body.icd10Code ?? null,
    diagnosisDescription: body.diagnosisDescription ?? null,
    feeAmountCents: body.feeAmountCents,
    status: 'draft',
    submittedAt: null,
    notes: body.notes ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createClaimDraft', patientId, claimId: claim.id }, 'Claim draft created');

  return ctx.json(claim, 201);
}
