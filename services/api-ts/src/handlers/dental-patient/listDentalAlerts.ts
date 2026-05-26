/**
 * listDentalAlerts — GET /dental/patients/:patientId/dental-alerts
 *
 * alt01: List all dental alerts (active + inactive) for a patient.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PatientRepository } from '@/handlers/patient/repos/patient.repo';
import { DentalAlertRepository } from './repos/dental-alert.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listDentalAlerts(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patientRepo = new PatientRepository(db, logger);
  const patient = await patientRepo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const alertRepo = new DentalAlertRepository(db, logger);
  const alerts = await alertRepo.findByPatientId(patientId);

  return ctx.json(alerts);
}
