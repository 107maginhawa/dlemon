/**
 * listMembers — simplified flat endpoint for listing branch members
 *
 * Path: GET /dental/org/members?branchId=...
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';

export async function listMembers(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const branchId = ctx.req.query('branchId');
  if (!branchId) {
    return ctx.json({ error: 'branchId query parameter is required' }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization
  await assertBranchAccess(db, user.id, branchId);

  const includeInactive = ctx.req.query('includeInactive') === 'true';
  const logger = ctx.get('logger');
  const { limit, offset } = parsePagination(ctx.req.query());

  const repo = new MembershipRepository(db, logger);
  // V-ORG-004 (perf §16): push the status filter + LIMIT/OFFSET into the query
  // and compute `total` via count(*), so the DB read is bounded by the page
  // size rather than loading every member and slicing in JS.
  const [items, total] = await Promise.all([
    repo.listByBranchPaginated(branchId, { includeInactive, limit, offset }),
    repo.countByBranch(branchId, { includeInactive }),
  ]);

  // Strip sensitive credential fields from each member
  const page = items.map(
    ({ pinHash, securityAnswerHash, securityQuestion, ...rest }) => rest,
  );

  return ctx.json({ data: page, pagination: buildPaginationMeta(page, total, limit, offset) });
}
