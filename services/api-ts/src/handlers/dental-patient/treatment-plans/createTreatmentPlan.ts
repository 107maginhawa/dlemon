/**
 * createTreatmentPlan — POST /dental/patients/:patientId/treatment-plans
 *
 * AC-001: Create a plan header entity in 'draft' status.
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { TreatmentPlanRepository } from '../repos/treatment-plan.repo';
import { DEFAULT_CDT_CODE_SET_YEAR } from '../repos/treatment-plan.schema';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function createTreatmentPlan(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param') as { patientId: string };
  const body = ctx.req.valid('json') as { providerId: string; totalEstimateCents?: number; notes?: string | null; cdtCodeSetYear?: number };

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

  const repo = new TreatmentPlanRepository(db, logger);
  const plan = await repo.create({
    patientId,
    providerId: body.providerId,
    status: 'draft',
    totalEstimateCents: body.totalEstimateCents ?? 0,
    notes: body.notes ?? null,
    // P2-10: stamp the CDT code-set year (caller override, else current default).
    cdtCodeSetYear: body.cdtCodeSetYear ?? DEFAULT_CDT_CODE_SET_YEAR,
    createdBy: user.id,
    updatedBy: user.id,
  });

  // P2-8: seed the status-history timeline with the initial draft creation event.
  await repo.recordStatusHistory({
    treatmentPlanId: plan.id,
    fromStatus: null,
    toStatus: 'draft',
    changedByPersonId: user.id,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createTreatmentPlan', patientId, planId: plan.id }, 'Treatment plan created');

  return ctx.json(plan, 201);
}
