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
} from '@/core/errors';
import { PerioChartRepository } from './repos/perio-chart.repo';
import { PerioReadingRepository } from './repos/perio-reading.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { assertValidDepths, assertValidToothNumber } from './utils/perio-validation';
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
  // BR-P03: validate depths in body.
  assertValidDepths(body as Record<string, unknown>);

  const chartRepo = new PerioChartRepository(db);
  const chart = await chartRepo.findOneById(chartId);
  if (!chart) throw new NotFoundError('Perio chart');

  // BR-P02: chart must be writable.
  if (chart.status !== 'draft') {
    throw new BusinessLogicError(`Cannot modify ${chart.status} perio chart`, 'PERIO_CHART_LOCKED');
  }

  // BR-P05: dentist or hygienist role required.
  await assertBranchRole(db, user.id, chart.branchId, ['dentist_owner', 'dentist_associate', 'hygienist']);

  const repo = new PerioReadingRepository(db);
  const reading = await repo.upsert({
    chartId,
    toothNumber,
    depthBM: body.depthBM ?? null,
    depthBC: body.depthBC ?? null,
    depthBD: body.depthBD ?? null,
    depthLM: body.depthLM ?? null,
    depthLC: body.depthLC ?? null,
    depthLD: body.depthLD ?? null,
    bopBM: body.bopBM ?? null,
    bopBC: body.bopBC ?? null,
    bopBD: body.bopBD ?? null,
    bopLM: body.bopLM ?? null,
    bopLC: body.bopLC ?? null,
    bopLD: body.bopLD ?? null,
    recession: body.recession ?? null,
    mobility: body.mobility ?? 0,
    furcation: body.furcation ?? 0,
    plaque: body.plaque ?? false,
    suppuration: body.suppuration ?? false,
    notes: body.notes,
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

  return ctx.json(reading);
}
