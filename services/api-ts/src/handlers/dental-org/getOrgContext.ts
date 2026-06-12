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

  // Resolve the caller's org. Owners are found by ownership; NON-OWNER staff
  // (members of someone else's org) are resolved via their active membership →
  // branch → org. Previously this only checked ownership, so a staff_full member
  // got {org:null} and the dashboard guard bounced them to onboarding.
  const ownedOrgs = await orgRepo.findMany({ ownerPersonId: user.id });
  let org = ownedOrgs[0] ?? null;
  let branch = null;
  let member = null;

  if (org) {
    // EF-ORG-P022 / V-ORG-004: pick the first ACTIVE branch, scoped in SQL.
    branch = await branchRepo.findFirstActiveByOrg(org.id);
    if (branch) {
      member = await memberRepo.findActiveByPersonAndBranch(user.id, branch.id);
    }
  } else {
    // Non-owner member: resolve context from their own active membership.
    member = await memberRepo.findFirstActiveByPerson(user.id);
    if (member) {
      branch = await branchRepo.findOneById(member.branchId);
      if (branch) org = await orgRepo.findOneById(branch.organizationId);
    }
  }

  if (!org) {
    return ctx.json({ org: null, branch: null, member: null }, 200);
  }

  return ctx.json({
    org: { id: org.id, name: org.name, tier: org.tier as string, status: org.status as string },
    branch: branch ? { id: branch.id, name: branch.name, timezone: branch.timezone } : null,
    member: member ? { id: member.id, role: member.role as string, displayName: member.displayName } : null,
  }, 200);
}
