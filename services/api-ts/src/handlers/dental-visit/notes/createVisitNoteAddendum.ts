/**
 * createVisitNoteAddendum handler
 *
 * POST /dental/visits/{visitId}/notes/addendum
 *
 * Appends an immutable addendum version to a signed visit note.
 * Requires `reason` (mandatory) and `content`. Each addendum increments
 * the version counter. The snapshot JSON IS the audit trail.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { VisitNotesRepository } from '../repos/treatment.repo';
import { VisitRepository } from '../repos/visit.repo';
import type { User } from '@/types/auth';
import type { CreateVisitNoteAddendumBody, CreateVisitNoteAddendumParams } from '@/generated/openapi/validators';

export async function createVisitNoteAddendum(
  ctx: ValidatedContext<CreateVisitNoteAddendumBody, never, CreateVisitNoteAddendumParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const { reason, content } = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'hygienist']);

  const repo = new VisitNotesRepository(db);
  const note = await repo.findByVisit(visitId);
  if (!note) throw new NotFoundError('Visit note');

  if (!note.signed) {
    throw new BusinessLogicError('Visit note must be signed before adding an addendum', 'NOTE_NOT_SIGNED');
  }

  const version = await repo.addendum(note.id, content, reason, user.id);

  ctx.get('logger')?.info(
    { requestId: ctx.get('requestId'), action: 'visit_note_addendum', noteId: note.id, visitId, version: version.version, by: user.id },
    'Visit note addendum created',
  );

  return ctx.json(version, 201);
}
