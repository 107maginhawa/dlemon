/**
 * listPatientTreatmentPlans — GET /dental/patients/:patientId/treatment-plans
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { logAuditEvent } from '@/core/audit-logger';
import { TreatmentPlanRepository } from '../repos/treatment-plan.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function listPatientTreatmentPlans(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param') as { patientId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  const repo = new TreatmentPlanRepository(db, logger);
  const plans = await repo.findByPatientId(patientId);

  // EF-PAT-005: audit READ access to treatment plans
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: patient.preferredBranchId ?? patientId,
    action: 'patient.treatment_plans.read',
    resourceType: 'dental_patient_treatment_plans',
    resourceId: patientId,
  });

  return ctx.json(plans, 200);
}
