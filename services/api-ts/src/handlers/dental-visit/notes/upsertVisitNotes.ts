/**
 * upsertVisitNotes handler
 *
 * POST /dental/visits/{visitId}/notes
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { VisitNotesRepository } from '../repos/treatment.repo';
import { VisitRepository } from '../repos/visit.repo';
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
  // E2: dental_assistant may DRAFT visit notes under dentist supervision.
  // E3: on a hygiene-typed visit, the hygienist may ALSO draft (and sign — see
  // signVisitNotes) the notes. General visits stay dentist/assistant-scoped; the
  // hygienist is only added when the visit is hygiene-typed.
  const draftRoles =
    visit.visitType === 'hygiene'
      ? (['dentist_owner', 'dentist_associate', 'dental_assistant', 'hygienist'] as const)
      : (['dentist_owner', 'dentist_associate', 'dental_assistant'] as const);
  await assertBranchRole(db, user.id, visit.branchId, [...draftRoles]);

  // EM-VIS-007: completed OR locked visits cannot be modified — lock gate
  if (visit.status === 'completed' || visit.status === 'locked') {
    throw new BusinessLogicError('Visit is immutable and cannot be modified', 'VISIT_IMMUTABLE');
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
