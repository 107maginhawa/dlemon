/**
 * Role-aware branch authorization utility.
 *
 * Verifies that the authenticated user has an active membership in the given
 * branch AND that their role is in the allowedRoles list.
 *
 * Use this instead of assertBranchAccess when the operation is restricted to
 * a subset of roles (e.g., clinical writes require dentist_*, void requires
 * dentist_owner only).
 *
 * Throws ForbiddenError for non-members (same message as assertBranchAccess
 * to avoid role-enumeration via error messages).
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { ForbiddenError } from '@/core/errors';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import type { MemberRole } from '@/handlers/dental-org/repos/membership.schema';

export async function assertBranchRole(
  db: DatabaseInstance,
  userId: string,
  branchId: string,
  allowedRoles: MemberRole[],
): Promise<void> {
  const role = await getBranchRole(db, userId, branchId);

  if (!role) {
    throw new ForbiddenError('You do not have access to this branch');
  }

  if (!allowedRoles.includes(role)) {
    throw new ForbiddenError('You do not have access to this branch');
  }
}

/**
 * Returns the caller's active membership role in the given branch, or null if
 * they have no active membership there.
 *
 * Use this (instead of assertBranchRole) when a handler needs to branch on the
 * role itself — e.g. a graded permission where a wider set may PREPARE a draft
 * but only a narrower set may FINALIZE (ceph sign-off split, G4-B). The handler
 * decides which denial to surface (404 anti-enumeration for non-members vs an
 * explicit 403 for a member who lacks the finalize right).
 */
export async function getBranchRole(
  db: DatabaseInstance,
  userId: string,
  branchId: string,
): Promise<MemberRole | null> {
  const [membership] = await db
    .select({ role: dentalMemberships.role })
    .from(dentalMemberships)
    .where(and(
      eq(dentalMemberships.personId, userId),
      eq(dentalMemberships.branchId, branchId),
      eq(dentalMemberships.status, 'active'),
    ))
    .limit(1);

  return membership?.role ?? null;
}
