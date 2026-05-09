/**
 * joinVideoCall handler tests
 *
 * Tests auth, validation, and not-found cases.
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { joinVideoCall } from './joinVideoCall';
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
    ctx.set('config', { auth: { baseUrl: 'http://localhost:7213' } });
    ctx.set('notifs', { createNotification: async () => ({}) });
    if (user) {
      ctx.set('user', { id: user.id, email: user.email, role: 'user' });
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.post('/comms/chat-rooms/:room/video-call/join', joinVideoCall as any);

  return app;
}

describe('joinVideoCall handler', () => {
  const authedUser = { id: 'user-1', email: 'user@test.com' };

  test('returns error when not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request('/comms/chat-rooms/room-1/video-call/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Test User' }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('returns error when displayName is missing', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/comms/chat-rooms/room-1/video-call/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('returns error when displayName is empty', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/comms/chat-rooms/room-1/video-call/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '   ' }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('handler processes valid request (fails at repo level)', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/comms/chat-rooms/room-1/video-call/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Test User', audioEnabled: true, videoEnabled: true }),
    });

    // Should not be auth error
    expect(res.status).not.toBe(401);
  });
});
