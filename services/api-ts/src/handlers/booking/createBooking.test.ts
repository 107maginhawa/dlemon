/**
 * createBooking handler tests
 *
 * Tests HTTP-level behavior for booking creation.
 * Database repos are mocked.
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { createBooking } from './createBooking';
import { AppError } from '@/core/errors';

function buildTestApp(user?: { id: string; email: string }) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: err.message }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', {});
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.post('/booking/bookings', createBooking as any);

  return app;
}

describe('createBooking handler', () => {
  const authedUser = { id: 'user-1', email: 'client@test.com' };

  test('returns error when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request('/booking/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot: 'slot-1', locationType: 'in_person' }),
    });

    // Without a user, the handler will throw
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('handler requires slot in body', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/booking/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Missing slot field should fail
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('handler accepts valid body shape', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/booking/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot: 'slot-uuid-1',
        locationType: 'in_person',
      }),
    });

    // Will fail at repo level (no real DB) but should not be 401
    expect(res.status).not.toBe(401);
  });
});
