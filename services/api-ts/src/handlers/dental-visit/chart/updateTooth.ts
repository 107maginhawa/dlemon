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
import { VisitRepository } from '../repos/visit.repo';
import type { User } from '@/types/auth';
import type { UpdateToothBody, UpdateToothParams } from '@/generated/openapi/validators';

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
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

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
    entryClassification: body.entryClassification as any,
  });

  return ctx.json(updated);
}
