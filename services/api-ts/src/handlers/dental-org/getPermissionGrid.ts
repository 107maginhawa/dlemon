/**
 * getPermissionGrid — return the effective feature-permission grid for an org (P2-17).
 *
 * GET /dental/org/permissions?organizationId=...
 *
 * organizationId is optional; if omitted it resolves to the org owned by the
 * caller. The caller must be the org owner OR hold an active membership in one
 * of the org's branches (any member may VIEW the grid; only the owner may edit).
 */

import type { Context } from 'hono';
import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import type { Logger } from '@/types/logger';
import { OrganizationRepository } from './repos/organization.repo';
import { dentalMemberships } from './repos/membership.schema';
import { dentalBranches } from './repos/branch.schema';
import { buildPermissionGrid } from './permissions/buildGrid';

/** Resolve the target org for the caller; throws if none found / not a member. */
export async function resolveOrgForCaller(
  db: DatabaseInstance,
  userId: string,
  requestedOrgId: string | undefined,
  logger?: Logger,
): Promise<{ id: string; ownerPersonId: string }> {
  const orgRepo = new OrganizationRepository(db, logger);

  let org;
  if (requestedOrgId) {
    org = await orgRepo.findOneById(requestedOrgId);
  } else {
    const owned = await orgRepo.findMany({ ownerPersonId: userId });
    org = owned[0];
  }
  if (!org) throw new NotFoundError('Organization');

  // Owner always has access. Otherwise require an active membership in any
  // branch of this org.
  if (org.ownerPersonId !== userId) {
    const [mine] = await db
      .select({ id: dentalMemberships.id })
      .from(dentalMemberships)
      .innerJoin(dentalBranches, eq(dentalMemberships.branchId, dentalBranches.id))
      .where(and(
        eq(dentalBranches.organizationId, org.id),
        eq(dentalMemberships.personId, userId),
        eq(dentalMemberships.status, 'active'),
      ))
      .limit(1);
    if (!mine) {
      throw new ForbiddenError('You do not have access to this organization');
    }
  }

  return { id: org.id, ownerPersonId: org.ownerPersonId };
}

export async function getPermissionGrid(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger') as Logger | undefined;
  const requestedOrgId = ctx.req.query('organizationId') || undefined;

  const org = await resolveOrgForCaller(db, user.id, requestedOrgId, logger);
  const grid = await buildPermissionGrid(db, org.id);

  return ctx.json(grid, 200);
}
