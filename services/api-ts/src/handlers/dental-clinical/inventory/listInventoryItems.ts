/**
 * listInventoryItems — GET /dental/branches/:branchId/inventory
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { InventoryRepository } from '../repos/inventory.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
import type { DatabaseInstance } from '@/core/database';
import { eq } from 'drizzle-orm';
import type { HandlerContext } from '@/types/app';

export async function listInventoryItems(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { branchId } = ctx.req.valid('param') as { branchId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Branch-level authorization (read)
  await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'dentist_associate', 'staff_full', 'hygienist']);

  // Verify branch exists
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  const repo = new InventoryRepository(db, logger);
  const items = await repo.findByBranchId(branchId);

  // G10: conform to the platform `{ data, pagination }` envelope (was a bare array).
  const { limit, offset } = parsePagination(ctx.req.query(), { limit: 50 });
  const page = items.slice(offset, offset + limit);
  return ctx.json({ data: page, pagination: buildPaginationMeta(page, items.length, limit, offset) }, 200);
}
