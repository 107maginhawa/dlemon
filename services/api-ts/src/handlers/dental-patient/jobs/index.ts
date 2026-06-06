/**
 * Dental Patient (recall / continuing-care) background jobs (P1-24)
 *
 * Registers the recall due-scan and dispatch jobs. Dispatch needs the
 * NotificationService (it enqueues outbound rows that the existing
 * `notifs.processScheduled` job delivers).
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';
import { recallDueScanJob } from './recallDueScan';
import { recallDispatchJob } from './recallDispatch';

type RecallDispatchJobContext = JobContext & { notificationService: NotificationService };

export function registerDentalPatientJobs(
  scheduler: JobScheduler,
  notificationService: NotificationService,
): void {
  // Nightly recare due scan (06:00).
  scheduler.registerCron('dental-patient.recallDueScan', '0 6 * * *', recallDueScanJob);

  // Daily recare dispatch (07:00) — enqueues outreach + flips recalls to sent.
  scheduler.registerCron('dental-patient.recallDispatch', '0 7 * * *', async (context: JobContext) => {
    await recallDispatchJob({ ...context, notificationService } as RecallDispatchJobContext);
  });
}

export { recallDueScanJob } from './recallDueScan';
export { recallDispatchJob } from './recallDispatch';
