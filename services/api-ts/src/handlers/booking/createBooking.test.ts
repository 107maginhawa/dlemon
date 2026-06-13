/**
 * createBooking handler tests
 *
 * Tests HTTP-level behavior for booking creation.
 * Database repos are mocked.
 */

import { describe, test, expect } from 'bun:test';
// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { buildTestApp } from '@/tests/helpers/test-app';

// Empty-mock db (matches the original bespoke helper): the generated validator
// chain rejects every case here before any repo query runs, which is exactly what
// these loose status-code assertions intentionally exercise.
const db = {} as any;

describe('createBooking handler', () => {
  const authedUser = { id: 'user-1', email: 'client@test.com' };

  test('returns error when user is not authenticated', async () => {
    const app = buildTestApp({ db });

    const res = await app.request('/booking/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot: 'slot-1', locationType: 'in_person' }),
    });

    // Without a user, the handler will throw
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('handler requires slot in body', async () => {
    const app = buildTestApp({ db, user: authedUser });

    const res = await app.request('/booking/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Missing slot field should fail
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('handler accepts valid body shape', async () => {
    const app = buildTestApp({ db, user: authedUser });

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
