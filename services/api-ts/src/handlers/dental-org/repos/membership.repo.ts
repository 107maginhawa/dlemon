/**
 * MembershipRepository — data access for dental staff memberships
 */

import { eq, and, ne, isNotNull, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { BusinessLogicError } from '@/core/errors';
import {
  dentalMemberships,
  type DentalMembership,
  type NewDentalMembership,
} from './membership.schema';

/**
 * V-ORG-001 / MODULE_SPEC §8 — Membership status state machine.
 * The ONLY legal transitions are:
 *   invited  → active    (staff completes first login)
 *   active   → inactive  (owner deactivates)
 *   inactive → active    (owner reactivates)
 * Any other jump (incl. no-op self-transitions and the unreconciled `revoked`
 * value) is illegal and must be rejected with 422. All status writes route
 * through `transitionStatus` so the guard cannot be bypassed.
 */
export type MembershipLifecycleStatus = 'invited' | 'active' | 'inactive';

const LEGAL_STATUS_TRANSITIONS: Record<MembershipLifecycleStatus, MembershipLifecycleStatus[]> = {
  invited: ['active'],
  active: ['inactive'],
  inactive: ['active'],
};

export function isLegalStatusTransition(
  from: MembershipLifecycleStatus,
  to: MembershipLifecycleStatus,
): boolean {
  return LEGAL_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

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
   * V-ORG-004 (perf §16): paginated branch member listing. Pushes the
   * active-status filter + LIMIT/OFFSET into the SQL query so the DB read is
   * bounded rather than loading every member and slicing in JS.
   */
  async listByBranchPaginated(
    branchId: string,
    opts: ListByBranchOptions & { limit: number; offset: number },
  ): Promise<DentalMembership[]> {
    const conditions = [eq(dentalMemberships.branchId, branchId)];
    if (!opts.includeInactive) {
      conditions.push(eq(dentalMemberships.status, 'active'));
    }
    return this.db
      .select()
      .from(dentalMemberships)
      .where(and(...conditions))
      .limit(opts.limit)
      .offset(opts.offset);
  }

  /**
   * V-ORG-004 (perf §16): total member count for a branch, computed with
   * count(*) rather than materializing every row, so pagination `total` does
   * not require a full load.
   */
  async countByBranch(branchId: string, opts: ListByBranchOptions = {}): Promise<number> {
    const conditions = [eq(dentalMemberships.branchId, branchId)];
    if (!opts.includeInactive) {
      conditions.push(eq(dentalMemberships.status, 'active'));
    }
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(dentalMemberships)
      .where(and(...conditions));
    return row?.count ? Number(row.count) : 0;
  }

  /**
   * V-ORG-004 (perf §16): resolve a person's active membership in a branch with
   * a scoped WHERE + LIMIT 1, rather than loading the whole branch roster and
   * filtering in app code. Identical semantics to `findByPersonAndBranch` —
   * kept distinct so call sites read intentionally.
   */
  async findActiveByPersonAndBranch(
    personId: string,
    branchId: string,
  ): Promise<DentalMembership | null> {
    return this.findByPersonAndBranch(personId, branchId);
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
   * Count active *staff* members in a branch (FR6.3 tier limit). The practice
   * owner (role `dentist_owner`) authorizes via ownership and is not counted
   * against the "maximum active staff members" tier limit.
   */
  async countActiveStaffByBranch(branchId: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(dentalMemberships)
      .where(
        and(
          eq(dentalMemberships.branchId, branchId),
          eq(dentalMemberships.status, 'active'),
          ne(dentalMemberships.role, 'dentist_owner'),
        ),
      );
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
   * V-ORG-001: Guarded membership status transition (MODULE_SPEC §8).
   *
   * Whitelists {invited→active, active→inactive, inactive→active}. Rejects any
   * illegal jump with a 422 BusinessLogicError. Verifies the row's *actual*
   * current status equals `from` before writing (guards against a stale-read /
   * concurrent change). Returns null when the member does not exist.
   */
  async transitionStatus(
    id: string,
    from: MembershipLifecycleStatus,
    to: MembershipLifecycleStatus,
  ): Promise<DentalMembership | null> {
    const member = await this.findOneById(id);
    if (!member) return null;

    if (!isLegalStatusTransition(from, to)) {
      throw new BusinessLogicError(
        `Illegal membership status transition: ${from} → ${to}`,
        'ILLEGAL_STATUS_TRANSITION',
      );
    }

    if (member.status !== from) {
      throw new BusinessLogicError(
        `Illegal membership status transition: current status is "${member.status}", not "${from}"`,
        'ILLEGAL_STATUS_TRANSITION',
      );
    }

    const [updated] = await this.db
      .update(dentalMemberships)
      .set({ status: to, updatedAt: new Date() })
      .where(eq(dentalMemberships.id, id))
      .returning();
    return updated ?? null;
  }

  /**
   * Deactivate a membership (active → inactive). Routes through the guarded
   * `transitionStatus` so the §8 state machine cannot be bypassed.
   */
  async deactivate(id: string): Promise<DentalMembership | null> {
    return this.transitionStatus(id, 'active', 'inactive');
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
