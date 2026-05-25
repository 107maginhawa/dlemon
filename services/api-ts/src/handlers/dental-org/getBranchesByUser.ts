import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError } from '@/core/errors';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * GET /dental/branches
 * Returns all branches the authenticated user has an active membership in.
 * Resolution: user.id → dental_membership (personId) → dental_branch
 */
export async function getBranchesByUser(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;

  const memberships = await db
    .select({ branchId: dentalMemberships.branchId })
    .from(dentalMemberships)
    .where(and(
      eq(dentalMemberships.personId, user.id),
      eq(dentalMemberships.status, 'active'),
    ));

  if (memberships.length === 0) {
    return ctx.json({ items: [], total: 0 });
  }

  const branchIds = memberships.map(m => m.branchId);
  const branches = await db
    .select()
    .from(dentalBranches)
    .where(inArray(dentalBranches.id, branchIds));

  return ctx.json({ items: branches, total: branches.length });
}
