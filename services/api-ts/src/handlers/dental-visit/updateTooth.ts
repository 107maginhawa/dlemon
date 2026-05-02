/**
 * updateTooth handler
 *
 * PATCH /dental/visits/{visitId}/chart/teeth/{toothNumber}
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { DentalChartRepository } from './repos/dental-chart.repo';
import type { User } from '@/types/auth';

export async function updateTooth(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const toothNumber = parseInt(ctx.req.param('toothNumber') ?? '');
  if (isNaN(toothNumber)) throw new ValidationError('toothNumber must be a number');

  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;
  if (!body['state'] || typeof body['state'] !== 'string') throw new ValidationError('state is required');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalChartRepository(db);

  const chart = await repo.findByVisit(visitId);
  if (!chart) throw new NotFoundError('Dental chart');

  const updated = await repo.updateTooth(chart.id, {
    toothNumber,
    state: body['state'] as string,
    surfaces: Array.isArray(body['surfaces']) ? body['surfaces'] as string[] : undefined,
    conditionCode: typeof body['conditionCode'] === 'string' ? body['conditionCode'] : undefined,
    note: typeof body['note'] === 'string' ? body['note'] : undefined,
  });

  return ctx.json(updated);
}
