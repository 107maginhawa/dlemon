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
import { logAuditEvent } from '@/core/audit-logger';

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
      personId: user.id,
      tenantId: member.branchId,
      branchId: member.branchId,
      eventType: 'data-modification',
      action: 'membership.deactivate',
      resourceType: 'dental_membership',
      resourceId: memberId,
      metadata: { memberId },
    });
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'AL-004: failed to write deactivateMembership audit log');
  }

  return new Response(null, { status: 204 });
}
