/**
 * POST /dental/erasure-requests — create a right-to-erasure request (V-DG-002).
 * Admin-only. Creates a `requested` row; mutates no subject data.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { requestErasure } from './erasure-service';
import type { RequestErasureBodyType } from './utils/erasure-validators';

export async function requestErasureHandler(
  ctx: ValidatedContext<RequestErasureBodyType, never, never>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');
  if (user.role !== 'admin') throw new ForbiddenError('Only administrators can request data erasure');

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const req = await requestErasure(db, logger, {
    subjectPersonId: body.subjectPersonId,
    subjectPatientId: body.subjectPatientId ?? null,
    tenantId: body.tenantId,
    branchId: body.branchId ?? null,
    reason: body.reason,
    requestedBy: user.id,
  });

  return ctx.json(req, 201);
}
