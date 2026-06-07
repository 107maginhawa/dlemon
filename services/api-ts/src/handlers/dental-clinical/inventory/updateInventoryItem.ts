/**
 * updateInventoryItem — PATCH /dental/branches/:branchId/inventory/:itemId
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { InventoryRepository } from '../repos/inventory.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function updateInventoryItem(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { branchId, itemId } = ctx.req.valid('param') as { branchId: string; itemId: string };
  const body = ctx.req.valid('json') as Record<string, unknown>;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Branch-level authorization (mutation)
  await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'staff_full']);

  const repo = new InventoryRepository(db, logger);
  const existing = await repo.findOneById(itemId, branchId);
  if (!existing) throw new NotFoundError('Inventory item not found');

  const updates: Record<string, unknown> = {};
  if (body['name'] !== undefined) updates['name'] = body['name'];
  if (body['category'] !== undefined) updates['category'] = body['category'];
  if (body['unit'] !== undefined) updates['unit'] = body['unit'];
  if (body['status'] !== undefined) updates['status'] = body['status'];
  if (body['quantityOnHand'] !== undefined) updates['quantityOnHand'] = body['quantityOnHand'];
  if (body['reorderLevel'] !== undefined) updates['reorderLevel'] = body['reorderLevel'];
  if (body['notes'] !== undefined) updates['notes'] = body['notes'];
  updates['updatedBy'] = user.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- key/value pairs are pre-validated against schema field names above
  const item = await repo.updateItem(itemId, branchId, updates as any);
  if (!item) throw new NotFoundError('Inventory item not found');

  logger?.info({ action: 'updateInventoryItem', branchId, itemId, updates }, 'Inventory item updated');

  return ctx.json(item, 200);
}
