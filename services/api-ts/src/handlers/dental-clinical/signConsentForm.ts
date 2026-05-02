/**
 * signConsentForm handler
 *
 * POST /dental/visits/{visitId}/consents/{consentId}/sign
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError, NotFoundError } from '@/core/errors';
import { ConsentFormRepository } from './repos/consent-form.repo';
import type { User } from '@/types/auth';

export async function signConsentForm(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const consentId = ctx.req.param('consentId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  if (!body['signatureData'] || typeof body['signatureData'] !== 'string') {
    throw new ValidationError('signatureData is required');
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ConsentFormRepository(db);

  const existing = await repo.findOneById(consentId);
  if (!existing) throw new NotFoundError('Consent form');

  if (existing.signed) {
    throw new ValidationError('Consent form is already signed and cannot be modified');
  }

  const signed = await repo.sign(consentId, body['signatureData'] as string);
  if (!signed) throw new ValidationError('Could not sign consent form');

  return ctx.json(signed);
}
