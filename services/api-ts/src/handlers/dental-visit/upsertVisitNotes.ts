/**
 * upsertVisitNotes handler
 *
 * POST /dental/visits/{visitId}/notes
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { VisitNotesRepository } from './repos/treatment.repo';
import { VisitRepository } from './repos/visit.repo';
import { getActiveMembershipId } from '@/handlers/dental-org/repos/org-billing.facade';
import type { User } from '@/types/auth';
import type { UpsertVisitNotesBody, UpsertVisitNotesParams } from '@/generated/openapi/validators';

export async function upsertVisitNotes(
  ctx: ValidatedContext<UpsertVisitNotesBody, never, UpsertVisitNotesParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch authorization — look up visit to get branchId
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  if (visit.status === 'locked') {
    throw new BusinessLogicError('Locked visits cannot be modified', 'VISIT_LOCKED');
  }

  // Resolve membership ID from user's personId + visit's branchId
  const membership = await getActiveMembershipId(db, user.id, visit.branchId);
  if (!membership) throw new ForbiddenError('No active membership in this branch');

  const repo = new VisitNotesRepository(db);

  const notes = await repo.upsert({
    visitId,
    authorMemberId: membership.id,
    subjective: body.subjective,
    objective: body.objective,
    assessment: body.assessment,
    plan: body.plan,
    notes: body.notes,
  });

  return ctx.json(notes, 201);
}
