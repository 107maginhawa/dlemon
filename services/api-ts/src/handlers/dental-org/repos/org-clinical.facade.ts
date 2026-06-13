/**
 * org-clinical.facade.ts
 *
 * Facade exposing dental-org repo data to dental-clinical handlers.
 * Isolates cross-module access behind typed functions.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalMemberships } from './membership.schema';
import { dentalBranches } from './branch.schema';

/**
 * P0-B: resolve human-readable branch + provider names for a chart export header.
 * Both are best-effort (null when absent) — the export still renders with ids.
 */
export async function getBranchAndProviderNames(
  db: DatabaseInstance,
  branchId: string,
  membershipId: string | null | undefined,
): Promise<{ branchName: string | null; providerName: string | null }> {
  const [branch] = await db
    .select({ name: dentalBranches.name })
    .from(dentalBranches)
    .where(eq(dentalBranches.id, branchId))
    .limit(1);
  let providerName: string | null = null;
  if (membershipId) {
    const [member] = await db
      .select({ displayName: dentalMemberships.displayName })
      .from(dentalMemberships)
      .where(eq(dentalMemberships.id, membershipId))
      .limit(1);
    providerName = member?.displayName ?? null;
  }
  return { branchName: branch?.name ?? null, providerName };
}

/**
 * Resolve the active membership id for a person at a branch.
 * Used by createAmendment to populate authorMemberId for the audit trail.
 */
export async function getActiveMembershipForClinical(
  db: DatabaseInstance,
  personId: string,
  branchId: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: dentalMemberships.id })
    .from(dentalMemberships)
    .where(
      and(
        eq(dentalMemberships.personId, personId),
        eq(dentalMemberships.branchId, branchId),
        eq(dentalMemberships.status, 'active'),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Validate that a membership id is active within a specific branch.
 * Used by createPrescription to verify prescriberMemberId (EM-CLI-005).
 */
export async function getActiveMembershipByIdForClinical(
  db: DatabaseInstance,
  membershipId: string,
  branchId: string,
): Promise<{ id: string; role: string } | null> {
  const [row] = await db
    .select({ id: dentalMemberships.id, role: dentalMemberships.role })
    .from(dentalMemberships)
    .where(
      and(
        eq(dentalMemberships.id, membershipId),
        eq(dentalMemberships.branchId, branchId),
        eq(dentalMemberships.status, 'active'),
      ),
    )
    .limit(1);
  return row ?? null;
}
