/**
 * rejectCasePresentation —
 *   POST /dental/patients/:patientId/case-presentations/:presentationId/reject
 *
 * P1-20 (Phase 1, staff bearerAuth): the patient declines the presented case. We
 * transition the plan presented → rejected (P2-8 terminal state) through
 * TREATMENT_PLAN_FSM (+ a status-history row), persist the optional reason, and mark
 * the presentation decision = rejected (terminal — re-deciding is 422). The clinician
 * can present a NEW version later (new presentation row).
 */

import {
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  BusinessLogicError,
} from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { CasePresentationRepository } from '../repos/case-presentation.repo';
import { TreatmentPlanRepository } from '../repos/treatment-plan.repo';
import { TREATMENT_PLAN_FSM } from '../repos/treatment-plan.schema';
import type { DatabaseInstance } from '@/core/database';

export async function rejectCasePresentation(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, presentationId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const repo = new CasePresentationRepository(db, logger);
  const presentation = await repo.findOneById(presentationId, patientId);
  if (!presentation) throw new NotFoundError('Case presentation not found');

  if (presentation.decision) {
    throw new BusinessLogicError(
      'Case presentation has already been decided and cannot be changed',
      'PRESENTATION_DECIDED',
    );
  }

  const planRepo = new TreatmentPlanRepository(db, logger);
  const plan = await planRepo.findOneById(presentation.treatmentPlanId, patientId);
  if (!plan) throw new NotFoundError('Treatment plan not found');

  // FSM guard: reject is only legal from 'presented' → 'rejected'.
  if (!TREATMENT_PLAN_FSM[plan.status].includes('rejected')) {
    throw new BusinessLogicError(
      `Cannot reject a plan in status '${plan.status}' (reject requires 'presented')`,
      'PLAN_INVALID_TRANSITION',
    );
  }

  const updatedPlan = await planRepo.update(plan.id, patientId, { status: 'rejected' });
  await planRepo.recordStatusHistory({
    treatmentPlanId: plan.id,
    fromStatus: plan.status,
    toStatus: 'rejected',
    changedByPersonId: user.id,
    createdBy: user.id,
    updatedBy: user.id,
  });

  const decided = await repo.decide(presentationId, patientId, 'rejected', {
    rejectionReason: body.rejectionReason ?? null,
  });
  if (!decided) {
    throw new BusinessLogicError(
      'Case presentation has already been decided and cannot be changed',
      'PRESENTATION_DECIDED',
    );
  }

  logger?.info(
    { action: 'rejectCasePresentation', patientId, presentationId, planId: plan.id },
    'Case presentation rejected',
  );

  return ctx.json({ presentation: decided, plan: updatedPlan }, 200);
}
