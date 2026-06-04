/**
 * confirmAppointmentByToken (P1-24)
 *
 * POST /dental/public/appointments/:appointmentId/confirm/:token  (public)
 *
 * Token-gated patient self-confirm reached from the reminder link. No auth; the
 * single-use `confirmationToken` is the bearer. Valid + scheduled → confirmed
 * (confirmedVia='link'); the token is cleared so a replay 404s. Rate-limited.
 * Returns a PII-minimal view (status + window only). Synchronously expires any
 * queued reminder rows on success.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { NotificationService } from '@/core/notifs';
import { NotFoundError } from '@/core/errors';
import type { ConfirmAppointmentByTokenParams } from '@/generated/openapi/validators';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { computeEndAt } from './appointment-wire';
import { REMINDER_NOTIFICATION_TYPES } from './utils/reminder-types';
import { bookingWriteLimiter, clientIp } from './public-booking-ratelimit';
import { RateLimitError } from '@/core/errors';

export async function confirmAppointmentByToken(
  ctx: ValidatedContext<never, never, ConfirmAppointmentByTokenParams>,
): Promise<Response> {
  const { appointmentId, token } = ctx.req.valid('param');

  // Abuse guard (public, unauthenticated route).
  const ip = clientIp(ctx.req.raw.headers);
  const rl = bookingWriteLimiter.check(`${ip}:confirm-token`);
  if (!rl.allowed) {
    throw new RateLimitError('Too many requests. Please try again shortly.');
  }

  const db = ctx.get('database') as DatabaseInstance;
  const notifs = ctx.get('notifs') as NotificationService | undefined;
  const repo = new DentalAppointmentRepository(db);

  // Single-use, status-guarded confirm. Unknown/used token or non-scheduled → null.
  const confirmed = await repo.confirmByToken(appointmentId, token);
  if (!confirmed) throw new NotFoundError('Appointment');

  if (notifs) {
    await notifs.expireQueuedByEntity(appointmentId, REMINDER_NOTIFICATION_TYPES).catch(() => {/* best-effort */});
  }

  return ctx.json({
    appointmentId: confirmed.id,
    status: confirmed.status,
    startAt: confirmed.scheduledAt.toISOString(),
    endAt: computeEndAt(confirmed.scheduledAt, confirmed.durationMinutes).toISOString(),
    confirmedAt: (confirmed.confirmedAt ?? new Date()).toISOString(),
  }, 200);
}
