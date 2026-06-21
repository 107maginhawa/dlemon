/**
 * updateDentalFinding handler — P0-C
 *
 * PATCH /dental/visits/{visitId}/findings/{findingId}
 *
 * Edits a finding or resolves it (status='resolved' → stops rendering as active).
 */
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { VisitRepository } from './repos/visit.repo';
import { DentalFindingRepository } from './repos/dental-finding.repo';
import type { ConditionCode, FindingStatus } from './repos/dental-finding.schema';
import type { UpdateDentalFindingBody, UpdateDentalFindingParams } from '@/generated/openapi/validators';
import type { User } from '@/types/auth';

export async function updateDentalFinding(
  ctx: ValidatedContext<UpdateDentalFindingBody, never, UpdateDentalFindingParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId, findingId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const visit = await new VisitRepository(db).findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'hygienist', 'dental_assistant']);

  // BR-003: a completed/locked visit's clinical record is immutable. createDentalFinding
  // blocks ADDing a finding to such a visit; editing one is the same mutation and is blocked
  // the same way.
  if (visit.status === 'completed' || visit.status === 'locked') {
    throw new BusinessLogicError(`Cannot edit findings on a ${visit.status} visit`, 'VISIT_IMMUTABLE');
  }

  const repo = new DentalFindingRepository(db);
  const finding = await repo.findById(findingId);
  if (!finding || finding.visitId !== visitId) throw new NotFoundError('Finding');

  // 'other' must keep a note: changing to 'other' without a note (and none stored)
  // is rejected for the same reason create enforces it.
  const nextCode = (body.conditionCode ?? finding.conditionCode) as ConditionCode;
  const nextNote = body.note !== undefined ? body.note : finding.note;
  if (nextCode === 'other' && !nextNote?.trim()) {
    throw new ValidationError("A note is required when conditionCode is 'other'");
  }

  const updated = await repo.updateOne(findingId, {
    conditionCode: body.conditionCode as ConditionCode | undefined,
    surface: body.surface,
    note: body.note,
    status: body.status as FindingStatus | undefined,
    updatedBy: user.id,
  });

  return ctx.json(updated ?? finding, 200);
}
