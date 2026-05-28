/**
 * org-scheduling.facade.ts
 *
 * Facade exposing dental-org repo data to dental-scheduling handlers.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalBranches } from './branch.schema';
import { dentalMemberships } from './membership.schema';

export async function getBranchSchedulingConfig(
  db: DatabaseInstance,
  branchId: string,
): Promise<{ id: string; workingHours: string | null; timezone: string } | null> {
  const [row] = await db
    .select({ id: dentalBranches.id, workingHours: dentalBranches.workingHours, timezone: dentalBranches.timezone })
    .from(dentalBranches)
    .where(eq(dentalBranches.id, branchId));
  return row ?? null;
}

export async function updateBranchWorkingHours(
  db: DatabaseInstance,
  branchId: string,
  workingHours: string,
  updatedBy: string,
): Promise<void> {
  await db
    .update(dentalBranches)
    .set({ workingHours, updatedAt: new Date(), updatedBy })
    .where(eq(dentalBranches.id, branchId));
}

export async function getActiveBranchIdsForPerson(
  db: DatabaseInstance,
  personId: string,
): Promise<string[]> {
  const rows = await db
    .select({ branchId: dentalMemberships.branchId })
    .from(dentalMemberships)
    .where(and(eq(dentalMemberships.personId, personId), eq(dentalMemberships.status, 'active')));
  return rows.map(r => r.branchId);
}
