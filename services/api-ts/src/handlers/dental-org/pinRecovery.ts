/**
 * PIN Recovery handlers (FR9.7)
 *
 * POST /dental/org/members/:memberId/security-question  — set security question + answer
 * POST /dental/org/members/:memberId/recover-pin        — verify answer + reset PIN
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError, BusinessLogicError } from '@/core/errors';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { eq } from 'drizzle-orm';

export async function setSecurityQuestion(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const memberId = ctx.req.param('memberId')!;
  let body: any;
  try { body = await ctx.req.json(); } catch { throw new ValidationError('Invalid JSON'); }

  const question = body.question as string | undefined;
  const answer = body.answer as string | undefined;

  if (!question?.trim()) throw new ValidationError('question is required');
  if (!answer?.trim()) throw new ValidationError('answer is required');
  if (answer.trim().length < 3) throw new ValidationError('answer must be at least 3 characters');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db);
  const member = await repo.findOneById(memberId);
  if (!member) throw new NotFoundError('Membership');

  const answerHash = await Bun.password.hash(answer.toLowerCase().trim(), { algorithm: 'bcrypt', cost: 10 });

  await db.update(dentalMemberships)
    .set({ securityQuestion: question.trim(), securityAnswerHash: answerHash, updatedAt: new Date() })
    .where(eq(dentalMemberships.id, memberId));

  return ctx.json({ success: true, question: question.trim() }, 200);
}

export async function recoverPin(ctx: Context): Promise<Response> {
  const memberId = ctx.req.param('memberId')!;
  let body: any;
  try { body = await ctx.req.json(); } catch { throw new ValidationError('Invalid JSON'); }

  const answer = body.answer as string | undefined;
  const newPin = body.newPin as string | undefined;

  if (!answer?.trim()) throw new ValidationError('answer is required');
  if (!newPin || !/^\d{4,6}$/.test(newPin)) throw new ValidationError('newPin must be 4-6 digits');

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
