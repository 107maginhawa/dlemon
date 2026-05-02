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

  const branches = await branchRepo.listByOrg(org.id);
  const branch = branches[0] ?? null;

  // Find this user's membership in the branch
  let member = null;
  if (branch) {
    const members = await memberRepo.listByBranch(branch.id);
    member = members.find(m => m.personId === user.id) ?? members[0] ?? null;
  }

  return ctx.json({
    org: { id: org.id, name: org.name, tier: org.tier as string },
    branch: branch ? { id: branch.id, name: branch.name, timezone: branch.timezone } : null,
    member: member ? { id: member.id, role: member.role as string, displayName: member.displayName } : null,
  }, 200);
}
