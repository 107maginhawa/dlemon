/**
 * audit-query.facade.ts
 *
 * Read-only facade exposing the append-only audit log to other modules without
 * leaking the dental-audit repo/schema across the module boundary. Sibling of
 * the write path (`@/core/audit-logger`).
 *
 * Consumed by retention observability (G2) to derive last-run / dry-run-vs-live
 * status from the `retention.*` compliance events the engine writes.
 */
import { inArray, and, eq, desc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalAuditLog } from './repos/audit-log.schema';

export interface AuditEventRow {
  action: string;
  timestamp: Date;
  metadata: unknown;
}

/**
 * Audit events whose `action` is one of `actions`, newest first. Optionally
 * scoped to a tenant. Returns only the safe, non-PHI columns a status/summary
 * surface needs (action, timestamp, metadata) — never snapshots.
 */
export async function findAuditEventsByActions(
  db: DatabaseInstance,
  actions: string[],
  tenantId?: string,
): Promise<AuditEventRow[]> {
  if (actions.length === 0) return [];
  const actionFilter = inArray(dentalAuditLog.action, actions);
  const where = tenantId ? and(actionFilter, eq(dentalAuditLog.tenantId, tenantId)) : actionFilter;

  return db
    .select({
      action: dentalAuditLog.action,
      timestamp: dentalAuditLog.timestamp,
      metadata: dentalAuditLog.metadata,
    })
    .from(dentalAuditLog)
    .where(where)
    .orderBy(desc(dentalAuditLog.timestamp));
}
