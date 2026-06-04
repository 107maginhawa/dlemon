/**
 * recordMedicalHistoryReview handler (P1-4)
 *
 * POST /dental/clinical/medical-history-review
 *
 * Records an ASA Physical Status classification and a re-confirmation timestamp
 * for a patient's medical history. Append-only: each call creates a new review
 * row (reviewedAt = now) so the "due for review" prompt can be derived from the
 * latest reviewedAt.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { MedicalHistoryReviewRepository } from '../repos/medical-history-review.repo';
import { getPatientForClinical } from '@/handlers/patient/repos/patient-clinical.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import type { RecordMedicalHistoryReviewBody } from '@/generated/openapi/validators';

export async function recordMedicalHistoryReview(
  ctx: ValidatedContext<RecordMedicalHistoryReviewBody>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via patient's preferred branch (mirrors
  // createMedicalHistoryEntry: dentist_owner/associate/staff_full).
  const patient = await getPatientForClinical(db, body.patientId);
  if (!patient) throw new NotFoundError('Patient');
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchRole(db, user.id, patient.preferredBranchId, ['dentist_owner', 'dentist_associate', 'staff_full']);

  const repo = new MedicalHistoryReviewRepository(db);

  const review = await repo.createOne({
    patientId: body.patientId,
    asaClassification: body.asaClassification,
    asaEmergency: body.asaEmergency ?? false,
    reviewedAt: new Date(),
  });

  return ctx.json(review, 201);
}
