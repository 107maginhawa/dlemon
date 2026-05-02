/**
 * PIN verification handler
 *
 * POST /dental/organizations/{orgId}/branches/{branchId}/members/{membershipId}/verify-pin
 *
 * Checks a staff member's PIN against the stored bcrypt hash.
 * Handles lockout state and brute-force tracking.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { User } from '@/types/auth';
import { MembershipRepository } from './repos/membership.repo';
import type {
  DentalMembershipManagement_verifyPinBody,
  DentalMembershipManagement_verifyPinParams,
} from '@/generated/openapi/validators';

export async function DentalMembershipManagement_verifyPin(
  ctx: ValidatedContext<DentalMembershipManagement_verifyPinBody, never, DentalMembershipManagement_verifyPinParams>
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

  // Check if currently locked out
  if (repo.isLockedOut(member)) {
    return ctx.json(
      { message: 'Too many failed attempts', lockedUntil: member.pinLockedUntil },
      429
    );
  }

  // No PIN set — treat as failure without incrementing attempts
  if (!member.pinHash) {
    return ctx.json({ success: false, failedAttempts: member.pinFailedAttempts });
  }

  // Verify PIN against stored bcrypt hash
  const isValid = await Bun.password.verify(pin, member.pinHash);

  if (isValid) {
    const reset = await repo.resetPinAttempts(membershipId);
    return ctx.json({ success: true, failedAttempts: reset?.pinFailedAttempts ?? 0 });
  }

  // Wrong PIN — record the attempt
  const updated = await repo.recordFailedPinAttempt(membershipId);

  // Check if we're now locked out after this attempt
  if (updated && repo.isLockedOut(updated)) {
    return ctx.json(
      { message: 'Too many failed attempts', lockedUntil: updated.pinLockedUntil },
      429
    );
  }

  return ctx.json({
    success: false,
    failedAttempts: updated?.pinFailedAttempts ?? member.pinFailedAttempts + 1,
  });
}
