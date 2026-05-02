/**
 * checkInAppointment handler
 *
 * POST /dental/appointments/:appointmentId/check-in
 *
 * Multi-step operation:
 * 1. Load appointment
 * 2. Set status=checkedIn + checkInTime=now()
 * 3. Create a new DentalVisit (status='draft') linked to appointment
 * 4. Link visitId back to appointment
 * 5. Return { appointment, visitId }
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import type { User } from '@/types/auth';

export async function checkInAppointment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const appointmentId = ctx.req.param('appointmentId')!;
  const db = ctx.get('database') as DatabaseInstance;

  const appointmentRepo = new DentalAppointmentRepository(db);
  const visitRepo = new VisitRepository(db);

  // 1. Load appointment
  const appointment = await appointmentRepo.findOneById(appointmentId);
  if (!appointment) throw new NotFoundError('Appointment');

  if (appointment.status !== 'scheduled') {
    throw new ValidationError('Only scheduled appointments can be checked in');
  }

  // 2. Check in the appointment
  const checkedIn = await appointmentRepo.checkIn(appointmentId);
  if (!checkedIn) throw new ValidationError('Failed to check in appointment');

  // 3. Create a draft visit linked to the appointment
  const visit = await visitRepo.createOne({
    patientId: appointment.patientId,
    branchId: appointment.branchId,
    dentistMemberId: appointment.dentistMemberId,
  });

  // 4. Link visit back to appointment
  const linkedAppointment = await appointmentRepo.linkVisit(appointmentId, visit.id);

  return ctx.json({
    appointment: linkedAppointment,
    visitId: visit.id,
  });
}
