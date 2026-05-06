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
  // FR9.7: PIN recovery is intentionally unauthenticated — the user is locked out
  // and cannot authenticate. The security answer is the auth mechanism here.
  const memberId = ctx.req.param('memberId')!;
  const rawBody = await ctx.req.json();
  const { answer, newPin } = recoverPinSchema.parse(rawBody);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db);
  const member = await repo.findOneById(memberId);
  if (!member) throw new NotFoundError('Membership');

  if (!member.securityAnswerHash) {
    throw new BusinessLogicError('No security question set for this member', 'NO_SECURITY_QUESTION');
  }

  const isCorrect = await Bun.password.verify(answer.toLowerCase().trim(), member.securityAnswerHash);
  if (!isCorrect) {
    return ctx.json({ success: false, error: 'Incorrect security answer' }, 401);
  }

  // Correct answer — set new PIN
  const pinHash = await Bun.password.hash(newPin);
  await repo.updatePin(memberId, pinHash);
  await repo.resetPinAttempts(memberId);

  return ctx.json({ success: true }, 200);
}
