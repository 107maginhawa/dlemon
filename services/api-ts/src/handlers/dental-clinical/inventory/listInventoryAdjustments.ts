/**
 * listInventoryAdjustments — GET /dental/branches/:branchId/inventory/:itemId/adjustments
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { InventoryRepository } from '../repos/inventory.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { DatabaseInstance } from '@/core/database';

export async function listInventoryAdjustments(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { branchId, itemId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Branch-level authorization (read)
  await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'dentist_associate', 'staff_full', 'hygienist']);

  const repo = new InventoryRepository(db, logger);
  const item = await repo.findOneById(itemId, branchId);
  if (!item) throw new NotFoundError('Inventory item not found');

  const adjustments = await repo.findAdjustmentsByItemId(itemId);

  return ctx.json(adjustments, 200);
}
