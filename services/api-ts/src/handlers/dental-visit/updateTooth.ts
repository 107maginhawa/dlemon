/**
 * updateTooth handler
 *
 * PATCH /dental/visits/{visitId}/chart/teeth/{toothNumber}
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { DentalChartRepository } from './repos/dental-chart.repo';
import { VisitRepository } from './repos/visit.repo';
import type { User } from '@/types/auth';
import type { UpdateToothBody, UpdateToothParams } from '@/generated/openapi/validators';

export async function updateTooth(
  ctx: ValidatedContext<UpdateToothBody, never, UpdateToothParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId, toothNumber } = ctx.req.valid('param');

  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch authorization — look up visit to get branchId
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const repo = new DentalChartRepository(db);
  const chart = await repo.findByVisit(visitId);
  if (!chart) throw new NotFoundError('Dental chart');

  const updated = await repo.updateTooth(chart.id, {
    toothNumber,
    state: body.state,
    surfaces: body.surfaces,
    conditionCode: body.conditionCode,
    note: body.note,
  });

  return ctx.json(updated);
}
