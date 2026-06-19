/**
 * dental_billing_reminder_log — dunning idempotency ledger (BR-050).
 *
 * One row per (invoiceId, offsetDay) reminder event. The unique
 * (invoice_id, offset_day) constraint is the idempotency guard: the dunning
 * sweep does an insert-if-absent before enqueuing notifications, so a re-run (or
 * a second daily sweep) can never re-send the same offset's reminder.
 *
 * `channel` records the channels actually dispatched (comma-joined, e.g.
 * "email,push"); SMS is deferred (notifs 'sms' is a no-op) so it never appears.
 */

import { pgTable, uuid, integer, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalInvoices } from './dental-invoice.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';

export const dentalBillingReminderLog = pgTable('dental_billing_reminder_log', {
  ...baseEntityFields,
  invoiceId: uuid('invoice_id').notNull().references(() => dentalInvoices.id),
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
  // Days past the invoice due date at which this reminder fired.
  offsetDay: integer('offset_day').notNull(),
  // Comma-joined channels dispatched (e.g. "email,push").
  channel: text('channel').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
  // 'sent' (at least one channel enqueued) | 'failed' (all dispatch failed).
  status: text('status').notNull(),
}, (table) => ({
  // BR-050 idempotency: one reminder per invoice per offset, ever.
  invoiceOffsetUnique: uniqueIndex('dental_billing_reminder_log_invoice_offset_unique')
    .on(table.invoiceId, table.offsetDay),
  branchIdx: index('dental_billing_reminder_log_branch_idx').on(table.branchId),
}));

export type DentalBillingReminderLog = typeof dentalBillingReminderLog.$inferSelect;
export type NewDentalBillingReminderLog = typeof dentalBillingReminderLog.$inferInsert;
