/**
 * createDentalAlert — POST /dental/patients/:patientId/dental-alerts
 *
 * alt01: Create a dental-specific alert for a patient (active: true by default).
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { DentalAlertRepository } from '../repos/dental-alert.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';
import type { CreateDentalAlertParams, CreateDentalAlertBody } from '@/generated/openapi/validators';

export async function createDentalAlert(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param') as CreateDentalAlertParams;
  const body = ctx.req.valid('json') as CreateDentalAlertBody;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  // EF-PAT-001: block writes on archived patients
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

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
