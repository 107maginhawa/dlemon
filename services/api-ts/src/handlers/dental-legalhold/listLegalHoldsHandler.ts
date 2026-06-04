/**
 * GET /dental/legal-holds — list legal holds with optional filters
 * (V-DG-002 support). Admin-only.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { LegalHoldRepository } from './repos/legal-hold.repo';
import type { ListLegalHoldQueryType } from './utils/legal-hold-validators';

export async function listLegalHoldsHandler(
  ctx: ValidatedContext<never, ListLegalHoldQueryType, never>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');
  if (user.role !== 'admin') throw new ForbiddenError('Only administrators can view legal holds');

  const filters = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new LegalHoldRepository(db, ctx.get('logger'));

  const rows = await repo.findMany({
    status: filters.status,
    subjectPersonId: filters.subjectPersonId,
    tenantId: filters.tenantId,
  });

  return ctx.json(rows, 200);
}
