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
import { cascadeChartLockFromVisit } from './utils/perio-lock-cascade';
import { computeReadingCal } from './utils/perio-cal';
import { getVisitForPerio } from '@/handlers/dental-visit/repos/visit-perio.facade';
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
  let chart = await chartRepo.findOneById(chartId);
  if (!chart) throw new NotFoundError('Perio chart');

  // BR-P06: any branch member with clinical access can read.
  // staff_scheduling excluded per MODULE_SPEC §6 — perio data is clinical.
  await assertBranchRole(db, user.id, chart.branchId, [
    'dentist_owner',
    'dentist_associate',
    'hygienist',
    'staff_full',
  ]);

  // V-PER-007: reconcile chart lock against authoritative parent-visit state.
  const visit = await getVisitForPerio(db, chart.visitId);
  if (visit) {
    chart = await cascadeChartLockFromVisit(db, ctx.get('logger'), chart, visit.status, user.id);
  }

  const readingRepo = new PerioReadingRepository(db);
  const readings = await readingRepo.findMany({ chartId });

  // P1-5: attach read-only per-site CAL (derived from PD + gingival margin).
  const readingsWithCal = readings.map((r) => ({ ...r, ...computeReadingCal(r) }));

  return ctx.json({ ...chart, readings: readingsWithCal });
}
