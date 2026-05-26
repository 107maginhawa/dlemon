/**
 * updateMember — update a membership's display name, role, or avatar
 *
 * Path: PATCH /dental/org/members/:memberId
 */

import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { VALID_MEMBER_ROLES, dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';

const updateMemberSchema = z.object({
  displayName: z.string().min(1).optional(),
  role: z.enum(VALID_MEMBER_ROLES).optional(),
  avatarUrl: z.string().optional().nullable(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'No valid fields to update' }
);

export async function updateMember(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const memberId = ctx.req.param('memberId')!;
  const rawBody = await ctx.req.json();
  const body = updateMemberSchema.parse(rawBody);
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new MembershipRepository(db, logger);

  // Branch-level authorization via member lookup
  const member = await repo.findOneById(memberId);
  if (!member) throw new NotFoundError('Membership');
  await assertBranchAccess(db, user.id, member.branchId);

  // G7-S3: Role changes require dentist_owner — assertBranchAccess alone allows self-promotion
  if (body.role !== undefined) {
    const [callerMembership] = await db
      .select({ role: dentalMemberships.role })
      .from(dentalMemberships)
      .where(and(
        eq(dentalMemberships.personId, user.id),
        eq(dentalMemberships.branchId, member.branchId),
        eq(dentalMemberships.status, 'active'),
      ))
      .limit(1);
    if (callerMembership?.role !== 'dentist_owner') {
      throw new ForbiddenError('Only dentist_owner can change member roles');
    }
  }

  // Build update payload from allowed fields
  const updateData: Record<string, unknown> = {};
  if (body.displayName !== undefined) updateData['displayName'] = body.displayName;
  if (body.role !== undefined) updateData['role'] = body.role;
  if (body.avatarUrl !== undefined) updateData['avatarUrl'] = body.avatarUrl;

  try {
    const updated = await repo.updateOneById(memberId, updateData);
    const { pinHash, ...safeResponse } = updated;
    return ctx.json(safeResponse);
  } catch (error: unknown) {
    if (error instanceof Error && error.message?.includes('not found')) {
      throw new NotFoundError('Membership');
    }
    throw error;
  }
}
