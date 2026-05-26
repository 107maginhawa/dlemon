/**
 * Dental audit shim — writes to Pino, dental_audit (legacy), AND dental_audit_log (spec).
 *
 * Use in any handler that touches PHI. Never throws — audit failure
 * must never break the main request.
 */

import type { DatabaseInstance } from './database';
import { DentalAuditRepository } from '@/db/audit.repo';
import { AuditLogRepository } from '@/handlers/dental-audit/repos/audit-log.repo';

export interface AuditEvent {
  personId: string;
  tenantId: string;
  branchId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  reason?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export async function logAuditEvent(
  db: DatabaseInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  event: AuditEvent,
): Promise<void> {
  // Pino log (existing behaviour)
  logger?.info({ audit: event }, `dental.audit: ${event.action}`);

  // Write to dental_audit (legacy table — keeps existing wiring tests passing)
  try {
    const repo = new DentalAuditRepository(db);
    await repo.log({
      personId: event.personId,
      tenantId: event.tenantId,
      branchId: event.branchId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      metadata: event.metadata ?? null,
      before: event.before ?? null,
      after: event.after ?? null,
    });
  } catch (err) {
    logger?.error({ err, event }, 'dental.audit: failed to write to dental_audit');
  }

  // Write to dental_audit_log (spec-compliant table — actorId, targetType, targetId, snapshots)
  try {
    const auditLogRepo = new AuditLogRepository(db);
    await auditLogRepo.insert({
      actorId: event.personId,
      tenantId: event.tenantId,
      branchId: event.branchId,
      action: event.action,
      targetType: event.resourceType,
      targetId: event.resourceId,
      reason: event.reason,
      beforeSnapshot: event.before ?? null,
      afterSnapshot: event.after ?? null,
    });
  } catch (err) {
    logger?.error({ err, event }, 'dental.audit: failed to write to dental_audit_log');
  }
}
