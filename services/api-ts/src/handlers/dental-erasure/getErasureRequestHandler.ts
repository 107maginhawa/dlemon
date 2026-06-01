/**
 * GET /dental/erasure-requests/{id} — fetch one erasure request (V-DG-002).
 * Admin-only.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/core/errors';
import type { User } from '@/types/auth';
import { ErasureRequestRepository } from './repos/erasure-request.repo';
import type { ErasureIdParamsType } from './utils/erasure-validators';

export async function getErasureRequestHandler(
  ctx: ValidatedContext<never, never, ErasureIdParamsType>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');
  if (user.role !== 'admin') throw new ForbiddenError('Only administrators can view erasure requests');

  const { id } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ErasureRequestRepository(db, ctx.get('logger'));

  const req = await repo.findOneById(id);
  if (!req) throw new NotFoundError('Erasure request not found');

  return ctx.json(req, 200);
}
