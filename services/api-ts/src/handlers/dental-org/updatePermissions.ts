/**
 * updatePermissions — upsert feature-permission overrides for an org (P2-17).
 *
 * PUT /dental/org/permissions?organizationId=...
 * Body: { overrides: [{ role, feature, allowed }, ...] }
 *
 * Owner-only. Each override is validated against the catalog (unknown features
 * rejected). Returns the recomputed effective grid.
 *
 * SAFETY: This endpoint can only ADD explicit allow/deny overrides; the absence
 * of a row falls back to the catalog default. To avoid an org locking itself
 * out of permission administration, we refuse to set `staff.manage = false`
 * for dentist_owner (the owner must always retain admin control).
 */

import { z } from 'zod';
import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, AppError } from '@/core/errors';
import type { User } from '@/types/auth';
import { VALID_MEMBER_ROLES } from './repos/membership.schema';
import { FeaturePermissionRepository } from './repos/feature-permission.repo';
import { isKnownFeature } from './permissions/catalog';
import { buildPermissionGrid } from './permissions/buildGrid';
import { resolveOrgForCaller } from './getPermissionGrid';
import { logAuditEvent } from '@/core/audit-logger';

const overrideSchema = z.object({
  role: z.enum(VALID_MEMBER_ROLES),
  feature: z.string().min(1),
  allowed: z.boolean(),
});

const updatePermissionsSchema = z.object({
  overrides: z.array(overrideSchema).min(1, 'at least one override is required').max(200),
});

export async function updatePermissions(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const requestedOrgId = ctx.req.query('organizationId') || undefined;

  const rawBody = await ctx.req.json();
  const body = updatePermissionsSchema.parse(rawBody);

  const org = await resolveOrgForCaller(db, user.id, requestedOrgId, logger);

  // Owner-only: changing the permission grid is an administrative action.
  if (org.ownerPersonId !== user.id) {
    throw new ForbiddenError('Only the organization owner can change permissions');
  }

  // Validate features against the catalog and guard the owner lockout invariant.
  for (const o of body.overrides) {
    if (!isKnownFeature(o.feature)) {
      throw new AppError(`Unknown permission feature: ${o.feature}`, 'VALIDATION_ERROR', 400);
    }
    if (o.role === 'dentist_owner' && o.feature === 'staff.manage' && o.allowed === false) {
      throw new AppError(
        'Cannot revoke staff management from dentist_owner — the owner must retain admin control',
        'VALIDATION_ERROR',
        400,
      );
    }
  }

  const repo = new FeaturePermissionRepository(db, logger);
  for (const o of body.overrides) {
    await repo.upsertOverride(org.id, o.role, o.feature, o.allowed, user.id);
  }

  // Audit the permission change (HIPAA §164.312 administrative action).
  try {
    await logAuditEvent(db, logger, {
      personId: user.id,
      tenantId: org.id,
      eventType: 'data-modification',
      actorRole: 'dentist_owner',
      action: 'permission.update',
      resourceType: 'dental_feature_permission',
      resourceId: org.id,
      metadata: { count: body.overrides.length },
    });
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'P2-17: failed to write permission.update audit log');
  }

  const grid = await buildPermissionGrid(db, org.id);
  return ctx.json(grid, 200);
}
