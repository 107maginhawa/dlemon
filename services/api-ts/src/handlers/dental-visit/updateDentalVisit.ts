/**
 * updateDentalVisit handler
 *
 * PATCH /dental/visits/{visitId}
 * Updates visit status or chiefComplaint.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError, BusinessLogicError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { VisitRepository } from './repos/visit.repo';
import type { DentalVisitStatus } from './repos/visit.schema';
import type { User } from '@/types/auth';

const VALID_STATUSES: DentalVisitStatus[] = ['draft', 'active', 'completed', 'locked'];

export async function updateDentalVisit(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new VisitRepository(db);

  const visit = await repo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');

  await assertBranchAccess(db, user.id, visit.branchId);

  // FR1.16: Immutability — completed/locked visits cannot be modified
  if (visit.status === 'locked') {
    throw new BusinessLogicError('Locked visits cannot be modified', 'VISIT_LOCKED');
  }
  if (visit.status === 'completed' && body['status'] !== 'locked') {
    // Only allowed transition from completed is -> locked
    if (body['status'] !== undefined && body['status'] !== 'locked') {
      throw new BusinessLogicError('Completed visits can only be transitioned to locked', 'VISIT_IMMUTABLE');
    }
    // chiefComplaint edits also blocked on completed
    if (body['chiefComplaint'] !== undefined && body['status'] === undefined) {
      throw new BusinessLogicError('Completed visit notes cannot be edited', 'VISIT_IMMUTABLE');
    }
  }

  const patch: Partial<{ status: DentalVisitStatus; chiefComplaint: string }> = {};

  if (body['status'] !== undefined) {
    if (!VALID_STATUSES.includes(body['status'] as DentalVisitStatus)) {
      throw new ValidationError(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    patch.status = body['status'] as DentalVisitStatus;
  }

  if (typeof body['chiefComplaint'] === 'string') {
    patch.chiefComplaint = body['chiefComplaint'];
  }

  // Apply lifecycle timestamps on status transitions
  if (patch.status === 'active') {
    const updated = await repo.activate(visitId);
    if (patch.chiefComplaint) await repo.updateStatus(visitId, { chiefComplaint: patch.chiefComplaint });
    return ctx.json(updated);
  }

  if (patch.status === 'completed') {
    const updated = await repo.complete(visitId);
    if (patch.chiefComplaint) await repo.updateStatus(visitId, { chiefComplaint: patch.chiefComplaint });
    return ctx.json(updated);
  }

  if (patch.status === 'locked') {
    const updated = await repo.lock(visitId);
    return ctx.json(updated);
  }

  const updated = await repo.updateStatus(visitId, patch);
  return ctx.json(updated);
}
