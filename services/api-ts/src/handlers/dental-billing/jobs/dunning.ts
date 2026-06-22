/**
 * Dunning / payment reminders (BR-050).
 *
 * Runs after the auto-overdue sweep: for every currently-overdue invoice with a
 * balance, fire a reminder at each configured days-past-due offset that has
 * elapsed and not yet been sent. The `dental_billing_reminder_log` unique
 * (invoiceId, offsetDay) claim makes each offset exactly-once.
 *
 * Channels: consent-gated. Outbound (sms/email/push) fires only on the patient's
 * explicit per-channel communication consent; in-app is ALWAYS delivered —
 * identical to recall/appointment reminders (resolveConsentedChannels). Delivery
 * is the notifs module's job; here we only enqueue `billing` notifications, which
 * the notifs cron then sends.
 */

import { and, eq, gt, isNotNull } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import { dentalInvoices } from '../repos/dental-invoice.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { BranchRepository } from '@/handlers/dental-org/repos/branch.repo';
import { NotificationRepository } from '@/handlers/notifs/repos/notification.repo';
import { DentalBillingReminderLogRepository } from '../repos/dental-billing-reminder-log.repo';
import { getPatientPersonConsent } from '@/handlers/person/repos/person-dental-patient.facade';
import { getPatientPreferredChannel } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { resolveConsentedChannels, type ReminderChannel, type PersonConsent } from '@/handlers/dental-scheduling/utils/resolve-reminder-channels';

/** Default cadence (days past due) when a branch has not configured its own. */
export const DEFAULT_REMINDER_OFFSET_DAYS = [3, 7, 14];

const DAY_MS = 24 * 60 * 60 * 1000;
// Outbound channels dunning offers + always-on in-app. resolveConsentedChannels
// gates the outbound ones on consent; in-app is never suppressed.
// ponytail: push has no per-channel consent flag yet → fails closed (never fires)
// until one is added; left in to mirror the reminder policy.
const REMINDER_POLICY_CHANNELS: ReminderChannel[] = ['email', 'push', 'in-app'];
// A 'pending' claim older than this is an orphan from a crashed sweep, safe to
// reclaim. Enqueue takes milliseconds, so an hour clears any real in-flight run.
const RECLAIM_STALE_MS = 60 * 60 * 1000;

function resolveOffsets(settings: unknown): number[] {
  const configured = (settings as { billingReminderOffsetDays?: number[] })?.billingReminderOffsetDays;
  const offsets = Array.isArray(configured) ? configured : DEFAULT_REMINDER_OFFSET_DAYS;
  return [...new Set(offsets.filter((o) => Number.isInteger(o) && o >= 0))].sort((a, b) => a - b);
}

export async function runDunningSweep(
  db: DatabaseInstance,
  logger: Logger,
  asOf: Date = new Date(),
): Promise<{ remindersSent: number }> {
  const rows = await db
    .select({
      id: dentalInvoices.id,
      branchId: dentalInvoices.branchId,
      dueDate: dentalInvoices.dueDate,
      balanceCents: dentalInvoices.balanceCents,
      patientId: dentalInvoices.patientId,
      recipientPersonId: patients.person,
    })
    .from(dentalInvoices)
    .innerJoin(patients, eq(patients.id, dentalInvoices.patientId))
    .where(
      and(
        eq(dentalInvoices.status, 'overdue'),
        gt(dentalInvoices.balanceCents, 0),
        isNotNull(dentalInvoices.dueDate),
        isNotNull(patients.person),
      ),
    );

  if (rows.length === 0) return { remindersSent: 0 };

  // Resolve each branch's cadence once.
  const branchRepo = new BranchRepository(db);
  const offsetsByBranch = new Map<string, number[]>();
  for (const branchId of new Set(rows.map((r) => r.branchId))) {
    const branch = await branchRepo.findOneById(branchId);
    offsetsByBranch.set(branchId, resolveOffsets(branch?.settings));
  }

  const reminderRepo = new DentalBillingReminderLogRepository(db);
  const notifRepo = new NotificationRepository(db, logger);
  let remindersSent = 0;

  for (const inv of rows) {
    const offsets = offsetsByBranch.get(inv.branchId) ?? DEFAULT_REMINDER_OFFSET_DAYS;
    const daysOverdue = Math.floor((asOf.getTime() - inv.dueDate!.getTime()) / DAY_MS);

    for (const offset of offsets) {
      if (offset > daysOverdue) break; // offsets are sorted ascending
      // ponytail: fires all elapsed unsent offsets per run; first-deploy backfill
      // of pre-existing long-overdue invoices may burst once. The per-offset claim
      // makes it exactly-once thereafter.
      const claim = await reminderRepo.claim({
        invoiceId: inv.id,
        branchId: inv.branchId,
        offsetDay: offset,
        channel: '',
        status: 'pending',
        sentAt: asOf,
        reclaimStaleBefore: new Date(asOf.getTime() - RECLAIM_STALE_MS),
      });
      if (!claim) continue; // already reminded for this offset (or freshly in flight)

      // Consent gate: outbound on explicit per-channel consent, in-app always.
      const consent = await getPatientPersonConsent(db, inv.patientId);
      const preferredChannel = await getPatientPreferredChannel(db, inv.patientId);
      const { channels } = resolveConsentedChannels({
        consent: consent as PersonConsent | null,
        policyChannels: REMINDER_POLICY_CHANNELS,
        preferredChannel,
      });

      const sent: string[] = [];
      for (const channel of channels) {
        try {
          await notifRepo.createNotificationForModule({
            recipient: inv.recipientPersonId!,
            type: 'billing',
            channel,
            title: 'Payment reminder',
            message: `Your invoice has an outstanding balance of ${(inv.balanceCents / 100).toFixed(2)} and is ${daysOverdue} day(s) overdue.`,
            relatedEntityType: 'dental_invoice',
            relatedEntity: inv.id,
          });
          sent.push(channel);
        } catch (error) {
          logger.warn({ error, invoiceId: inv.id, channel, offset }, 'dunning channel enqueue failed');
        }
      }

      if (sent.length === 0) {
        await reminderRepo.release(claim.id); // retry next sweep
      } else {
        await reminderRepo.setOutcome(claim.id, sent.join(','), 'sent');
        remindersSent += 1;
      }
    }
  }

  logger.info({ remindersSent }, 'dental-billing dunning sweep completed');
  return { remindersSent };
}
