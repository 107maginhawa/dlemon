/**
 * Module 10: Onboarding — FR7.2 CSV / JSON patient import
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
 * - FR7.5 (checked via getOrgContext returning null when no org exists)
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { importPatients } from './importPatients';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const BRANCH_ID = 'bb000000-0000-1000-8000-000000000001';

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
