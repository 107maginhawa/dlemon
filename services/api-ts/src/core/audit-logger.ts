/**
 * Dental audit shim — writes to Pino, dental_audit_log (spec), AND dental_audit (legacy).
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
  /** AUDIT_CONTRACTS §2: event classification (data-modification | security | authentication | …). */
  eventType?: string;
  /** AUDIT_CONTRACTS §2: membership role the actor held at time of event. */
  actorRole?: string;
  /** AUDIT_CONTRACTS §2: source IP (web requests only). */
  ipAddress?: string;
  /** AUDIT_CONTRACTS §2: client user-agent (web requests only). */
  userAgent?: string;
}

/**
 * Transient pooled-connection errors (postgres.js can hand out a connection that
 * the server closed under load). The write never reached the server, so a single
 * retry on a fresh connection is safe and idempotent — and prevents a HIPAA audit
 * row from being silently dropped on a connection blip. (EM-AUD-008)
 */
function isTransientConnectionError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? '';
  const code = (err as { code?: string })?.code ?? '';
  return /CONNECTION_CLOSED|CONNECTION_ENDED|CONNECTION_DESTROYED|ECONNRESET|ECONNREFUSED|read ECONN|terminating connection/i.test(
    `${code} ${msg}`,
  );
}

async function withConnectionRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isTransientConnectionError(err)) {
      return await fn(); // one retry on a transient connection drop
    }
    throw err;
  }
}

/**
 * V-AUD-001 (PHI guard): The audit log is append-only and never deleted, so any PHI
 * written into `metadata` is unremediable (AC-AUD-004 / HIPAA breach). Strip obvious
 * PII keys from metadata before it is persisted to EITHER audit table. Matching is
 * case-insensitive and applied at the top level of the metadata object (the only place
 * handlers currently stash free-form fields). Never throws — sanitization must never
 * break the audit write or the originating request.
 */
const PHI_METADATA_KEYS = new Set([
  'displayname',
  'firstname',
  'lastname',
  'fullname',
  'name',
  'email',
  'phone',
  'ssn',
  'dateofbirth',
  'dob',
]);

function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  event: AuditEvent,
): Record<string, unknown> | null {
  if (metadata == null || typeof metadata !== 'object') {
    return (metadata as Record<string, unknown> | null) ?? null;
  }
  try {
    const stripped: string[] = [];
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (PHI_METADATA_KEYS.has(key.toLowerCase())) {
        stripped.push(key);
        continue;
      }
      clean[key] = value;
    }
    if (stripped.length > 0) {
      logger?.warn(
        { strippedKeys: stripped, action: event.action, resourceType: event.resourceType },
        'dental.audit: stripped PHI keys from audit metadata before persisting (V-AUD-001)',
      );
    }
    return clean;
  } catch {
    // Sanitization must never throw — fall back to no metadata rather than risk
    // leaking PHI or breaking the audit write.
    return null;
  }
}

export async function logAuditEvent(
  db: DatabaseInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  event: AuditEvent,
): Promise<void> {
  // Pino log (existing behaviour)
  logger?.info({ audit: event }, `dental.audit: ${event.action}`);

  // V-AUD-001: strip PHI keys from metadata once, before either persisted write.
  const safeMetadata = sanitizeAuditMetadata(event.metadata, logger, event);

  // V-AUD-007 (fail-closed): per ADR-005, security-class events must NOT be silently
  // lost — a swallowed failure on a security audit (PIN set, role change, cross-tenant
  // access) is a compliance hole. For these events we RETHROW on the authoritative
  // dental_audit_log write so the failure surfaces to the caller. Non-security events
  // keep the existing fire-and-forget behaviour.
  const isSecurityEvent = event.eventType === 'security';

  // Write to dental_audit_log FIRST — this is the spec-compliant table the dental
  // audit VIEWER (getAuditEvents) reads, so it is the authoritative sink and must
  // never be starved by a failure of the legacy table below. (EM-AUD-008)
  try {
    const auditLogRepo = new AuditLogRepository(db);
    await withConnectionRetry(() =>
      auditLogRepo.insert({
        actorId: event.personId,
        tenantId: event.tenantId,
        branchId: event.branchId,
        eventType: event.eventType,
        actorRole: event.actorRole,
        action: event.action,
        targetType: event.resourceType,
        targetId: event.resourceId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        reason: event.reason,
        metadata: safeMetadata,
        beforeSnapshot: event.before ?? null,
        afterSnapshot: event.after ?? null,
      }),
    );
  } catch (err) {
    logger?.error({ err, event }, 'dental.audit: failed to write to dental_audit_log');
    if (isSecurityEvent) {
      // Fail-closed (ADR-005): surface security audit failures rather than swallow them.
      throw err;
    }
  }

  // Write to dental_audit (legacy table — kept for existing wiring tests).
  try {
    const repo = new DentalAuditRepository(db);
    await withConnectionRetry(() =>
      repo.log({
        personId: event.personId,
        tenantId: event.tenantId,
        branchId: event.branchId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        metadata: safeMetadata,
        before: event.before ?? null,
        after: event.after ?? null,
      }),
    );
  } catch (err) {
    logger?.error({ err, event }, 'dental.audit: failed to write to dental_audit');
  }
}
