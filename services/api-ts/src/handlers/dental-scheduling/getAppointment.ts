/**
 * getAppointment handler
 *
 * GET /dental/appointments/:appointmentId
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import type { User } from '@/types/auth';

export async function getAppointment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const appointmentId = ctx.req.param('appointmentId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalAppointmentRepository(db);

  const appt = await repo.findOneById(appointmentId);
  if (!appt) throw new NotFoundError('Appointment');

  return ctx.json(appt);
}
