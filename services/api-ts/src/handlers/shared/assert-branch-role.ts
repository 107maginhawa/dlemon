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
  const [membership] = await db
    .select({ id: dentalMemberships.id, role: dentalMemberships.role })
    .from(dentalMemberships)
    .where(and(
      eq(dentalMemberships.personId, userId),
      eq(dentalMemberships.branchId, branchId),
      eq(dentalMemberships.status, 'active'),
    ))
    .limit(1);

  if (!membership) {
    throw new ForbiddenError('You do not have access to this branch');
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new ForbiddenError('You do not have access to this branch');
  }
}
