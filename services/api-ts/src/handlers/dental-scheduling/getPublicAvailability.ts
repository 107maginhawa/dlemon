/**
 * getPublicAvailability (P1-25)
 *
 * GET /dental/public/branches/:branchId/availability  (public, rate-limited)
 *
 * Computes truly-bookable slots on-read from working hours minus existing
 * appointments and active holds. PII-free (free windows only). 31-day cap bounds
 * cost. 404 if branch missing; 400 if booking disabled / visit type not bookable.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, ValidationError, RateLimitError } from '@/core/errors';
import type { GetPublicAvailabilityQuery, GetPublicAvailabilityParams } from '@/generated/openapi/validators';
import { isVisitType, type VisitType } from './appointment-wire';
import {
  computeAvailability,
  BranchNotFoundError,
  OnlineBookingDisabledError,
  VisitTypeNotBookableError,
} from './availability.service';
import { availabilityLimiter, clientIp } from './public-booking-ratelimit';

const MAX_RANGE_DAYS = 31;

export async function getPublicAvailability(
  ctx: ValidatedContext<never, GetPublicAvailabilityQuery, GetPublicAvailabilityParams>,
): Promise<Response> {
  const { branchId } = ctx.req.valid('param');
  const query = ctx.req.valid('query');

  const rl = availabilityLimiter.check(`${clientIp(ctx.req.raw.headers)}:avail:${branchId}`);
  if (!rl.allowed) throw new RateLimitError('Too many requests');

  if (!isVisitType(query.visitType)) {
    throw new ValidationError('visitType must be one of: checkup, treatment, emergency, recall');
  }
  const visitType = query.visitType as VisitType;

  const dateFrom = new Date(query.date_from + 'T00:00:00.000Z');
  const dateTo = new Date(query.date_to + 'T23:59:59.999Z');
  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
    throw new ValidationError('date_from and date_to must be valid dates');
  }
  if (dateTo.getTime() < dateFrom.getTime()) {
    throw new ValidationError('date_to must be on or after date_from');
  }
  const rangeDays = Math.floor((dateTo.getTime() - dateFrom.getTime()) / 86_400_000) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    throw new ValidationError(`date range must not exceed ${MAX_RANGE_DAYS} days`);
  }

  const db = ctx.get('database') as DatabaseInstance;

  try {
    const { slots } = await computeAvailability(db, {
      branchId,
      visitType,
      dateFrom,
      dateTo,
      ...(query.providerId ? { providerId: query.providerId } : {}),
    });

    return ctx.json({
      branchId,
      visitType,
      slots: slots.map((s) => ({
        startAt: s.startAt.toISOString(),
        endAt: s.endAt.toISOString(),
        providerId: s.providerId,
        visitType: s.visitType,
      })),
    }, 200);
  } catch (err) {
    if (err instanceof BranchNotFoundError) throw new NotFoundError('Branch');
    if (err instanceof OnlineBookingDisabledError) throw new ValidationError(err.message);
    if (err instanceof VisitTypeNotBookableError) throw new ValidationError(err.message);
    throw err;
  }
}
