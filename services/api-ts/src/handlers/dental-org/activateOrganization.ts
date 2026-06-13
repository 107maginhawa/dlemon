/**
 * activateOrganization — owner activates a provisional clinic (C-1 / ADR-007).
 *
 * Path: POST /dental/organizations/{id}/activate
 * OperationId: activateOrganization
 *
 * Self-service onboarding leaves an org `status = 'provisional'`, and (in
 * production) PHI writes are gated until the clinic is activated — see
 * `assert-org-live.ts`. This endpoint is the activation: the clinic OWNER accepts
 * the terms/BAA (the act of calling it represents that acceptance) and the org
 * flips to `status = 'live'`, unlocking patient/visit creation.
 *
 * - Owner-only: caller must be the org's `ownerPersonId`. Becoming a member or even
 *   a platform admin does NOT grant activation; only the clinic owner can.
 * - Idempotent: an already-'live' org returns 200 with its current state.
 * - A 'suspended' org cannot be self-activated (ops-only) → 403 ORG_SUSPENDED.
 * - Audited: writes `org.activate` so the go-live transition is on the trail.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { OrganizationRepository } from './repos/organization.repo';
import { logAuditEvent } from '@/core/audit-logger';

export async function activateOrganization(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const orgId = ctx.req.param('id')!;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new OrganizationRepository(db, logger);
  const org = await repo.findOneById(orgId);
  if (!org) throw new NotFoundError('Organization');

  // Owner-only — activation is the clinic owner's terms/BAA acceptance.
  if (org.ownerPersonId !== user.id) {
    throw new ForbiddenError('Only the clinic owner can activate the clinic');
  }

  // Idempotent — already live.
  if (org.status === 'live') {
    return ctx.json(org, 200);
  }

  // A suspended clinic is an ops state — not self-recoverable here.
  if (org.status === 'suspended') {
    throw new ForbiddenError('A suspended clinic cannot be self-activated', 'ORG_SUSPENDED');
  }

  const updated = await repo.updateOne(orgId, { status: 'live', updatedBy: user.id });
  if (!updated) throw new NotFoundError('Organization');

  try {
    await logAuditEvent(db, logger, {
      personId: user.id,
      tenantId: orgId,
      eventType: 'data-modification',
      actorRole: 'dentist_owner',
      action: 'org.activate',
      resourceType: 'dental_organization',
      resourceId: orgId,
      metadata: { from: org.status, to: 'live', mode: 'terms-accepted' },
    });
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'failed to write org activation audit log');
  }

  return ctx.json(updated, 200);
}
