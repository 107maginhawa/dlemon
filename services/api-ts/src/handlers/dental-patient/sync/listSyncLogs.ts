/**
 * listSyncLogs — GET /dental/sync-logs
 *
 * AC-002 / LF-BR-003: List sync log entries (visible as pending/syncing/synced/failed).
 */

import { UnauthorizedError } from '@/core/errors';
import { logAuditEvent } from '@/core/audit-logger';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { SyncLogRepository } from '../repos/sync-log.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function listSyncLogs(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // G1 (P0): scope sync logs to a branch the caller can access. branchId is a
  // real query param the FE already sends (use-sync-status.ts); it is absent
  // from the TypeSpec schema (documented drift) so read it from the raw query.
  // Without it we must NOT return every org's logs — reject like listDentalPatients.
  const branchId = ctx.req.query('branchId');
  if (!branchId) {
    return ctx.json({ error: 'branchId is required' }, 400);
  }
  await assertBranchAccess(db, user.id, branchId);

  const repo = new SyncLogRepository(db, logger);
  const logs = await repo.findAll([branchId]);

  // EF-PAT-005: audit READ access to sync logs
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: user.id,
    action: 'patient.sync_logs.read',
    resourceType: 'dental_sync_logs',
  });

  return ctx.json(logs, 200);
}
