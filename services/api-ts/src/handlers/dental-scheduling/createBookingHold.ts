/**
 * createBookingHold (P1-25)
 *
 * POST /dental/public/branches/:branchId/holds  (public, rate-limited)
 *
 * Places a short-TTL soft reservation on a provider/time window so two patients
 * can't both reach commit for the same slot. Validates the slot is genuinely
 * bookable (config + working hours + no existing appointment/active hold) before
 * holding. Returns a session token the client presents at commit time.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, ValidationError, ConflictError, BusinessLogicError, RateLimitError } from '@/core/errors';
import type { CreateBookingHoldBody, CreateBookingHoldParams } from '@/generated/openapi/validators';
import { isVisitType, type VisitType } from './appointment-wire';
import { parseWorkingHours, isWithinWorkingHours } from './workingHours';
import { getBranchOnlineBookingContext } from '@/handlers/dental-org/repos/org-scheduling.facade';
import { parseOnlineBookingConfig, durationForVisitType, isOnlineBookable } from './online-booking-config';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { AppointmentHoldRepository } from './repos/appointment-hold.repo';
import { bookingWriteLimiter, clientIp } from './public-booking-ratelimit';
import { withTenantTx } from '@/core/tenant-tx';

const HOLD_TTL_MINUTES = 5;

export async function createBookingHold(
  ctx: ValidatedContext<CreateBookingHoldBody, never, CreateBookingHoldParams>,
): Promise<Response> {
  const { branchId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const rl = bookingWriteLimiter.check(`${clientIp(ctx.req.raw.headers)}:hold:${branchId}`);
  if (!rl.allowed) throw new RateLimitError('Too many requests');

  if (!isVisitType(body.visitType)) {
    throw new ValidationError('visitType must be one of: checkup, treatment, emergency, recall');
  }
  const visitType = body.visitType as VisitType;
  const startAt = body.startAt instanceof Date ? body.startAt : new Date(String(body.startAt));
  if (Number.isNaN(startAt.getTime())) throw new ValidationError('startAt must be a valid date');

  const db = ctx.get('database') as DatabaseInstance;
  const branch = await getBranchOnlineBookingContext(db, branchId);
  if (!branch || !branch.active) throw new NotFoundError('Branch');

  const config = parseOnlineBookingConfig(branch.settings);
  if (!config.enabled) throw new BusinessLogicError('Online booking is not enabled for this branch', 'ONLINE_BOOKING_DISABLED');
  if (!isOnlineBookable(config, visitType)) {
    throw new BusinessLogicError(`Visit type '${visitType}' is not bookable online`, 'VISIT_TYPE_NOT_BOOKABLE');
  }

  // Provider must be one of the branch's online-bookable providers.
  const eligibleProvider = branch.providers.some((p) => p.providerId === body.providerId)
    && (config.bookableProviderMemberIds === 'all' || (config.bookableProviderMemberIds as string[]).includes(body.providerId));
  if (!eligibleProvider) throw new ValidationError('providerId is not available for online booking');

  const durationMinutes = durationForVisitType(visitType);

  // Lead-time + horizon gate.
  const now = new Date();
  if (startAt.getTime() < now.getTime() + config.leadTimeMinutes * 60 * 1000) {
    throw new BusinessLogicError('Slot is within the minimum lead time', 'SLOT_TOO_SOON');
  }
  if (startAt.getTime() > now.getTime() + config.horizonDays * 24 * 60 * 60 * 1000) {
    throw new BusinessLogicError('Slot is beyond the booking horizon', 'SLOT_BEYOND_HORIZON');
  }

  // Working-hours gate (reuse the proven Intl logic).
  const hours = parseWorkingHours(branch.workingHours);
  if (!hours || !isWithinWorkingHours(startAt, durationMinutes, hours, branch.timezone || 'UTC')) {
    throw new BusinessLogicError('Slot is outside configured working hours', 'OUTSIDE_WORKING_HOURS');
  }

  // RLS P1b activation: the overlap re-checks (dental_appointment +
  // dental_appointment_hold) and the hold write run inside one withTenantTx so
  // app_rls scopes them to this branch (and WITH CHECK validates the insert).
  // The branch-config read above stays on db.
  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + HOLD_TTL_MINUTES * 60 * 1000);
  const hold = await withTenantTx(db, { branchIds: [branchId] }, async (tx) => {
    const apptRepo = new DentalAppointmentRepository(tx);
    const holdRepo = new AppointmentHoldRepository(tx);

    const overlapping = await apptRepo.findOverlapping(body.providerId, branchId, startAt, durationMinutes);
    if (overlapping.length > 0) throw new ConflictError('Slot is no longer available', 'SLOT_TAKEN');

    const heldOverlaps = await holdRepo.findActiveOverlapping(body.providerId, branchId, startAt, durationMinutes, now);
    if (heldOverlaps.length > 0) throw new ConflictError('Slot is currently held', 'SLOT_HELD');

    return holdRepo.createOne({
      branchId,
      providerId: body.providerId,
      startAt,
      durationMinutes,
      expiresAt,
      sessionToken,
    });
  });

  return ctx.json({
    holdId: hold.id,
    sessionToken,
    providerId: body.providerId,
    startAt: startAt.toISOString(),
    endAt: new Date(startAt.getTime() + durationMinutes * 60 * 1000).toISOString(),
    expiresAt: expiresAt.toISOString(),
  }, 201);
}
