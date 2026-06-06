/**
 * OrganizationRepository — data access for dental organizations
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import type { Logger } from '@/types/logger';
import {
  dentalOrganizations,
  type DentalOrganization,
  type NewDentalOrganization,
  VALID_ORG_TIERS,
} from './organization.schema';

export interface OrgFilters {
  ownerPersonId?: string;
  active?: boolean;
}

export class OrganizationRepository extends DatabaseRepository<
  DentalOrganization,
  NewDentalOrganization,
  OrgFilters
> {
  constructor(db: DatabaseInstance, logger?: Logger) {
    super(db, dentalOrganizations, logger);
  }

  protected buildWhereConditions(filters?: OrgFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.ownerPersonId) conditions.push(eq(dentalOrganizations.ownerPersonId, filters.ownerPersonId));
    if (filters.active !== undefined) conditions.push(eq(dentalOrganizations.active, filters.active));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Create with name validation (empty name rejected at application level)
   */
  override async createOne(data: NewDentalOrganization): Promise<DentalOrganization> {
    if (!data.name || data.name.trim() === '') {
      throw new Error('name is required');
    }
    return super.createOne(data);
  }

  /**
   * Update fields on an org; returns null if not found
   */
  async updateOne(id: string, patch: Partial<NewDentalOrganization>): Promise<DentalOrganization | null> {
    const [updated] = await this.db
      .update(dentalOrganizations)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(dentalOrganizations.id, id))
      .returning();
    return updated ?? null;
  }

  /**
   * Throws if tier is not one of the valid enum values
   */
  validateTier(tier: string): void {
    if (!(VALID_ORG_TIERS as readonly string[]).includes(tier)) {
      throw new Error(`Invalid tier: '${tier}'. Valid values: ${VALID_ORG_TIERS.join(', ')}`);
    }
  }
}
