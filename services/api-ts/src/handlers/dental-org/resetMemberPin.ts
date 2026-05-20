/**
 * resetMemberPin — reset a member's PIN (owner operation)
 *
 * Path: POST /dental/org/members/:memberId/reset-pin
 * Body: { pin: string } — raw PIN, hashed server-side
 */

import { z } from 'zod';
import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { eq, and } from 'drizzle-orm';

const resetMemberPinSchema = z.object({
  newPin: z.string().regex(/^\d{6}$/, 'PIN must be exactly 6 digits'),
});

export async function resetMemberPin(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const memberId = ctx.req.param('memberId')!;
  // In production, body is pre-validated by zValidator as { newPin }.
  // In unit tests (no middleware), parse directly.
  const validated = (ctx.req as any).valid?.('json') as { newPin?: string } | undefined;
  const pin = validated?.newPin ?? resetMemberPinSchema.parse(await ctx.req.json()).newPin;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new MembershipRepository(db, logger);
  const member = await repo.findOneById(memberId);
  if (!member) throw new NotFoundError('Membership');

  // Branch-level authorization
  await assertBranchAccess(db, user.id, member.branchId);

  // Authorization: only dentist_owner of the same branch can reset another member's PIN
  const [callerMembership] = await db
    .select({ role: dentalMemberships.role })
    .from(dentalMemberships)
    .where(and(eq(dentalMemberships.personId, user.id), eq(dentalMemberships.branchId, member.branchId)));
  if (!callerMembership || callerMembership.role !== 'dentist_owner') {
    throw new ForbiddenError('Only the dentist owner can reset member PINs');
  }

  const pinHash = await Bun.password.hash(pin);
  await repo.updatePin(memberId, pinHash);

  // Also reset any failed attempts / lockout
  await repo.resetPinAttempts(memberId);

  return ctx.json({ success: true });
}
