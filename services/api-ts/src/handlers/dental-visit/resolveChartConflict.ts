/**
 * resolveChartConflict handler — P0-A
 *
 * POST /dental/visits/{visitId}/chart/resolve-conflict
 *
 * Resolves an open chart sync conflict (a stale offline write the clock-aware
 * baseline merge rejected). Two resolutions:
 *
 *   - accept:  the rejected (offline) write becomes the truth. It is re-applied
 *              to the patient baseline as a NEW change with a NEW (higher) clock
 *              so it wins legitimately. History is never mutated — a new clock /
 *              baseline revision records the decision.
 *   - dismiss: keep the current value; discard the rejected write. A reason is
 *              REQUIRED (the offline edit is being deliberately dropped).
 *
 * Either way the conflict flag is retired so it stops surfacing.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { DentalChartRepository } from './repos/dental-chart.repo';
import { DentalChartBaselineRepository } from './repos/dental-chart-baseline.repo';
import type { ToothChartState } from './repos/dental-chart.schema';
import { VisitRepository } from './repos/visit.repo';
import type { ResolveChartConflictBody, ResolveChartConflictParams } from '@/generated/openapi/validators';
import type { User } from '@/types/auth';

interface ConflictPayload {
  reason?: string;
  rejectedTeeth?: ToothChartState[];
}

export async function resolveChartConflict(
  ctx: ValidatedContext<ResolveChartConflictBody, never, ResolveChartConflictParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  // Branch authorization — resolving a conflict is a clinical judgment, so it is
  // limited to clinicians (a dental_assistant may write conditions but not adjudicate).
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'hygienist']);

  const repo = new DentalChartRepository(db);
  const chart = await repo.findByVisit(visitId);
  if (!chart || chart.syncStatus !== 'conflict') {
    throw new NotFoundError('Open chart conflict');
  }

  const payload = (chart.conflictPayload ?? {}) as ConflictPayload;
  const rejectedTeeth = payload.rejectedTeeth ?? [];

  if (body.resolution === 'dismiss') {
    // Deliberately dropping the offline edit — a reason is mandatory. (@minLength
    // in TypeSpec only fires when present; an omitted reason must be caught here.)
    if (!body.reason || body.reason.trim().length < 5) {
      throw new ValidationError('A reason (5–500 chars) is required to dismiss a chart conflict');
    }
    const updated = await repo.clearConflict(chart.id);
    return ctx.json(updated ?? chart, 200);
  }

  // accept: re-apply the rejected teeth to the baseline with a NEW clock above
  // the current winner so the offline edit wins legitimately (never mutates the
  // prior facts — it adds a new, higher-clocked change).
  //
  // Atomic: the baseline merge, the version snapshot, and the conflict-clear run in a
  // single transaction so a partial failure can't lose the baseline update while still
  // retiring the conflict flag (which would silently drop the accepted edit).
  // NOTE: an explicit `FOR UPDATE` lock on the baseline row would further serialize
  // two concurrent resolves of the SAME conflict, but is deliberately omitted — the
  // offline-first embedded path runs on a single-writer SQLite (sqlite-proxy, which
  // does not implement row locks), and concurrent resolution of one conflict is a
  // narrow window already guarded by the syncStatus!=='conflict' 404 recheck.
  const updated = await db.transaction(async (tx) => {
    const baselineRepo = new DentalChartBaselineRepository(tx);
    const txRepo = new DentalChartRepository(tx);
    const baseline = await baselineRepo.findByPatient(chart.patientId);
    const maxClock = (baseline?.teeth ?? []).reduce(
      (max, t) => (typeof t.clock === 'number' && t.clock > max ? t.clock : max),
      0,
    );
    const newClock = maxClock + 1;
    const bumped: ToothChartState[] = rejectedTeeth.map((t) => ({ ...t, clock: newClock }));

    if (bumped.length > 0) {
      await baselineRepo.mergeVisitChart(chart.patientId, visitId, bumped, user.id);
      // Record the resolution as a new version snapshot of the visit chart.
      await txRepo.saveVersion(chart.id, chart.teeth as ToothChartState[], user.id);
    }

    return txRepo.clearConflict(chart.id);
  });

  return ctx.json(updated ?? chart, 200);
}
