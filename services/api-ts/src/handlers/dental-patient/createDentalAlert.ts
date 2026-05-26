/**
 * createDentalAlert — POST /dental/patients/:patientId/dental-alerts
 *
 * alt01: Create a dental-specific alert for a patient (active: true by default).
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PatientRepository } from '@/handlers/patient/repos/patient.repo';
import { DentalAlertRepository } from './repos/dental-alert.repo';
import type { DatabaseInstance } from '@/core/database';

export async function createDentalAlert(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patientRepo = new PatientRepository(db, logger);
  const patient = await patientRepo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const alertRepo = new DentalAlertRepository(db, logger);
  const alert = await alertRepo.create({
    patientId,
    alertType: body.alertType,
    severity: body.severity ?? 'medium',
    description: body.description ?? null,
    active: true,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createDentalAlert', patientId, alertId: alert.id }, 'Dental alert created');

  return ctx.json(alert, 201);
}
