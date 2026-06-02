/**
 * Granular feature-permission enforcement (P2-17).
 *
 * Layers a per-(role, feature) permission grid on top of the coarse role enum.
 * Resolution order for a (caller, feature) decision:
 *   1. Caller must have an active membership in the branch (else 403).
 *   2. If the org has an explicit override row for (role, feature) → use it.
 *   3. Otherwise → fall back to the catalog default (which mirrors the legacy
 *      hard-coded assertBranchRole sets).
 *
 * Because the fallback is the existing default, orgs with NO override rows
 * behave exactly as before — this is strictly additive and never locks out an
 * existing org.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { ForbiddenError } from '@/core/errors';
import { dentalMemberships, type MemberRole } from '@/handlers/dental-org/repos/membership.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { FeaturePermissionRepository } from '@/handlers/dental-org/repos/feature-permission.repo';
import { defaultAllows, type PermissionFeature } from '@/handlers/dental-org/permissions/catalog';

export interface PermissionDecision {
  allowed: boolean;
  role: MemberRole;
  /** 'override' if an org row decided it, 'default' if the catalog default did. */
  source: 'override' | 'default';
}

/**
 * Resolve whether the caller is allowed to perform `feature` in `branchId`,
 * WITHOUT throwing. Returns null if the caller is not an active member.
 */
export async function resolvePermission(
  db: DatabaseInstance,
  userId: string,
  branchId: string,
  feature: PermissionFeature,
): Promise<PermissionDecision | null> {
  const [row] = await db
    .select({ role: dentalMemberships.role, organizationId: dentalBranches.organizationId })
    .from(dentalMemberships)
    .innerJoin(dentalBranches, eq(dentalMemberships.branchId, dentalBranches.id))
    .where(and(
      eq(dentalMemberships.personId, userId),
      eq(dentalMemberships.branchId, branchId),
      eq(dentalMemberships.status, 'active'),
    ))
    .limit(1);

  if (!row) return null;

  const repo = new FeaturePermissionRepository(db);
  const override = await repo.findOverride(row.organizationId, row.role, feature);
  if (override) {
    return { allowed: override.allowed, role: row.role, source: 'override' };
  }
  return { allowed: defaultAllows(row.role, feature), role: row.role, source: 'default' };
}

/**
 * Enforce a feature permission. Throws ForbiddenError (403) for non-members or
 * when the resolved decision is deny. Uses the same opaque message as
 * assertBranchRole to avoid role/permission enumeration via error text.
 */
export async function assertPermission(
  db: DatabaseInstance,
  userId: string,
  branchId: string,
  feature: PermissionFeature,
): Promise<void> {
  const decision = await resolvePermission(db, userId, branchId, feature);
  if (!decision || !decision.allowed) {
    throw new ForbiddenError('You do not have access to this branch');
  }
}
