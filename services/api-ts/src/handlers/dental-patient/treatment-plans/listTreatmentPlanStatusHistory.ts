/**
 * listTreatmentPlanStatusHistory —
 *   GET /dental/patients/:patientId/treatment-plans/:planId/status-history
 *
 * P2-8: returns the chronological status-transition timeline for a plan
 * (who / when / from → to). Read access is audited (EF-PAT-005).
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { logAuditEvent } from '@/core/audit-logger';
import { TreatmentPlanRepository } from '../repos/treatment-plan.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listTreatmentPlanStatusHistory(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, planId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  const repo = new TreatmentPlanRepository(db, logger);
  const plan = await repo.findOneById(planId, patientId);
  if (!plan) throw new NotFoundError('Treatment plan not found');

  const history = await repo.findStatusHistoryByPlanId(planId);

  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: patient.preferredBranchId ?? patientId,
    action: 'patient.treatment_plan_status_history.read',
    resourceType: 'dental_treatment_plan_status_history',
    resourceId: planId,
  });

  return ctx.json(history, 200);
}
