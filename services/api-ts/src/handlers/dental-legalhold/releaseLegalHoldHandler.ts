/**
 * POST /dental/legal-holds/{id}/release — release a legal hold (V-DG-002 support).
 * Admin-only.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { releaseLegalHold } from './legal-hold-service';
import type { LegalHoldIdParamsType } from './utils/legal-hold-validators';

export async function releaseLegalHoldHandler(
  ctx: ValidatedContext<never, never, LegalHoldIdParamsType>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');
  if (user.role !== 'admin') throw new ForbiddenError('Only administrators can release legal holds');

  const { id } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const released = await releaseLegalHold(db, logger, id, { releasedBy: user.id });
  return ctx.json(released, 200);
}
