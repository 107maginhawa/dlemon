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
import { isPrimaryToothNumber } from './utils/perio-validation';
import { classifyChart, type PerioRiskFactors } from './utils/perio-classify-chart';
import { getVisitForPerio } from '@/handlers/dental-visit/repos/visit-perio.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';
import type {
  CompletePerioChartBody,
  CompletePerioChartParams,
} from '@/generated/openapi/validators';

// BR-P07: minimum tooth readings required to complete a chart. Adult dentition
// (32 teeth) requires 16; primary dentition (20 teeth, FDI 51–85) requires 8.
// MODULE_SPEC §13 / API_CONTRACTS "complete" error table.
const MIN_READINGS_ADULT = 16;
const MIN_READINGS_PRIMARY = 8;
const DEEP_POCKET_THRESHOLD_MM = 5;
const DEPTH_FIELDS = ['depthBM', 'depthBC', 'depthBD', 'depthLM', 'depthLC', 'depthLD'] as const;
const BOP_FIELDS = ['bopBM', 'bopBC', 'bopBD', 'bopLM', 'bopLC', 'bopLD'] as const;

export async function completePerioChart(
  ctx: ValidatedContext<CompletePerioChartBody, never, CompletePerioChartParams>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { chartId } = ctx.req.valid('param');
  // P1-6: optional 2017 staging/grading risk factors (medical-history sourced).
  // The body is optional, so tolerate its absence (no-body POST).
  let riskFactors: PerioRiskFactors = {};
  try {
    riskFactors = (ctx.req.valid('json') as PerioRiskFactors | undefined) ?? {};
  } catch {
    riskFactors = {};
  }
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
    throw new BusinessLogicError('Cannot complete chart on a locked visit', 'VISIT_IMMUTABLE');
  }

  await assertBranchRole(db, user.id, chart.branchId, ['dentist_owner', 'dentist_associate', 'hygienist']);

  const readingRepo = new PerioReadingRepository(db);
  const readings = await readingRepo.findMany({ chartId });

  // BR-P07: the chart has no dentition-type column, so infer it from the charted
  // tooth numbers. A chart is treated as primary dentition only when it has at
  // least one reading and every reading is a primary tooth (FDI 51–85); any adult
  // (or mixed) tooth keeps the stricter adult minimum.
  const isPrimaryDentition =
    readings.length > 0 && readings.every((r) => isPrimaryToothNumber(r.toothNumber));
  const minReadings = isPrimaryDentition ? MIN_READINGS_PRIMARY : MIN_READINGS_ADULT;

  if (readings.length < minReadings) {
    throw new BusinessLogicError(
      `At least ${minReadings} tooth readings required to complete chart (have ${readings.length})`,
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

  // P1-6: compute the 2017 AAP/EFP classification from the charted readings
  // (CAL, PD, furcation, mobility) plus the optional medical-history risk
  // factors. Stage/extent are null when there is no evidence to classify.
  const classification = classifyChart(readings, riskFactors);

  const updated = await chartRepo.complete(chartId, {
    bopPercent,
    meanDepth,
    deepPocketCount,
    // FIX-001/002: persist the diagnosis of record + its grading evidence so the
    // read paths (GET / visit-GET / history) and the longitudinal comparison can
    // surface the staging trajectory — frozen at completion (Q2 default).
    stage: classification.stage,
    grade: classification.grade,
    extent: classification.extent,
    // PerioRiskFactors is a closed interface (no index signature); it is structurally
    // a plain JSONB object for persistence.
    riskFactors: riskFactors as Record<string, unknown>,
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
      // P1-6: persist the computed 2017 classification in the audit trail.
      stage: classification.stage,
      grade: classification.grade,
      extent: classification.extent,
    },
  });

  return ctx.json({
    id: updated.id,
    status: updated.status,
    completedAt: updated.completedAt!,
    summaryBopPercent: Number(updated.summaryBopPercent ?? 0),
    summaryMeanDepth: Number(updated.summaryMeanDepth ?? 0),
    summaryDeepPocketCount: updated.summaryDeepPocketCount ?? 0,
    // FIX-001: return the PERSISTED diagnosis (from the write's RETURNING row), not
    // the in-memory `classification`, so the completion response confirms what was
    // actually stored — the read paths and the response can never silently diverge.
    stage: (updated.stage ?? null) as typeof classification.stage,
    grade: (updated.grade ?? null) as typeof classification.grade,
    extent: (updated.extent ?? null) as typeof classification.extent,
  });
}
