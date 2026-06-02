/**
 * confirmAppointment handler (P1-24)
 *
 * POST /dental/appointments/:appointmentId/confirm
 *
 * Staff confirm action: moves a `scheduled` appointment to `confirmed`
 * (confirmedVia='staff'), then synchronously expires any queued reminder /
 * confirmation-request notification rows for the appointment (a confirmed
 * appointment needs no further reminders).
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { NotificationService } from '@/core/notifs';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { APPOINTMENT_TRANSITIONS } from './repos/dental-appointment.schema';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { REMINDER_NOTIFICATION_TYPES } from './utils/reminder-types';
import type { User } from '@/types/auth';
import type { ConfirmAppointmentParams } from '@/generated/openapi/validators';
import { toWire } from './appointment-wire';

export async function confirmAppointment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { appointmentId } = ctx.req.valid('param') as ConfirmAppointmentParams;
  const db = ctx.get('database') as DatabaseInstance;
  const notifs = ctx.get('notifs') as NotificationService | undefined;
  const repo = new DentalAppointmentRepository(db);

  const existing = await repo.findOneById(appointmentId);
  if (!existing) throw new NotFoundError('Appointment');

  await assertBranchRole(db, user.id, existing.branchId, [
    'dentist_owner', 'dentist_associate', 'staff_full', 'staff_scheduling',
  ]);

  if (!APPOINTMENT_TRANSITIONS[existing.status].includes('confirmed')) {
    throw new ValidationError(`Cannot transition appointment from '${existing.status}' to 'confirmed'`);
  }

  const result = await repo.confirm(appointmentId, user.id, 'staff');
  if (!result) throw new NotFoundError('Appointment');

  // Synchronously expire queued reminders — confirmed needs no further nudges.
  if (notifs) {
    await notifs.expireQueuedByEntity(appointmentId, REMINDER_NOTIFICATION_TYPES).catch(() => {/* best-effort */});
  }

  return ctx.json(toWire(result));
}
