/**
 * POST /dental/erasure-requests/{id}/reject — reject an erasure request with a
 * reason (V-DG-002). Admin-only. Mutates no subject data.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { rejectErasure } from './erasure-service';
import type { ErasureIdParamsType, RejectErasureBodyType } from './utils/erasure-validators';

export async function rejectErasureHandler(
  ctx: ValidatedContext<RejectErasureBodyType, never, ErasureIdParamsType>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');
  if (user.role !== 'admin') throw new ForbiddenError('Only administrators can reject data erasure');

  const { id } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const result = await rejectErasure(db, logger, id, {
    reviewedBy: user.id,
    rejectionReason: body.rejectionReason,
  });

  return ctx.json(result, 200);
}
