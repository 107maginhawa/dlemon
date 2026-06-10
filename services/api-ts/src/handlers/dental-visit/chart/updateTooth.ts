/**
 * updateTooth handler
 *
 * PATCH /dental/visits/{visitId}/chart/teeth/{toothNumber}
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { DentalChartRepository } from '../repos/dental-chart.repo';
import { DentalChartBaselineRepository } from '../repos/dental-chart-baseline.repo';
import { VisitRepository } from '../repos/visit.repo';
import type { User } from '@/types/auth';
import type { UpdateToothBody, UpdateToothParams } from '@/generated/openapi/validators';
import type { ChartEntryClassification, ToothChartState } from '../repos/dental-chart.schema';

export async function updateTooth(
  ctx: ValidatedContext<UpdateToothBody, never, UpdateToothParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId, toothNumber } = ctx.req.valid('param');

  const body = ctx.req.valid('json');

  if (!body.state && !body.surfaces && !body.conditionCode && !body.note && !body.surfaceConditionMap && !body.entryClassification) {
    throw new ValidationError('At least one of state, surfaces, conditionCode, note, surfaceConditionMap, or entryClassification must be provided');
  }

  const db = ctx.get('database') as DatabaseInstance;

  // Branch authorization — look up visit to get branchId
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  // E2: dental_assistant may write tooth/surface CONDITIONS under dentist supervision.
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'dental_assistant']);

  // EF-VIS-002: completed/locked visits cannot be modified — lock gate
  if (visit.status === 'completed' || visit.status === 'locked') {
    throw new BusinessLogicError('Visit is immutable and cannot be modified', 'VISIT_IMMUTABLE');
  }

  const repo = new DentalChartRepository(db);
  const chart = await repo.findByVisit(visitId);
  if (!chart) throw new NotFoundError('Dental chart');

  const updated = await repo.updateTooth(chart.id, {
    toothNumber,
    state: body.state,
    surfaces: body.surfaces,
    conditionCode: body.conditionCode,
    note: body.note,
    surfaceConditionMap: body.surfaceConditionMap,
    entryClassification: body.entryClassification as ChartEntryClassification | undefined,
  });

  // B-G1: the odontogram is a living document — every chart write path (full
  // upsert AND per-tooth PATCH) must merge into the patient baseline, or a
  // single-tooth edit is silently dropped from next-visit carry-over (CHART-BR-002,
  // WF-032). Mirror upsertDentalChart: merge the full post-edit teeth array
  // (existing/existing_other baseline entries are protected by mergeTeeth).
  if (updated) {
    const baselineRepo = new DentalChartBaselineRepository(db);
    await baselineRepo.mergeVisitChart(chart.patientId, visitId, updated.teeth as ToothChartState[], user.id);
  }

  return ctx.json(updated);
}
