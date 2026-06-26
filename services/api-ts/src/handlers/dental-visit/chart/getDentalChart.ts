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
import { TreatmentRepository } from '../repos/treatment.repo';
import { chartFromBaseline } from './chart-carryover';
import { deriveLayerSetsAsOf, resolveTerminalTeeth } from './chart-export';
import type { ToothChartState } from '../repos/dental-chart.schema';
import type { User } from '@/types/auth';

const CHARTED_VISIT_STATUSES = new Set(['active', 'completed', 'locked']);

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
  if (chart) {
    // Cumulative as-of layers: derive each tooth's lifecycle layer AS OF this visit's
    // date across the patient's whole charted treatment history — so a historical card
    // shows the chart state at that point in time, not just that visit's deltas.
    const allVisits = await visitRepo.findMany({ patientId: visit.patientId });
    const charted = allVisits.filter((v) => CHARTED_VISIT_STATUSES.has(v.status));
    const visitDateById = new Map(charted.map((v) => [v.id, v.completedAt ?? v.createdAt] as const));
    const asOf = visitDateById.get(visitId) ?? visit.completedAt ?? visit.createdAt;

    const patientTreatments = await new TreatmentRepository(db).findByPatientCharted(visit.patientId);
    const { proposed, completed, declined, changed } = deriveLayerSetsAsOf(
      patientTreatments.map((t) => ({
        toothNumber: t.toothNumber,
        status: t.status,
        performedAt: t.performedAt,
        visitId: t.visitId,
        sourceVisitId: t.sourceVisitId,
        carriedOver: t.carriedOver,
      })),
      asOf,
      visitDateById,
    );

    // Terminal teeth (missing/extracted) have no actionable lifecycle — strip them from
    // the layers and surface them separately at top precedence.
    const terminal = resolveTerminalTeeth(chart.teeth as ToothChartState[]);
    for (const n of terminal) { proposed.delete(n); completed.delete(n); declined.delete(n); }

    return ctx.json({
      ...chart,
      layers: {
        proposed: [...proposed].sort((a, b) => a - b),
        completed: [...completed].sort((a, b) => a - b),
        declined: [...declined].sort((a, b) => a - b),
      },
      changedThisVisit: [...changed].sort((a, b) => a - b),
      terminalTeeth: [...terminal].sort((a, b) => a - b),
    });
  }

  // Living-document carry-over: a visit with no chart row of its own inherits the
  // patient's cumulative existing dentition from the baseline (returning patient).
  // Only a brand-new patient with no baseline gets a 404 → FE "Initialize Dentition".
  const baseline = await new DentalChartBaselineRepository(db).findByPatient(visit.patientId);
  if (baseline) {
    return ctx.json(chartFromBaseline(baseline, { id: visitId, patientId: visit.patientId }));
  }

  throw new NotFoundError('Dental chart');
}
