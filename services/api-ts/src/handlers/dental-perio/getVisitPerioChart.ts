/**
 * getVisitPerioChart
 *
 * GET /dental/visits/{visitId}/perio-chart
 *
 * Returns 204 when no chart exists for the visit.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { PerioChartRepository } from './repos/perio-chart.repo';
import { PerioReadingRepository } from './repos/perio-reading.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import type { GetVisitPerioChartParams } from '@/generated/openapi/validators';

export async function getVisitPerioChart(
  ctx: ValidatedContext<never, never, GetVisitPerioChartParams>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  const visit = await getVisitOrThrow(db, visitId);

  await assertBranchRole(db, user.id, visit.branchId, [
    'dentist_owner',
    'dentist_associate',
    'hygienist',
    'staff_full',
    'staff_scheduling',
  ]);

  const chartRepo = new PerioChartRepository(db);
  const chart = await chartRepo.findByVisitId(visitId);

  if (!chart) {
    return new Response(null, { status: 204 });
  }

  const readingRepo = new PerioReadingRepository(db);
  const readings = await readingRepo.findMany({ chartId: chart.id });

  return ctx.json({ ...chart, readings });
}
