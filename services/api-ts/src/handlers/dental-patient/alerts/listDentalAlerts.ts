/**
 * listDentalAlerts — GET /dental/patients/:patientId/dental-alerts
 *
 * alt01: List all dental alerts (active + inactive) for a patient.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { logAuditEvent } from '@/core/audit-logger';
import { DentalAlertRepository } from '../repos/dental-alert.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';
import type { ListDentalAlertsParams } from '@/generated/openapi/validators';

export async function listDentalAlerts(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param') as ListDentalAlertsParams;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  const alertRepo = new DentalAlertRepository(db, logger);
  const alerts = await alertRepo.findByPatientId(patientId);

  // EF-PAT-005: audit READ access to patient alerts
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: patient.preferredBranchId ?? patientId,
    action: 'patient.alerts.read',
    resourceType: 'dental_patient_alerts',
    resourceId: patientId,
  });

  return ctx.json(alerts);
}
