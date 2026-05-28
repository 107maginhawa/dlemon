import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { BranchRepository } from '@/handlers/dental-org/repos/branch.repo';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
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

  // G7-S1: IDOR guard — org owners may deactivate; otherwise caller must be a branch member
  const branchRepo = new BranchRepository(db, logger);
  const branch = await branchRepo.findOneById(existing.branchId);
  const orgRepo = new OrganizationRepository(db, logger);
  const org = branch ? await orgRepo.findOneById(branch.organizationId) : null;
  if (org?.ownerPersonId !== user.id) {
    await assertBranchAccess(db, user.id, existing.branchId);
  }

  const membership = await repo.deactivate(membershipId);
  if (!membership) throw new NotFoundError('Membership');

  // G7-S2: Strip credential fields from response
  const { pinHash: _ph, securityAnswerHash: _sah, securityQuestion: _sq, ...safeResponse } = membership;
  return ctx.json(safeResponse);
}
