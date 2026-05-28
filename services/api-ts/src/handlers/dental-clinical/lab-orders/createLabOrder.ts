/**
 * createLabOrder handler
 *
 * POST /dental/visits/{visitId}/lab-orders
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, BusinessLogicError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { LabOrderRepository } from '../repos/lab-order.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
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
  const visit = await getVisitOrThrow(db, visitId);
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

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
