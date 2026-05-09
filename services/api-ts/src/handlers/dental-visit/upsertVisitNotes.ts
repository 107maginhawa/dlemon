/**
 * upsertVisitNotes handler
 *
 * POST /dental/visits/{visitId}/notes
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { VisitNotesRepository } from './repos/treatment.repo';
import { VisitRepository } from './repos/visit.repo';
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
  await assertBranchAccess(db, user.id, visit.branchId);

  const repo = new VisitNotesRepository(db);

  const notes = await repo.upsert({
    visitId,
    authorMemberId: user.id,
    subjective: body.subjective,
    objective: body.objective,
    assessment: body.assessment,
    plan: body.plan,
    notes: body.notes,
  });

  return ctx.json(notes, 201);
}
