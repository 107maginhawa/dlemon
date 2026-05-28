/**
 * updateInventoryItem — PATCH /dental/branches/:branchId/inventory/:itemId
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { InventoryRepository } from './repos/inventory.repo';
import type { DatabaseInstance } from '@/core/database';

export async function updateInventoryItem(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { branchId, itemId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

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

  const item = await repo.updateItem(itemId, branchId, updates as any);
  if (!item) throw new NotFoundError('Inventory item not found');

  logger?.info({ action: 'updateInventoryItem', branchId, itemId, updates }, 'Inventory item updated');

  return ctx.json(item, 200);
}
