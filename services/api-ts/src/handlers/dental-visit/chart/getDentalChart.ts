/**
 * getDentalChart handler
 *
 * GET /dental/visits/{visitId}/chart
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { DentalChartRepository } from './repos/dental-chart.repo';
import { VisitRepository } from './repos/visit.repo';
import type { User } from '@/types/auth';

export async function getDentalChart(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const db = ctx.get('database') as DatabaseInstance;

  // Branch authorization — look up visit to get branchId
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const repo = new DentalChartRepository(db);
  const chart = await repo.findByVisit(visitId);
  if (!chart) throw new NotFoundError('Dental chart');

  return ctx.json(chart);
}
