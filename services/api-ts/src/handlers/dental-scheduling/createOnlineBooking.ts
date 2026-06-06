/**
 * createOnlineBooking (P1-25)
 *
 * POST /dental/public/branches/:branchId/bookings  (public, rate-limited)
 *
 * Commits a self-service booking into a REAL dental_appointment (status
 * 'scheduled', source 'online', confirmation_state 'pending') that flows through
 * the existing check-in → visit lifecycle unchanged. Double-booking is HARD
 * blocked (unlike staff): a transactional final overlap re-check inside the
 * commit closes the read-then-write race, backed at the storage layer by the
 * Postgres EXCLUDE-USING-gist constraint (see migration note in PR/report).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, ValidationError, ConflictError, BusinessLogicError, RateLimitError } from '@/core/errors';
import type { CreateOnlineBookingBody, CreateOnlineBookingParams } from '@/generated/openapi/validators';
import { isVisitType, type VisitType } from './appointment-wire';
import { parseWorkingHours, isWithinWorkingHours } from './workingHours';
import { getBranchOnlineBookingContext } from '@/handlers/dental-org/repos/org-scheduling.facade';
import { parseOnlineBookingConfig, durationForVisitType, isOnlineBookable } from './online-booking-config';
import { matchOrCreatePatientForOnlineBooking } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { AppointmentHoldRepository } from './repos/appointment-hold.repo';
import { bookingWriteLimiter, clientIp } from './public-booking-ratelimit';
import { logAuditEvent } from '@/core/audit-logger';
import type { NotificationService } from '@/core/notifs';

// Fixed, auditable actor id for system/online-created rows (no FK; createdBy is nullable).
export const ONLINE_BOOKING_ACTOR_ID = '00000000-0000-4000-8000-0000000b0001';

/** Unguessable, human-friendly confirmation code (bearer for the lookup endpoint). */
function generateConfirmationCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export async function createOnlineBooking(
  ctx: ValidatedContext<CreateOnlineBookingBody, never, CreateOnlineBookingParams>,
): Promise<Response> {
  const { branchId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const rl = bookingWriteLimiter.check(`${clientIp(ctx.req.raw.headers)}:book:${branchId}`);
  if (!rl.allowed) throw new RateLimitError('Too many requests');

  if (!body.firstName?.trim()) throw new ValidationError('firstName is required');
  if (!isVisitType(body.visitType)) {
    throw new ValidationError('visitType must be one of: checkup, treatment, emergency, recall');
  }
  const visitType = body.visitType as VisitType;
  const startAt = body.startAt instanceof Date ? body.startAt : new Date(String(body.startAt));
  if (Number.isNaN(startAt.getTime())) throw new ValidationError('startAt must be a valid date');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const notifs = ctx.get('notifs') as NotificationService | undefined;

  const branch = await getBranchOnlineBookingContext(db, branchId);
  if (!branch || !branch.active) throw new NotFoundError('Branch');

  const config = parseOnlineBookingConfig(branch.settings);
  if (!config.enabled) throw new BusinessLogicError('Online booking is not enabled for this branch', 'ONLINE_BOOKING_DISABLED');
  if (!isOnlineBookable(config, visitType)) {
    throw new BusinessLogicError(`Visit type '${visitType}' is not bookable online`, 'VISIT_TYPE_NOT_BOOKABLE');
  }
  // requirePatientAuth: prospect (unauthenticated) bookings are rejected when the
  // branch demands a verified patient identity. The authenticated tier is an
  // additive follow-up; today there is no patient session, so this is a hard gate.
  if (config.requirePatientAuth) {
    throw new BusinessLogicError('This branch requires a verified patient to book online', 'PATIENT_AUTH_REQUIRED');
  }

  const eligibleProvider = branch.providers.some((p) => p.providerId === body.providerId)
    && (config.bookableProviderMemberIds === 'all' || (config.bookableProviderMemberIds as string[]).includes(body.providerId));
  if (!eligibleProvider) throw new ValidationError('providerId is not available for online booking');

  const durationMinutes = durationForVisitType(visitType);
  const now = new Date();
  if (startAt.getTime() < now.getTime() + config.leadTimeMinutes * 60 * 1000) {
    throw new BusinessLogicError('Slot is within the minimum lead time', 'SLOT_TOO_SOON');
  }
  if (startAt.getTime() > now.getTime() + config.horizonDays * 24 * 60 * 60 * 1000) {
    throw new BusinessLogicError('Slot is beyond the booking horizon', 'SLOT_BEYOND_HORIZON');
  }

  const hours = parseWorkingHours(branch.workingHours);
  if (!hours || !isWithinWorkingHours(startAt, durationMinutes, hours, branch.timezone || 'UTC')) {
    throw new BusinessLogicError('Slot is outside configured working hours', 'OUTSIDE_WORKING_HOURS');
  }

  // Match-or-create patient BEFORE the commit tx (its own write; idempotent enough
  // for the prospect path). The booking tx then only does the race-sensitive work.
  const { patientId } = await matchOrCreatePatientForOnlineBooking(db, {
    firstName: body.firstName.trim(),
    ...(body.lastName ? { lastName: body.lastName.trim() } : {}),
    ...(body.email ? { email: body.email } : {}),
    ...(body.phone ? { phone: body.phone } : {}),
    ...(body.dateOfBirth ? { dateOfBirth: body.dateOfBirth } : {}),
    branchId,
    actorId: ONLINE_BOOKING_ACTOR_ID,
  });

  const confirmationCode = generateConfirmationCode();

  // Transactional commit: final overlap re-check (appointments AND active holds)
  // then create the appointment. This closes the read-then-write race; the DB
  // exclusion constraint is the storage backstop if two tx interleave.
  let appointment;
  try {
    appointment = await db.transaction(async (tx) => {
      const apptRepo = new DentalAppointmentRepository(tx);
      const holdRepo = new AppointmentHoldRepository(tx);

      const overlapping = await apptRepo.findOverlapping(body.providerId, branchId, startAt, durationMinutes);
      if (overlapping.length > 0) throw new ConflictError('Slot is no longer available', 'SLOT_TAKEN');

      // Ignore the caller's own hold (by token) so it doesn't block itself.
      const heldOverlaps = await holdRepo.findActiveOverlapping(
        body.providerId, branchId, startAt, durationMinutes, now, body.sessionToken,
      );
      if (heldOverlaps.length > 0) throw new ConflictError('Slot is currently held', 'SLOT_HELD');

      const appt = await apptRepo.createOne({
        patientId,
        dentistMemberId: body.providerId,
        branchId,
        scheduledAt: startAt,
        durationMinutes,
        serviceType: visitType,
        walkIn: false,
        status: 'scheduled',
        source: 'online',
        confirmationState: 'pending',
        confirmationCode,
        ...(body.notes ? { notes: body.notes } : {}),
        createdBy: ONLINE_BOOKING_ACTOR_ID,
        updatedBy: ONLINE_BOOKING_ACTOR_ID,
      });

      // Release the caller's hold now that it has been converted to a booking.
      if (body.sessionToken) await holdRepo.deleteByToken(body.sessionToken);

      return appt;
    });
  } catch (err) {
    // An application-level conflict re-check (SLOT_TAKEN/SLOT_HELD) bubbles as-is.
    if (err instanceof ConflictError) throw err;
    // Postgres exclusion-constraint violation (storage backstop) → friendly 409.
    // The pg error code (23P01) may be on the error or nested in its `cause`
    // (Drizzle wraps query errors), so probe both plus the message text.
    const e = err as { code?: string; cause?: { code?: string }; message?: string };
    const code = e?.code ?? e?.cause?.code;
    const msg = e?.message ?? '';
    if (code === '23P01' || /exclusion constraint|dental_appointment_no_overlap/i.test(msg)) {
      throw new ConflictError('Slot is no longer available', 'SLOT_TAKEN');
    }
    throw err;
  }

  await logAuditEvent(db, logger, {
    personId: ONLINE_BOOKING_ACTOR_ID,
    tenantId: branchId,
    branchId,
    action: 'appointment.book',
    resourceType: 'dental_appointment',
    resourceId: appointment.id,
    metadata: {
      providerId: appointment.dentistMemberId,
      startAt: startAt.toISOString(),
      visitType,
      channel: 'online',
      source: 'online',
    },
  });

  notifs?.createNotification({
    recipient: patientId,
    type: 'booking.created',
    channel: 'in-app',
    title: 'Appointment requested',
    message: `Your appointment request is recorded for ${startAt.toISOString()} (confirmation ${confirmationCode})`,
    relatedEntityType: 'appointment',
    relatedEntity: appointment.id,
  }).catch(() => {/* non-blocking */});

  return ctx.json({
    confirmationCode,
    appointmentId: appointment.id,
    branchId,
    providerId: appointment.dentistMemberId,
    startAt: startAt.toISOString(),
    endAt: new Date(startAt.getTime() + durationMinutes * 60 * 1000).toISOString(),
    visitType,
    status: appointment.status,
  }, 201);
}
