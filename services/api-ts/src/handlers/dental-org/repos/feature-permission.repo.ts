/**
 * FeaturePermissionRepository — data access for granular feature permissions (P2-17).
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import type { Logger } from '@/types/logger';
import {
  dentalFeaturePermissions,
  type DentalFeaturePermission,
  type NewDentalFeaturePermission,
} from './feature-permission.schema';
import type { MemberRole } from './membership.schema';

export interface FeaturePermissionFilters {
  organizationId?: string;
  role?: MemberRole;
}

export class FeaturePermissionRepository extends DatabaseRepository<
  DentalFeaturePermission,
  NewDentalFeaturePermission,
  FeaturePermissionFilters
> {
  constructor(db: DatabaseInstance, logger?: Logger) {
    super(db, dentalFeaturePermissions, logger);
  }

  protected buildWhereConditions(filters?: FeaturePermissionFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.organizationId) conditions.push(eq(dentalFeaturePermissions.organizationId, filters.organizationId));
    if (filters.role) conditions.push(eq(dentalFeaturePermissions.role, filters.role));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /** All override rows for an organization. */
  async listByOrg(organizationId: string): Promise<DentalFeaturePermission[]> {
    return this.db
      .select()
      .from(dentalFeaturePermissions)
      .where(eq(dentalFeaturePermissions.organizationId, organizationId));
  }

  /** Look up a single (org, role, feature) override; null if none (→ default applies). */
  async findOverride(
    organizationId: string,
    role: MemberRole,
    feature: string,
  ): Promise<DentalFeaturePermission | null> {
    const [row] = await this.db
      .select()
      .from(dentalFeaturePermissions)
      .where(and(
        eq(dentalFeaturePermissions.organizationId, organizationId),
        eq(dentalFeaturePermissions.role, role),
        eq(dentalFeaturePermissions.feature, feature),
      ))
      .limit(1);
    return row ?? null;
  }

  /**
   * Upsert a (org, role, feature) override decision. One row per tuple
   * (enforced by the unique index).
   */
  async upsertOverride(
    organizationId: string,
    role: MemberRole,
    feature: string,
    allowed: boolean,
    actorId?: string,
  ): Promise<DentalFeaturePermission> {
    const [row] = await this.db
      .insert(dentalFeaturePermissions)
      .values({ organizationId, role, feature, allowed, createdBy: actorId, updatedBy: actorId })
      .onConflictDoUpdate({
        target: [
          dentalFeaturePermissions.organizationId,
          dentalFeaturePermissions.role,
          dentalFeaturePermissions.feature,
        ],
        set: { allowed, updatedAt: new Date(), updatedBy: actorId },
      })
      .returning();
    return row!;
  }

  /** Remove a (org, role, feature) override so it reverts to the catalog default. */
  async deleteOverride(organizationId: string, role: MemberRole, feature: string): Promise<void> {
    await this.db
      .delete(dentalFeaturePermissions)
      .where(and(
        eq(dentalFeaturePermissions.organizationId, organizationId),
        eq(dentalFeaturePermissions.role, role),
        eq(dentalFeaturePermissions.feature, feature),
      ));
  }
}
