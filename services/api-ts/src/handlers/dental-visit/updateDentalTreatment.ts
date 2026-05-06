/**
 * updateDentalTreatment handler
 *
 * PATCH /dental/visits/{visitId}/treatments/{treatmentId}
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { TreatmentRepository } from './repos/treatment.repo';
import { VisitRepository } from './repos/visit.repo';
import type { DentalTreatment } from './repos/treatment.schema';
import type { User } from '@/types/auth';
import type { UpdateDentalTreatmentBody, UpdateDentalTreatmentParams } from '@/generated/openapi/validators';

export async function updateDentalTreatment(
  ctx: ValidatedContext<UpdateDentalTreatmentBody, never, UpdateDentalTreatmentParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { treatmentId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new TreatmentRepository(db);

  const treatment = await repo.findOneById(treatmentId);
  if (!treatment) throw new NotFoundError('Dental treatment');

  // Branch authorization — look up visit to get branchId
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(treatment.visitId);
  if (visit) await assertBranchAccess(db, user.id, visit.branchId);

  // Dismiss with reason
  if (body.status === 'dismissed') {
    const reason = body.dismissReason ?? 'Dismissed';
    const dismissed = await repo.dismiss(treatmentId, reason);
    return ctx.json(dismissed);
  }

  const patch: Partial<Pick<DentalTreatment, 'status' | 'toothNumber' | 'surfaces' | 'cdtCode' | 'description' | 'conditionCode'>> = {};
  if (body.status) patch.status = body.status as DentalTreatment['status'];
  if (body.toothNumber !== undefined) patch.toothNumber = body.toothNumber;
  if (body.surfaces) patch.surfaces = body.surfaces;
  if (body.cdtCode) patch.cdtCode = body.cdtCode;
  if (body.description) patch.description = body.description;
  if (body.conditionCode) patch.conditionCode = body.conditionCode;

  const updated = await repo.update(treatmentId, patch);
  return ctx.json(updated);
}
