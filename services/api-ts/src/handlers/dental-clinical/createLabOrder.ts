/**
 * createLabOrder handler
 *
 * POST /dental/visits/{visitId}/lab-orders
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { LabOrderRepository } from './repos/lab-order.repo';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { User } from '@/types/auth';
import type { CreateLabOrderBody, CreateLabOrderParams } from '@/generated/openapi/validators';

export async function createLabOrder(
  ctx: ValidatedContext<CreateLabOrderBody, never, CreateLabOrderParams>
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

  if (visit.status === 'completed' || visit.status === 'locked') {
    throw new BusinessLogicError(
      `Cannot add lab orders to a ${visit.status} visit`,
      'VISIT_IMMUTABLE'
    );
  }

  const repo = new LabOrderRepository(db);

  const order = await repo.createOne({
    visitId,
    patientId: body.patientId,
    labName: body.labName,
    description: body.description,
    expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : undefined,
  });

  return ctx.json(order, 201);
}
