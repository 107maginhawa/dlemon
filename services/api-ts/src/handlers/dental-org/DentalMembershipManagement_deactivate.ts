import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { BranchRepository } from '@/handlers/dental-org/repos/branch.repo';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { logAuditEvent } from '@/core/audit-logger';
import type { DentalMembershipManagement_deactivateBody, DentalMembershipManagement_deactivateParams } from '@/generated/openapi/validators';

/**
 * DentalMembershipManagement_deactivate
 *
 * Path: POST /dental/organizations/{orgId}/branches/{branchId}/members/{membershipId}/deactivate
 * OperationId: DentalMembershipManagement_deactivate
 *
 * Security fixes (G7):
 *   G7-S1/IDOR: assertBranchAccess enforces caller belongs to target member's branch.
 *   G7-S2: pinHash, securityAnswerHash, securityQuestion stripped from response.
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

  // G7-S1: Look up target membership first to get branchId for IDOR check
  const existing = await repo.findOneById(membershipId);
  if (!existing) throw new NotFoundError('Membership');

  // EF-ORG-004 / G7-S1: IDOR guard — org owners may deactivate any member;
  // branch-level callers must hold the dentist_owner role (not just any active member).
  const branchRepo = new BranchRepository(db, logger);
  const branch = await branchRepo.findOneById(existing.branchId);
  const orgRepo = new OrganizationRepository(db, logger);
  const org = branch ? await orgRepo.findOneById(branch.organizationId) : null;
  if (org?.ownerPersonId !== user.id) {
    // Branch-level path: caller must be dentist_owner of the target branch
    await assertBranchRole(db, user.id, existing.branchId, ['dentist_owner']);
  }

  const membership = await repo.deactivate(membershipId);
  if (!membership) throw new NotFoundError('Membership');

  // AL-004: HIPAA §164.312 — audit membership deactivation
  try {
    await logAuditEvent(db, logger, {
      personId: user.id,
      tenantId: existing.branchId,
      branchId: existing.branchId,
      eventType: 'data-modification',
      action: 'membership.deactivate',
      resourceType: 'dental_membership',
      resourceId: membershipId,
      metadata: { membershipId },
    });
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'AL-004: failed to write deactivateMembership audit log');
  }

  // G7-S2: Strip credential fields from response
  const { pinHash: _ph, securityAnswerHash: _sah, securityQuestion: _sq, ...safeResponse } = membership;
  return ctx.json(safeResponse);
}
