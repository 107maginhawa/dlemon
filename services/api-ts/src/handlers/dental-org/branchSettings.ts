/**
 * Branch Settings handlers (FR8.1, FR8.2, FR8.3, FR8.7, FR8.8)
 *
 * GET  /dental/branches/:branchId/settings  — get current settings
 * PUT  /dental/branches/:branchId/settings  — merge-update settings
 *
 * FR8.13: Access Control — PUT is restricted to dentist_owner role
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { dentalBranches, type BranchSettings } from './repos/branch.schema';
import { dentalMemberships } from './repos/membership.schema';
import { eq, and } from 'drizzle-orm';

async function getMemberRole(db: DatabaseInstance, userId: string, branchId: string): Promise<string | null> {
  const [member] = await db
    .select({ role: dentalMemberships.role })
    .from(dentalMemberships)
    .where(and(eq(dentalMemberships.personId, userId), eq(dentalMemberships.branchId, branchId)));
  return member?.role ?? null;
}

export async function getBranchSettings(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const branchId = ctx.req.param('branchId');
  const db = ctx.get('database') as DatabaseInstance;

  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  return ctx.json({ branchId, settings: branch.settings ?? {} }, 200);
}

export async function updateBranchSettings(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const branchId = ctx.req.param('branchId');
  const db = ctx.get('database') as DatabaseInstance;

  // FR8.13: Only dentist_owner can update settings
  const role = await getMemberRole(db, user.id, branchId);
  if (!role || role !== 'dentist_owner') {
    throw new ForbiddenError('Only the dentist owner can update branch settings');
  }

  let body: any;
  try { body = await ctx.req.json(); } catch { throw new Error('Invalid JSON'); }

  const updates = body.settings ?? body;
  if (!updates || typeof updates !== 'object') {
    throw new Error('settings must be an object');
  }

  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  // Merge with existing settings (top-level key merge)
  const merged: BranchSettings = { ...(branch.settings ?? {}), ...updates };

  await db.update(dentalBranches)
    .set({ settings: merged, updatedAt: new Date(), updatedBy: user.id })
    .where(eq(dentalBranches.id, branchId));

  return ctx.json({ branchId, settings: merged }, 200);
}
