/**
 * getVisitNoteHistory handler
 *
 * GET /dental/visits/{visitId}/notes/history
 *
 * Returns all immutable version snapshots for a visit note,
 * ordered by version ascending (v1 = original sign, v2+ = addenda).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { VisitNotesRepository } from './repos/treatment.repo';
import { VisitRepository } from './repos/visit.repo';
import type { User } from '@/types/auth';
import type { GetVisitNoteHistoryParams } from '@/generated/openapi/validators';

export async function getVisitNoteHistory(
  ctx: ValidatedContext<never, never, GetVisitNoteHistoryParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  const repo = new VisitNotesRepository(db);
  const note = await repo.findByVisit(visitId);
  if (!note) throw new NotFoundError('Visit note');

  const versions = await repo.history(note.id);

  return ctx.json(versions);
}
