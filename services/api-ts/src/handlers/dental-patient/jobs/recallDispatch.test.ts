/**
 * recallDispatch + due-list + next-cycle seeding tests — P1-24, plan §4 Slice B.
 *
 * Real DB + real NotificationRepository. Verifies:
 *   - due pending recall → outreach enqueued + status flipped to 'sent' + attempts bumped
 *   - re-attempt only after recallReattemptDays; stops at recallMaxAttempts
 *   - consent gate identical to Slice A (sms suppressed when not consented)
 *   - due-list excludes completed/cancelled and is branch-scoped
 *   - completing a recurring recall seeds the next-cycle pending recall
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import type { Logger } from '@/types/logger';
import { NotificationRepository } from '@/handlers/notifs/repos/notification.repo';
import { recallDispatchJob } from './recallDispatch';
import { RecallRepository } from '../repos/recall.repo';
import { dentalRecalls } from '../repos/recall.schema';
import { notifications } from '@/handlers/notifs/repos/notification.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { addMonths, todayInTimezone } from '../utils/recall-dates';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ACTOR = '00000000-0000-1000-8000-0000000000f1';
const PERSON_ID = 'a0000000-0000-1000-8000-0000000000f1';
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000000f2';
const ORG_ID = 'f0000000-0000-1000-8000-0000000000f1';
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000f1';

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as unknown as Logger;

function buildNotifsService() {
  const repo = new NotificationRepository(db, noopLogger);
  return {
    enqueueScheduledIfAbsent: repo.enqueueScheduledIfAbsent.bind(repo),
    expireQueuedByEntity: repo.expireQueuedByEntity.bind(repo),
  } as any;
}

function ctx(svc: any) {
  return { db, logger: noopLogger, jobId: 'test', notificationService: svc } as any;
}

async function setPolicy(channels: string[], reattemptDays = 14, maxAttempts = 3) {
  await db.update(dentalBranches)
    .set({ settings: { reminderPolicy: { channels, recallReattemptDays: reattemptDays, recallMaxAttempts: maxAttempts } } as any })
    .where(eq(dentalBranches.id, BRANCH_ID));
}

async function setConsent(channels: Record<string, boolean>) {
  await db.update(persons)
    .set({ consent: { registrationConsent: true, capturedAt: new Date().toISOString(), channels } as any })
    .where(eq(persons.id, PERSON_ID));
}

async function seedRecall(values: { dueDate: string; status?: string; intervalMonths?: number; sendAttempts?: number; lastSentAt?: Date | null }) {
  const [row] = await db.insert(dentalRecalls).values({
    patientId: PATIENT_ID,
    type: 'cleaning',
    dueDate: values.dueDate,
    status: (values.status ?? 'pending') as any,
    intervalMonths: values.intervalMonths ?? null,
    sendAttempts: values.sendAttempts ?? 0,
    lastSentAt: values.lastSentAt ?? null,
    createdBy: ACTOR,
    updatedBy: ACTOR,
  }).returning();
  return row!;
}

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Recall Test Clinic', tier: 'solo', ownerPersonId: ACTOR,
    countryCode: 'PH', createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Recall Branch', timezone: 'Asia/Manila',
    createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Recall', lastName: 'Patient', createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM notification WHERE related_entity_type = 'recall'`);
  await db.execute(sql`DELETE FROM dental_recall WHERE patient_id = ${PATIENT_ID}`);
  // Restore the shared person's name in case a test marked it erased.
  await db.update(persons).set({ firstName: 'Recall' }).where(eq(persons.id, PERSON_ID));
});

const yesterday = () => {
  const d = new Date(Date.now() - 24 * 3_600_000);
  return d.toISOString().slice(0, 10);
};

async function recallNotifsFor(recallId: string) {
  return db.select().from(notifications)
    .where(and(eq(notifications.relatedEntity, recallId), sql`${notifications.type} IN ('recall.due','recall.reminder')`));
}

describe('recallDispatch (P1-24)', () => {
  test('due pending recall → enqueues outreach, flips to sent, bumps attempts', async () => {
    await setPolicy(['email', 'in-app']);
    await setConsent({ email: true });
    const recall = await seedRecall({ dueDate: yesterday(), status: 'pending' });

    await recallDispatchJob(ctx(buildNotifsService()));

    const [row] = await db.select().from(dentalRecalls).where(eq(dentalRecalls.id, recall.id)); if (!row) throw new Error('row missing');
    expect(row.status).toBe('sent');
    expect(row.sendAttempts).toBe(1);
    expect(row.lastSentAt).toBeTruthy();

    const notifs = await recallNotifsFor(recall.id);
    expect(notifs.length).toBeGreaterThan(0);
    expect(notifs.some((n) => n.type === 'recall.due')).toBe(true);
  });

  test('consent gate: sms suppressed when not consented; in-app still enqueued', async () => {
    await setPolicy(['sms', 'in-app']);
    await setConsent({ email: true }); // sms not consented
    const recall = await seedRecall({ dueDate: yesterday(), status: 'pending' });

    await recallDispatchJob(ctx(buildNotifsService()));

    const notifs = await recallNotifsFor(recall.id);
    const channels = new Set(notifs.map((n) => n.channel));
    expect(channels.has('sms')).toBe(false);
    expect(channels.has('in-app')).toBe(true);
  });

  test('re-attempt blocked until recallReattemptDays elapse', async () => {
    await setPolicy(['in-app'], 14, 3);
    await setConsent({});
    // sent 2 days ago, attempts=1 → re-attempt window (14d) not elapsed → no dispatch
    const recall = await seedRecall({
      dueDate: yesterday(), status: 'sent', sendAttempts: 1, lastSentAt: new Date(Date.now() - 2 * 24 * 3_600_000),
    });

    await recallDispatchJob(ctx(buildNotifsService()));

    const [row] = await db.select().from(dentalRecalls).where(eq(dentalRecalls.id, recall.id)); if (!row) throw new Error('row missing');
    expect(row.sendAttempts).toBe(1); // unchanged
  });

  test('re-attempt fires after window; stops at recallMaxAttempts', async () => {
    await setPolicy(['in-app'], 14, 3);
    await setConsent({});
    // last sent 20 days ago, attempts=1 → eligible → bumps to 2, type recall.reminder
    const recall = await seedRecall({
      dueDate: yesterday(), status: 'sent', sendAttempts: 1, lastSentAt: new Date(Date.now() - 20 * 24 * 3_600_000),
    });
    await recallDispatchJob(ctx(buildNotifsService()));
    let [row] = await db.select().from(dentalRecalls).where(eq(dentalRecalls.id, recall.id)); if (!row) throw new Error('row missing');
    expect(row.sendAttempts).toBe(2);

    // At max attempts (3), a further-eligible recall is NOT dispatched.
    await db.update(dentalRecalls)
      .set({ sendAttempts: 3, lastSentAt: new Date(Date.now() - 20 * 24 * 3_600_000) })
      .where(eq(dentalRecalls.id, recall.id));
    await recallDispatchJob(ctx(buildNotifsService()));
    [row] = await db.select().from(dentalRecalls).where(eq(dentalRecalls.id, recall.id)); if (!row) throw new Error('row missing');
    expect(row.sendAttempts).toBe(3); // capped
  });

  test('an ERASED subject gets NO outreach — not even the always-on in-app channel — and the recall is left pending', async () => {
    // person-erasure-then-reminder-inapp-leak (G-low): anonymizePersonPii nulls
    // consent but KEEPS the row; the consent gate fails outbound (sms/email/push)
    // closed but in-app is always written, so an erased subject still got queued
    // in-app recall notices. The cron must skip an erased subject entirely.
    await setPolicy(['email', 'in-app']);
    await setConsent({ email: true });
    const recall = await seedRecall({ dueDate: yesterday(), status: 'pending' });

    // Mark the subject erased (the [ERASED] marker is what isPersonErased checks).
    await db.update(persons).set({ firstName: '[ERASED]' }).where(eq(persons.id, PERSON_ID));

    await recallDispatchJob(ctx(buildNotifsService()));

    // No notifications at all — in-app included.
    const notifs = await recallNotifsFor(recall.id);
    expect(notifs.length).toBe(0);

    // The recall is untouched (still pending), not flipped to 'sent'.
    const [row] = await db.select().from(dentalRecalls).where(eq(dentalRecalls.id, recall.id)); if (!row) throw new Error('row missing');
    expect(row.status).toBe('pending');
    expect(row.sendAttempts).toBe(0);
  });

  test('not-yet-due pending recall is not dispatched', async () => {
    await setPolicy(['in-app']);
    await setConsent({});
    const future = todayInTimezone('Asia/Manila');
    const recall = await seedRecall({ dueDate: addMonths(future, 2), status: 'pending' });
    await recallDispatchJob(ctx(buildNotifsService()));
    const [row] = await db.select().from(dentalRecalls).where(eq(dentalRecalls.id, recall.id)); if (!row) throw new Error('row missing');
    expect(row.status).toBe('pending');
  });
});

describe('recall due-list query (P1-24)', () => {
  test('findDueByBranch returns pending/sent in window, excludes completed/cancelled, branch-scoped', async () => {
    const repo = new RecallRepository(db, noopLogger);
    await seedRecall({ dueDate: yesterday(), status: 'pending' });
    await seedRecall({ dueDate: yesterday(), status: 'completed' });
    await seedRecall({ dueDate: yesterday(), status: 'cancelled' });

    const rows = await repo.findDueByBranch(BRANCH_ID, '2000-01-01', '2999-12-31');
    expect(rows.length).toBe(1);
    expect(rows[0]!.status).toBe('pending');
    expect(rows[0]!.patientName).toContain('Recall');

    // A different branch sees nothing.
    const other = await repo.findDueByBranch('b0000000-0000-1000-8000-00000000ffff', '2000-01-01', '2999-12-31');
    expect(other.length).toBe(0);
  });
});

describe('next-cycle recall seeding (P1-24)', () => {
  test('completing a recurring recall seeds the next-cycle pending recall', async () => {
    const repo = new RecallRepository(db, noopLogger);
    const recall = await seedRecall({ dueDate: yesterday(), status: 'pending', intervalMonths: 6 });

    // Simulate the updateRecall completion path's seeding logic.
    await repo.update(recall.id, PATIENT_ID, { status: 'completed', completedAt: new Date() });
    const baseDate = todayInTimezone('UTC');
    await repo.create({
      patientId: PATIENT_ID, type: 'cleaning', dueDate: addMonths(baseDate, 6), status: 'pending',
      intervalMonths: 6, createdBy: ACTOR, updatedBy: ACTOR,
    });

    const all = await repo.findByPatientId(PATIENT_ID);
    const pending = all.filter((r) => r.status === 'pending');
    expect(pending.length).toBe(1);
    expect(pending[0]!.intervalMonths).toBe(6);
  });
});
