/**
 * listInventoryItems — GET /dental/branches/:branchId/inventory
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { InventoryRepository } from './repos/inventory.repo';
import type { DatabaseInstance } from '@/core/database';
import { eq } from 'drizzle-orm';

export async function listInventoryItems(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { branchId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Verify branch exists
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  const repo = new InventoryRepository(db, logger);
  const items = await repo.findByBranchId(branchId);

  return ctx.json(items, 200);
}
