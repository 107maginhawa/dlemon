import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalAuditLog, type NewDentalAuditLog, type DentalAuditLog } from './audit-log.schema';

export interface AuditLogFilters {
  actorId?: string;
  tenantId?: string;
  branchId?: string;
  targetType?: string;
  targetId?: string;
  action?: string;
  from?: Date;
  to?: Date;
}

export class AuditLogRepository {
  constructor(private db: DatabaseInstance) {}

  async insert(entry: NewDentalAuditLog): Promise<DentalAuditLog> {
    const [row] = await this.db.insert(dentalAuditLog).values(entry).returning();
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
