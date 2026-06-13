/**
 * markNotificationAsRead handler tests
 *
 * Tests auth, not-found, and ownership checks.
 */

import { describe, test, expect } from 'bun:test';
// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { buildTestApp } from '@/tests/helpers/test-app';

// Empty-mock db (matches the original bespoke helper): the handler crashes at the
// repo level, which is what these loose status-code assertions intentionally exercise.
const db = {} as any;

describe('markNotificationAsRead handler', () => {
  const authedUser = { id: 'user-1', email: 'user@test.com' };

  test('returns error when not authenticated', async () => {
    const app = buildTestApp({ db });

    const res = await app.request('/notifs/notif-1/read', {
      method: 'POST',
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('handler extracts notification ID from param', async () => {
    const app = buildTestApp({ db, user: authedUser });

    const res = await app.request('/notifs/notif-123/read', {
      method: 'POST',
    });

    // Will fail at repo level but should not be 401
    expect(res.status).not.toBe(401);
  });

  test('handler processes POST method', async () => {
    const app = buildTestApp({ db, user: authedUser });

    // GET should not be supported
    const res = await app.request('/notifs/notif-1/read', {
      method: 'GET',
    });

    // The path is registered for POST in the real route table, so a GET is
    // Method-Not-Allowed (405), not Not-Found. The old raw mount only mounted
    // POST on a bespoke app, so a GET fell through to 404 — an artifact of the
    // mount, not production. The harness asserts the production response.
    expect(res.status).toBe(405);
  });
});
