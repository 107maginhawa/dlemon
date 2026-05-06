/**
 * createMember — simplified flat endpoint for creating a branch member
 *
 * Path: POST /dental/org/members?branchId=...
 * Body: { displayName, role, avatarUrl? }
 */

import { z } from 'zod';
import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { VALID_MEMBER_ROLES } from '@/handlers/dental-org/repos/membership.schema';

const createMemberSchema = z.object({
  displayName: z.string().min(1, 'displayName is required'),
  role: z.enum(VALID_MEMBER_ROLES, { error: () => ({ message: `role is required and must be one of: ${VALID_MEMBER_ROLES.join(', ')}` }) }),
  branchId: z.string().uuid().optional(),
  personId: z.string().uuid().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  pin: z.string().regex(/^\d{6}$/, 'PIN must be exactly 6 digits').optional(),
});

export async function createMember(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const branchIdQuery = ctx.req.query('branchId');
  const rawBody = await ctx.req.json();
  const body = createMemberSchema.parse(rawBody);

  // branchId can come from query param or body
  const resolvedBranchId = branchIdQuery || body.branchId;
  if (!resolvedBranchId) {
    return ctx.json({ error: 'branchId is required (query param or body)' }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Branch-level authorization
  await assertBranchAccess(db, user.id, resolvedBranchId);

  const repo = new MembershipRepository(db, logger);

  // Optionally accept a PIN and hash it
  let pinHash: string | null = null;
  if (body.pin) {
    pinHash = await Bun.password.hash(body.pin);
  }

  const membership = await repo.createOne({
    branchId: resolvedBranchId,
    displayName: body.displayName.trim(),
    role: body.role,
    personId: body.personId ?? null,
    avatarUrl: body.avatarUrl ?? null,
    status: 'active',
    ...(pinHash ? { pinHash } : {}),
  });

  // Strip pinHash from response
  const { pinHash: _ph, ...safeResponse } = membership;

  return ctx.json(safeResponse, 201);
}
