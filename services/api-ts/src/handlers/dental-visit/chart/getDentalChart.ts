/**
 * getDentalChart handler
 *
 * GET /dental/visits/{visitId}/chart
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { DentalChartRepository } from '../repos/dental-chart.repo';
import { DentalChartBaselineRepository } from '../repos/dental-chart-baseline.repo';
import { VisitRepository } from '../repos/visit.repo';
import { chartFromBaseline } from './chart-carryover';
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
  if (chart) return ctx.json(chart);

  // Living-document carry-over: a visit with no chart row of its own inherits the
  // patient's cumulative existing dentition from the baseline (returning patient).
  // Only a brand-new patient with no baseline gets a 404 → FE "Initialize Dentition".
  const baseline = await new DentalChartBaselineRepository(db).findByPatient(visit.patientId);
  if (baseline) {
    return ctx.json(chartFromBaseline(baseline, { id: visitId, patientId: visit.patientId }));
  }

  throw new NotFoundError('Dental chart');
}
