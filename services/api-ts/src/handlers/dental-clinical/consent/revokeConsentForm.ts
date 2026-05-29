/**
 * revokeConsentForm handler
 *
 * PATCH /dental/visits/{visitId}/consents/{cid}/revoke
 *
 * EM-CLI-001 — implements the missing revoke endpoint (WF-035).
 *
 * V-CLN-003 / ADR-006: DE-013 ConsentRevoked is an audit-log-only semantic marker —
 * there is NO event bus. The revocation is recorded synchronously in dental_audit_log
 * via logAuditEvent(); no publisher/queue scaffolding is used (the prior emit went to
 * a queue with no consumer, so no audit row was ever written).
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { ConflictError, UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { ConsentFormRepository } from '../repos/consent-form.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';
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

  // V-CLN-003 / DE-013 (ADR-006): record the revocation synchronously in the audit
  // log. No event bus — this audit row IS the ConsentRevoked semantic marker.
  const branchForAudit = await getBranchOrgId(db, visit.branchId);
  await logAuditEvent(db, ctx.get('logger'), {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? visit.branchId,
    branchId: visit.branchId,
    action: 'consent.revoked',
    resourceType: 'dental_consent_form',
    resourceId: revoked.id,
    metadata: { visitId: revoked.visitId, patientId: revoked.patientId },
  });

  return ctx.json(revoked);
}
