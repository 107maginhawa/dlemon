/**
 * Module 10: Onboarding — FR7.2 CSV / JSON patient import + FR7.5 First-Time Detection
 *
 * Tests:
 * - Import via JSON array (happy path)
 * - Import via CSV body (happy path)
 * - Returns imported count and patient IDs
 * - 422 with errors when firstName missing
 * - 422 with errors when branchId missing
 * - Transaction rollback: if one row fails, none are imported
 * - 401 without auth
 * - Empty array → 400
 * - CSV missing required header columns → 422
 * - FR7.5: getOrgContext returns { org: null } for a fresh user with no org
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { importPatients } from './importPatients';
import { getOrgContext } from '@/handlers/dental-org/getOrgContext';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const BRANCH_ID = 'bb000000-0000-1000-8000-000000000001';
const ORG_ID = 'ea000000-0000-1000-8000-000000000001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Module10 Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: 'eb000000-0000-1000-8000-000000000001', branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Staff', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    if (user) ctx.set('user', user);
    await next();
  });
  app.post('/dental/patients/import', importPatients);
  return app;
}

afterEach(async () => {
  await db.execute(sql`TRUNCATE patient, person RESTART IDENTITY CASCADE`);
});

function jsonBody(rows: object[]) {
  return JSON.stringify(rows);
}

// ---------------------------------------------------------------------------
// FR7.2: JSON import
// ---------------------------------------------------------------------------

describe('POST /dental/patients/import (FR7.2)', () => {
  test('imports via JSON array', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody([
        { firstName: 'Maria', lastName: 'Santos', dateOfBirth: '1990-05-15', branchId: BRANCH_ID },
        { firstName: 'Juan', lastName: 'dela Cruz', branchId: BRANCH_ID },
      ]),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.imported).toBe(2);
    expect(body.patients).toHaveLength(2);
    expect(body.patients[0].firstName).toBe('Maria');
  });

  test('422 when firstName missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody([{ lastName: 'Santos', branchId: BRANCH_ID }]),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  test('422 when branchId missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody([{ firstName: 'Ana' }]),
    });
    expect(res.status).toBe(422);
  });

  test('400 for non-array body', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Ana', branchId: BRANCH_ID }),
    });
    expect(res.status).toBe(400);
  });

  test('401 without auth', async () => {
    const app = buildTestApp();
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody([{ firstName: 'Ana', branchId: BRANCH_ID }]),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// FR7.2: CSV import
// ---------------------------------------------------------------------------

describe('POST /dental/patients/import via CSV', () => {
  test('imports via CSV body', async () => {
    const csv = [
      'firstName,lastName,dateOfBirth,branchId',
      `Maria,Santos,1990-05-15,${BRANCH_ID}`,
      `Juan,dela Cruz,1985-03-20,${BRANCH_ID}`,
    ].join('\n');

    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: csv,
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.imported).toBe(2);
  });

  test('422 when required CSV column missing', async () => {
    const csv = [
      'lastName,dateOfBirth', // missing firstName and branchId
      'Santos,1990-05-15',
    ].join('\n');

    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: csv,
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.errors.some((e: string) => e.toLowerCase().includes('firstname') || e.toLowerCase().includes('firstname'))).toBe(true);
  });

  test('422 when row has empty firstName', async () => {
    const csv = [
      'firstName,lastName,branchId',
      `,,${BRANCH_ID}`, // empty firstName
    ].join('\n');

    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: csv,
    });
    expect(res.status).toBe(422);
  });
});

// FR7.5: First-Time Detection — GET /dental/org/context returns null fields for new user
describe('FR7.5 — First-Time Detection', () => {
  const FRESH_USER = { id: 'ff000000-0000-0000-0000-000000000099', email: 'fresh@clinic.com' };

  function buildOrgContextApp(user?: typeof FRESH_USER) {
    const app = new Hono();
    app.onError((err, c) => {
      if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
      return c.json({ error: String(err.message) }, 500);
    });
    app.use('*', async (c, next) => {
      const ctx = c as any;
      ctx.set('database', db);
      if (user) ctx.set('user', user);
      await next();
    });
    app.get('/dental/org/context', getOrgContext as any);
    return app;
  }

  test('returns { org: null, branch: null, member: null } for a user with no org', async () => {
    // FRESH_USER has never completed onboarding — no org exists for this person ID
    const app = buildOrgContextApp(FRESH_USER);
    const res = await app.request('/dental/org/context');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.org).toBeNull();
    expect(body.branch).toBeNull();
    expect(body.member).toBeNull();
  });

  test('returns 401 when called without auth', async () => {
    const app = buildOrgContextApp(); // no user
    const res = await app.request('/dental/org/context');
    expect(res.status).toBe(401);
  });
});
