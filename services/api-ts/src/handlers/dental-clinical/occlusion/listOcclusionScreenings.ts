/**
 * listOcclusionScreenings — GET /dental/patients/:patientId/occlusion-screenings
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getPatientForClinical } from '@/handlers/patient/repos/patient-clinical.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { OcclusionScreeningRepository } from '../repos/occlusion-screening.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function listOcclusionScreenings(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param') as { patientId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForClinical(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // Branch-level authorization via patient's preferred branch (read)
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchRole(db, user.id, patient.preferredBranchId, ['dentist_owner', 'dentist_associate', 'staff_full', 'hygienist']);

  const repo = new OcclusionScreeningRepository(db, logger);
  const screenings = await repo.findByPatientId(patientId);

  return ctx.json(screenings);
}
