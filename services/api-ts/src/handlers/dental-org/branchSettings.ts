/**
 * Branch Settings handlers (FR8.1, FR8.2, FR8.3, FR8.7, FR8.8)
 *
 * GET  /dental/branches/:branchId/settings  — get current settings
 * PUT  /dental/branches/:branchId/settings  — merge-update settings
 *
 * FR8.13: Access Control — PUT is restricted to dentist_owner role
 */

import { z } from 'zod';
import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { dentalBranches, type BranchSettings } from './repos/branch.schema';
import { dentalMemberships } from './repos/membership.schema';
import { eq, and } from 'drizzle-orm';

const updateBranchSettingsSchema = z.object({
  settings: z.record(z.unknown()).optional(),
}).passthrough().refine(
  (data) => typeof data === 'object' && data !== null,
  { message: 'settings must be an object' }
);

async function getMemberRole(db: DatabaseInstance, userId: string, branchId: string): Promise<string | null> {
  const [member] = await db
    .select({ role: dentalMemberships.role })
    .from(dentalMemberships)
    .where(and(eq(dentalMemberships.personId, userId), eq(dentalMemberships.branchId, branchId)));
  return member?.role ?? null;
}

export async function getBranchSettings(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const branchId = ctx.req.param('branchId');
  if (!branchId) throw new NotFoundError('Branch not found');
  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization
  await assertBranchAccess(db, user.id, branchId);

  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  return ctx.json({ branchId, settings: branch.settings ?? {} }, 200);
}

export async function updateBranchSettings(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const branchId = ctx.req.param('branchId');
  if (!branchId) throw new NotFoundError('Branch not found');
  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization
  await assertBranchAccess(db, user.id, branchId);

  // FR8.13: Only dentist_owner can update settings
  const role = await getMemberRole(db, user.id, branchId);
  if (!role || role !== 'dentist_owner') {
    throw new ForbiddenError('Only the dentist owner can update branch settings');
  }

  const rawBody = await ctx.req.json();
  const body = updateBranchSettingsSchema.parse(rawBody);

  const updates = body.settings ?? body;

  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  // Merge with existing settings (top-level key merge)
  const merged: BranchSettings = { ...(branch.settings ?? {}), ...updates };

  await db.update(dentalBranches)
    .set({ settings: merged, updatedAt: new Date(), updatedBy: user.id })
    .where(eq(dentalBranches.id, branchId));

  return ctx.json({ branchId, settings: merged }, 200);
}
