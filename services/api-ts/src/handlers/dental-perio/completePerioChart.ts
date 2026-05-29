/**
 * completePerioChart
 *
 * POST /dental/perio-charts/{chartId}/complete
 *
 * BR-P05: dentist role required.
 * BR-P07: requires at least 16 readings to complete.
 * Computes summary stats: BoP%, mean depth, deep pocket count (depth >= 5mm).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
  BusinessLogicError,
  ConflictError,
} from '@/core/errors';
import { PerioChartRepository } from './repos/perio-chart.repo';
import { PerioReadingRepository } from './repos/perio-reading.repo';
import { getVisitForPerio } from '@/handlers/dental-visit/repos/visit-perio.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';
import type { CompletePerioChartParams } from '@/generated/openapi/validators';

const MIN_READINGS_FOR_COMPLETE = 16;
const DEEP_POCKET_THRESHOLD_MM = 5;
const DEPTH_FIELDS = ['depthBM', 'depthBC', 'depthBD', 'depthLM', 'depthLC', 'depthLD'] as const;
const BOP_FIELDS = ['bopBM', 'bopBC', 'bopBD', 'bopLM', 'bopLC', 'bopLD'] as const;

export async function completePerioChart(
  ctx: ValidatedContext<never, never, CompletePerioChartParams>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { chartId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  const chartRepo = new PerioChartRepository(db);
  const chart = await chartRepo.findOneById(chartId);
  if (!chart) throw new NotFoundError('Perio chart');

  // V-PER-001: completing an already-completed/locked chart is a state conflict (409),
  // not a 422 business-rule failure. Canonical code CHART_COMPLETED.
  if (chart.status === 'completed' || chart.status === 'locked') {
    throw new ConflictError(`Perio chart is already ${chart.status}`, 'CHART_COMPLETED');
  }

  // BR-P02 / AC-P08: parent visit must not be locked or completed.
  const visit = await getVisitForPerio(db, chart.visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  if (visit.status === 'completed' || visit.status === 'locked') {
    throw new BusinessLogicError('Cannot complete chart on a locked visit', 'VISIT_LOCKED');
  }

  await assertBranchRole(db, user.id, chart.branchId, ['dentist_owner', 'dentist_associate', 'hygienist']);

  const readingRepo = new PerioReadingRepository(db);
  const readings = await readingRepo.findMany({ chartId });

  // BR-P07
  if (readings.length < MIN_READINGS_FOR_COMPLETE) {
    throw new BusinessLogicError(
      `At least ${MIN_READINGS_FOR_COMPLETE} tooth readings required to complete chart (have ${readings.length})`,
      'INSUFFICIENT_READINGS',
    );
  }

  // Summary computation.
  let depthSum = 0;
  let depthCount = 0;
  let deepPocketCount = 0;
  let bopTrue = 0;
  let bopTotal = 0;

  for (const r of readings) {
    for (const f of DEPTH_FIELDS) {
      const v = r[f];
      if (typeof v === 'number') {
        depthSum += v;
        depthCount += 1;
        if (v >= DEEP_POCKET_THRESHOLD_MM) deepPocketCount += 1;
      }
    }
    for (const f of BOP_FIELDS) {
      const v = r[f];
      if (typeof v === 'boolean') {
        bopTotal += 1;
        if (v) bopTrue += 1;
      }
    }
  }

  const meanDepth = depthCount > 0 ? depthSum / depthCount : 0;
  const bopPercent = bopTotal > 0 ? (bopTrue / bopTotal) * 100 : 0;

  const updated = await chartRepo.complete(chartId, {
    bopPercent,
    meanDepth,
    deepPocketCount,
  });

  if (!updated) throw new NotFoundError('Perio chart');

  const logger = ctx.get('logger');
  logger?.info(
    {
      requestId: ctx.get('requestId'),
      action: 'dental_perio_chart_complete',
      chartId,
      bopPercent,
      meanDepth,
      deepPocketCount,
      readingCount: readings.length,
      by: user.id,
    },
    'Perio chart completed',
  );

  // V-PER-006 / V-PER-005: completion finalizes a clinical PHI record — persist a
  // dental_audit_log row (§4/§17 + audit-convergence). Per ADR-006 the
  // `perio.chart.completed` domain event is an audit-log-only semantic marker
  // (no event bus); writing this row satisfies it.
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: chart.branchId,
    branchId: chart.branchId,
    action: 'perio.chart.completed',
    resourceType: 'dental_perio_chart',
    resourceId: chartId,
    metadata: {
      visitId: chart.visitId,
      patientId: chart.patientId,
      summaryBopPercent: Number(bopPercent.toFixed(2)),
      summaryMeanDepth: Number(meanDepth.toFixed(2)),
      summaryDeepPocketCount: deepPocketCount,
      readingCount: readings.length,
    },
  });

  return ctx.json({
    id: updated.id,
    status: updated.status,
    completedAt: updated.completedAt!,
    summaryBopPercent: Number(updated.summaryBopPercent ?? 0),
    summaryMeanDepth: Number(updated.summaryMeanDepth ?? 0),
    summaryDeepPocketCount: updated.summaryDeepPocketCount ?? 0,
  });
}
