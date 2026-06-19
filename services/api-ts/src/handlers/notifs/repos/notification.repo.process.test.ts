/**
 * NotificationRepository.processScheduledNotifications — regression test
 *
 * Fixture tag: np01
 * All deterministic UUIDs use namespace np01.
 *
 * Covers three cases:
 *   1. queued + scheduledAt IS NULL → must be delivered (regression: was skipped before fix)
 *   2. queued + scheduledAt in the past → must be delivered
 *   3. queued + scheduledAt in the future → must NOT be delivered (stays queued)
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { NotificationRepository } from './notification.repo';
import { notifications } from './notification.schema';

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// ---------------------------------------------------------------------------
// Fixtures — fixture tag: np01
// ---------------------------------------------------------------------------

// System / fixture UUIDs (no real person rows needed; recipient is a uuid column, FK not enforced in test DB)
const SYSTEM_UUID  = '00000000-0000-0000-0000-000000000000';
const RECIPIENT_ID = 'af000000-0000-4000-8000-000000000099';  // np01 fixture recipient

const NOTIF_NULL_SCHED  = 'cf000000-0000-4000-8000-000000000101'; // case 1: queued, scheduledAt NULL
const NOTIF_PAST_SCHED  = 'cf000000-0000-4000-8000-000000000102'; // case 2: queued, scheduledAt past
const NOTIF_FUTURE_SCHED = 'cf000000-0000-4000-8000-000000000103'; // case 3: queued, scheduledAt future

const ALL_IDS = [NOTIF_NULL_SCHED, NOTIF_PAST_SCHED, NOTIF_FUTURE_SCHED];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedNotifications() {
  const past   = new Date(Date.now() - 60_000);   // 1 minute ago
  const future = new Date(Date.now() + 60_000);   // 1 minute from now

  await db.insert(notifications).values([
    {
      id:          NOTIF_NULL_SCHED,
      recipient:   RECIPIENT_ID,
      type:        'system',
      channel:     'in-app',
      title:       'np01 null-sched',
      message:     'Regression: queued with null scheduledAt must be processed',
      scheduledAt: null,
      status:      'queued',
      consentValidated: false,
      createdBy:   SYSTEM_UUID,
      updatedBy:   SYSTEM_UUID,
    },
    {
      id:          NOTIF_PAST_SCHED,
      recipient:   RECIPIENT_ID,
      type:        'system',
      channel:     'in-app',
      title:       'np01 past-sched',
      message:     'Queued with past scheduledAt must be processed',
      scheduledAt: past,
      status:      'queued',
      consentValidated: false,
      createdBy:   SYSTEM_UUID,
      updatedBy:   SYSTEM_UUID,
    },
    {
      id:          NOTIF_FUTURE_SCHED,
      recipient:   RECIPIENT_ID,
      type:        'system',
      channel:     'in-app',
      title:       'np01 future-sched',
      message:     'Queued with future scheduledAt must NOT be processed yet',
      scheduledAt: future,
      status:      'queued',
      consentValidated: false,
      createdBy:   SYSTEM_UUID,
      updatedBy:   SYSTEM_UUID,
    },
  ]);
}

async function fetchStatuses(): Promise<Record<string, string>> {
  const rows = await db
    .select({ id: notifications.id, status: notifications.status })
    .from(notifications)
    .where(inArray(notifications.id, ALL_IDS));

  return Object.fromEntries(rows.map((r) => [r.id, r.status]));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationRepository.processScheduledNotifications', () => {
  afterEach(async () => {
    await db.delete(notifications).where(inArray(notifications.id, ALL_IDS));
  });

  test('delivers queued notification with NULL scheduledAt (regression)', async () => {
    await seedNotifications();

    const repo = new NotificationRepository(db);
    await repo.processScheduledNotifications();

    const statuses = await fetchStatuses();

    // Case 1: NULL-scheduled queued row MUST have been delivered — regression case
    expect(statuses[NOTIF_NULL_SCHED]).not.toBe('queued');
  });

  test('delivers queued notification with past scheduledAt', async () => {
    await seedNotifications();

    const repo = new NotificationRepository(db);
    await repo.processScheduledNotifications();

    const statuses = await fetchStatuses();

    // Case 2: past-scheduled queued row MUST have been delivered
    expect(statuses[NOTIF_PAST_SCHED]).not.toBe('queued');
  });

  test('does not deliver queued notification with future scheduledAt', async () => {
    await seedNotifications();

    const repo = new NotificationRepository(db);
    await repo.processScheduledNotifications();

    const statuses = await fetchStatuses();

    // Case 3: future-scheduled row MUST remain queued
    expect(statuses[NOTIF_FUTURE_SCHED]).toBe('queued');
  });
});
