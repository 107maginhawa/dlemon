/**
 * deactivateMember — deactivate a membership
 *
 * Path: DELETE /dental/org/members/:memberId
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';

export async function deactivateMember(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const memberId = ctx.req.param('memberId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new MembershipRepository(db, logger);

  // Branch-level authorization via member lookup
  const member = await repo.findOneById(memberId);
  if (!member) throw new NotFoundError('Membership');
  await assertBranchAccess(db, user.id, member.branchId);

  const membership = await repo.deactivate(memberId);
  if (!membership) throw new NotFoundError('Membership');

  return new Response(null, { status: 204 });
}
