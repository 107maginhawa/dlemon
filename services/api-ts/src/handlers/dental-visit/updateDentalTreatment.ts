/**
 * updateDentalTreatment handler
 *
 * PATCH /dental/visits/{visitId}/treatments/{treatmentId}
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { TreatmentRepository } from './repos/treatment.repo';
import { VisitRepository } from './repos/visit.repo';
import type { DentalTreatment } from './repos/treatment.schema';
import type { User } from '@/types/auth';

const VALID_STATUSES = ['diagnosed', 'planned', 'performed', 'verified', 'dismissed'] as const;

export async function updateDentalTreatment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const treatmentId = ctx.req.param('treatmentId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new TreatmentRepository(db);

  const treatment = await repo.findOneById(treatmentId);
  if (!treatment) throw new NotFoundError('Dental treatment');

  // Branch authorization — look up visit to get branchId
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(treatment.visitId);
  if (visit) await assertBranchAccess(db, user.id, visit.branchId);

  // Validate status if provided
  if (body['status'] !== undefined && !VALID_STATUSES.includes(body['status'] as any)) {
    throw new ValidationError(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  // Dismiss with reason
  if (body['status'] === 'dismissed') {
    const reason = typeof body['dismissReason'] === 'string' ? body['dismissReason'] : 'Dismissed';
    const dismissed = await repo.dismiss(treatmentId, reason);
    return ctx.json(dismissed);
  }

  const patch: Partial<Pick<DentalTreatment, 'status' | 'toothNumber' | 'surfaces' | 'cdtCode' | 'description' | 'conditionCode'>> = {};
  if (body['status']) patch.status = body['status'] as DentalTreatment['status'];
  if (typeof body['toothNumber'] === 'number') patch.toothNumber = body['toothNumber'];
  if (Array.isArray(body['surfaces'])) patch.surfaces = body['surfaces'] as string[];
  if (typeof body['cdtCode'] === 'string') patch.cdtCode = body['cdtCode'];
  if (typeof body['description'] === 'string') patch.description = body['description'];
  if (typeof body['conditionCode'] === 'string') patch.conditionCode = body['conditionCode'];

  const updated = await repo.update(treatmentId, patch);
  return ctx.json(updated);
}
