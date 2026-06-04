/**
 * upsertToothReading
 *
 * PUT /dental/perio-charts/{chartId}/readings/{toothNumber}
 *
 * BR-P02: chart must be in draft (not completed/locked).
 * BR-P03: depths 0-20mm.
 * BR-P04: tooth number must be valid FDI.
 * BR-P05: dentist role required.
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
import { assertValidDepths, assertValidToothNumber, assertValidGrades, assertValidGingivalMargins } from './utils/perio-validation';
import { computeReadingCal } from './utils/perio-cal';
import type { User } from '@/types/auth';
import type {
  UpsertToothReadingBody,
  UpsertToothReadingParams,
} from '@/generated/openapi/validators';

export async function upsertToothReading(
  ctx: ValidatedContext<UpsertToothReadingBody, never, UpsertToothReadingParams>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { chartId, toothNumber } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  // BR-P04: validate FDI tooth number.
  assertValidToothNumber(toothNumber);
  // BR-P03: validate depths (and recession) in body.
  assertValidDepths(body as Record<string, unknown>);
  // V-PER-004: mobility / furcation must be grade 0–3.
  assertValidGrades(body as Record<string, unknown>);
  // P1-5: per-site gingival margin must be an integer -5..20mm.
  assertValidGingivalMargins(body as Record<string, unknown>);

  const chartRepo = new PerioChartRepository(db);
  const chart = await chartRepo.findOneById(chartId);
  if (!chart) throw new NotFoundError('Perio chart');

  // BR-P02: chart must be writable. A completed/locked chart is immutable —
  // N-PER-01 / V-PER-002: CHART_COMPLETED is a state conflict (409), not a 422
  // business-rule failure. ERROR_TAXONOMY.md mandates 409 and the create/complete
  // handlers already use ConflictError — keep the wire contract consistent.
  if (chart.status !== 'draft') {
    throw new ConflictError(`Cannot modify ${chart.status} perio chart`, 'CHART_COMPLETED');
  }

  // EF-PER-001: parent visit must not be completed or locked.
  const visit = await getVisitForPerio(db, chart.visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  if (visit.status === 'completed' || visit.status === 'locked') {
    throw new BusinessLogicError('Visit is immutable and cannot be modified', 'VISIT_IMMUTABLE');
  }

  // BR-P05: dentist or hygienist role required.
  await assertBranchRole(db, user.id, chart.branchId, ['dentist_owner', 'dentist_associate', 'hygienist']);

  const repo = new PerioReadingRepository(db);

  // The chairside flow PATCHes ONE site per keystroke, so most fields are absent
  // from any given request. Pass the patch straight through: repo.upsert writes
  // ONLY the columns present in `body` on conflict, so a single-site write leaves
  // every other site on the tooth untouched (no full-row replace, and no
  // read-then-write — the upsert is one atomic, race-free statement).
  // `createdBy` is used only on first insert; the conflict-update never touches it.
  const reading = await repo.upsert({
    chartId,
    toothNumber,
    ...body,
    createdBy: user.id,
    updatedBy: user.id,
  });

  ctx.get('logger')?.info(
    {
      requestId: ctx.get('requestId'),
      action: 'dental_perio_reading_upsert',
      chartId,
      toothNumber,
      by: user.id,
    },
    'Perio tooth reading upserted',
  );

  // P1-5: CAL is derived read-only per-site from probing depth + gingival
  // margin — never stored, so it can never drift from its inputs.
  return ctx.json({ ...reading, ...computeReadingCal(reading) });
}
