/**
 * updateDentalAlert — PATCH /dental/patients/:patientId/dental-alerts/:alertId
 *
 * alt01: Update severity, description, or active status of a dental alert.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalAlertRepository } from '../repos/dental-alert.repo';
import type { DatabaseInstance } from '@/core/database';

export async function updateDentalAlert(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, alertId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const alertRepo = new DentalAlertRepository(db, logger);
  const existing = await alertRepo.findOneById(alertId, patientId);
  if (!existing) throw new NotFoundError('Dental alert not found');

  const updated = await alertRepo.update(alertId, patientId, {
    ...(body.alertType !== undefined && { alertType: body.alertType }),
    ...(body.severity !== undefined && { severity: body.severity }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.active !== undefined && { active: body.active }),
  });

  logger?.info({ action: 'updateDentalAlert', patientId, alertId }, 'Dental alert updated');

  return ctx.json(updated);
}
