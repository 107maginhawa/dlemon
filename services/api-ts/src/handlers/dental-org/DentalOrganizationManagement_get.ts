import { eq, and } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import type { DentalOrganizationManagement_getParams } from '@/generated/openapi/validators';

/**
 * DentalOrganizationManagement_get
 *
 * Path: GET /dental/organizations/{id}
 * OperationId: DentalOrganizationManagement_get
 *
 * Security (EM-ORG-006): Only the org owner or active org members may read
 * organization details. Any other authenticated user receives 403.
 */
export async function DentalOrganizationManagement_get(
  ctx: ValidatedContext<never, never, DentalOrganizationManagement_getParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { id } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new OrganizationRepository(db, logger);
  const org = await repo.findOneById(id);
  if (!org) throw new NotFoundError('Organization');

  // EM-ORG-006: Caller must be the org owner or an active member of any branch in this org
  if (org.ownerPersonId !== user.id) {
    const [membership] = await db
      .select({ id: dentalMemberships.id })
      .from(dentalMemberships)
      .innerJoin(dentalBranches, eq(dentalMemberships.branchId, dentalBranches.id))
      .where(and(
        eq(dentalBranches.organizationId, id),
        eq(dentalMemberships.personId, user.id),
        eq(dentalMemberships.status, 'active'),
      ))
      .limit(1);

    if (!membership) {
      throw new ForbiddenError('You do not have access to this organization');
    }
  }

  return ctx.json(org);
}
