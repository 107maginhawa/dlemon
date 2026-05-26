/**
 * getPerioChart
 *
 * GET /dental/perio-charts/{chartId}
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PerioChartRepository } from './repos/perio-chart.repo';
import { PerioReadingRepository } from './repos/perio-reading.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import type { GetPerioChartParams } from '@/generated/openapi/validators';

export async function getPerioChart(
  ctx: ValidatedContext<never, never, GetPerioChartParams>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { chartId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  const chartRepo = new PerioChartRepository(db);
  const chart = await chartRepo.findOneById(chartId);
  if (!chart) throw new NotFoundError('Perio chart');

  // BR-P06: any branch member can read.
  await assertBranchRole(db, user.id, chart.branchId, [
    'dentist_owner',
    'dentist_associate',
    'hygienist',
    'staff_full',
    'staff_scheduling',
  ]);

  const readingRepo = new PerioReadingRepository(db);
  const readings = await readingRepo.findMany({ chartId });

  return ctx.json({ ...chart, readings });
}
