/**
 * updateInsuranceProfile — PATCH /dental/patients/:patientId/insurance-profiles/:profileId
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { InsuranceProfileRepository } from '../repos/insurance-profile.repo';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { DatabaseInstance } from '@/core/database';

export async function updateInsuranceProfile(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, profileId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // EF-PAT-001: block writes on archived patients
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization
  if (patient.preferredBranchId) {
    await assertBranchAccess(db, user.id, patient.preferredBranchId);
  }

  if (patient.status === 'archived') {
    throw new BusinessLogicError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const repo = new InsuranceProfileRepository(db, logger);
  const existing = await repo.findOneById(profileId, patientId);
  if (!existing) throw new NotFoundError('Insurance profile not found');

  const updated = await repo.update(profileId, patientId, {
    ...(body.insurerName !== undefined && { insurerName: body.insurerName }),
    ...(body.policyNumber !== undefined && { policyNumber: body.policyNumber }),
    ...(body.groupNumber !== undefined && { groupNumber: body.groupNumber }),
    ...(body.subscriberName !== undefined && { subscriberName: body.subscriberName }),
    ...(body.subscriberDob !== undefined && { subscriberDob: body.subscriberDob }),
    ...(body.relationship !== undefined && { relationship: body.relationship }),
    ...(body.active !== undefined && { active: body.active }),
    ...(body.notes !== undefined && { notes: body.notes }),
  });

  logger?.info({ action: 'updateInsuranceProfile', patientId, profileId }, 'Insurance profile updated');

  return ctx.json(updated, 200);
}
