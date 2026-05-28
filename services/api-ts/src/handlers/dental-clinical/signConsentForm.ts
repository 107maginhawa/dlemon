/**
 * signConsentForm handler
 *
 * POST /dental/visits/{visitId}/consents/{consentId}/sign
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError, NotFoundError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { ConsentFormRepository } from './repos/consent-form.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
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

  if (existing.signed) {
    throw new ValidationError('Consent form is already signed and cannot be modified');
  }

  const signed = await repo.sign(consentId, body.signatureData);
  if (!signed) throw new ValidationError('Could not sign consent form');

  ctx.get('logger')?.info(
    { requestId: ctx.get('requestId'), action: 'dental_consent_sign', consentId, visitId: existing.visitId, by: user.id },
    'Consent form signed',
  );

  return ctx.json(signed);
}
