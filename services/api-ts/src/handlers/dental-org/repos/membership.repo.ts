/**
 * MembershipRepository — data access for dental staff memberships
 */

import { eq, and, isNotNull } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  dentalMemberships,
  type DentalMembership,
  type NewDentalMembership,
} from './membership.schema';

export interface MembershipFilters {
  branchId?: string;
  status?: 'active' | 'inactive';
}

export interface ListByBranchOptions {
  includeInactive?: boolean;
}

export class MembershipRepository extends DatabaseRepository<
  DentalMembership,
  NewDentalMembership,
  MembershipFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, dentalMemberships, logger);
  }

  protected buildWhereConditions(filters?: MembershipFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.branchId) conditions.push(eq(dentalMemberships.branchId, filters.branchId));
    if (filters.status) conditions.push(eq(dentalMemberships.status, filters.status));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * List members in a branch; excludes inactive by default
   */
  async listByBranch(branchId: string, opts: ListByBranchOptions = {}): Promise<DentalMembership[]> {
    const conditions = [eq(dentalMemberships.branchId, branchId)];
    if (!opts.includeInactive) {
      conditions.push(eq(dentalMemberships.status, 'active'));
    }
    return this.db
      .select()
      .from(dentalMemberships)
      .where(and(...conditions));
  }

  /**
   * Count active members in a branch (used for tier limit enforcement)
   */
  async countActiveByBranch(branchId: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(dentalMemberships)
      .where(and(eq(dentalMemberships.branchId, branchId), eq(dentalMemberships.status, 'active')));
    return rows.length;
  }

  /**
   * Set or replace the PIN hash for a member
   */
  async updatePin(id: string, pinHash: string): Promise<DentalMembership | null> {
    const [updated] = await this.db
      .update(dentalMemberships)
      .set({ pinHash, updatedAt: new Date() })
      .where(eq(dentalMemberships.id, id))
      .returning();
    return updated ?? null;
  }

  /**
   * Deactivate a membership
   */
  async deactivate(id: string): Promise<DentalMembership | null> {
    const [updated] = await this.db
      .update(dentalMemberships)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(dentalMemberships.id, id))
      .returning();
    return updated ?? null;
  }

  /**
   * Record a failed PIN attempt, applying lockout at thresholds:
   *   5 attempts  → 30-second lockout
   *   10 attempts → 5-minute lockout
   * Returns null when member not found.
   */
  async recordFailedPinAttempt(id: string): Promise<DentalMembership | null> {
    const member = await this.findOneById(id);
    if (!member) return null;

    const attempts = (member.pinFailedAttempts ?? 0) + 1;

    let pinLockedUntil: Date | null = member.pinLockedUntil ?? null;
    if (attempts >= 10) {
      pinLockedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    } else if (attempts >= 5) {
      pinLockedUntil = new Date(Date.now() + 30 * 1000); // 30 seconds
    }

    const [updated] = await this.db
      .update(dentalMemberships)
      .set({ pinFailedAttempts: attempts, pinLockedUntil, updatedAt: new Date() })
      .where(eq(dentalMemberships.id, id))
      .returning();
    return updated ?? null;
  }

  /**
   * Reset PIN failure counter and clear any active lockout (called on successful auth).
   * Returns null when member not found.
   */
  async resetPinAttempts(id: string): Promise<DentalMembership | null> {
    const [updated] = await this.db
      .update(dentalMemberships)
      .set({ pinFailedAttempts: 0, pinLockedUntil: null, updatedAt: new Date() })
      .where(eq(dentalMemberships.id, id))
      .returning();
    return updated ?? null;
  }

  /**
   * Returns true if the member is currently locked out (pinLockedUntil is set and in the future).
   */
  isLockedOut(member: DentalMembership): boolean {
    return member.pinLockedUntil !== null && member.pinLockedUntil > new Date();
  }

  /**
   * FR6.4: Record the current timestamp as lastLoginAt for activity visibility.
   */
  async trackLastLogin(id: string): Promise<void> {
    await this.db
      .update(dentalMemberships)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(dentalMemberships.id, id));
  }

  /**
   * EM-ORG-002: Locate the caller's active membership in a given branch by personId.
   * Returns null when the caller has no active membership in that branch.
   *
   * Used by setPin to determine whether the caller is (a) the target member
   * themselves or (b) a dentist_owner authorized to set another member's PIN.
   */
  async findByPersonAndBranch(personId: string, branchId: string): Promise<DentalMembership | null> {
    const [row] = await this.db
      .select()
      .from(dentalMemberships)
      .where(and(
        eq(dentalMemberships.personId, personId),
        eq(dentalMemberships.branchId, branchId),
        eq(dentalMemberships.status, 'active'),
      ))
      .limit(1);
    return row ?? null;
  }
}
