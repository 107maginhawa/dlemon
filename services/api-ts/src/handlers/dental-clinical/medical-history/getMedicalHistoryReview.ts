/**
 * getMedicalHistoryReview handler (P1-4)
 *
 * GET /dental/clinical/medical-history-review?patientId=...
 *
 * Returns the patient's most recent medical-history review (ASA classification +
 * last-reviewed timestamp). 404 when the patient has never been reviewed, so the
 * client can render a "review never recorded — due now" state.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError, NotFoundError, ForbiddenError } from '@/core/errors';
import { MedicalHistoryReviewRepository } from '../repos/medical-history-review.repo';
import { getPatientForClinical } from '@/handlers/patient/repos/patient-clinical.facade';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { User } from '@/types/auth';

export async function getMedicalHistoryReview(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.query('patientId');
  if (!patientId) throw new ValidationError('patientId query parameter is required');

  const db = ctx.get('database') as DatabaseInstance;

  const patient = await getPatientForClinical(db, patientId);
  if (!patient) throw new NotFoundError('Patient');
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchAccess(db, user.id, patient.preferredBranchId);

  const repo = new MedicalHistoryReviewRepository(db);
  const review = await repo.findLatestByPatient(patientId);
  if (!review) throw new NotFoundError('Medical history review');

  return ctx.json(review);
}
