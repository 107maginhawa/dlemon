/**
 * DentalBillingReminderLogRepository — dunning idempotency claims (BR-050).
 *
 * `claim` does an insert-if-absent on the (invoice_id, offset_day) unique index:
 * it returns the new row when this offset has never been reminded, or null when
 * a prior sweep already handled it. The dunning job claims BEFORE enqueuing, so
 * the same offset can never send twice; on a total dispatch failure it `release`s
 * the claim so the next daily sweep retries.
 *
 * Crash recovery: a row is left `status='pending'` between claim and outcome. If
 * the worker dies in that window the row would block its offset forever, so when
 * the insert conflicts `claim` also reclaims a `pending` row whose `sent_at` is
 * older than `reclaimStaleBefore` (an orphan from a crashed run) — fresh pending
 * rows (an in-flight claim) are left alone.
 */

import { and, eq, lt } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalBillingReminderLog,
  type DentalBillingReminderLog,
} from './dental-billing-reminder-log.schema';

export class DentalBillingReminderLogRepository {
  constructor(private readonly db: DatabaseInstance) {}

  /**
   * Claim an (invoiceId, offsetDay) slot. Returns the row, or null if already
   * claimed. When `reclaimStaleBefore` is given and the slot is held by a stale
   * `pending` row (orphaned by a crashed run), that row is reclaimed and returned
   * instead of returning null.
   */
  async claim(input: {
    invoiceId: string;
    branchId: string;
    offsetDay: number;
    channel: string;
    status: string;
    sentAt: Date;
    reclaimStaleBefore?: Date;
  }): Promise<DentalBillingReminderLog | null> {
    const { reclaimStaleBefore, ...values } = input;
    const [row] = await this.db
      .insert(dentalBillingReminderLog)
      .values(values)
      .onConflictDoNothing({
        target: [dentalBillingReminderLog.invoiceId, dentalBillingReminderLog.offsetDay],
      })
      .returning();
    if (row) return row;
    if (!reclaimStaleBefore) return null;

    // Slot taken — reclaim it only if it's a stale orphaned 'pending' row.
    const [reclaimed] = await this.db
      .update(dentalBillingReminderLog)
      .set({ sentAt: values.sentAt, channel: values.channel, updatedAt: new Date() })
      .where(
        and(
          eq(dentalBillingReminderLog.invoiceId, values.invoiceId),
          eq(dentalBillingReminderLog.offsetDay, values.offsetDay),
          eq(dentalBillingReminderLog.status, 'pending'),
          lt(dentalBillingReminderLog.sentAt, reclaimStaleBefore),
        ),
      )
      .returning();
    return reclaimed ?? null;
  }

  /** Release a claim (after a total dispatch failure) so the next sweep retries. */
  async release(id: string): Promise<void> {
    await this.db.delete(dentalBillingReminderLog).where(eq(dentalBillingReminderLog.id, id));
  }

  async setOutcome(id: string, channel: string, status: string): Promise<void> {
    await this.db
      .update(dentalBillingReminderLog)
      .set({ channel, status, updatedAt: new Date() })
      .where(eq(dentalBillingReminderLog.id, id));
  }
}
