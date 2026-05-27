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
