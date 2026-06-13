/**
 * getCasePresentation —
 *   GET /dental/patients/:patientId/case-presentations/:presentationId
 *
 * P1-20 (Phase 1, staff bearerAuth): return the denormalized, patient-readable
 * aggregate (phased ₱ breakdown + alternates + annotated-image refs + first name)
 * and record engagement telemetry (firstViewedAt once, lastViewedAt each time,
 * draft/sent → viewed).
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { CasePresentationRepository } from '../repos/case-presentation.repo';
import { getPatientFirstName } from '../repos/patient-name.facade';
import { TreatmentPlanRepository } from '../repos/treatment-plan.repo';
import { buildCasePresentationAggregate } from './aggregate';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';
import type { GetCasePresentationParams } from '@/generated/openapi/validators';

export async function getCasePresentation(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, presentationId } = ctx.req.valid('param') as GetCasePresentationParams;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  // E1: reads stay broad — see listCasePresentations. Schedule-only / read-only-
  // observer roles are excluded.
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchRole(db, user.id, patient.preferredBranchId, [
    'dentist_owner', 'dentist_associate', 'hygienist', 'treatment_coordinator',
    'staff_full', 'front_desk', 'dental_assistant', 'billing_staff',
  ]);

  const repo = new CasePresentationRepository(db, logger);
  const presentation = await repo.findOneById(presentationId, patientId);
  if (!presentation) throw new NotFoundError('Case presentation not found');

  const planRepo = new TreatmentPlanRepository(db, logger);
  const plan = await planRepo.findOneById(presentation.treatmentPlanId, patientId);
  if (!plan) throw new NotFoundError('Treatment plan not found');

  const firstName = await getPatientFirstName(db, patientId);
  const aggregate = await buildCasePresentationAggregate(db, repo, presentation, plan, firstName);

  // Engagement telemetry — record the view (does not mutate a terminal decision).
  await repo.recordView(presentation);

  logger?.info(
    { action: 'getCasePresentation', patientId, presentationId },
    'Case presentation viewed',
  );

  return ctx.json(aggregate, 200);
}
