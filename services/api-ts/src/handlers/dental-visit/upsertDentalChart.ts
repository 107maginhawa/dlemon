/**
 * upsertDentalChart handler
 *
 * POST /dental/visits/{visitId}/chart
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { DentalChartRepository } from './repos/dental-chart.repo';
import type { ToothChartState } from './repos/dental-chart.schema';
import { VisitRepository } from './repos/visit.repo';
import type { User } from '@/types/auth';
import type { UpsertDentalChartBody, UpsertDentalChartParams } from '@/generated/openapi/validators';

export async function upsertDentalChart(
  ctx: ValidatedContext<UpsertDentalChartBody, never, UpsertDentalChartParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch authorization — look up visit to get branchId
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const repo = new DentalChartRepository(db);

  const chart = await repo.upsert({
    visitId,
    patientId: body.patientId,
    teeth: body.teeth as ToothChartState[],
  });

  return ctx.json(chart, 201);
}
