/**
 * getDentalChart handler
 *
 * GET /dental/visits/{visitId}/chart
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalChartRepository } from './repos/dental-chart.repo';
import type { User } from '@/types/auth';

export async function getDentalChart(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalChartRepository(db);

  const chart = await repo.findByVisit(visitId);
  if (!chart) throw new NotFoundError('Dental chart');

  return ctx.json(chart);
}
