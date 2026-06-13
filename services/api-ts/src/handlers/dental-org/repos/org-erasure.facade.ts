/**
 * org-erasure.facade.ts
 *
 * Facade exposing branch→organization resolution to the `erasure` module
 * (FIX-001 / V-DG-002). Lets erasure derive a subject's tenant (organization)
 * from the subject patient's branch without importing the org schema directly
 * (Phase 10 boundary lint).
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalBranches } from './branch.schema';

/** The organization (tenant) that owns a branch, or null if the branch is unknown. */
export async function getBranchOrganizationId(db: DatabaseInstance, branchId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: dentalBranches.organizationId })
    .from(dentalBranches)
    .where(eq(dentalBranches.id, branchId))
    .limit(1);
  return row?.organizationId ?? null;
}
