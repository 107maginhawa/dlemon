/**
 * listPatientClaims — GET /dental/patients/:patientId/claims
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PatientRepository } from '@/handlers/patient/repos/patient.repo';
import { ClaimDraftRepository } from './repos/claim-draft.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listPatientClaims(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patientRepo = new PatientRepository(db, logger);
  const patient = await patientRepo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const repo = new ClaimDraftRepository(db, logger);
  const claims = await repo.findByPatientId(patientId);

  return ctx.json(claims, 200);
}
