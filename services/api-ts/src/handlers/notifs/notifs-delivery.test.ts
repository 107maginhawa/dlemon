/**
 * notifs delivery side-effect (G5) — DB-bound.
 *
 * Proves the cron→deliver seam end-to-end: a queued notification (as a domain
 * action enqueues) is DELIVERED by processScheduledNotifications — status flips
 * queued→sent AND, for an email-channel notification, the injected EmailService
 * actually receives a queueEmail call addressed to the recipient. The prior
 * coverage tested enqueue + expiry but never proved a notification is delivered.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { NotificationRepository } from './repos/notification.repo';
import { notifications } from './repos/notification.schema';
import { persons } from '@/handlers/person/repos/person.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });
const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

// Fixture tag: nfdel
const RECIPIENT = 'af0de100-0000-4000-8000-000000000001';
const RECIPIENT_EMAIL = 'deliver.nfdel@example.com';
const EMAIL_NOTIF = 'cf0de100-0000-4000-8000-000000000001';
const INAPP_NOTIF = 'cf0de100-0000-4000-8000-000000000002';

async function seedRecipient() {
  await db.insert(persons).values({
    id: RECIPIENT, firstName: 'Deliver', lastName: 'Target',
    contactInfo: { email: RECIPIENT_EMAIL } as any,
    createdBy: RECIPIENT, updatedBy: RECIPIENT,
  }).onConflictDoNothing();
}

async function seedQueued(id: string, channel: 'email' | 'in-app', type = 'appointment.reminder') {
  await db.insert(notifications).values({
    id, recipient: RECIPIENT, type: type as any, channel,
    title: 'Reminder', message: 'You have an appointment', status: 'queued',
    consentValidated: true, createdBy: RECIPIENT, updatedBy: RECIPIENT,
  }).onConflictDoNothing();
}

const statusOf = async (id: string) => {
  const [r] = await db.select({ s: notifications.status }).from(notifications).where(eq(notifications.id, id));
  return r?.s;
};

afterEach(async () => {
  await db.delete(notifications).where(eq(notifications.recipient, RECIPIENT));
});

describe('processScheduledNotifications — delivery side-effect (G5)', () => {
  test('a queued EMAIL notification is delivered: status→sent AND EmailService.queueEmail is called for the recipient', async () => {
    await seedRecipient();
    await seedQueued(EMAIL_NOTIF, 'email');

    const queueEmail = mock(async () => ({ id: 'queued-1' }) as any);
    const repo = new NotificationRepository(db, noopLogger, undefined, { queueEmail } as any);

    await repo.processScheduledNotifications();

    expect(await statusOf(EMAIL_NOTIF)).toBe('delivered'); // delivered, not left queued
    expect(queueEmail).toHaveBeenCalledTimes(1);
    const arg = (queueEmail.mock.calls as any[])[0][0] as any;
    expect(arg.recipient).toBe(RECIPIENT_EMAIL); // resolved via the person facade
    expect(arg.templateTags).toContain('appointment.reminder');
    expect(arg.metadata.notificationId).toBe(EMAIL_NOTIF);
  });

  test('a queued in-app notification is delivered (status→sent) without an email send', async () => {
    await seedRecipient();
    await seedQueued(INAPP_NOTIF, 'in-app');

    const queueEmail = mock(async () => ({ id: 'queued-2' }) as any);
    const repo = new NotificationRepository(db, noopLogger, undefined, { queueEmail } as any);

    await repo.processScheduledNotifications();

    expect(await statusOf(INAPP_NOTIF)).toBe('delivered');
    expect(queueEmail).toHaveBeenCalledTimes(0); // in-app channel never queues email
  });
});
