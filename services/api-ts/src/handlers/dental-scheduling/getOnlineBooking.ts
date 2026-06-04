/**
 * getOnlineBooking (P1-25)
 *
 * GET /dental/public/bookings/:confirmationCode  (public; code is the bearer)
 *
 * "Your appointment" lookup for a self-booked patient. Gated only by the
 * unguessable confirmation code. Returns a PII-minimal view (branch + provider
 * name, time, status) — never the patient record. 404 on unknown code.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, ValidationError } from '@/core/errors';
import type { GetOnlineBookingParams } from '@/generated/openapi/validators';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { computeEndAt } from './appointment-wire';
import { getBranchOnlineBookingContext } from '@/handlers/dental-org/repos/org-scheduling.facade';

export async function getOnlineBooking(
  ctx: ValidatedContext<never, never, GetOnlineBookingParams>,
): Promise<Response> {
  const { confirmationCode } = ctx.req.valid('param');
  if (!confirmationCode || confirmationCode.length < 6) throw new ValidationError('Invalid confirmation code');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalAppointmentRepository(db);

  const appt = await repo.findByConfirmationCode(confirmationCode);
  if (!appt) throw new NotFoundError('Booking');

  const branch = await getBranchOnlineBookingContext(db, appt.branchId);
  const providerName = branch?.providers.find((p) => p.providerId === appt.dentistMemberId)?.displayName ?? 'Provider';

  return ctx.json({
    confirmationCode,
    branchId: appt.branchId,
    branchName: branch?.name ?? 'Clinic',
    providerName,
    startAt: appt.scheduledAt.toISOString(),
    endAt: computeEndAt(appt.scheduledAt, appt.durationMinutes).toISOString(),
    visitType: appt.serviceType,
    status: appt.status,
    confirmationState: appt.confirmationState,
  }, 200);
}
