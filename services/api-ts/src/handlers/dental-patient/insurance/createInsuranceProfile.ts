/**
 * createInsuranceProfile — POST /dental/patients/:patientId/insurance-profiles
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { InsuranceProfileRepository } from '../repos/insurance-profile.repo';
import type { DatabaseInstance } from '@/core/database';

export async function createInsuranceProfile(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  // EF-PAT-001: block writes on archived patients
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const repo = new InsuranceProfileRepository(db, logger);
  const profile = await repo.create({
    patientId,
    insurerName: body.insurerName,
    policyNumber: body.policyNumber,
    groupNumber: body.groupNumber ?? null,
    subscriberName: body.subscriberName,
    subscriberDob: body.subscriberDob ?? null,
    relationship: body.relationship ?? 'self',
    active: true,
    notes: body.notes ?? null,
    // P1-26 PH payer fields (additive)
    payerType: body.payerType ?? 'hmo',
    accredited: body.accredited ?? null,
    annualLimitCents: body.annualLimitCents ?? null,
    annualLimitUsedCents: body.annualLimitUsedCents ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createInsuranceProfile', patientId, profileId: profile.id }, 'Insurance profile created');

  return ctx.json(profile, 201);
}
