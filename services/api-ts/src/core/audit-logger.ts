/**
 * Dental audit shim — writes to Pino, dental_audit_log (spec), AND dental_audit (legacy).
 * Writes are inline/synchronous (ADR-005) — there is no async/pg-boss pipeline.
 *
 * Use in any handler that touches PHI. By default fire-and-forget: a write failure
 * is logged but never breaks the main request. EXCEPTION (fail-closed): security-class
 * events (eventType === 'security') and calls passing `{ failClosed: true }` RETHROW
 * when the authoritative `dental_audit_log` write fails (see logAuditEvent below).
 */

import type { DatabaseInstance } from './database';
import type { Logger } from '@/types/logger';
import { DentalAuditRepository } from '@/db/audit.repo';
import { AuditLogRepository } from '@/handlers/dental-audit/repos/audit-log.repo';
import { sanitizeAuditField } from './audit-phi-sanitizer';

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
 * V-AUD-001 / V-AUD-NEW-A / V-AUD-101 (PHI guard): The audit log is append-only and
 * never deleted, so any PHI written into `metadata` OR the before/after row snapshots is
 * unremediable (AC-AUD-004 / "No PHI in log body" / HIPAA breach). The recursive
 * sanitizer now lives in `core/audit-phi-sanitizer.ts` so it is shared across EVERY
 * write path that goes through `AuditLogRepository.insert` (the single choke point) —
 * it sanitizes there too, without going through this function. (Audit writes are
 * inline/synchronous per ADR-005; there is no async/pg-boss consumer.)
 *
 * `logAuditEvent` still sanitizes here for two reasons: (1) to emit the best-effort
 * warn log when PHI is stripped, and (2) because the legacy `dental_audit` table write
 * below does NOT go through `AuditLogRepository`, so it would otherwise be uncovered.
 * Sanitization is idempotent, so the second sanitize inside `AuditLogRepository.insert`
 * is a no-op on these already-clean values.
 */
function sanitizeAuditObject(
  obj: Record<string, unknown> | null | undefined,
  logger: Logger | null | undefined,
  event: AuditEvent,
  field: string,
): Record<string, unknown> | null {
  return sanitizeAuditField(obj, (strippedKeys) => {
    logger?.warn(
      {
        strippedKeys,
        field,
        action: event.action,
        resourceType: event.resourceType,
      },
      `dental.audit: stripped PHI keys from audit ${field} before persisting (V-AUD-001/V-AUD-NEW-A)`,
    );
  });
}

function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | null | undefined,
  logger: Logger | null | undefined,
  event: AuditEvent,
): Record<string, unknown> | null {
  return sanitizeAuditObject(metadata, logger, event, 'metadata');
}

/**
 * T-001 (PHI in logs): the Pino stream must carry only non-PHI identifiers. The raw
 * event's `metadata` / `before` / `after` snapshots routinely contain names, email,
 * DOB, and clinical free-text, and they nest too deep for the logger's `*.field`
 * redact paths. Log ONLY these safe fields; PHI goes (sanitized) to the DB tables.
 */
function safeAuditLogFields(event: AuditEvent) {
  return {
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    personId: event.personId,
    tenantId: event.tenantId,
    branchId: event.branchId,
    eventType: event.eventType,
    actorRole: event.actorRole,
  };
}

/**
 * Per-call options for {@link logAuditEvent}.
 *
 * `failClosed` (dental-audit P1-C): escalate THIS call to the same fail-closed
 * guarantee as security events — rethrow when the authoritative `dental_audit_log`
 * write fails — WITHOUT changing the default fire-and-forget behaviour for the
 * ~70 other producer handlers (no global flip). Set it on financial/clinical
 * mutations (void / discount / payment / visit-complete / role-change) so a
 * money/clinical mutation can never silently report success with no audit row.
 */
export interface LogAuditEventOptions {
  failClosed?: boolean;
}

export async function logAuditEvent(
  db: DatabaseInstance,
  logger: Logger | null | undefined,
  event: AuditEvent,
  opts?: LogAuditEventOptions,
): Promise<void> {
  // Pino log — safe identifiers only (T-001: never the PHI-bearing snapshots/metadata).
  logger?.info({ audit: safeAuditLogFields(event) }, `dental.audit: ${event.action}`);

  // V-AUD-001: strip PHI keys from metadata once, before either persisted write.
  const safeMetadata = sanitizeAuditMetadata(event.metadata, logger, event);

  // V-AUD-NEW-A: row snapshots routinely contain PHI (names, DOB, clinical text)
  // nested at any depth. The audit log is append-only/never-deleted, so PHI baked into
  // before_snapshot/after_snapshot is unremediable. Recursively sanitize both before
  // they are persisted to EITHER audit table.
  const safeBefore = sanitizeAuditObject(event.before, logger, event, 'before_snapshot');
  const safeAfter = sanitizeAuditObject(event.after, logger, event, 'after_snapshot');

  // V-AUD-007 (fail-closed): per ADR-005, security-class events must NOT be silently
  // lost — a swallowed failure on a security audit (PIN set, role change, cross-tenant
  // access) is a compliance hole. For these events we RETHROW on the authoritative
  // dental_audit_log write so the failure surfaces to the caller. Non-security events
  // keep the existing fire-and-forget behaviour.
  // P1-C: security events are always fail-closed; opts.failClosed escalates a
  // single non-security financial/clinical call to the same guarantee.
  const isSecurityEvent = event.eventType === 'security';
  const mustFailClosed = isSecurityEvent || opts?.failClosed === true;

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
        beforeSnapshot: safeBefore,
        afterSnapshot: safeAfter,
      }),
    );
  } catch (err) {
    logger?.error({ err, audit: safeAuditLogFields(event) }, 'dental.audit: failed to write to dental_audit_log');
    if (mustFailClosed) {
      // Fail-closed (ADR-005 / P1-C): surface security AND opt-in financial/clinical
      // audit failures rather than swallow them.
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
        before: safeBefore,
        after: safeAfter,
      }),
    );
  } catch (err) {
    logger?.error({ err, audit: safeAuditLogFields(event) }, 'dental.audit: failed to write to dental_audit');
  }
}
