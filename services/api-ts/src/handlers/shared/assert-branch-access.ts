/**
 * Branch-level authorization utility.
 *
 * Verifies that the authenticated user (by their personId = user.id) has an
 * active membership in the given branch. Throws ForbiddenError if not.
 *
 * Key invariant: user.id === personId in this codebase (see getPerson.ts).
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { ForbiddenError } from '@/core/errors';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';

export async function assertBranchAccess(
  db: DatabaseInstance,
  userId: string,
  branchId: string,
): Promise<void> {
  const [membership] = await db
    .select({ id: dentalMemberships.id })
    .from(dentalMemberships)
    .where(and(
      eq(dentalMemberships.personId, userId),
      eq(dentalMemberships.branchId, branchId),
      eq(dentalMemberships.status, 'active'),
    ))
    .limit(1);

  if (!membership) {
    // V-AUD-006: use the specific BRANCH_ACCESS_DENIED code (ERROR_TAXONOMY §5 dental-audit)
    // rather than the generic FORBIDDEN. Status stays 403.
    throw new ForbiddenError('You do not have access to this branch', 'BRANCH_ACCESS_DENIED');
  }
}

/**
 * Patient-scoped branch authorization (V-PAT-002).
 *
 * A patient's record is reachable only by members of the patient's branch.
 * If the patient has NO assigned branch, the record is NOT a free-for-all:
 * deny (403) rather than skipping the check. Centralizing this here prevents
 * the per-handler drift that left 23 handlers bypassing auth on branchless
 * patients (the original V-PAT-002 fix only reached 6 of ~29 call sites).
 *
 * Pass the patient's `preferredBranchId` (which may be null/undefined).
 */
export async function assertPatientBranchAccess(
  db: DatabaseInstance,
  userId: string,
  preferredBranchId: string | null | undefined,
): Promise<void> {
  if (!preferredBranchId) {
    throw new ForbiddenError('Patient has no assigned branch');
  }
  await assertBranchAccess(db, userId, preferredBranchId);
}
