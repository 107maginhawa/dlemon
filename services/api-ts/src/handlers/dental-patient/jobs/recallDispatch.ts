/**
 * recallDispatch (P1-24)
 *
 * Daily cron. For recalls that are due — `pending` with dueDate ≤ today, OR
 * `sent` past the re-attempt window and under the max-attempts cap — consent-gate,
 * enqueue a scheduled `notification` (recall.due / recall.reminder), flip the
 * recall to `sent`, and bump `lastSentAt` / `sendAttempts`. This REPLACES the
 * manual `updateRecall status:'sent'` flip as the primary path.
 *
 * Idempotency: enqueue is keyed on (relatedEntity, type, channel, scheduledAt) so
 * a same-day re-run writes no duplicate outbound rows. Batch-limited to 100.
 *
 * Timezone: due-ness is judged against "today in the branch timezone".
 */

import type { JobContext } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';
import type { DatabaseInstance } from '@/core/database';
import { SYSTEM_USER_ID } from '@/core/constants';
import { RecallRepository } from '../repos/recall.repo';
import { getBranchReminderPolicy } from '@/handlers/dental-org/repos/org-scheduling.facade';
import { getPatientPersonConsent } from '@/handlers/person/repos/person-dental-patient.facade';
import { getPatientPreferredChannel } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { resolveConsentedChannels, type ReminderChannel, type PersonConsent } from '@/handlers/dental-scheduling/utils/resolve-reminder-channels';
import { todayInTimezone, isDueOnOrBefore } from '../utils/recall-dates';

interface RecallDispatchJobContext extends JobContext {
  notificationService: NotificationService;
}

export async function recallDispatchJob(context: RecallDispatchJobContext): Promise<void> {
  const { logger, jobId } = context;
  const db = context.db as unknown as DatabaseInstance;
  const notifs = context.notificationService;

  try {
    const repo = new RecallRepository(db, logger);
    const now = new Date();

    // Use a wide reattempt cutoff guard up front; per-branch policy refines below.
    // Fetch a generous candidate set; gate each against its own branch policy.
    const reattemptCutoff = new Date(now.getTime() - 1 * 24 * 3_600_000); // ≥1 day floor
    const candidates = await repo.findDispatchable(
      now.toISOString().slice(0, 10), // crude UTC due filter; refined per-branch below
      reattemptCutoff,
      99, // generous attempt ceiling here; real cap applied per-branch below
      100,
    );

    let dispatched = 0;
    let suppressedCount = 0;

    for (const recall of candidates) {
      const branchId = recall.preferredBranchId;
      if (!branchId) continue; // can't resolve policy/consent without a branch

      const { policy, timezone } = await getBranchReminderPolicy(db, branchId);
      const today = todayInTimezone(timezone, now);

      // Per-branch re-attempt + max-attempt enforcement.
      if (recall.status === 'pending') {
        if (!isDueOnOrBefore(recall.dueDate, today)) continue;
      } else {
        // status === 'sent' re-attempt path
        if (recall.sendAttempts >= policy.recallMaxAttempts) continue;
        if (recall.lastSentAt) {
          const nextEligible = new Date(recall.lastSentAt.getTime() + policy.recallReattemptDays * 24 * 3_600_000);
          if (nextEligible.getTime() > now.getTime()) continue;
        }
      }

      const consent = await getPatientPersonConsent(db, recall.patientId);
      const preferredChannel = await getPatientPreferredChannel(db, recall.patientId);
      const { channels, suppressed } = resolveConsentedChannels({
        consent: consent as PersonConsent | null,
        policyChannels: policy.channels as ReminderChannel[],
        preferredChannel,
      });

      for (const s of suppressed) {
        suppressedCount++;
        logger.info({ jobId, recallId: recall.id, channel: s.channel, reason: s.reason }, 'Recall channel suppressed by consent gate');
      }

      const isReattempt = recall.status === 'sent';
      const type = isReattempt ? 'recall.reminder' : 'recall.due';

      // Enqueue immediate outbound rows (scheduledAt = now) on each consented channel.
      // in-app is always written even when outbound is fully suppressed.
      for (const channel of channels) {
        await notifs.enqueueScheduledIfAbsent({
          recipient: recall.personId,
          type,
          channel,
          title: 'Time for your next visit',
          message: 'Your recare visit is due. Please contact the clinic to schedule.',
          scheduledAt: now,
          relatedEntityType: 'recall',
          relatedEntity: recall.id,
        });
      }

      // Flip to sent + bump attempts regardless of outbound suppression (in-app fired).
      await repo.markDispatched(recall.id, recall.sendAttempts + 1, SYSTEM_USER_ID);
      dispatched++;
    }

    if (dispatched > 0 || suppressedCount > 0) {
      logger.info({ jobId, candidates: candidates.length, dispatched, suppressed: suppressedCount }, 'Recall dispatch run complete');
    }
  } catch (error) {
    logger.error({ jobId, error: error instanceof Error ? error.message : String(error) }, 'Recall dispatch job failed');
    // Non-critical — do not rethrow.
  }
}
