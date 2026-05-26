/**
 * Dental audit shim — writes to Pino AND the dental_audit DB table.
 *
 * Use in any handler that touches PHI. Never throws — audit failure
 * must never break the main request.
 */

import type { DatabaseInstance } from './database';
import { DentalAuditRepository } from '@/db/audit.repo';

export interface AuditEvent {
  personId: string;
  tenantId: string;
  branchId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(
  db: DatabaseInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  event: AuditEvent,
): Promise<void> {
  // Pino log (existing behaviour)
  logger?.info({ audit: event }, `dental.audit: ${event.action}`);

  // Write to DB (new)
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
    });
  } catch (err) {
    // Never propagate — audit failure must not break main request
    logger?.error({ err, event }, 'dental.audit: failed to write to DB');
  }
}
