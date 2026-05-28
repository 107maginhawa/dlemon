/**
 * updateLabOrder handler
 *
 * PATCH /dental/visits/{visitId}/lab-orders/{orderId}
 * Handles status transitions and field updates.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { LabOrderRepository } from './repos/lab-order.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import type { UpdateLabOrderBody, UpdateLabOrderParams } from '@/generated/openapi/validators';

export async function updateLabOrder(
  ctx: ValidatedContext<UpdateLabOrderBody, never, UpdateLabOrderParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { orderId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new LabOrderRepository(db);

  const existing = await repo.findOneById(orderId);
  if (!existing) throw new NotFoundError('Lab order');

  // Branch-level authorization via parent visit
  const visit = await getVisitOrThrow(db, existing.visitId);
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  // Status transition
  if (body.status !== undefined) {
    const { order, error } = await repo.updateStatus(orderId, body.status, {
      expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : undefined,
      cancelReason: body.cancelReason,
      isDefective: body.isDefective,
    });
    if (error) throw new ValidationError(error);
    return ctx.json(order);
  }

  // Non-status fields update
  const updated = await repo.update(orderId, {
    expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : undefined,
    cancelReason: body.cancelReason,
    isDefective: body.isDefective,
  });

  return ctx.json(updated);
}
