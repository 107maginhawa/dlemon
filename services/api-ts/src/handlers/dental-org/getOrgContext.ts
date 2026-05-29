/**
 * getOrgContext — returns the current user's org + first branch + their membership
 *
 * GET /dental/org/context
 *
 * Used by the frontend to auto-bootstrap localStorage after sign-in
 * when the user has already completed onboarding (e.g. seeded via script).
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { User } from '@/types/auth';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';

export async function getOrgContext(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const orgRepo = new OrganizationRepository(db, logger);
  const branchRepo = new BranchRepository(db, logger);
  const memberRepo = new MembershipRepository(db, logger);

  // Find org owned by this user
  const orgs = await orgRepo.findMany({ ownerPersonId: user.id });
  const org = orgs[0];
  if (!org) {
    return ctx.json({ org: null, branch: null, member: null }, 200);
  }

  // EF-ORG-P022: Only consider active branches when picking the default
  // context branch. An inactive/soft-deleted branch must not be auto-selected.
  // V-ORG-004: scoped WHERE active=true LIMIT 1 instead of load-all-then-filter.
  const branch = await branchRepo.findFirstActiveByOrg(org.id);

  // Find this user's active membership in the branch.
  // V-ORG-004: scoped WHERE personId=? AND branchId=? LIMIT 1 instead of
  // loading the full branch roster and filtering in JS.
  let member = null;
  if (branch) {
    member = await memberRepo.findActiveByPersonAndBranch(user.id, branch.id);
  }

  return ctx.json({
    org: { id: org.id, name: org.name, tier: org.tier as string },
    branch: branch ? { id: branch.id, name: branch.name, timezone: branch.timezone } : null,
    member: member ? { id: member.id, role: member.role as string, displayName: member.displayName } : null,
  }, 200);
}
