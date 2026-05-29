/**
 * deactivateMember — deactivate a membership
 *
 * Path: DELETE /dental/org/members/:memberId
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { logAuditEvent } from '@/handlers/audit/repos/audit.facade';

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
  await assertBranchRole(db, user.id, member.branchId, ['dentist_owner']);

  const membership = await repo.deactivate(memberId);
  if (!membership) throw new NotFoundError('Membership');

  // AL-004: HIPAA §164.312 — audit membership revocation
  try {
    await logAuditEvent(db, logger, {
      eventType: 'data-modification',
      category: 'administrative',
      action: 'delete',
      outcome: 'success',
      user: user.id,
      userType: 'host',
      resourceType: 'dental_membership',
      resource: memberId,
      description: `Membership deactivated for branch ${member.branchId}`,
      details: { branchId: member.branchId, memberId },
    }, user.id);
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'AL-004: failed to write deactivateMembership audit log');
  }

  return new Response(null, { status: 204 });
}
