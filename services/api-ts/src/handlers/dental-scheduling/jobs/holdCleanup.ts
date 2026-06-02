/**
 * holdCleanup (P1-25)
 *
 * Sweeps expired dental_appointment_hold rows so the side-table doesn't grow
 * unbounded. Availability already ignores expired holds (TTL filter at query
 * time), so this is purely housekeeping. Mirrors booking/jobs/slotCleanup.ts.
 */

import type { JobContext, JobScheduler } from '@/core/jobs';
import { AppointmentHoldRepository } from '../repos/appointment-hold.repo';

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
export function registerDentalSchedulingJobs(scheduler: JobScheduler): void {
  // Sweep expired holds every 5 minutes (TTL is 5 min).
  scheduler.registerInterval('dental-scheduling.holdCleanup', 5 * 60 * 1000, holdCleanupJob);
}
