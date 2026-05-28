/**
 * listDentalAlerts — GET /dental/patients/:patientId/dental-alerts
 *
 * alt01: List all dental alerts (active + inactive) for a patient.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { DentalAlertRepository } from './repos/dental-alert.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listDentalAlerts(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const alertRepo = new DentalAlertRepository(db, logger);
  const alerts = await alertRepo.findByPatientId(patientId);

  return ctx.json(alerts);
}
