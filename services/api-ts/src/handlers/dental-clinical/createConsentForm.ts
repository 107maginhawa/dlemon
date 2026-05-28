/**
 * createConsentForm handler
 *
 * POST /dental/visits/{visitId}/consents
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { ConsentFormRepository } from './repos/consent-form.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import type { CreateConsentFormBody, CreateConsentFormParams } from '@/generated/openapi/validators';

export async function createConsentForm(
  ctx: ValidatedContext<CreateConsentFormBody, never, CreateConsentFormParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via parent visit
  const visit = await getVisitOrThrow(db, visitId);
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'hygienist']);

  const repo = new ConsentFormRepository(db);

  const form = await repo.createOne({
    visitId,
    patientId: body.patientId,
    templateId: body.templateId,
    templateName: body.templateName,
  });

  return ctx.json(form, 201);
}
