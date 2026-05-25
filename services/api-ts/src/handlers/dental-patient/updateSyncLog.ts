/**
 * updateSyncLog — PATCH /dental/sync-logs/:logId
 *
 * AC-003 / LF-BR-003 / LF-BR-004: Transition sync status. 'synced' is terminal.
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { SyncLogRepository } from './repos/sync-log.repo';
import { SYNC_FSM, type SyncStatus } from './repos/sync-log.schema';
import type { DatabaseInstance } from '@/core/database';

export async function updateSyncLog(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { logId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new SyncLogRepository(db, logger);
  const existing = await repo.findOneById(logId);
  if (!existing) throw new NotFoundError('Sync log not found');

  const updates: Record<string, unknown> = {};

  if (body['serverId'] !== undefined) updates['serverId'] = body['serverId'];
  if (body['error'] !== undefined) updates['error'] = body['error'];

  if (body['syncStatus'] !== undefined) {
    const from = existing.syncStatus as SyncStatus;
    const to = body['syncStatus'] as SyncStatus;
    const allowed = SYNC_FSM[from];

    if (!allowed.includes(to)) {
      throw new BusinessLogicError(
        `Invalid sync status transition: ${from} → ${to}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
        'SYNC_INVALID_TRANSITION',
      );
    }

    updates['syncStatus'] = to;
    if (to === 'synced') updates['lastSyncAt'] = new Date();
  }

  const log = await repo.update(logId, updates as any);
  if (!log) throw new NotFoundError('Sync log not found');

  logger?.info({ action: 'updateSyncLog', logId, syncStatus: updates['syncStatus'] }, 'Sync log updated');

  return ctx.json(log, 200);
}
