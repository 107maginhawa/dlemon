/**
 * createQueueItem — POST /dental/appointments/:appointmentId/queue-item
 *
 * Creates a queue entry for an appointment, status defaults to 'waiting'.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { QueueItemRepository } from './repos/queue-item.repo';
import { assertBranchAccess } from './utils/assert-branch-access';
import { withTenantTx } from '@/core/tenant-tx';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function createQueueItem(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { appointmentId } = ctx.req.valid('param') as { appointmentId: string };
  const body = ctx.req.valid('json') as { notes?: string | null };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const appointmentRepo = new DentalAppointmentRepository(db, logger);
  const appointment = await appointmentRepo.findOneById(appointmentId);
  if (!appointment) throw new NotFoundError('Appointment not found');

  await assertBranchAccess(db, user.id, appointment.branchId);

  // RLS P1b activation: the queue-item write goes through withTenantTx so the
  // app_rls policy on dental_queue_item enforces the branch scope (and WITH CHECK
  // validates the insert). Resolution fetch + authz above stay on db.
  const item = await withTenantTx(db, { branchIds: [appointment.branchId] }, (tx) =>
    new QueueItemRepository(tx, logger).createOne({
      appointmentId,
      patientId: appointment.patientId,
      branchId: appointment.branchId,
      status: 'waiting',
      notes: body.notes ?? null,
      createdBy: user.id,
      updatedBy: user.id,
    }),
  );

  logger?.info({ action: 'createQueueItem', appointmentId, itemId: item.id }, 'Queue item created');

  return ctx.json(item, 201);
}
