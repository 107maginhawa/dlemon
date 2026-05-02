/**
 * listMembers — simplified flat endpoint for listing branch members
 *
 * Path: GET /dental/org/members?branchId=...
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';

export async function listMembers(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const branchId = ctx.req.query('branchId');
  if (!branchId) {
    return ctx.json({ error: 'branchId query parameter is required' }, 400);
  }

  const includeInactive = ctx.req.query('includeInactive') === 'true';
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new MembershipRepository(db, logger);
  const items = await repo.listByBranch(branchId, { includeInactive });

  // Strip pinHash from each member
  const safeItems = items.map(({ pinHash, ...rest }) => rest);

  return ctx.json({ items: safeItems, total: safeItems.length });
}
