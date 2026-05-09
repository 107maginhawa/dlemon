/**
 * createConsentForm handler
 *
 * POST /dental/visits/{visitId}/consents
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { ConsentFormRepository } from './repos/consent-form.repo';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
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
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const repo = new ConsentFormRepository(db);

  const form = await repo.createOne({
    visitId,
    patientId: body.patientId,
    templateId: body.templateId,
    templateName: body.templateName,
  });

  return ctx.json(form, 201);
}
