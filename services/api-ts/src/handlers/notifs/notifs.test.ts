/**
 * notifs handler tests — getNotification, listNotifications, markAllNotificationsAsRead
 *
 * Fixture tag: nf01
 * All deterministic UUIDs use namespace nf01.
 *
 * markNotificationAsRead is already covered in markNotificationAsRead.test.ts
 * — not duplicated here.
 *
 * RED-for-right-reason: each 404 / 403 happy-path test confirmed to fail
 * before seed existed.
 *
 * Pattern: buildTestApp (handler-unit, NOT real router) with real DB + zValidator
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  GetNotificationParams,
  ListNotificationsQuery,
  MarkAllNotificationsAsReadQuery,
} from '@/generated/openapi/validators';
import { notifications } from './repos/notification.schema';
import { getNotification } from './getNotification';
import { listNotifications } from './listNotifications';
import { markAllNotificationsAsRead } from './markAllNotificationsAsRead';

// ---------------------------------------------------------------------------
// DB + fixtures
// ---------------------------------------------------------------------------

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Fixture tag: nf01 — all IDs are valid UUIDs (hex only)
const USER_A = {
  id: 'af010000-0000-4000-8000-000000000001',
  email: 'user-a-nf01@test.com',
  role: 'user',
};
const USER_B = {
  id: 'af010000-0000-4000-8000-000000000002',
  email: 'user-b-nf01@test.com',
  role: 'user',
};

const NOTIF_ID_1 = 'cf010000-0000-4000-8000-000000000001';
const NOTIF_ID_2 = 'cf010000-0000-4000-8000-000000000002';
const NOTIF_ID_3 = 'cf010000-0000-4000-8000-000000000003';

const FIXED_TS = new Date('2026-02-01T09:00:00Z');

// ---------------------------------------------------------------------------
// buildTestApp
// ---------------------------------------------------------------------------

const ve = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
};

function buildTestApp(user?: typeof USER_A) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      // NOTE: the notifs handlers read the authed identity from ctx.get('user')
      // directly (NOT session.user, unlike the reviews handlers). The 'session'
      // here is set only to mirror real middleware; a refactor that switches
      // these handlers to session.user would need this 'user' set too.
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session-nf01', user });
    }
    await next();
  });

  app.get('/notifications', zValidator('query', ListNotificationsQuery, ve), listNotifications as any);
  app.get('/notifications/:notif', zValidator('param', GetNotificationParams, ve), getNotification as any);
  app.post('/notifications/read-all', zValidator('query', MarkAllNotificationsAsReadQuery, ve), markAllNotificationsAsRead as any);

  return app;
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedNotification(
  id: string,
  recipientId: string,
  overrides: Partial<typeof notifications.$inferInsert> = {}
) {
  await db.insert(notifications).values({
    id,
    recipient: recipientId,
    type: 'system',
    channel: 'in-app',
    title: 'Test notification nf01',
    message: 'This is a test notification',
    status: 'queued',
    consentValidated: true,
    createdBy: recipientId,
    updatedBy: recipientId,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
    ...overrides,
  }).onConflictDoNothing();

  // Post-seed read-back assert
  const [readback] = await db.select().from(notifications).where(eq(notifications.id, id));
  expect(readback!.recipient).toBe(overrides.recipient ?? recipientId);
  return readback!;
}

async function truncateNotifications() {
  await db.delete(notifications).where(eq(notifications.id, NOTIF_ID_1));
  await db.delete(notifications).where(eq(notifications.id, NOTIF_ID_2));
  await db.delete(notifications).where(eq(notifications.id, NOTIF_ID_3));
}

// ---------------------------------------------------------------------------
// getNotification
// ---------------------------------------------------------------------------

describe('getNotification', () => {
  afterEach(truncateNotifications);

  test('unauthenticated (no user set) → 401 UNAUTHORIZED', async () => {
    // getNotification guards: ctx.get('user') null → UnauthorizedError.
    // (In production the auth middleware already 401s before the handler;
    // this in-handler guard is defensive and keeps behavior consistent
    // with the reviews handlers.)
    const app = buildTestApp(undefined);
    const res = await app.request(`/notifications/${NOTIF_ID_1}`);
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('notification not found for user → 404 NOT_FOUND', async () => {
    // RED verified: no seed → findOneByIdAndRecipient returns null → NotFoundError
    const app = buildTestApp(USER_A);
    const res = await app.request('/notifications/00000000-0000-4000-8000-000099030001');
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('user cannot get another user notification (ownership filter) → 404', async () => {
    // Repo uses findOneByIdAndRecipient — owned by USER_B, USER_A gets 404 not 403
    // (security by obscurity: same error for not-found vs not-owned)
    await seedNotification(NOTIF_ID_1, USER_B.id);
    const app = buildTestApp(USER_A);
    const res = await app.request(`/notifications/${NOTIF_ID_1}`);
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('happy path → 200 with notification data', async () => {
    await seedNotification(NOTIF_ID_1, USER_A.id, { title: 'nf01 Hello', type: 'billing' });
    const app = buildTestApp(USER_A);
    const res = await app.request(`/notifications/${NOTIF_ID_1}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(NOTIF_ID_1);
    expect(body.recipient).toBe(USER_A.id);
    expect(body.title).toBe('nf01 Hello');
    expect(body.type).toBe('billing');
  });
});

// ---------------------------------------------------------------------------
// listNotifications
// ---------------------------------------------------------------------------

describe('listNotifications', () => {
  afterEach(truncateNotifications);

  test('unauthenticated (no user set) → 401 UNAUTHORIZED', async () => {
    // listNotifications guards: ctx.get('user') null → UnauthorizedError.
    const app = buildTestApp(undefined);
    const res = await app.request('/notifications');
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('happy path empty → 200 with empty data array and pagination', async () => {
    const app = buildTestApp(USER_A);
    const res = await app.request('/notifications');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  test('happy path with seeded notifications → 200 contains own notifications only', async () => {
    // RED verified: before seed, data array was empty
    await seedNotification(NOTIF_ID_1, USER_A.id, { type: 'billing' });
    await seedNotification(NOTIF_ID_2, USER_B.id, { type: 'security' }); // belongs to USER_B
    const app = buildTestApp(USER_A);
    const res = await app.request('/notifications');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const ids = body.data.map((n: any) => n.id);
    // USER_A should only see their own notification
    expect(ids).toContain(NOTIF_ID_1);
    expect(ids).not.toContain(NOTIF_ID_2);
  });

  test('channel filter → 200 returns only in-app notifications', async () => {
    await seedNotification(NOTIF_ID_1, USER_A.id, { channel: 'in-app', type: 'system' });
    await seedNotification(NOTIF_ID_2, USER_A.id, { channel: 'email', type: 'billing' });
    const app = buildTestApp(USER_A);
    const res = await app.request('/notifications?channel=in-app');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const ids = body.data.map((n: any) => n.id);
    expect(ids).toContain(NOTIF_ID_1);
    expect(ids).not.toContain(NOTIF_ID_2);
  });

  test('type filter → 200 returns only matching type', async () => {
    await seedNotification(NOTIF_ID_1, USER_A.id, { type: 'billing' });
    await seedNotification(NOTIF_ID_2, USER_A.id, { type: 'security' });
    const app = buildTestApp(USER_A);
    const res = await app.request('/notifications?type=billing');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const ids = body.data.map((n: any) => n.id);
    expect(ids).toContain(NOTIF_ID_1);
    expect(ids).not.toContain(NOTIF_ID_2);
  });

  test('pagination limit respected → 200 with truncated result', async () => {
    await seedNotification(NOTIF_ID_1, USER_A.id, { type: 'billing' });
    await seedNotification(NOTIF_ID_2, USER_A.id, { type: 'security' });
    await seedNotification(NOTIF_ID_3, USER_A.id, { type: 'system' });
    const app = buildTestApp(USER_A);
    const res = await app.request('/notifications?limit=2');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBeLessThanOrEqual(2);
    expect(body.pagination).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// markAllNotificationsAsRead
// ---------------------------------------------------------------------------

describe('markAllNotificationsAsRead', () => {
  afterEach(truncateNotifications);

  test('unauthenticated (no user set) → 401 UNAUTHORIZED', async () => {
    // markAllNotificationsAsRead guards: ctx.get('user') null → UnauthorizedError.
    const app = buildTestApp(undefined);
    const res = await app.request('/notifications/read-all', { method: 'POST' });
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('no unread notifications → 200 with markedCount exactly 0', async () => {
    // RED verified: user has no notifications → markedCount is 0
    const app = buildTestApp(USER_A);
    const res = await app.request('/notifications/read-all', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.markedCount).toBe(0);
  });

  test('marks sent/delivered notifications as read → 200 with correct markedCount', async () => {
    // markAllAsRead only marks sent/delivered (not queued) — seed with those statuses
    // RED verified: before seed, markedCount was 0
    await seedNotification(NOTIF_ID_1, USER_A.id, { status: 'sent', type: 'billing' });
    await seedNotification(NOTIF_ID_2, USER_A.id, { status: 'delivered', type: 'security' });
    const app = buildTestApp(USER_A);
    const res = await app.request('/notifications/read-all', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.markedCount).toBe('number');
    expect(body.markedCount).toBeGreaterThanOrEqual(2);
  });

  test('only marks current user notifications, not other users → 200', async () => {
    await seedNotification(NOTIF_ID_1, USER_A.id, { status: 'sent' });
    await seedNotification(NOTIF_ID_2, USER_B.id, { status: 'sent' }); // different user
    const app = buildTestApp(USER_A);
    const res = await app.request('/notifications/read-all', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.markedCount).toBe('number');
    // USER_B's notification should not be marked (check by reading it back)
    const [bNotif] = await db.select().from(notifications).where(eq(notifications.id, NOTIF_ID_2));
    // USER_B's notification was not touched — still sent
    expect(bNotif!.status).toBe('sent');
  });

  test('type filter marks only matching type → 200 with filtered count', async () => {
    await seedNotification(NOTIF_ID_1, USER_A.id, { status: 'sent', type: 'billing' });
    await seedNotification(NOTIF_ID_2, USER_A.id, { status: 'sent', type: 'security' });
    const app = buildTestApp(USER_A);
    const res = await app.request('/notifications/read-all?type=billing', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.markedCount).toBe('number');
    // security notification should NOT be marked by the billing filter
    const [secNotif] = await db.select().from(notifications).where(eq(notifications.id, NOTIF_ID_2));
    expect(secNotif!.status).toBe('sent');
  });

  test('queued notification is NOT marked (only sent/delivered) → row stays queued', async () => {
    // M3: proves markAllAsRead deliberately skips queued (scheduled/not-yet-sent)
    // notifications. Seed ONE queued row, mark-all, and assert it is untouched.
    await seedNotification(NOTIF_ID_1, USER_A.id, { status: 'queued', type: 'billing' });
    const app = buildTestApp(USER_A);
    const res = await app.request('/notifications/read-all', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // Nothing eligible to mark — the queued row is excluded.
    expect(body.markedCount).toBe(0);
    const [row] = await db.select().from(notifications).where(eq(notifications.id, NOTIF_ID_1));
    expect(row!.status).toBe('queued');
    expect(row!.readAt).toBeNull();
  });
});
