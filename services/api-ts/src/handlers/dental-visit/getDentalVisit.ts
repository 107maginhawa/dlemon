/**
 * getDentalVisit handler
 *
 * GET /dental/visits/{visitId}
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { VisitRepository } from './repos/visit.repo';
import type { User } from '@/types/auth';

export async function getDentalVisit(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new VisitRepository(db);

  const visit = await repo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');

  await assertBranchAccess(db, user.id, visit.branchId);

  return ctx.json(visit);
}
