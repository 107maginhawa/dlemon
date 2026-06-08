/**
 * org-billing.facade.ts
 *
 * Facade exposing dental-org repo data to dental-billing handlers.
 * Isolates cross-module access behind typed functions.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { BranchRepository } from './branch.repo';
import { dentalMemberships } from './membership.schema';

export async function getBranchOrgId(
  db: DatabaseInstance,
  branchId: string,
): Promise<{ organizationId: string } | null> {
  const branch = await new BranchRepository(db).findOneById(branchId);
  return branch ? { organizationId: branch.organizationId } : null;
}

/**
 * EM-BIL-002: the active branch ids a person belongs to.
 *
 * Used by the dental-billing report endpoints (AR aging, collections summary,
 * payer aging, claim worklist, statement batch) whose `branchId` filter is
 * OPTIONAL. When the caller omits `branchId` the handler must scope results to
 * the caller's own branches — NOT the entire (multi-tenant) database — or it
 * leaks another org's invoices/payments/claims/balances + patient PHI.
 */
export async function getActiveBranchIdsForPerson(
  db: DatabaseInstance,
  personId: string,
): Promise<string[]> {
  const rows = await db
    .select({ branchId: dentalMemberships.branchId })
    .from(dentalMemberships)
    .where(and(eq(dentalMemberships.personId, personId), eq(dentalMemberships.status, 'active')));
  return rows.map((r) => r.branchId);
}

export async function getActiveMembershipId(
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
