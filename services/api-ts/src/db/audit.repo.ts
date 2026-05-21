/**
 * DentalAuditRepository — CRUD for the dental_audit table.
 */

import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalAudit, type NewDentalAuditEntry, type DentalAuditEntry } from './audit.schema';

export interface AuditFilters {
  personId?: string;
  tenantId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  from?: Date;
  to?: Date;
}

export class DentalAuditRepository {
  constructor(private db: DatabaseInstance) {}

  async log(entry: NewDentalAuditEntry): Promise<void> {
    await this.db.insert(dentalAudit).values(entry);
  }

  async query(
    filters: AuditFilters,
    pagination: { limit: number; offset: number },
  ): Promise<{ entries: DentalAuditEntry[]; total: number }> {
    const conditions = [];
    if (filters.personId) conditions.push(eq(dentalAudit.personId, filters.personId));
    if (filters.tenantId) conditions.push(eq(dentalAudit.tenantId, filters.tenantId));
    if (filters.resourceType) conditions.push(eq(dentalAudit.resourceType, filters.resourceType));
    if (filters.resourceId) conditions.push(eq(dentalAudit.resourceId, filters.resourceId));
    if (filters.action) conditions.push(eq(dentalAudit.action, filters.action));
    if (filters.from) conditions.push(gte(dentalAudit.timestamp, filters.from));
    if (filters.to) conditions.push(lte(dentalAudit.timestamp, filters.to));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [entries, countResult] = await Promise.all([
      this.db
        .select()
        .from(dentalAudit)
        .where(where)
        .orderBy(desc(dentalAudit.timestamp))
        .limit(pagination.limit)
        .offset(pagination.offset),
      this.db
        .select({ id: dentalAudit.id })
        .from(dentalAudit)
        .where(where),
    ]);

    return { entries, total: countResult.length };
  }
}
