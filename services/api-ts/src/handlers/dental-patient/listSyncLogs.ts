/**
 * listSyncLogs — GET /dental/sync-logs
 *
 * AC-002 / LF-BR-003: List sync log entries (visible as pending/syncing/synced/failed).
 */

import { UnauthorizedError } from '@/core/errors';
import { SyncLogRepository } from './repos/sync-log.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listSyncLogs(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new SyncLogRepository(db, logger);
  const logs = await repo.findAll();

  return ctx.json(logs, 200);
}
