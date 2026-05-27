/**
 * Set/change PIN handler
 *
 * POST /dental/organizations/{orgId}/branches/{branchId}/members/{membershipId}/set-pin
 *
 * Hashes the provided PIN with bcrypt and stores it.
 * Returns the updated membership (without pinHash — stripped for security).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { MembershipRepository } from './repos/membership.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type {
  DentalMembershipManagement_setPinBody,
  DentalMembershipManagement_setPinParams,
} from '@/generated/openapi/validators';

/**
 * Security fixes:
 *   CF-38/AUTH-02 (Slice H): assertBranchAccess enforces that the caller belongs to the
 *   same branch as the target membership before allowing PIN mutation.
 *   EM-ORG-002: Only the target member themselves OR a dentist_owner may set a PIN.
 *   Any other branch member is forbidden from overwriting another member's PIN.
 */
export async function DentalMembershipManagement_setPin(
  ctx: ValidatedContext<DentalMembershipManagement_setPinBody, never, DentalMembershipManagement_setPinParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { membershipId } = ctx.req.valid('param');
  const { pin } = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new MembershipRepository(db, logger);
  const member = await repo.findOneById(membershipId);
  if (!member) throw new NotFoundError('Membership');

  // CF-38/AUTH-02: Enforce branch-level isolation — caller must be a member of the same branch.
  await assertBranchAccess(db, user.id, member.branchId);

  // EM-ORG-002: Only the target member themselves or a dentist_owner can set this PIN.
  const callerMembership = await repo.findByPersonAndBranch(user.id, member.branchId);
  if (!callerMembership || (callerMembership.id !== membershipId && callerMembership.role !== 'dentist_owner')) {
    throw new ForbiddenError('Only dentist_owner or the member themselves can set a PIN');
  }

  const pinHash = await Bun.password.hash(pin);
  const updated = await repo.updatePin(membershipId, pinHash);

  // Strip pinHash from response (never expose the hash to clients)
  const { pinHash: _pinHash, ...safeResponse } = updated!;

  return ctx.json(safeResponse);
}
