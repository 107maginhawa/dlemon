/**
 * createInventoryAdjustment — POST /dental/branches/:branchId/inventory/:itemId/adjustments
 *
 * P2-004: Create a stock adjustment ledger entry. Updates item.quantityOnHand
 * in the same DB transaction.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { InventoryRepository } from '../repos/inventory.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function createInventoryAdjustment(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { branchId, itemId } = ctx.req.valid('param') as { branchId: string; itemId: string };
  const body = ctx.req.valid('json') as { adjustmentType: 'restock' | 'usage' | 'disposal' | 'correction'; quantity: number; reason?: string | null };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Branch-level authorization (mutation)
  await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'staff_full']);

  const repo = new InventoryRepository(db, logger);
  const item = await repo.findOneById(itemId, branchId);
  if (!item) throw new NotFoundError('Inventory item not found');

  const adjustment = await repo.createAdjustment({
    itemId,
    adjustmentType: body.adjustmentType,
    quantity: body.quantity,
    reason: body.reason ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info(
    { action: 'createInventoryAdjustment', branchId, itemId, adjustmentId: adjustment.id, delta: body.quantity },
    'Inventory adjustment created',
  );

  return ctx.json(adjustment, 201);
}
