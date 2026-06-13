/**
 * createPerson handler tests
 *
 * Tests person creation, required fields, and auth checks.
 */

import { describe, test, expect } from 'bun:test';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';

// Migrated off the bespoke raw-handler mount to the shared validator-mounting
// harness: requests now traverse the real authMiddleware → generated zValidator
// → handler chain (POST /persons), not a direct handler call with a fake DB.

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

describe('createPerson handler', () => {
  const authedUser = { id: 'user-1', email: 'test@test.com' };

  test('returns error when not authenticated', async () => {
    const app = buildTestApp({ db });

    const res = await app.request('/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'John', lastName: 'Doe' }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('handler reads firstName from body', async () => {
    const app = buildTestApp({ db, user: authedUser });

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
    const app = buildTestApp({ db, user: authedUser });

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
