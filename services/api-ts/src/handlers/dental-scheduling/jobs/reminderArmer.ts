/**
 * reminderArmer (P1-24)
 *
 * Cron job (every 15 min) that ENQUEUES scheduled reminder notification rows for
 * upcoming appointments. Delivery itself is handled by the existing
 * `notifs.processScheduled` job — this job only decides which rows to write and
 * when, gated by per-channel consent.
 *
 * For each appointment in `scheduled` | `confirmed` whose `scheduledAt` is in the
 * future, for each configured lead-hour whose reminder time has not yet passed,
 * for each consented channel, write a scheduled `notification`
 * (type='appointment.reminder', scheduledAt = appt.scheduledAt - leadHours).
 *
 * Idempotency: enqueue is keyed on (relatedEntity, type, channel, scheduledAt) so
 * re-runs write zero duplicates. Batch-limited to 100 appointments per run.
 *
 * Timezone: lead times are computed in UTC off `scheduledAt` (timestamptz).
 */

import { and, gte, lte, inArray } from 'drizzle-orm';
import type { JobContext } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';
import type { DatabaseInstance } from '@/core/database';
import { dentalAppointments } from '../repos/dental-appointment.schema';
import { getBranchReminderPolicy } from '@/handlers/dental-org/repos/org-scheduling.facade';
import { getPatientPersonConsent } from '@/handlers/person/repos/person-dental-patient.facade';
import { getPatientPreferredChannel } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { resolveConsentedChannels, type ReminderChannel, type PersonConsent } from '../utils/resolve-reminder-channels';

interface ReminderArmerJobContext extends JobContext {
  notificationService: NotificationService;
}

/** Look at most this many hours ahead (≥ the largest sensible lead time). */
const MAX_LEAD_HORIZON_HOURS = 24 * 14; // 14 days

export async function reminderArmerJob(context: ReminderArmerJobContext): Promise<void> {
  const { logger, jobId } = context;
  const db = context.db as unknown as DatabaseInstance;
  const notifs = context.notificationService;

  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + MAX_LEAD_HORIZON_HOURS * 3_600_000);

    const upcoming = await db
      .select()
      .from(dentalAppointments)
      .where(and(
        inArray(dentalAppointments.status, ['scheduled', 'confirmed']),
        gte(dentalAppointments.scheduledAt, now),
        lte(dentalAppointments.scheduledAt, horizon),
      ))
      .limit(100);

    let enqueued = 0;
    let suppressedCount = 0;

    for (const appt of upcoming) {
      const { policy } = await getBranchReminderPolicy(db, appt.branchId);
      const consent = await getPatientPersonConsent(db, appt.patientId);
      const preferredChannel = await getPatientPreferredChannel(db, appt.patientId);

      const { channels, suppressed } = resolveConsentedChannels({
        consent: consent as PersonConsent | null,
        policyChannels: policy.channels as ReminderChannel[],
        preferredChannel,
      });

      // Audit suppressions (no PII — appointment id + channel + reason only).
      for (const s of suppressed) {
        suppressedCount++;
        logger.info({ jobId, appointmentId: appt.id, channel: s.channel, reason: s.reason }, 'Reminder channel suppressed by consent gate');
      }

      if (channels.length === 0) continue;

      for (const leadHours of policy.leadHours) {
        const fireAt = new Date(appt.scheduledAt.getTime() - leadHours * 3_600_000);
        // Skip lead times already in the past (the window has elapsed).
        if (fireAt.getTime() <= now.getTime()) continue;

        for (const channel of channels) {
          const { created } = await notifs.enqueueScheduledIfAbsent({
            recipient: appt.patientId,
            type: 'appointment.reminder',
            channel,
            title: 'Appointment reminder',
            message: `Reminder: you have an appointment on ${appt.scheduledAt.toISOString()}.`,
            scheduledAt: fireAt,
            relatedEntityType: 'appointment',
            relatedEntity: appt.id,
          });
          if (created) enqueued++;
        }
      }
    }

    if (enqueued > 0 || suppressedCount > 0) {
      logger.info({ jobId, appointments: upcoming.length, enqueued, suppressed: suppressedCount }, 'Reminder armer run complete');
    }
  } catch (error) {
    logger.error({ jobId, error: error instanceof Error ? error.message : String(error) }, 'Reminder armer job failed');
    // Non-critical housekeeping — do not rethrow (avoid pg-boss retry storms).
  }
}
