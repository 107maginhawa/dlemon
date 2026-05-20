/**
 * email-queue handler tests — listEmailQueueItems, getEmailQueueItem,
 * cancelEmailQueueItem, retryEmailQueueItem
 *
 * Fixture tag: em01
 * All deterministic UUIDs use namespace em01.
 *
 * RED-for-right-reason: each happy-path test was written against a state
 * where the seed did not exist (returned 404/500), confirming the error
 * reason before the seed was added to make it GREEN.
 *
 * Pattern: buildTestApp (handler-unit, NOT real router)
 *
 * Note: zValidator middleware returns 400 for Zod schema violations (missing/invalid fields);
 * BusinessLogicError from handler logic returns 422. Tests assert actual server behavior.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  GetEmailQueueItemParams,
  CancelEmailQueueItemParams,
  CancelEmailQueueItemBody,
  RetryEmailQueueItemParams,
  ListEmailQueueItemsQuery,
} from '@/generated/openapi/validators';
import { emailQueue, emailTemplates } from './repos/email.schema';
import { listEmailQueueItems } from './listEmailQueueItems';
import { getEmailQueueItem } from './getEmailQueueItem';
import { cancelEmailQueueItem } from './cancelEmailQueueItem';
import { retryEmailQueueItem } from './retryEmailQueueItem';

// ---------------------------------------------------------------------------
// DB + fixtures
// ---------------------------------------------------------------------------

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

// Fixture tag: em01 — all IDs are valid UUIDs (hex only)
const ADMIN_USER = {
  id: 'ae010000-0000-4000-8000-000000000001',
  email: 'admin-em01@test.com',
  role: 'admin',
};
const NON_ADMIN_USER = {
  id: 'ae010000-0000-4000-8000-000000000002',
  email: 'user-em01@test.com',
  role: 'user',
};

// Queue fixture IDs
const QUEUE_ID_PENDING   = 'ce010000-0000-4000-8000-000000000001';
const QUEUE_ID_FAILED    = 'ce010000-0000-4000-8000-000000000002';
const QUEUE_ID_SENT      = 'ce010000-0000-4000-8000-000000000003';
const QUEUE_ID_CANCELLED = 'ce010000-0000-4000-8000-000000000004';
// Template used by queue items — distinct from email-templates.test.ts TEMPLATE_ID_1 (...000000000001)
const TEMPLATE_ID = 'be010000-0000-4000-8000-000000000010';
const FIXED_TS = new Date('2026-01-15T12:00:00Z');

// ---------------------------------------------------------------------------
// buildTestApp
// ---------------------------------------------------------------------------

function buildTestApp(user?: typeof ADMIN_USER) {
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
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session-em01' });
    }
    await next();
  });

  const ve = (result: any, c: any) => {
    if (!result.success) {
      return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
    }
  };

  // Queue routes — param/query validators required so ctx.req.valid('param'/'query') works
  app.get('/email/queue', zValidator('query', ListEmailQueueItemsQuery, ve), listEmailQueueItems as any);
  app.get('/email/queue/:queue', zValidator('param', GetEmailQueueItemParams, ve), getEmailQueueItem as any);
  app.post('/email/queue/:queue/cancel', zValidator('param', CancelEmailQueueItemParams, ve), zValidator('json', CancelEmailQueueItemBody, ve), cancelEmailQueueItem as any);
  app.post('/email/queue/:queue/retry', zValidator('param', RetryEmailQueueItemParams, ve), retryEmailQueueItem as any);

  return app;
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedTemplate() {
  await db.insert(emailTemplates).values({
    id: TEMPLATE_ID,
    name: 'em01 Queue Test Template',
    subject: 'Queue Test',
    bodyHtml: '<p>Queue test</p>',
    variables: [],
    status: 'active',
    createdBy: ADMIN_USER.id,
    updatedBy: ADMIN_USER.id,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
  }).onConflictDoNothing();

  // Post-seed read-back assert
  const [readback] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, TEMPLATE_ID));
  expect(readback!.name).toBe('em01 Queue Test Template');
}

async function seedQueueItem(
  id: string,
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled',
  overrides: Partial<typeof emailQueue.$inferInsert> = {}
) {
  await db.insert(emailQueue).values({
    id,
    template: TEMPLATE_ID,
    recipientEmail: 'recipient-em01@test.com',
    recipientName: 'Queue Test User',
    variables: {},
    status,
    priority: 5,
    attempts: status === 'failed' ? 1 : 0,
    createdBy: ADMIN_USER.id,
    updatedBy: ADMIN_USER.id,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
    ...overrides,
  }).onConflictDoNothing();

  // Post-seed read-back assert
  const [readback] = await db.select().from(emailQueue).where(eq(emailQueue.id, id));
  expect(readback!.status).toBe(status);
  return readback!;
}

async function truncateQueue() {
  for (const id of [QUEUE_ID_PENDING, QUEUE_ID_FAILED, QUEUE_ID_SENT, QUEUE_ID_CANCELLED]) {
    await db.delete(emailQueue).where(eq(emailQueue.id, id));
  }
  await db.delete(emailTemplates).where(eq(emailTemplates.id, TEMPLATE_ID));
}

// ---------------------------------------------------------------------------
// listEmailQueueItems
// ---------------------------------------------------------------------------

describe('listEmailQueueItems', () => {
  afterEach(truncateQueue);

  test('non-admin → 403 FORBIDDEN', async () => {
    const app = buildTestApp(NON_ADMIN_USER);
    const res = await app.request('/email/queue');
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('no user → 500 (user undefined crash before role check)', async () => {
    // When no user is set in context, user.role access throws TypeError → 500
    const app = buildTestApp(undefined);
    const res = await app.request('/email/queue');
    expect(res.status).toBe(500);
  });

  test('happy path empty → 200 with items array', async () => {
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/queue');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('happy path with seeded items → 200 contains item', async () => {
    // RED verified: before seed, QUEUE_ID_PENDING not present in items
    await seedTemplate();
    await seedQueueItem(QUEUE_ID_PENDING, 'pending');
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/queue');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    const found = body.data.find((q: any) => q.id === QUEUE_ID_PENDING);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(QUEUE_ID_PENDING);
    expect(found.recipientEmail).toBe('recipient-em01@test.com');
  });

  test('status filter → 200 returns only matching status', async () => {
    await seedTemplate();
    await seedQueueItem(QUEUE_ID_PENDING, 'pending');
    await seedQueueItem(QUEUE_ID_FAILED, 'failed');

    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/queue?status=failed');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const ids = body.data.map((q: any) => q.id);
    expect(ids).toContain(QUEUE_ID_FAILED);
    expect(ids).not.toContain(QUEUE_ID_PENDING);
  });
});

// ---------------------------------------------------------------------------
// getEmailQueueItem
// ---------------------------------------------------------------------------

describe('getEmailQueueItem', () => {
  afterEach(truncateQueue);

  test('non-admin → 403 FORBIDDEN', async () => {
    const app = buildTestApp(NON_ADMIN_USER);
    const res = await app.request(`/email/queue/${QUEUE_ID_PENDING}`);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('not found → 404 NOT_FOUND', async () => {
    // RED verified: no seed → repo.findOneById null → NotFoundError
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/queue/00000000-0000-4000-8000-000099960001');
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('happy path → 200 with queue item', async () => {
    await seedTemplate();
    await seedQueueItem(QUEUE_ID_PENDING, 'pending');
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/email/queue/${QUEUE_ID_PENDING}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(QUEUE_ID_PENDING);
    expect(body.recipientEmail).toBe('recipient-em01@test.com');
    expect(body.status).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// cancelEmailQueueItem
// ---------------------------------------------------------------------------

describe('cancelEmailQueueItem', () => {
  afterEach(truncateQueue);

  test('non-admin → 403 FORBIDDEN', async () => {
    const app = buildTestApp(NON_ADMIN_USER);
    const res = await app.request(`/email/queue/${QUEUE_ID_PENDING}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'test' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('missing reason → 400 VALIDATION_ERROR', async () => {
    // RED verified: empty reason → ValidationError('Cancellation reason is required')
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/email/queue/${QUEUE_ID_PENDING}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: '' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('reason whitespace only → 400 VALIDATION_ERROR', async () => {
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/email/queue/${QUEUE_ID_PENDING}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: '   ' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('reason > 500 chars → 400 (zValidator catches .max(500) before handler)', async () => {
    // CancelEmailRequestSchema has z.string().max(500) — zValidator rejects before handler
    const app = buildTestApp(ADMIN_USER);
    const longReason = 'x'.repeat(501);
    const res = await app.request(`/email/queue/${QUEUE_ID_PENDING}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: longReason }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(typeof body.error).toBe('string');
  });

  test('item not found → 404 NOT_FOUND', async () => {
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/queue/00000000-0000-4000-8000-000099950001/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Test cancellation' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('already sent → 422 BUSINESS_ERROR (EMAIL_ALREADY_SENT)', async () => {
    await seedTemplate();
    await seedQueueItem(QUEUE_ID_SENT, 'sent');
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/email/queue/${QUEUE_ID_SENT}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Test cancellation' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('EMAIL_ALREADY_SENT');
  });

  test('happy path → 200 with cancelled item', async () => {
    // RED verified: before seed, returned 404 (item not found)
    await seedTemplate();
    await seedQueueItem(QUEUE_ID_PENDING, 'pending');
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/email/queue/${QUEUE_ID_PENDING}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Test cancellation reason' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(QUEUE_ID_PENDING);
    expect(body.status).toBe('cancelled');
    expect(body.cancellationReason).toBe('Test cancellation reason');
  });
});

// ---------------------------------------------------------------------------
// retryEmailQueueItem
// ---------------------------------------------------------------------------

describe('retryEmailQueueItem', () => {
  afterEach(truncateQueue);

  test('non-admin → 403 FORBIDDEN', async () => {
    const app = buildTestApp(NON_ADMIN_USER);
    const res = await app.request(`/email/queue/${QUEUE_ID_FAILED}/retry`, { method: 'POST' });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('no user → 500 (user undefined crash before role check)', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/email/queue/${QUEUE_ID_FAILED}/retry`, { method: 'POST' });
    expect(res.status).toBe(500);
  });

  test('item not found → 404 NOT_FOUND', async () => {
    // RED verified: no seed → repo.retryEmail → repo.findOneById null → NotFoundError
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/queue/00000000-0000-4000-8000-000099940001/retry', { method: 'POST' });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('pending item → 422 INVALID_STATUS_FOR_RETRY', async () => {
    // BusinessLogicError: 'Cannot retry email with status pending'
    await seedTemplate();
    await seedQueueItem(QUEUE_ID_PENDING, 'pending');
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/email/queue/${QUEUE_ID_PENDING}/retry`, { method: 'POST' });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVALID_STATUS_FOR_RETRY');
  });

  test('happy path failed item → 200 reset to pending', async () => {
    // RED verified: before seed, returned 404 (item not found)
    await seedTemplate();
    await seedQueueItem(QUEUE_ID_FAILED, 'failed', { attempts: 1 });
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/email/queue/${QUEUE_ID_FAILED}/retry`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(QUEUE_ID_FAILED);
    // After retry, status should be reset to pending
    expect(body.status).toBe('pending');
    expect(body.attempts).toBe(1);
  });
});
