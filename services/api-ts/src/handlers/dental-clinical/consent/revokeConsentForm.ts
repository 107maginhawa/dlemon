/**
 * revokeConsentForm handler
 *
 * PATCH /dental/visits/{visitId}/consents/{cid}/revoke
 *
 * EM-CLI-001 — implements the missing revoke endpoint (WF-035).
 * Emits DE-013 ConsentRevoked domain event on success (best-effort).
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { ConflictError, UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { ConsentFormRepository } from '../repos/consent-form.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { emitConsentRevoked } from '../domain-events';
import type { User } from '@/types/auth';
import type { JobScheduler } from '@/core/jobs';
import { z } from 'zod';

const RevokeConsentFormParams = z.object({
  visitId: z.string().uuid(),
  cid: z.string().uuid(),
});

export async function revokeConsentForm(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const rawParams = ctx.req.param();
  const params = RevokeConsentFormParams.parse(rawParams);
  const { cid } = params;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ConsentFormRepository(db);

  const existing = await repo.findOneById(cid);
  if (!existing) throw new NotFoundError('Consent form');

  // Branch-level authorization via consent form's parent visit
  const visit = await getVisitOrThrow(db, existing.visitId);
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  // A signed consent form cannot be revoked (illegal signed → revoked transition)
  if (existing.signed) {
    throw new BusinessLogicError('Cannot revoke a signed consent form', 'CONSENT_ALREADY_SIGNED');
  }

  if (existing.revoked) {
    throw new ConflictError('Consent form has already been revoked');
  }

  const revoked = await repo.revoke(cid, user.id);
  if (!revoked) {
    // Race: another request revoked between the read and the update
    throw new ConflictError('Consent form has already been revoked');
  }

  const scheduler = ctx.get('jobs') as JobScheduler | undefined;

  // DE-013: emit ConsentRevoked domain event (best-effort, non-blocking)
  scheduler && emitConsentRevoked(scheduler, {
    consentId: revoked.id,
    visitId: revoked.visitId,
    patientId: revoked.patientId,
    revokedBy: user.id,
  }).catch(() => {/* non-blocking */});

  ctx.get('logger')?.info(
    {
      requestId: ctx.get('requestId'),
      action: 'dental_consent_revoke',
      consentId: revoked.id,
      visitId: revoked.visitId,
      by: user.id,
    },
    'Consent form revoked',
  );

  return ctx.json(revoked);
}
