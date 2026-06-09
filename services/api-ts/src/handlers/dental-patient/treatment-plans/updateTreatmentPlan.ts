/**
 * updateTreatmentPlan — PATCH /dental/patients/:patientId/treatment-plans/:planId
 *
 * AC-003..AC-008: Update plan fields and enforce FSM for status transitions.
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { TreatmentPlanRepository } from '../repos/treatment-plan.repo';
import { TREATMENT_PLAN_FSM, type TreatmentPlanStatus, type DentalTreatmentPlan } from '../repos/treatment-plan.schema';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function updateTreatmentPlan(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, planId } = ctx.req.valid('param') as { patientId: string; planId: string };
  const body = ctx.req.valid('json') as Partial<Pick<DentalTreatmentPlan, 'status' | 'totalEstimateCents' | 'notes'>>;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // I1: branch-access floor — like every sibling treatment-plan handler, any
  // mutation requires active membership in the patient's branch (branchless
  // patient → Forbidden). This closes the cross-tenant hole where any
  // authenticated user could PATCH any patient's plan for non-presented
  // transitions. The presented transition layers an additional role gate below.
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  // EF-PAT-001: block writes on archived patients
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const repo = new TreatmentPlanRepository(db, logger);
  const existing = await repo.findOneById(planId, patientId);
  if (!existing) throw new NotFoundError('Treatment plan not found');

  const updates: Partial<Pick<DentalTreatmentPlan, 'status' | 'totalEstimateCents' | 'notes' | 'presentedAt' | 'approvedAt'>> = {};

  if (body.totalEstimateCents !== undefined) updates.totalEstimateCents = body.totalEstimateCents;
  if (body.notes !== undefined) updates.notes = body.notes;

  if (body.status !== undefined) {
    const from = existing.status as TreatmentPlanStatus;
    const to = body.status as TreatmentPlanStatus;
    const allowed = TREATMENT_PLAN_FSM[from];

    if (!allowed.includes(to)) {
      throw new BusinessLogicError(
        `Invalid plan status transition: ${from} → ${to}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
        'PLAN_INVALID_TRANSITION',
      );
    }

    updates.status = to;
    if (to === 'presented') {
      // E1: presenting a plan to the patient is a treatment-presentation action —
      // restrict to clinicians + the treatment coordinator. Other status
      // transitions retain existing access (no new gate introduced for them).
      if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
      await assertBranchRole(db, user.id, patient.preferredBranchId, [
        'dentist_owner', 'dentist_associate', 'treatment_coordinator',
      ]);
      updates.presentedAt = new Date();
      // case-presentation G1 (P0): link the patient's pending (diagnosed/planned)
      // treatments to the plan at the moment it is presented — mirroring
      // approveTreatmentPlan. Without this the case-presentation aggregate is
      // structurally empty (₱0/0 items) and accept throws PLAN_HAS_NO_ITEMS.
      // Idempotent: only unlinked treatments are claimed.
      await repo.linkPendingTreatments(planId, patientId);
    }
    if (to === 'approved') updates.approvedAt = new Date();
  }

  const plan = await repo.update(planId, patientId, updates);
  if (!plan) throw new NotFoundError('Treatment plan not found');

  // P2-8: append a status-history row whenever the status actually changes.
  if (body.status !== undefined && body.status !== existing.status) {
    await repo.recordStatusHistory({
      treatmentPlanId: planId,
      fromStatus: existing.status,
      toStatus: body.status as TreatmentPlanStatus,
      changedByPersonId: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    });
  }

  logger?.info({ action: 'updateTreatmentPlan', patientId, planId, updates }, 'Treatment plan updated');

  return ctx.json(plan, 200);
}
