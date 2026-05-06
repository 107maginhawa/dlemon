/**
 * createAmendment handler
 *
 * POST /dental/visits/{visitId}/amendments
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { AmendmentRepository } from './repos/amendment.repo';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { User } from '@/types/auth';
import type { CreateAmendmentBody, CreateAmendmentParams } from '@/generated/openapi/validators';

export async function createAmendment(
  ctx: ValidatedContext<CreateAmendmentBody, never, CreateAmendmentParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const authorMemberId = body.authorMemberId ?? user.id;

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via parent visit
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const repo = new AmendmentRepository(db);

  const amendment = await repo.createOne({
    visitId,
    patientId: body.patientId,
    authorMemberId,
    originalRecordType: body.originalRecordType,
    originalRecordId: body.originalRecordId,
    reason: body.reason,
    content: body.content,
  });

  return ctx.json(amendment, 201);
}
