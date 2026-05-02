/**
 * updateLabOrder handler
 *
 * PATCH /dental/visits/{visitId}/lab-orders/{orderId}
 * Handles status transitions and field updates.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { LabOrderRepository } from './repos/lab-order.repo';
import { VALID_LAB_ORDER_STATUSES } from './repos/lab-order.schema';
import type { User } from '@/types/auth';

export async function updateLabOrder(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const orderId = ctx.req.param('orderId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new LabOrderRepository(db);

  const existing = await repo.findOneById(orderId);
  if (!existing) throw new NotFoundError('Lab order');

  // Status transition
  if (body['status'] !== undefined) {
    if (!VALID_LAB_ORDER_STATUSES.includes(body['status'] as any)) {
      throw new ValidationError(`status must be one of: ${VALID_LAB_ORDER_STATUSES.join(', ')}`);
    }
    const { order, error } = await repo.updateStatus(orderId, body['status'] as any, {
      expectedDeliveryDate: body['expectedDeliveryDate'] ? new Date(body['expectedDeliveryDate'] as string) : undefined,
      cancelReason: typeof body['cancelReason'] === 'string' ? body['cancelReason'] : undefined,
      isDefective: typeof body['isDefective'] === 'boolean' ? body['isDefective'] : undefined,
    });
    if (error) throw new ValidationError(error);
    return ctx.json(order);
  }

  // Non-status fields update
  const updated = await repo.update(orderId, {
    expectedDeliveryDate: body['expectedDeliveryDate'] ? new Date(body['expectedDeliveryDate'] as string) : undefined,
    cancelReason: typeof body['cancelReason'] === 'string' ? body['cancelReason'] : undefined,
    isDefective: typeof body['isDefective'] === 'boolean' ? body['isDefective'] : undefined,
  });

  return ctx.json(updated);
}
