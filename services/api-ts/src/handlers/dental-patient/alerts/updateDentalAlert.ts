/**
 * updateDentalAlert — PATCH /dental/patients/:patientId/dental-alerts/:alertId
 *
 * alt01: Update severity, description, or active status of a dental alert.
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { DentalAlertRepository } from '../repos/dental-alert.repo';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';
import type { UpdateDentalAlertParams, UpdateDentalAlertBody } from '@/generated/openapi/validators';

export async function updateDentalAlert(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, alertId } = ctx.req.valid('param') as UpdateDentalAlertParams;
  const body = ctx.req.valid('json') as UpdateDentalAlertBody;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // EF-PAT-001: block writes on archived patients
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

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
