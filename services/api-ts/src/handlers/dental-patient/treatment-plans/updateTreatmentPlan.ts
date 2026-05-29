/**
 * updateTreatmentPlan — PATCH /dental/patients/:patientId/treatment-plans/:planId
 *
 * AC-003..AC-008: Update plan fields and enforce FSM for status transitions.
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { TreatmentPlanRepository } from '../repos/treatment-plan.repo';
import { TREATMENT_PLAN_FSM, type TreatmentPlanStatus } from '../repos/treatment-plan.schema';
import type { DatabaseInstance } from '@/core/database';

export async function updateTreatmentPlan(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, planId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-001: block writes on archived patients
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const repo = new TreatmentPlanRepository(db, logger);
  const existing = await repo.findOneById(planId, patientId);
  if (!existing) throw new NotFoundError('Treatment plan not found');

  const updates: Record<string, unknown> = {};

  if (body['totalEstimateCents'] !== undefined) updates['totalEstimateCents'] = body['totalEstimateCents'];
  if (body['notes'] !== undefined) updates['notes'] = body['notes'];

  if (body['status'] !== undefined) {
    const from = existing.status as TreatmentPlanStatus;
    const to = body['status'] as TreatmentPlanStatus;
    const allowed = TREATMENT_PLAN_FSM[from];

    if (!allowed.includes(to)) {
      throw new BusinessLogicError(
        `Invalid plan status transition: ${from} → ${to}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
        'PLAN_INVALID_TRANSITION',
      );
    }

    updates['status'] = to;
    if (to === 'presented') updates['presentedAt'] = new Date();
    if (to === 'approved') updates['approvedAt'] = new Date();
  }

  const plan = await repo.update(planId, patientId, updates as any);
  if (!plan) throw new NotFoundError('Treatment plan not found');

  logger?.info({ action: 'updateTreatmentPlan', patientId, planId, updates }, 'Treatment plan updated');

  return ctx.json(plan, 200);
}
