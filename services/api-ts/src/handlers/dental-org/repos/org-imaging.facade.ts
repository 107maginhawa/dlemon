/**
 * org-imaging.facade.ts
 *
 * Facade exposing dental-org repo data to dental-imaging handlers.
 */
import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalOrganizations } from './organization.schema';
import { dentalBranches } from './branch.schema';
import { dentalMemberships } from './membership.schema';
import { resolveImagingTier, type ImagingTier } from './organization.schema';

/** Get the resolved imaging tier for a branch (never null). Used to gate ceph features. */
export async function getImagingTierForBranch(
  db: DatabaseInstance,
  branchId: string,
): Promise<ImagingTier> {
  const [row] = await db
    .select({ imagingTier: dentalOrganizations.imagingTier })
    .from(dentalBranches)
    .innerJoin(dentalOrganizations, eq(dentalBranches.organizationId, dentalOrganizations.id))
    .where(eq(dentalBranches.id, branchId))
    .limit(1);
  return resolveImagingTier(row?.imagingTier ?? null);
}

/** Get imaging tier + branch name for a branch. Used by CephMgmt_createCephReport for D-4 context. */
export async function getOrgDataForBranch(
  db: DatabaseInstance,
  branchId: string,
): Promise<{ imagingTier: ImagingTier; branchName: string | null }> {
  const [row] = await db
    .select({ imagingTier: dentalOrganizations.imagingTier, branchName: dentalBranches.name })
    .from(dentalBranches)
    .innerJoin(dentalOrganizations, eq(dentalBranches.organizationId, dentalOrganizations.id))
    .where(eq(dentalBranches.id, branchId))
    .limit(1);
  return {
    imagingTier: resolveImagingTier(row?.imagingTier ?? null),
    branchName: row?.branchName ?? null,
  };
}

/** Get a person's membership role at a branch. Used by ImagingRepository. */
export async function getMemberRoleForImaging(
  db: DatabaseInstance,
  personId: string,
  branchId: string,
): Promise<string | null> {
  const [member] = await db
    .select({ role: dentalMemberships.role })
    .from(dentalMemberships)
    .where(and(eq(dentalMemberships.personId, personId), eq(dentalMemberships.branchId, branchId)))
    .limit(1);
  return member?.role ?? null;
}
