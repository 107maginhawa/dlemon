/**
 * POST /dental/erasure-requests/{id}/approve — approve + run anonymization
 * (V-DG-002). Admin-only. A legal hold (reviewer-asserted) blocks erasure and
 * rejects the request. Approval is the explicit opt-in that performs the
 * (non-destructive) anonymization.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { approveErasure } from './erasure-service';
import type { ErasureIdParamsType } from './utils/erasure-validators';

export async function approveErasureHandler(
  ctx: ValidatedContext<never, never, ErasureIdParamsType>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');
  if (user.role !== 'admin') throw new ForbiddenError('Only administrators can approve data erasure');

  const { id } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Body is optional ({ legalHold? }); tolerate an empty/absent JSON body.
  const body = (await ctx.req.json().catch(() => ({}))) as { legalHold?: boolean };

  const result = await approveErasure(db, logger, id, {
    reviewedBy: user.id,
    legalHold: body?.legalHold ?? false,
  });

  return ctx.json(result, 200);
}
