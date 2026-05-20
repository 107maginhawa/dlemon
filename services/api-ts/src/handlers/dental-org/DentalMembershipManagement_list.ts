import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
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

  const { limit, offset } = parsePagination(ctx.req.query());

  const repo = new MembershipRepository(db, logger);
  const allItems = await repo.listByBranch(branchId, { includeInactive: false });
  const total = allItems.length;
  const page = allItems.slice(offset, offset + limit);

  return ctx.json({ data: page, pagination: buildPaginationMeta(page, total, limit, offset) });
}