/**
 * listTreatmentOptionGroup —
 *   GET /dental/patients/:patientId/treatment-options/:optionGroupId
 *
 * P1-19: list the alternate-case options in a group (e.g. implant vs bridge) so the
 * UI can present "Option A / Option B" with the recommended one flagged.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { TreatmentPlanRepository } from '../repos/treatment-plan.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listTreatmentOptionGroup(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, optionGroupId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  const repo = new TreatmentPlanRepository(db, logger);
  const options = await repo.findOptionGroup(optionGroupId, patientId);
  if (options.length === 0) throw new NotFoundError('Treatment option group not found');

  return ctx.json({ optionGroupId, options }, 200);
}
