/**
 * updateSyncLog — PATCH /dental/sync-logs/:logId
 *
 * AC-003 / LF-BR-003 / LF-BR-004: Transition sync status. 'synced' is terminal.
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { SyncLogRepository } from '../repos/sync-log.repo';
import { SYNC_FSM, type SyncStatus, type DentalSyncLog } from '../repos/sync-log.schema';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function updateSyncLog(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { logId } = ctx.req.valid('param') as { logId: string };
  const body = ctx.req.valid('json') as Partial<DentalSyncLog> & { version?: number };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new SyncLogRepository(db, logger);
  const existing = await repo.findOneById(logId);
  if (!existing) throw new NotFoundError('Sync log not found');

  // G1 (P0): authorize unconditionally against the row's branch. A branchless
  // row (legacy) has no tenant anchor and must not be mutable by anyone.
  if (!existing.branchId) {
    throw new ForbiddenError('Sync log has no branch and cannot be modified', 'BRANCH_ACCESS_DENIED');
  }
  await assertBranchAccess(db, user.id, existing.branchId);

  // LF-BR-004: stale-write conflict detection
  if (body.version !== undefined && body.version !== existing.version) {
    return ctx.json({
      error: `Stale write: client version ${body.version}, server version ${existing.version}`,
      code: 'CONFLICT',
      conflictPayload: { current: existing, incoming: body },
    }, 409);
  }

  const updates: Partial<Pick<DentalSyncLog, 'serverId' | 'error' | 'syncStatus' | 'lastSyncAt'>> = {};

  if (body.serverId !== undefined) updates.serverId = body.serverId;
  if (body.error !== undefined) updates.error = body.error;

  if (body.syncStatus !== undefined) {
    const from = existing.syncStatus as SyncStatus;
    const to = body.syncStatus as SyncStatus;
    const allowed = SYNC_FSM[from];

    if (!allowed.includes(to)) {
      throw new BusinessLogicError(
        `Invalid sync status transition: ${from} → ${to}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
        'SYNC_INVALID_TRANSITION',
      );
    }

    updates.syncStatus = to;
    if (to === 'synced') updates.lastSyncAt = new Date();
  }

  const log = await repo.update(logId, updates);
  if (!log) throw new NotFoundError('Sync log not found');

  logger?.info({ action: 'updateSyncLog', logId, syncStatus: updates.syncStatus }, 'Sync log updated');

  return ctx.json(log, 200);
}
