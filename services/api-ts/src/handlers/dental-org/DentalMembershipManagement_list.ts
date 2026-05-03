import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import type { DentalMembershipManagement_listParams } from '@/generated/openapi/validators';

/**
 * DentalMembershipManagement_list
 *
 * Path: GET /dental/organizations/{orgId}/branches/{branchId}/members/
 * OperationId: DentalMembershipManagement_list
 */
export async function DentalMembershipManagement_list(
  ctx: ValidatedContext<never, never, DentalMembershipManagement_listParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { branchId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new MembershipRepository(db, logger);
  const items = await repo.listByBranch(branchId, { includeInactive: false });

  return ctx.json({ items, total: items.length });
}