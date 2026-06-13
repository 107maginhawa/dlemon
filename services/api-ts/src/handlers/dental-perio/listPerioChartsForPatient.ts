/**
 * listPerioChartsForPatient
 *
 * GET /dental/perio-charts?patientId={patientId}
 *
 * Multi-exam comparison: returns a patient's finalized (completed/locked) perio
 * charts, most recent first, each with its per-site readings (+ computed CAL),
 * so the UI can trend probing depths / BOP% / deep-pocket counts over time.
 *
 * Auth: branch-scoped clinical read, mirroring getPerioChart (BR-P06). Branch is
 * derived from the patient's own charts; when the patient has no finalized chart
 * there is nothing to authorize against and an empty list is returned.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { PerioChartRepository } from './repos/perio-chart.repo';
import { PerioReadingRepository } from './repos/perio-reading.repo';
import { computeReadingCal } from './utils/perio-cal';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import type { ListPerioChartsForPatientQuery } from '@/generated/openapi/validators';

const HISTORY_LIMIT = 12;

export async function listPerioChartsForPatient(
  ctx: ValidatedContext<never, ListPerioChartsForPatientQuery, never>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;

  const chartRepo = new PerioChartRepository(db);
  const charts = await chartRepo.findFinalizedByPatient(patientId, HISTORY_LIMIT);

  // No finalized charts → nothing to authorize against, no data to leak.
  if (charts.length === 0) return ctx.json({ data: [] });

  // BR-P06: any branch member with clinical access may read perio data
  // (staff_scheduling excluded — perio is clinical). All of a patient's charts
  // share its branch in this single-branch model, so one check suffices.
  await assertBranchRole(db, user.id, charts[0]!.branchId, [
    'dentist_owner',
    'dentist_associate',
    'hygienist',
    'staff_full',
  ]);

  // Drizzle returns `numeric` columns as strings; coerce the summary stats to
  // numbers so the wire matches the declared float64 contract (mirrors
  // completePerioChart). null stays null.
  const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

  const readingRepo = new PerioReadingRepository(db);
  const data = await Promise.all(
    charts.map(async (chart) => {
      const readings = await readingRepo.findMany({ chartId: chart.id });
      // P1-5: attach read-only per-site CAL (PD + gingival margin), as getPerioChart does.
      return {
        ...chart,
        summaryBopPercent: numOrNull(chart.summaryBopPercent),
        summaryMeanDepth: numOrNull(chart.summaryMeanDepth),
        readings: readings.map((r) => ({ ...r, ...computeReadingCal(r) })),
      };
    }),
  );

  return ctx.json({ data });
}
