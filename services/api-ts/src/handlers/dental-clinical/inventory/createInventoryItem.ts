/**
 * createInventoryItem — POST /dental/branches/:branchId/inventory
 *
 * P2-004: Create an inventory item scoped to a branch.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { InventoryRepository } from '../repos/inventory.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { DatabaseInstance } from '@/core/database';
import { eq } from 'drizzle-orm';
import type { HandlerContext } from '@/types/app';

export async function createInventoryItem(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { branchId } = ctx.req.valid('param') as { branchId: string };
  const body = ctx.req.valid('json') as { name: string; category: 'consumable' | 'instrument' | 'medication' | 'equipment' | 'other'; unit: string; quantityOnHand?: number; reorderLevel?: number; notes?: string | null };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Branch-level authorization (mutation)
  await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'staff_full']);

  // Verify branch exists
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  const repo = new InventoryRepository(db, logger);
  const item = await repo.createItem({
    branchId,
    name: body.name,
    category: body.category,
    unit: body.unit,
    quantityOnHand: body.quantityOnHand ?? 0,
    reorderLevel: body.reorderLevel ?? 10,
    notes: body.notes ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createInventoryItem', branchId, itemId: item.id }, 'Inventory item created');

  return ctx.json(item, 201);
}
