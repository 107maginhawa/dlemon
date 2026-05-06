/**
 * upsertDentalChart handler
 *
 * POST /dental/visits/{visitId}/chart
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { DentalChartRepository } from './repos/dental-chart.repo';
import { VisitRepository } from './repos/visit.repo';
import type { User } from '@/types/auth';

export async function upsertDentalChart(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  if (!body['patientId'] || typeof body['patientId'] !== 'string') throw new ValidationError('patientId is required');
  if (!Array.isArray(body['teeth'])) throw new ValidationError('teeth must be an array');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch authorization — look up visit to get branchId
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const repo = new DentalChartRepository(db);

  const chart = await repo.upsert({
    visitId,
    patientId: body['patientId'] as string,
    teeth: body['teeth'] as any[],
  });

  return ctx.json(chart, 201);
}
