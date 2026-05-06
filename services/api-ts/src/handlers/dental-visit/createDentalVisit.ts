/**
 * createDentalVisit handler
 *
 * POST /dental/visits
 * Creates a new dental visit in draft status.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { VisitRepository } from './repos/visit.repo';
import type { User } from '@/types/auth';
import type { CreateDentalVisitBody } from '@/generated/openapi/validators';

export async function createDentalVisit(
  ctx: ValidatedContext<CreateDentalVisitBody, never, never>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  await assertBranchAccess(db, user.id, body.branchId);

  const repo = new VisitRepository(db);

  const visit = await repo.createOne({
    patientId: body.patientId,
    branchId: body.branchId,
    dentistMemberId: body.dentistMemberId,
    chiefComplaint: body.chiefComplaint,
  });

  return ctx.json(visit, 201);
}
