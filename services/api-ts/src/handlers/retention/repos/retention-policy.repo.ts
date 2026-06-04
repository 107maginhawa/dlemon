/**
 * RetentionPolicyRepository — data access for dental_retention_policy.
 */

import { eq, and, isNull } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  dentalRetentionPolicies,
  type DentalRetentionPolicy,
  type NewDentalRetentionPolicy,
  type RetentionAction,
} from './retention-policy.schema';

export interface RetentionPolicyFilters {
  tenantId?: string;
  entityType?: string;
  enabled?: boolean;
  action?: RetentionAction;
}

export class RetentionPolicyRepository extends DatabaseRepository<
  DentalRetentionPolicy,
  NewDentalRetentionPolicy,
  RetentionPolicyFilters
> {
  constructor(db: DatabaseInstance, logger?: unknown) {
    super(db, dentalRetentionPolicies, logger);
  }

  protected buildWhereConditions(filters?: RetentionPolicyFilters) {
    const conditions = [isNull(dentalRetentionPolicies.deletedAt)];
    if (filters?.tenantId) conditions.push(eq(dentalRetentionPolicies.tenantId, filters.tenantId));
    if (filters?.entityType) conditions.push(eq(dentalRetentionPolicies.entityType, filters.entityType));
    if (filters?.enabled !== undefined) conditions.push(eq(dentalRetentionPolicies.enabled, filters.enabled));
    if (filters?.action) conditions.push(eq(dentalRetentionPolicies.action, filters.action));
    return and(...conditions);
  }

  override async findMany(filters?: RetentionPolicyFilters): Promise<DentalRetentionPolicy[]> {
    const where = this.buildWhereConditions(filters);
    return await this.db.select().from(dentalRetentionPolicies).where(where);
  }

  override async findOneById(id: string): Promise<DentalRetentionPolicy | null> {
    const [row] = await this.db
      .select()
      .from(dentalRetentionPolicies)
      .where(and(eq(dentalRetentionPolicies.id, id), isNull(dentalRetentionPolicies.deletedAt)));
    return row ?? null;
  }

  /**
   * Enabled, non-deleted policies — the set the enforcement job evaluates.
   * Pass a tenantId to scope to one organisation.
   */
  async findEnabled(tenantId?: string): Promise<DentalRetentionPolicy[]> {
    return this.findMany({ enabled: true, ...(tenantId ? { tenantId } : {}) });
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.db
      .update(dentalRetentionPolicies)
      .set({ deletedAt: new Date() })
      .where(and(eq(dentalRetentionPolicies.id, id), isNull(dentalRetentionPolicies.deletedAt)))
      .returning({ id: dentalRetentionPolicies.id });
    return result.length > 0;
  }
}
