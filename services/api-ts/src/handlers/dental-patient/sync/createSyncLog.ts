/**
 * createSyncLog — POST /dental/sync-logs
 *
 * AC-001 / LF-BR-001: Register a local-first sync entry for an offline-created entity.
 */

import { UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { SyncLogRepository } from '../repos/sync-log.repo';
import type { DentalSyncLog } from '../repos/sync-log.schema';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function createSyncLog(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json') as Partial<DentalSyncLog>;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // G1 (P0): branchId is REQUIRED — a branchless sync log bypassed authorization
  // entirely. Reject it, then authorize unconditionally against the caller's branch.
  if (!body.branchId) {
    return ctx.json({ error: 'branchId is required' }, 400);
  }
  await assertBranchAccess(db, user.id, body.branchId);

  const repo = new SyncLogRepository(db, logger);
  const log = await repo.create({
    localId: body.localId ?? '',
    entityType: body.entityType ?? '',
    entityId: body.entityId ?? '',
    serverId: body.serverId ?? null,
    branchId: body.branchId ?? null,
    syncStatus: 'pending',
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createSyncLog', localId: body.localId, entityType: body.entityType }, 'Sync log created');

  return ctx.json(log, 201);
}
