/**
 * listDentalTreatments handler
 *
 * GET /dental/visits/{visitId}/treatments
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { TreatmentRepository } from './repos/treatment.repo';
import type { User } from '@/types/auth';

export async function listDentalTreatments(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new TreatmentRepository(db);

  const treatments = await repo.findByVisit(visitId);

  const limit = parseInt(ctx.req.query('limit') ?? '100');
  const offset = parseInt(ctx.req.query('offset') ?? '0');

  return ctx.json({ items: treatments.slice(offset, offset + limit), total: treatments.length, limit, offset });
}
