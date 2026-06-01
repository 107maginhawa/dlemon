/**
 * POST /dental/legal-holds — place a legal hold on a subject (V-DG-002 support).
 * Admin-only.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { placeLegalHold } from './legal-hold-service';
import type { PlaceLegalHoldBodyType } from './utils/legal-hold-validators';

export async function placeLegalHoldHandler(
  ctx: ValidatedContext<PlaceLegalHoldBodyType, never, never>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');
  if (user.role !== 'admin') throw new ForbiddenError('Only administrators can place legal holds');

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const hold = await placeLegalHold(db, logger, {
    tenantId: body.tenantId,
    branchId: body.branchId ?? null,
    subjectPersonId: body.subjectPersonId,
    name: body.name,
    reason: body.reason,
    note: body.note ?? null,
    initiatedBy: user.id,
  });

  return ctx.json(hold, 201);
}
