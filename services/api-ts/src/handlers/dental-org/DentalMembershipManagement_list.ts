import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { DentalMembershipManagement_listParams } from '@/generated/openapi/validators';

/**
 * DentalMembershipManagement_list
 *
 * Path: GET /dental/organizations/{orgId}/branches/{branchId}/members/
 * OperationId: DentalMembershipManagement_list
 *
 * Security fixes (G7):
 *   G7-S1/IDOR: assertBranchAccess enforces caller belongs to this branch.
 *   G7-S2: pinHash, securityAnswerHash, securityQuestion stripped from response.
 */
export async function DentalMembershipManagement_list(
  ctx: ValidatedContext<never, never, DentalMembershipManagement_listParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { branchId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // G7-S1: IDOR guard — caller must be a member of this branch
  await assertBranchAccess(db, user.id, branchId);

  const { limit, offset } = parsePagination(ctx.req.query());

  const repo = new MembershipRepository(db, logger);
  const allItems = await repo.listByBranch(branchId, { includeInactive: false });
  const total = allItems.length;
  const page = allItems.slice(offset, offset + limit);

  // G7-S2: Strip credential fields — never expose hashes or security answers
  const safeItems = page.map(
    ({ pinHash: _ph, securityAnswerHash: _sah, securityQuestion: _sq, ...rest }) => rest
  );

  return ctx.json({ data: safeItems, pagination: buildPaginationMeta(page, total, limit, offset) });
}
