import { eq, and } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { BranchRepository } from '@/handlers/dental-org/repos/branch.repo';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import type { DentalBranchManagement_listParams } from '@/generated/openapi/validators';

/**
 * DentalBranchManagement_list
 *
 * Path: GET /dental/organizations/{orgId}/branches/
 * OperationId: DentalBranchManagement_list
 *
 * Security (EF-ORG-002): Caller must be the org owner or an active member of
 * at least one branch within that org.
 */
export async function DentalBranchManagement_list(
  ctx: ValidatedContext<never, never, DentalBranchManagement_listParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { orgId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // EF-ORG-002: Verify caller has access to this org
  const orgRepo = new OrganizationRepository(db, logger);
  const org = await orgRepo.findOneById(orgId);
  if (!org) throw new NotFoundError('Organization');

  if (org.ownerPersonId !== user.id) {
    // Check if caller has an active membership in any branch of this org
    const [membership] = await db
      .select({ id: dentalMemberships.id })
      .from(dentalMemberships)
      .innerJoin(dentalBranches, eq(dentalMemberships.branchId, dentalBranches.id))
      .where(and(
        eq(dentalBranches.organizationId, orgId),
        eq(dentalMemberships.personId, user.id),
        eq(dentalMemberships.status, 'active'),
      ))
      .limit(1);

    if (!membership) {
      throw new ForbiddenError('You do not have access to this organization');
    }
  }

  const repo = new BranchRepository(db, logger);
  const items = await repo.listByOrg(orgId);

  return ctx.json({ items, total: items.length });
}