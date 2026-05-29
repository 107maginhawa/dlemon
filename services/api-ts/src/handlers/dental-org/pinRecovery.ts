/**
 * PIN Recovery handlers (FR9.7)
 *
 * POST /dental/org/members/:memberId/security-question  — set security question + answer
 * POST /dental/org/members/:memberId/recover-pin        — verify answer + reset PIN
 */

import { z } from 'zod';
import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { eq, and } from 'drizzle-orm';

const setSecurityQuestionSchema = z.object({
  question: z.string().min(1, 'question is required'),
  answer: z.string().min(3, 'answer must be at least 3 characters'),
});

const recoverPinSchema = z.object({
  answer: z.string().min(1, 'answer is required'),
  newPin: z.string().regex(/^\d{4,6}$/, 'newPin must be 4-6 digits'),
});

export async function setSecurityQuestion(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const memberId = ctx.req.param('memberId')!;
  const rawBody = await ctx.req.json();
  const { question, answer } = setSecurityQuestionSchema.parse(rawBody);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db);
  const member = await repo.findOneById(memberId);
  if (!member) throw new NotFoundError('Membership');

  // Branch-level authorization
  await assertBranchAccess(db, user.id, member.branchId);

  // Ownership check: user must be the member themselves or a dentist_owner of the same branch
  if (member.personId !== user.id) {
    const [callerMembership] = await db
      .select({ role: dentalMemberships.role })
      .from(dentalMemberships)
      .where(and(eq(dentalMemberships.personId, user.id), eq(dentalMemberships.branchId, member.branchId)));
    if (!callerMembership || callerMembership.role !== 'dentist_owner') {
      throw new ForbiddenError('Only the member themselves or a dentist owner can set security questions');
    }
  }

  const answerHash = await Bun.password.hash(answer.trim().toLowerCase(), { algorithm: 'bcrypt', cost: 10 });

  await db.update(dentalMemberships)
    .set({ securityQuestion: question, securityAnswerHash: answerHash, updatedAt: new Date() })
    .where(eq(dentalMemberships.id, memberId));

  return ctx.json({ success: true, question }, 200);
}

export async function recoverPin(ctx: Context): Promise<Response> {
  // CF-39/AUTH-03 (Slice H): recoverPin MUST be authenticated. Even though the
  // staff member is "locked out" of PIN entry, the device owner (practice
  // owner/admin) holds the Better-Auth session and must be authenticated before
  // a PIN can be reset via security question. An unauthenticated endpoint would
  // allow any internet attacker to brute-force the security question.
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const memberId = ctx.req.param('memberId')!;
  const rawBody = await ctx.req.json();
  const { answer, newPin } = recoverPinSchema.parse(rawBody);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db);
  const member = await repo.findOneById(memberId);
  if (!member) throw new NotFoundError('Membership');

  // EF-ORG-P015: caller must belong to the target member's branch
  await assertBranchAccess(db, user.id, member.branchId);

  // Check if currently locked out (same pattern as verifyPin)
  if (repo.isLockedOut(member)) {
    return ctx.json(
      { message: 'Too many failed attempts', lockedUntil: member.pinLockedUntil },
      429
    );
  }

  // Normalize: no security question returns same shape as wrong answer (prevent info leak)
  if (!member.securityAnswerHash) {
    return ctx.json({ success: false }, 401);
  }

  const isCorrect = await Bun.password.verify(answer.toLowerCase().trim(), member.securityAnswerHash);
  if (!isCorrect) {
    // Wrong answer — record failed attempt (shares lockout counter with PIN)
    const updated = await repo.recordFailedPinAttempt(memberId);
    if (updated && repo.isLockedOut(updated)) {
      return ctx.json(
        { message: 'Too many failed attempts', lockedUntil: updated.pinLockedUntil },
        429
      );
    }
    return ctx.json({ success: false }, 401);
  }

  // Correct answer — reset attempts and set new PIN
  await repo.resetPinAttempts(memberId);
  const pinHash = await Bun.password.hash(newPin);
  await repo.updatePin(memberId, pinHash);

  return ctx.json({ success: true }, 200);
}
