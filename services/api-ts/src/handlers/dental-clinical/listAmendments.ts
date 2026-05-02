/**
 * listAmendments handler
 *
 * GET /dental/visits/{visitId}/amendments
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { AmendmentRepository } from './repos/amendment.repo';
import type { User } from '@/types/auth';

export async function listAmendments(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new AmendmentRepository(db);

  const items = await repo.findMany({ visitId });
  const limit = parseInt(ctx.req.query('limit') ?? '50');
  const offset = parseInt(ctx.req.query('offset') ?? '0');
  const page = items.slice(offset, offset + limit);

  return ctx.json({ items: page, total: items.length, limit, offset });
}
