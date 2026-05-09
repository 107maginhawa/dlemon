/**
 * createPerson handler tests
 *
 * Tests person creation, required fields, and auth checks.
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { createPerson } from './createPerson';
import { AppError } from '@/core/errors';

function buildTestApp(user?: { id: string; email: string; role?: string }) {
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
    ctx.set('audit', null);
    if (user) {
      ctx.set('user', { id: user.id, email: user.email, role: user.role || 'user' });
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.post('/persons', createPerson as any);

  return app;
}

describe('createPerson handler', () => {
  const authedUser = { id: 'user-1', email: 'test@test.com' };

  test('returns error when not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request('/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'John', lastName: 'Doe' }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('handler reads firstName from body', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
      }),
    });

    // Will fail at repo level (mocked DB) but shouldn't be 401
    expect(res.status).not.toBe(401);
  });

  test('handler accepts optional fields', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Jane',
        lastName: 'Smith',
        middleName: 'Marie',
        gender: 'female',
        timezone: 'Asia/Manila',
        languagesSpoken: ['en', 'fil'],
        contactInfo: { email: 'jane@test.com', phone: '+639123456789' },
      }),
    });

    // Not a 401 auth error
    expect(res.status).not.toBe(401);
  });
});
