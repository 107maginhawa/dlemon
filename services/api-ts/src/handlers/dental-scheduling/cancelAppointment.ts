/**
 * cancelAppointment handler
 *
 * DELETE /dental/appointments/:appointmentId
 * Cancels an appointment (sets status to cancelled).
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import type { User } from '@/types/auth';

export async function cancelAppointment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const appointmentId = ctx.req.param('appointmentId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalAppointmentRepository(db);

  const existing = await repo.findOneById(appointmentId);
  if (!existing) throw new NotFoundError('Appointment');

  await repo.cancel(appointmentId);

  return ctx.body(null, 204);
}
