/**
 * createOrganization handler tests
 *
 * Tests HTTP-level behavior: validation, auth, 201 on success, 400 on bad input.
 * Written RED (no implementation exists yet).
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createOrganization } from './createOrganization';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

// Helper: build a minimal Hono test app with auth stub and error handler
function buildTestApp(user?: { id: string; email: string }) {
  const app = new Hono();

  // Minimal error handler that maps AppError to status codes
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: 'Internal error' }, 500);
  });

  app.use('*', async (c, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.post('/dental/organizations', createOrganization);

  return app;
}

describe('createOrganization handler', () => {
  const authedUser = { id: '00000000-0000-0000-0000-000000000001', email: 'owner@clinic.com' };

  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // --------------------------------------------------------------------------
  // Success
  // --------------------------------------------------------------------------

  test('returns 201 with created organization on valid input', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/dental/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Happy Smiles Dental',
        tier: 'solo',
        countryCode: 'PH',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.name).toBe('Happy Smiles Dental');
    expect(body.tier).toBe('solo');
    expect(body.id).toBeTruthy();
    expect(body.ownerPersonId).toBe(authedUser.id);
    expect(body.active).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Validation errors
  // --------------------------------------------------------------------------

  test('returns 400 when name is missing', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/dental/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'solo', countryCode: 'PH' }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when tier is invalid', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/dental/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Clinic', tier: 'premium', countryCode: 'PH' }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when countryCode is missing', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/dental/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Clinic', tier: 'solo' }),
    });

    expect(res.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined); // no user

    const res = await app.request('/dental/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Clinic', tier: 'solo', countryCode: 'PH' }),
    });

    expect(res.status).toBe(401);
  });
});
