/**
 * listPatientTreatmentPlans — GET /dental/patients/:patientId/treatment-plans
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PatientRepository } from '@/handlers/patient/repos/patient.repo';
import { TreatmentPlanRepository } from './repos/treatment-plan.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listPatientTreatmentPlans(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patientRepo = new PatientRepository(db, logger);
  const patient = await patientRepo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const repo = new TreatmentPlanRepository(db, logger);
  const plans = await repo.findByPatientId(patientId);

  return ctx.json(plans, 200);
}
