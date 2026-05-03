/**
 * createMember — simplified flat endpoint for creating a branch member
 *
 * Path: POST /dental/org/members?branchId=...
 * Body: { displayName, role, avatarUrl? }
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { VALID_MEMBER_ROLES, type MemberRole } from '@/handlers/dental-org/repos/membership.schema';

export async function createMember(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const branchId = ctx.req.query('branchId');
  const body = await ctx.req.json();

  // branchId can come from query param or body
  const resolvedBranchId = branchId || body.branchId;
  if (!resolvedBranchId) {
    return ctx.json({ error: 'branchId is required (query param or body)' }, 400);
  }

  if (!body.displayName || typeof body.displayName !== 'string' || !body.displayName.trim()) {
    return ctx.json({ error: 'displayName is required' }, 400);
  }

  if (!body.role || !VALID_MEMBER_ROLES.includes(body.role as MemberRole)) {
    return ctx.json({ error: `role is required and must be one of: ${VALID_MEMBER_ROLES.join(', ')}` }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new MembershipRepository(db, logger);

  // Optionally accept a PIN and hash it
  let pinHash: string | null = null;
  if (body.pin && typeof body.pin === 'string' && /^\d{6}$/.test(body.pin)) {
    pinHash = await Bun.password.hash(body.pin);
  }

  const membership = await repo.createOne({
    branchId: resolvedBranchId,
    displayName: body.displayName.trim(),
    role: body.role as any,
    personId: body.personId ?? null,
    avatarUrl: body.avatarUrl ?? null,
    status: 'active',
    ...(pinHash ? { pinHash } : {}),
  });

  // Strip pinHash from response
  const { pinHash: _ph, ...safeResponse } = membership;

  return ctx.json(safeResponse, 201);
}
