/**
 * updateMember — update a membership's display name, role, or avatar
 *
 * Path: PATCH /dental/org/members/:memberId
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { VALID_MEMBER_ROLES, type MemberRole } from '@/handlers/dental-org/repos/membership.schema';

export async function updateMember(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const memberId = ctx.req.param('memberId')!;
  const body = await ctx.req.json() as Record<string, unknown>;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new MembershipRepository(db, logger);

  // Build update payload from allowed fields
  const updateData: Record<string, unknown> = {};
  if (body['displayName'] !== undefined) updateData['displayName'] = body['displayName'];
  if (body['role'] !== undefined) {
    if (!VALID_MEMBER_ROLES.includes(body['role'] as MemberRole)) {
      return ctx.json({ error: `Invalid role. Must be one of: ${VALID_MEMBER_ROLES.join(', ')}` }, 400);
    }
    updateData['role'] = body['role'];
  }
  if (body['avatarUrl'] !== undefined) updateData['avatarUrl'] = body['avatarUrl'];

  if (Object.keys(updateData).length === 0) {
    return ctx.json({ error: 'No valid fields to update' }, 400);
  }

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
