/**
 * createSyncLog — POST /dental/sync-logs
 *
 * AC-001 / LF-BR-001: Register a local-first sync entry for an offline-created entity.
 */

import { UnauthorizedError } from '@/core/errors';
import { SyncLogRepository } from '../repos/sync-log.repo';
import type { DatabaseInstance } from '@/core/database';

export async function createSyncLog(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new SyncLogRepository(db, logger);
  const log = await repo.create({
    localId: body.localId,
    entityType: body.entityType,
    entityId: body.entityId,
    serverId: body.serverId ?? null,
    branchId: body.branchId ?? null,
    syncStatus: 'pending',
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createSyncLog', localId: body.localId, entityType: body.entityType }, 'Sync log created');

  return ctx.json(log, 201);
}
