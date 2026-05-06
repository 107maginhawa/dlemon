/**
 * upsertVisitNotes handler
 *
 * POST /dental/visits/{visitId}/notes
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { VisitNotesRepository } from './repos/treatment.repo';
import { VisitRepository } from './repos/visit.repo';
import type { User } from '@/types/auth';

export async function upsertVisitNotes(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

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
    subjective: typeof body['subjective'] === 'string' ? body['subjective'] : undefined,
    objective: typeof body['objective'] === 'string' ? body['objective'] : undefined,
    assessment: typeof body['assessment'] === 'string' ? body['assessment'] : undefined,
    plan: typeof body['plan'] === 'string' ? body['plan'] : undefined,
    notes: typeof body['notes'] === 'string' ? body['notes'] : undefined,
  });

  return ctx.json(notes, 201);
}
