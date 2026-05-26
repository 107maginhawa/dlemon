/**
 * createQueueItem — POST /dental/appointments/:appointmentId/queue-item
 *
 * Creates a queue entry for an appointment, status defaults to 'waiting'.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { QueueItemRepository } from './repos/queue-item.repo';
import { assertBranchAccess } from './utils/assert-branch-access';
import type { DatabaseInstance } from '@/core/database';

export async function createQueueItem(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { appointmentId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const appointmentRepo = new DentalAppointmentRepository(db, logger);
  const appointment = await appointmentRepo.findOneById(appointmentId);
  if (!appointment) throw new NotFoundError('Appointment not found');

  await assertBranchAccess(db, user.id, appointment.branchId);

  const queueRepo = new QueueItemRepository(db, logger);
  const item = await queueRepo.createOne({
    appointmentId,
    patientId: appointment.patientId,
    branchId: appointment.branchId,
    status: 'waiting',
    notes: body.notes ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createQueueItem', appointmentId, itemId: item.id }, 'Queue item created');

  return ctx.json(item, 201);
}
