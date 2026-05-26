/**
 * updateQueueItemStatus — PATCH /dental/queue-items/:itemId/status
 *
 * Transitions queue item status via FSM.
 * Sets calledAt / startedAt / completedAt timestamps on appropriate transitions.
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { QueueItemRepository } from './repos/queue-item.repo';
import { QUEUE_ITEM_FSM } from './repos/queue-item.schema';
import { assertBranchAccess } from './utils/assert-branch-access';
import type { DatabaseInstance } from '@/core/database';
import type { DentalQueueItem } from './repos/queue-item.schema';

export async function updateQueueItemStatus(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { itemId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const queueRepo = new QueueItemRepository(db, logger);
  const item = await queueRepo.findOneById(itemId);
  if (!item) throw new NotFoundError('Queue item not found');

  await assertBranchAccess(db, user.id, item.branchId);

  const allowed = QUEUE_ITEM_FSM[item.status];
  if (!allowed.includes(body.status)) {
    throw new BusinessLogicError(
      `Invalid transition: '${item.status}' → '${body.status}'. Allowed: [${allowed.join(', ')}]`,
      'INVALID_FSM_TRANSITION',
    );
  }

  const now = new Date();
  const timestamps: Partial<Pick<DentalQueueItem, 'calledAt' | 'startedAt' | 'completedAt'>> = {};
  if (body.status === 'called') timestamps.calledAt = now;
  if (body.status === 'in_progress') timestamps.startedAt = now;
  if (body.status === 'completed') timestamps.completedAt = now;

  const updated = await queueRepo.update(itemId, {
    status: body.status,
    ...timestamps,
    ...(body.notes !== undefined ? { notes: body.notes } : {}),
  });

  logger?.info({ action: 'updateQueueItemStatus', itemId, from: item.status, to: body.status }, 'Queue item status updated');

  return ctx.json(updated);
}
