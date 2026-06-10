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

  const repo = new DentalChartRepository(db);

  // SL-01 / B-G3: offline-replay idempotency. The chart is one-per-visit, so a
  // replay never inserts a duplicate row — but re-running saveVersion below would
  // append a REDUNDANT version snapshot. localId is set once on first insert; if
  // the existing chart was created by THIS localId, the inbound POST is a replay of
  // that create op — short-circuit (skip the version append + baseline re-merge).
  // Scoped to an exact localId match, so a distinct edit op (different localId)
  // still applies normally. Placed before the immutability guard so a replay
  // resolves idempotently even after the visit was later completed/locked.
  if (body.localId) {
    const existingChart = await repo.findByVisit(visitId);
    if (existingChart && existingChart.localId === body.localId) {
      return ctx.json(existingChart, 201);
    }
  }

  // EF-VIS-003: completed/locked visits cannot be modified — lock gate
  if (visit.status === 'completed' || visit.status === 'locked') {
    throw new BusinessLogicError('Visit is immutable and cannot be modified', 'VISIT_IMMUTABLE');
  }

  const chart = await repo.upsert({
    visitId,
    patientId: body.patientId,
    teeth: body.teeth as ToothChartState[],
    // GAP-001: persist optional client-generated id for offline-first idempotent sync.
    localId: body.localId,
  });

  await repo.saveVersion(chart.id, body.teeth as ToothChartState[], user.id);

  // Update cumulative patient-level baseline (clock-aware merge, last-write-wins per tooth)
  const baselineRepo = new DentalChartBaselineRepository(db);
  const { conflicts } = await baselineRepo.mergeVisitChart(body.patientId, visitId, body.teeth as ToothChartState[], user.id);

  // SL-12 / F-G04: a stale tooth that lost the baseline clock merge is a sync
  // conflict — persist it (chart syncStatus='conflict' + conflictPayload) instead
  // of silently dropping the losing write, so it is a durable, surfaceable record.
  if (conflicts.length > 0) {
    const flagged = await repo.flagSyncConflict(chart.id, conflicts);
    return ctx.json(flagged ?? chart, 201);
  }

  return ctx.json(chart, 201);
}
