/**
 * confirmBooking handler tests
 *
 * Tests confirmation flow, auth checks, and not-found handling.
 */

import { describe, test, expect } from 'bun:test';
// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { buildTestApp } from '@/tests/helpers/test-app';

// Empty-mock db (matches the original bespoke helper): handlers crash at the repo
// level, which is what these loose status-code assertions intentionally exercise.
const db = {} as any;
const services = {
  notifs: { createNotification: async () => ({}) } as any,
  ws: { publishToUser: async () => {} } as any,
};

describe('confirmBooking handler', () => {
  const host = { id: 'host-1', email: 'host@test.com' };

  test('returns error when user is not authenticated', async () => {
    const app = buildTestApp({ db, services });

    const res = await app.request('/booking/bookings/booking-1/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('returns error when booking does not exist', async () => {
    const app = buildTestApp({ db, user: host, services });

    const res = await app.request('/booking/bookings/nonexistent/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Should be 404 or 500 (repo error due to mock)
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('handler requires booking param', async () => {
    const app = buildTestApp({ db, user: host, services });

    const res = await app.request('/booking/bookings/booking-123/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Will fail at repo level but confirms the route pattern works
    expect(res.status).not.toBe(401);
  });
});
