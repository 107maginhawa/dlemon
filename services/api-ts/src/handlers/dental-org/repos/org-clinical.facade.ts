/**
 * org-clinical.facade.ts
 *
 * Facade exposing dental-org repo data to dental-clinical handlers.
 * Isolates cross-module access behind typed functions.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalMemberships } from './membership.schema';

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
