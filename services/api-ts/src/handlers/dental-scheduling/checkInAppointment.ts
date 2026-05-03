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
import { UnauthorizedError, NotFoundError, ValidationError, ConflictError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { assertBranchAccess } from './utils/assert-branch-access';
import type { User } from '@/types/auth';
import type { CheckInAppointmentParams } from '@/generated/openapi/validators';

export async function checkInAppointment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { appointmentId } = ctx.req.valid('param') as CheckInAppointmentParams;
  const db = ctx.get('database') as DatabaseInstance;

  const appointmentRepo = new DentalAppointmentRepository(db);
  const visitRepo = new VisitRepository(db);

  // 1. Load appointment
  const appointment = await appointmentRepo.findOneById(appointmentId);
  if (!appointment) throw new NotFoundError('Appointment');

  await assertBranchAccess(db, user.id, appointment.branchId);

  if (appointment.status !== 'scheduled') {
    throw new ValidationError('Only scheduled appointments can be checked in');
  }

  // EC7: Check for existing in-progress visit BEFORE mutating appointment status
  // (prevents appointment getting stuck in checkedIn with no visit on conflict)
  const inProgressVisit = await visitRepo.findInProgressByPatient(appointment.patientId);
  if (inProgressVisit) {
    throw new ConflictError('Visit already active for this patient. Complete or cancel the existing visit first.');
  }

  // 2-4: Atomically: check in + create visit + link visit
  const result = await db.transaction(async (tx: any) => {
    const txAppointmentRepo = new DentalAppointmentRepository(tx);
    const txVisitRepo = new VisitRepository(tx);

    const checkedIn = await txAppointmentRepo.checkIn(appointmentId, user.id);
    if (!checkedIn) throw new ValidationError('Failed to check in appointment');

    const visit = await txVisitRepo.createOne({
      patientId: appointment.patientId,
      branchId: appointment.branchId,
      dentistMemberId: appointment.dentistMemberId,
    });

    const linked = await txAppointmentRepo.linkVisit(appointmentId, visit.id);
    return { appointment: linked, visitId: visit.id };
  });

  return ctx.json(result);
}
