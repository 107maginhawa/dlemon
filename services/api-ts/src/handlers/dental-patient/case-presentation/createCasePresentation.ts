/**
 * createCasePresentation — POST /dental/patients/:patientId/case-presentations
 *
 * P1-20 (Phase 1, staff bearerAuth): mint a patient-facing case presentation from a
 * *presented* treatment plan. The presentation is the patient-readable artifact the
 * clinician opens on the operatory iPad; it is created in 'draft' and bound to the
 * plan header (+ the optional immutable plan-version snapshot that was shown).
 *
 * The public shareable-link (by-token) path is DEFERRED to Phase 2 — this pass mints
 * no token and exposes no unauthenticated access.
 */

import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { TreatmentPlanRepository } from '../repos/treatment-plan.repo';
import { CasePresentationRepository } from '../repos/case-presentation.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';
import type { CreateCasePresentationParams, CreateCasePresentationBody } from '@/generated/openapi/validators';

export async function createCasePresentation(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param') as CreateCasePresentationParams;
  const body = ctx.req.valid('json') as CreateCasePresentationBody;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const planRepo = new TreatmentPlanRepository(db, logger);
  const plan = await planRepo.findOneById(body.treatmentPlanId, patientId);
  if (!plan) throw new NotFoundError('Treatment plan not found');

  // A presentation can only be built from a plan that has been presented to the
  // patient — a draft plan has nothing to present.
  if (plan.status !== 'presented') {
    throw new BusinessLogicError(
      `Plan must be 'presented' to create a case presentation (current: ${plan.status})`,
      'PLAN_NOT_PRESENTED',
    );
  }

  const repo = new CasePresentationRepository(db, logger);
  const presentation = await repo.create({
    patientId,
    treatmentPlanId: plan.id,
    planVersionId: body.planVersionId ?? null,
    status: 'draft',
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info(
    { action: 'createCasePresentation', patientId, presentationId: presentation.id, planId: plan.id },
    'Case presentation created',
  );

  return ctx.json(presentation, 201);
}
