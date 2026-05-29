import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalAuditLog, type NewDentalAuditLog, type DentalAuditLog } from './audit-log.schema';
import { sanitizeAuditField } from '@/core/audit-phi-sanitizer';

export interface AuditLogFilters {
  actorId?: string;
  tenantId?: string;
  branchId?: string;
  eventType?: string;
  targetType?: string;
  targetId?: string;
  action?: string;
  from?: Date;
  to?: Date;
}

export class AuditLogRepository {
  constructor(private db: DatabaseInstance) {}

  async insert(entry: NewDentalAuditLog): Promise<DentalAuditLog> {
    // V-AUD-101 / CONF-AUD-001 (PHI choke point): strip PHI from the JSONB fields
    // HERE, in the repository, so EVERY write path is covered regardless of caller —
    // including the pg-boss `domain-events.consumer.ts` path, which calls insert()
    // directly with caller-supplied snapshots. The audit store is append-only and
    // never deleted (DATA_GOVERNANCE §2/§3), so PHI written here is unremediable
    // (AC-AUD-004 / MODULE_SPEC §5 "No PHI in log body"). Sanitization is idempotent,
    // so callers that already sanitized (logAuditEvent) pass through unchanged.
    const safeEntry: NewDentalAuditLog = {
      ...entry,
      metadata: sanitizeAuditField(entry.metadata as Record<string, unknown> | null | undefined),
      beforeSnapshot: sanitizeAuditField(
        entry.beforeSnapshot as Record<string, unknown> | null | undefined,
      ),
      afterSnapshot: sanitizeAuditField(
        entry.afterSnapshot as Record<string, unknown> | null | undefined,
      ),
    };

    // EM-AUD-008: generate the id explicitly. The id column has no reliable
    // DB-level default in migrated databases (schema drift), so relying on it
    // makes audit writes fail the NOT NULL constraint — and audit-logger swallows
    // the error, leaving the dental audit viewer blind. See [[project_run7_enforcement]].
    const [row] = await this.db
      .insert(dentalAuditLog)
      .values({ ...safeEntry, id: safeEntry.id ?? crypto.randomUUID() })
      .returning();
    return row!;
  }

  async list(
    filters: AuditLogFilters,
    pagination: { limit: number; offset: number },
  ): Promise<{ entries: DentalAuditLog[]; total: number }> {
    const conditions = [];
    if (filters.actorId)    conditions.push(eq(dentalAuditLog.actorId, filters.actorId));
    if (filters.tenantId)   conditions.push(eq(dentalAuditLog.tenantId, filters.tenantId));
    if (filters.branchId)   conditions.push(eq(dentalAuditLog.branchId, filters.branchId));
    if (filters.eventType)  conditions.push(eq(dentalAuditLog.eventType, filters.eventType));
    if (filters.targetType) conditions.push(eq(dentalAuditLog.targetType, filters.targetType));
    if (filters.targetId)   conditions.push(eq(dentalAuditLog.targetId, filters.targetId));
    if (filters.action)     conditions.push(eq(dentalAuditLog.action, filters.action));
    if (filters.from)       conditions.push(gte(dentalAuditLog.timestamp, filters.from));
    if (filters.to)         conditions.push(lte(dentalAuditLog.timestamp, filters.to));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [entries, countResult] = await Promise.all([
      this.db
        .select()
        .from(dentalAuditLog)
        .where(where)
        .orderBy(desc(dentalAuditLog.timestamp))
        .limit(pagination.limit)
        .offset(pagination.offset),
      this.db
        .select({ id: dentalAuditLog.id })
        .from(dentalAuditLog)
        .where(where),
    ]);

    return { entries, total: countResult.length };
  }
}
