/**
 * listPatientRecalls — GET /dental/patients/:patientId/recalls
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PatientRepository } from '@/handlers/patient/repos/patient.repo';
import { RecallRepository } from './repos/recall.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listPatientRecalls(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patientRepo = new PatientRepository(db, logger);
  const patient = await patientRepo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const recallRepo = new RecallRepository(db, logger);
  const recalls = await recallRepo.findByPatientId(patientId);

  return ctx.json(recalls, 200);
}
