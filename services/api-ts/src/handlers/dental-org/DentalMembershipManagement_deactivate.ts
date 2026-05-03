import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import type { DentalMembershipManagement_deactivateBody, DentalMembershipManagement_deactivateParams } from '@/generated/openapi/validators';

/**
 * DentalMembershipManagement_deactivate
 *
 * Path: POST /dental/organizations/{orgId}/branches/{branchId}/members/{membershipId}/deactivate
 * OperationId: DentalMembershipManagement_deactivate
 */
export async function DentalMembershipManagement_deactivate(
  ctx: ValidatedContext<DentalMembershipManagement_deactivateBody, never, DentalMembershipManagement_deactivateParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { membershipId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new MembershipRepository(db, logger);
  const membership = await repo.deactivate(membershipId);
  if (!membership) throw new NotFoundError('Membership');

  return ctx.json(membership);
}