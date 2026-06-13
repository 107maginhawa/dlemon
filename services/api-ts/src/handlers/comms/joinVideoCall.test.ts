/**
 * joinVideoCall handler tests
 *
 * Tests auth, validation, and not-found cases.
 */

import { describe, test, expect } from 'bun:test';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';

// Migrated off the bespoke raw-handler mount to the shared validator-mounting
// harness: requests now traverse the real authMiddleware → generated zValidator
// → handler chain instead of calling the raw handler directly.

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const mockNotifs = { createNotification: async () => ({}) } as any;

describe('joinVideoCall handler', () => {
  const authedUser = { id: 'user-1', email: 'user@test.com' };

  test('returns error when not authenticated', async () => {
    const app = buildTestApp({ db });

    const res = await app.request('/comms/chat-rooms/room-1/video-call/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Test User' }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('returns error when displayName is missing', async () => {
    const app = buildTestApp({ db, user: authedUser, services: { notifs: mockNotifs } });

    const res = await app.request('/comms/chat-rooms/room-1/video-call/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('returns error when displayName is empty', async () => {
    const app = buildTestApp({ db, user: authedUser, services: { notifs: mockNotifs } });

    const res = await app.request('/comms/chat-rooms/room-1/video-call/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '   ' }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('handler processes valid request (fails at repo level)', async () => {
    const app = buildTestApp({ db, user: authedUser, services: { notifs: mockNotifs } });

    const res = await app.request('/comms/chat-rooms/room-1/video-call/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Test User', audioEnabled: true, videoEnabled: true }),
    });

    // Should not be auth error
    expect(res.status).not.toBe(401);
  });
});
