/**
 * createConsentForm handler
 *
 * POST /dental/visits/{visitId}/consents
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError, NotFoundError } from '@/core/errors';
import { ConsentFormRepository } from './repos/consent-form.repo';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { User } from '@/types/auth';

export async function createConsentForm(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  if (!body['patientId'] || typeof body['patientId'] !== 'string') throw new ValidationError('patientId is required');
  if (!body['templateId'] || typeof body['templateId'] !== 'string') throw new ValidationError('templateId is required');
  if (!body['templateName'] || typeof body['templateName'] !== 'string') throw new ValidationError('templateName is required');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via parent visit
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const repo = new ConsentFormRepository(db);

  const form = await repo.createOne({
    visitId,
    patientId: body['patientId'] as string,
    templateId: body['templateId'] as string,
    templateName: body['templateName'] as string,
  });

  return ctx.json(form, 201);
}
