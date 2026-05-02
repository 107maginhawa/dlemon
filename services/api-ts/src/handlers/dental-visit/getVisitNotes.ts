/**
 * getVisitNotes handler
 *
 * GET /dental/visits/{visitId}/notes
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { VisitNotesRepository } from './repos/treatment.repo';
import type { User } from '@/types/auth';

export async function getVisitNotes(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new VisitNotesRepository(db);

  const notes = await repo.findByVisit(visitId);
  if (!notes) throw new NotFoundError('Visit notes');

  return ctx.json(notes);
}
