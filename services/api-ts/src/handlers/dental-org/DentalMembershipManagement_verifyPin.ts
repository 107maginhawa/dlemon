import type { ValidatedContext } from '@/types/app';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { logAuditEvent } from '@/core/audit-logger';
import type { DentalMembershipManagement_verifyPinBody, DentalMembershipManagement_verifyPinParams } from '@/generated/openapi/validators';

/**
 * DentalMembershipManagement_verifyPin
 *
 * Path: POST /dental/organizations/{orgId}/branches/{branchId}/members/{membershipId}/verify-pin
 * OperationId: DentalMembershipManagement_verifyPin
 *
 * Security fixes (Slice H):
 *   CF-38/AUTH-02: assertBranchAccess ensures caller belongs to the same branch as target member.
 *   CF-46/AUTH-07: Audit log entry written on successful PIN verification.
 */
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

  // CF-38/AUTH-02: Enforce branch-level isolation — caller must be a member of the same branch.
  await assertBranchAccess(db, user.id, member.branchId);

  if (repo.isLockedOut(member)) {
    return ctx.json(
      { message: 'Too many failed attempts', lockedUntil: member.pinLockedUntil },
      429
    );
  }

  if (!member.pinHash) {
    return ctx.json({ success: false, failedAttempts: member.pinFailedAttempts });
  }

  const isValid = await Bun.password.verify(pin, member.pinHash);

  if (isValid) {
    const reset = await repo.resetPinAttempts(membershipId);
    // FR6.4 / EM-ORG-020: Track last login for activity visibility (parity with legacy verifyPin).
    await repo.trackLastLogin(membershipId);

    // CF-46/AUTH-07 / EM-AUD-008: Write audit entry on successful PIN verification.
    // Routed through @/core/audit-logger so the login event is visible in the
    // dental audit viewer (dental_audit_log), branch-scoped.
    try {
      await logAuditEvent(db, logger, {
        personId: user.id,
        tenantId: member.branchId,
        branchId: member.branchId,
        eventType: 'authentication',
        action: 'membership.verify_pin',
        resourceType: 'dental_membership',
        resourceId: membershipId,
        metadata: { memberId: membershipId },
      });
    } catch (auditErr) {
      // Audit failure must not block login — log and continue.
      logger?.warn?.({ auditErr }, 'Failed to write PIN_VERIFIED audit log');
    }

    return ctx.json({ success: true, failedAttempts: reset?.pinFailedAttempts ?? 0 });
  }

  const updated = await repo.recordFailedPinAttempt(membershipId);

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
