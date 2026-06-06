/**
 * listQueueBoard — GET /dental/branches/:branchId/queue-board
 *
 * Returns all active (non-terminal) queue items for the branch.
 */

import { UnauthorizedError } from '@/core/errors';
import { QueueItemRepository } from './repos/queue-item.repo';
import { assertBranchAccess } from './utils/assert-branch-access';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function listQueueBoard(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { branchId } = ctx.req.valid('param') as { branchId: string };
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  await assertBranchAccess(db, user.id, branchId);

  const queueRepo = new QueueItemRepository(db, logger);
  const items = await queueRepo.findActiveByBranch(branchId);

  return ctx.json(items);
}
