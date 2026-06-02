/**
 * updateLabOrder handler
 *
 * PATCH /dental/visits/{visitId}/lab-orders/{orderId}
 * Handles status transitions and field updates.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { LabOrderRepository } from '../repos/lab-order.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';
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
    // V-CLN-008: an illegal lab-order FSM transition is a business-rule violation,
    // not an input-validation failure → 422 INVALID_STATUS_TRANSITION.
    if (error) throw new BusinessLogicError(error, 'INVALID_STATUS_TRANSITION');

    // V-CLN-004 / DE-015 LabOrderCompleted: per ADR-006, satisfy the published
    // domain-event marker with a synchronous dental_audit_log write. The lab marking
    // the order complete is the `delivered` transition (fabrication finished and handed
    // back); emit ONLY on that transition, and only when it actually changed.
    if (body.status === 'delivered' && existing.status !== 'delivered') {
      const branchForAudit = await getBranchOrgId(db, visit.branchId);
      await logAuditEvent(db, ctx.get('logger'), {
        personId: user.id,
        tenantId: branchForAudit?.organizationId ?? visit.branchId,
        branchId: visit.branchId,
        action: 'lab_order.completed',
        resourceType: 'dental_lab_order',
        resourceId: orderId,
        metadata: { visitId: existing.visitId, patientId: existing.patientId },
      });
    }

    return ctx.json(order);
  }

  // Non-status fields update
  const updated = await repo.update(orderId, {
    expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : undefined,
    // P2-12: editable restoration detail fields
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    shade: body.shade,
    material: body.material,
    cancelReason: body.cancelReason,
    isDefective: body.isDefective,
  });

  return ctx.json(updated);
}
