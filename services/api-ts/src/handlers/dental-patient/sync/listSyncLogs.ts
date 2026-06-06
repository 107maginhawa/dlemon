/**
 * listSyncLogs — GET /dental/sync-logs
 *
 * AC-002 / LF-BR-003: List sync log entries (visible as pending/syncing/synced/failed).
 */

import { UnauthorizedError } from '@/core/errors';
import { logAuditEvent } from '@/core/audit-logger';
import { SyncLogRepository } from '../repos/sync-log.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function listSyncLogs(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new SyncLogRepository(db, logger);
  const logs = await repo.findAll();

  // EF-PAT-005: audit READ access to sync logs
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: user.id,
    action: 'patient.sync_logs.read',
    resourceType: 'dental_sync_logs',
  });

  return ctx.json(logs, 200);
}
