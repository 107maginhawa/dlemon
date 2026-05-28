/**
 * listOcclusionScreenings — GET /dental/patients/:patientId/occlusion-screenings
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForClinical } from '@/handlers/patient/repos/patient-clinical.facade';
import { OcclusionScreeningRepository } from './repos/occlusion-screening.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listOcclusionScreenings(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForClinical(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const repo = new OcclusionScreeningRepository(db, logger);
  const screenings = await repo.findByPatientId(patientId);

  return ctx.json(screenings);
}
