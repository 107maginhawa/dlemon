/**
 * DentalBillingReminderLogRepository — dunning idempotency claims (BR-050).
 *
 * `claim` does an insert-if-absent on the (invoice_id, offset_day) unique index:
 * it returns the new row when this offset has never been reminded, or null when
 * a prior sweep already handled it. The dunning job claims BEFORE enqueuing, so
 * the same offset can never send twice; on a total dispatch failure it `release`s
 * the claim so the next daily sweep retries.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalBillingReminderLog,
  type DentalBillingReminderLog,
} from './dental-billing-reminder-log.schema';

export class DentalBillingReminderLogRepository {
  constructor(private readonly db: DatabaseInstance) {}

  /** Claim an (invoiceId, offsetDay) slot. Returns the row, or null if already claimed. */
  async claim(input: {
    invoiceId: string;
    branchId: string;
    offsetDay: number;
    channel: string;
    status: string;
    sentAt: Date;
  }): Promise<DentalBillingReminderLog | null> {
    const [row] = await this.db
      .insert(dentalBillingReminderLog)
      .values(input)
      .onConflictDoNothing({
        target: [dentalBillingReminderLog.invoiceId, dentalBillingReminderLog.offsetDay],
      })
      .returning();
    return row ?? null;
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
