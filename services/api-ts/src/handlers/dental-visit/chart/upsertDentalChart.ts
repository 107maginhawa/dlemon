/**
 * upsertDentalChart handler
 *
 * POST /dental/visits/{visitId}/chart
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { DentalChartRepository } from '../repos/dental-chart.repo';
import { DentalChartBaselineRepository } from '../repos/dental-chart-baseline.repo';
import type { ToothChartState } from '../repos/dental-chart.schema';
import { VisitRepository } from '../repos/visit.repo';
import type { User } from '@/types/auth';
import type { UpsertDentalChartBody, UpsertDentalChartParams } from '@/generated/openapi/validators';

export async function upsertDentalChart(
  ctx: ValidatedContext<UpsertDentalChartBody, never, UpsertDentalChartParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch authorization — look up visit to get branchId
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  // E2: dental_assistant may write chart CONDITIONS under dentist supervision.
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'hygienist', 'dental_assistant']);

  // EF-VIS-003: completed/locked visits cannot be modified — lock gate
  if (visit.status === 'completed' || visit.status === 'locked') {
    throw new BusinessLogicError('Visit is immutable and cannot be modified', 'VISIT_IMMUTABLE');
  }

  const repo = new DentalChartRepository(db);

  const chart = await repo.upsert({
    visitId,
    patientId: body.patientId,
    teeth: body.teeth as ToothChartState[],
    // GAP-001: persist optional client-generated id for offline-first idempotent sync.
    localId: body.localId,
  });

  await repo.saveVersion(chart.id, body.teeth as ToothChartState[], user.id);

  // Update cumulative patient-level baseline (merge, last-write-wins per tooth)
  const baselineRepo = new DentalChartBaselineRepository(db);
  await baselineRepo.mergeVisitChart(body.patientId, visitId, body.teeth as ToothChartState[], user.id);

  return ctx.json(chart, 201);
}
