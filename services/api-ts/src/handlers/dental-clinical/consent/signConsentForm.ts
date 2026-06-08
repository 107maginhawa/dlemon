/**
 * signConsentForm handler
 *
 * POST /dental/visits/{visitId}/consents/{consentId}/sign
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { ConsentFormRepository } from '../repos/consent-form.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';
import type { SignConsentFormBody, SignConsentFormParams } from '@/generated/openapi/validators';

export async function signConsentForm(
  ctx: ValidatedContext<SignConsentFormBody, never, SignConsentFormParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { consentId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ConsentFormRepository(db);

  const existing = await repo.findOneById(consentId);
  if (!existing) throw new NotFoundError('Consent form');

  // Branch-level authorization via consent form's parent visit
  const visit = await getVisitOrThrow(db, existing.visitId);
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  // V-CLN-005: a signed consent form is immutable. Re-signing is a business-rule
  // violation, not an input-validation failure → 422 CONSENT_FORM_SIGNED.
  if (existing.signed) {
    throw new BusinessLogicError('Consent form is already signed and cannot be modified', 'CONSENT_FORM_SIGNED');
  }

  // V-CLN-010: a revoked consent cannot be signed (symmetric with the signed→revoke
  // guard in revokeConsentForm). Signing a form the patient withdrew would silently
  // overturn the revocation and let the refused treatment proceed via the consent gate.
  if (existing.revoked) {
    throw new BusinessLogicError('Consent form was revoked and cannot be signed', 'CONSENT_FORM_REVOKED');
  }

  const signed = await repo.sign(consentId, body.signatureData);
  if (!signed) throw new ValidationError('Could not sign consent form');

  ctx.get('logger')?.info(
    { requestId: ctx.get('requestId'), action: 'dental_consent_sign', consentId, visitId: existing.visitId, by: user.id },
    'Consent form signed',
  );

  // V-CLN-002: persist an audit row for the "Sign consent" event.
  const branchForAudit = await getBranchOrgId(db, visit.branchId);
  await logAuditEvent(db, ctx.get('logger'), {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? visit.branchId,
    branchId: visit.branchId,
    action: 'consent.signed',
    resourceType: 'dental_consent_form',
    resourceId: consentId,
    metadata: { visitId: existing.visitId, patientId: existing.patientId },
  });

  return ctx.json(signed);
}
