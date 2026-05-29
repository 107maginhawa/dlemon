/**
 * BranchRepository — data access for dental branches
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { dentalBranches, type DentalBranch, type NewDentalBranch } from './branch.schema';

export interface BranchFilters {
  organizationId?: string;
  active?: boolean;
}

export class BranchRepository extends DatabaseRepository<DentalBranch, NewDentalBranch, BranchFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, dentalBranches, logger);
  }

  protected buildWhereConditions(filters?: BranchFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.organizationId) conditions.push(eq(dentalBranches.organizationId, filters.organizationId));
    if (filters.active !== undefined) conditions.push(eq(dentalBranches.active, filters.active));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Create with timezone validation
   */
  override async createOne(data: NewDentalBranch): Promise<DentalBranch> {
    if (!data.timezone || data.timezone.trim() === '') {
      throw new Error('timezone is required');
    }
    return super.createOne(data);
  }

  /**
   * List all branches belonging to an organization
   */
  async listByOrg(organizationId: string): Promise<DentalBranch[]> {
    return this.db
      .select()
      .from(dentalBranches)
      .where(eq(dentalBranches.organizationId, organizationId));
  }

  /**
   * V-ORG-004 (perf §16): resolve the org's default (first active) branch with
   * a scoped `WHERE active=true LIMIT 1` instead of loading every branch and
   * filtering in app code (EF-ORG-P022: never auto-select an inactive branch).
   */
  async findFirstActiveByOrg(organizationId: string): Promise<DentalBranch | null> {
    const [row] = await this.db
      .select()
      .from(dentalBranches)
      .where(and(
        eq(dentalBranches.organizationId, organizationId),
        eq(dentalBranches.active, true),
      ))
      .limit(1);
    return row ?? null;
  }
}
