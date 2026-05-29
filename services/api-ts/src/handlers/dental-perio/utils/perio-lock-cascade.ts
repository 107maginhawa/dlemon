/**
 * perio-lock-cascade.ts
 *
 * V-PER-007: visit-lock → chart-lock cascade.
 *
 * The perio chart `locked` state was dead: a chart only ever moved
 * draft → completed, and `locked` was never set even after the parent visit
 * was locked. This helper materializes the cascade. When a chart's parent
 * visit is in a terminal (`locked`/`completed`) state, the chart is moved into
 * the terminal `locked` state.
 *
 * Per ADR-006 (domain-events-descope) there is NO event bus: the
 * `perio.chart.locked` domain event is an audit-log-only semantic marker. We
 * satisfy it by writing the corresponding dental_audit_log row synchronously
 * via logAuditEvent() whenever the cascade actually transitions a chart.
 *
 * The cascade is applied lazily on read/write paths (rather than reactively on
 * the visit-lock event) because there is no event bus to subscribe to — the
 * next perio access reconciles the chart against the authoritative visit state.
 */

import type { DatabaseInstance } from '@/core/database';
import { logAuditEvent } from '@/core/audit-logger';
import { PerioChartRepository } from '../repos/perio-chart.repo';
import type { DentalPerioChart } from '../repos/perio-chart.schema';

/** Visit statuses that seal their child perio chart. */
const SEALING_VISIT_STATUSES = new Set(['locked', 'completed']);

export function visitSealsChart(visitStatus: string): boolean {
  return SEALING_VISIT_STATUSES.has(visitStatus);
}

/**
 * If `visitStatus` seals the chart and the chart is not already locked, lock it
 * and write the `perio.chart.locked` audit marker. Returns the locked chart row
 * when a transition happened, otherwise the unchanged input chart.
 *
 * @param actorId person whose action surfaced the cascade (for audit attribution)
 */
export async function cascadeChartLockFromVisit(
  db: DatabaseInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  chart: DentalPerioChart,
  visitStatus: string,
  actorId: string,
): Promise<DentalPerioChart> {
  if (!visitSealsChart(visitStatus) || chart.status === 'locked') {
    return chart;
  }

  const repo = new PerioChartRepository(db);
  const locked = await repo.lockByVisitId(chart.visitId);
  if (!locked) {
    // Another concurrent request already locked it; nothing more to do.
    return chart;
  }

  // V-PER-007 / V-PER-005: audit-log-only `perio.chart.locked` marker (ADR-006).
  await logAuditEvent(db, logger, {
    personId: actorId,
    tenantId: chart.branchId,
    branchId: chart.branchId,
    action: 'perio.chart.locked',
    resourceType: 'dental_perio_chart',
    resourceId: chart.id,
    metadata: {
      visitId: chart.visitId,
      patientId: chart.patientId,
      cascadedFromVisitStatus: visitStatus,
    },
  });

  return locked;
}
