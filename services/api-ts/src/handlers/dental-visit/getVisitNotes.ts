/**
 * getVisitNotes handler
 *
 * GET /dental/visits/{visitId}/notes
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { VisitNotesRepository } from './repos/treatment.repo';
import { VisitRepository } from './repos/visit.repo';
import type { User } from '@/types/auth';

export async function getVisitNotes(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const db = ctx.get('database') as DatabaseInstance;

  // Branch authorization — look up visit to get branchId
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const repo = new VisitNotesRepository(db);
  const notes = await repo.findByVisit(visitId);
  if (!notes) throw new NotFoundError('Visit notes');

  const history = await repo.history(notes.id);

  return ctx.json({ ...notes, history });
}
