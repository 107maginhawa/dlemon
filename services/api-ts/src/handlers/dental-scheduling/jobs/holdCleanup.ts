/**
 * holdCleanup (P1-25)
 *
 * Sweeps expired dental_appointment_hold rows so the side-table doesn't grow
 * unbounded. Availability already ignores expired holds (TTL filter at query
 * time), so this is purely housekeeping. Mirrors booking/jobs/slotCleanup.ts.
 */

import type { JobContext, JobScheduler } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';
import { AppointmentHoldRepository } from '../repos/appointment-hold.repo';
import { reminderArmerJob } from './reminderArmer';

export async function holdCleanupJob(context: JobContext): Promise<void> {
  const { db, logger, jobId } = context;
  try {
    const repo = new AppointmentHoldRepository(db as any);
    const removed = await repo.deleteExpired();
    if (removed > 0) logger.info({ jobId, removed }, 'Expired appointment holds cleaned up');
  } catch (error) {
    logger.error({ jobId, error: error instanceof Error ? error.message : String(error) }, 'Hold cleanup job failed');
    // Non-critical — do not rethrow (avoid pg-boss retry storms for housekeeping).
  }
}

/** Register the dental-scheduling background jobs. */
export function registerDentalSchedulingJobs(
  scheduler: JobScheduler,
  notificationService?: NotificationService,
): void {
  // Sweep expired holds every 5 minutes (TTL is 5 min).
  scheduler.registerInterval('dental-scheduling.holdCleanup', 5 * 60 * 1000, holdCleanupJob);

  // P1-24: arm appointment reminders every 15 minutes (enqueue-only; the existing
  // notifs.processScheduled job delivers). Mirrors the booking.reminderSender
  // precedent. Needs the NotificationService to enqueue idempotently.
  if (notificationService) {
    scheduler.registerInterval('dental-scheduling.reminderArmer', 15 * 60 * 1000, async (context) => {
      await reminderArmerJob({ ...context, notificationService } as any);
    });
  }
}
