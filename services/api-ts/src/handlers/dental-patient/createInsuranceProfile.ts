/**
 * createInsuranceProfile — POST /dental/patients/:patientId/insurance-profiles
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PatientRepository } from '@/handlers/patient/repos/patient.repo';
import { InsuranceProfileRepository } from './repos/insurance-profile.repo';
import type { DatabaseInstance } from '@/core/database';

export async function createInsuranceProfile(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patientRepo = new PatientRepository(db, logger);
  const patient = await patientRepo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

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
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createInsuranceProfile', patientId, profileId: profile.id }, 'Insurance profile created');

  return ctx.json(profile, 201);
}
