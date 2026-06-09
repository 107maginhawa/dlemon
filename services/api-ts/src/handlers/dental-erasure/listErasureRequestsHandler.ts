/**
 * GET /dental/erasure-requests — list erasure requests with optional filters
 * (V-DG-002). Admin-only.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { ErasureRequestRepository } from './repos/erasure-request.repo';
import type { ListErasureQueryType } from './utils/erasure-validators';

export async function listErasureRequestsHandler(
  ctx: ValidatedContext<never, ListErasureQueryType, never>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');
  if (user.role !== 'admin') throw new ForbiddenError('Only administrators can view erasure requests');

  const filters = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ErasureRequestRepository(db, ctx.get('logger'));

  const rows = await repo.findMany({
    status: filters.status,
    subjectPersonId: filters.subjectPersonId,
    tenantId: filters.tenantId,
  });

  // ER-P2-1: conform to the declared contract `ErasureRequestList = { data: [] }`
  // (was returning a bare array, which the SDK type contradicts).
  return ctx.json({ data: rows }, 200);
}
