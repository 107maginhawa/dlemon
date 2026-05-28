/**
 * createAmendment handler
 *
 * POST /dental/visits/{visitId}/amendments
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/visit.service';
import { AmendmentRepository } from './repos/amendment.repo';
import { getActiveMembershipId } from '@/handlers/dental-org/repos/org-billing.facade';
import type { User } from '@/types/auth';
import type { CreateAmendmentBody, CreateAmendmentParams } from '@/generated/openapi/validators';

export async function createAmendment(
  ctx: ValidatedContext<CreateAmendmentBody, never, CreateAmendmentParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via parent visit
  const visit = await getVisitOrThrow(db, visitId);

  const membership = await getActiveMembershipId(db, user.id, visit.branchId);
  if (!membership) throw new ForbiddenError('You do not have access to this branch');

  const authorMemberId = membership.id;

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
