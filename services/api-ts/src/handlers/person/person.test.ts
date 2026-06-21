/**
 * Person handler tests — DB-backed, strong assertions.
 *
 * Person is the central PII safeguard. These tests cover all four base
 * handlers end-to-end against a real Postgres clone (per-file via test-with-db),
 * asserting status + body shape + field values + every error/deny path.
 *
 * Handlers covered:
 *   createPerson  POST  /persons          (owner self-create)
 *   getPerson     GET   /persons/:person  (owner | "me" | admin-internal-expand)
 *   listPersons   GET   /persons          (paginated, filter/sort)
 *   updatePerson  PATCH /persons/:person  (owner-only PII update)
 *
 * afterEach truncates: person CASCADE.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { createPerson } from './createPerson';
import { getPerson } from './getPerson';
import { listPersons } from './listPersons';
import { updatePerson } from './updatePerson';
import { PersonRepository } from './repos/person.repo';
import {
  CreatePersonBody,
  ListPersonsQuery,
  GetPersonParams,
  UpdatePersonParams,
  UpdatePersonBody,
} from '@/generated/openapi/validators';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// Fixed test IDs — valid UUID format
const TEST_USER_ID  = 'b0000000-0000-1000-8000-000000000001';
const OTHER_USER_ID = 'b0000000-0000-1000-8000-000000000002';
const NONEXISTENT   = 'b0000000-0000-1000-8000-000000000099';

const authedUser = { id: TEST_USER_ID, email: 'person@test.com', name: 'Test Person', role: 'user' };
const otherUser  = { id: OTHER_USER_ID, email: 'other@test.com', name: 'Other Person', role: 'user' };
const adminUser  = { ...authedUser, role: 'admin' };

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
  }
};

// ─── App builder ───────────────────────────────────────────────────────────

function buildTestApp(user?: { id: string; email: string; name?: string; role?: string }) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('audit', null);
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    } else {
      // Simulate authMiddleware rejecting unauthenticated requests
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }
    return await next();
  });

  app.post(
    '/persons',
    zValidator('json', CreatePersonBody, validationErrorHandler),
    createPerson as any,
  );

  app.get(
    '/persons',
    zValidator('query', ListPersonsQuery, validationErrorHandler),
    listPersons as any,
  );

  app.get(
    '/persons/:person',
    zValidator('param', GetPersonParams, validationErrorHandler),
    getPerson as any,
  );

  app.patch(
    '/persons/:person',
    zValidator('param', UpdatePersonParams, validationErrorHandler),
    zValidator('json', UpdatePersonBody, validationErrorHandler),
    updatePerson as any,
  );

  return app;
}

// ─── Seed helper ─────────────────────────────────────────────────────────────

async function seedPerson(userId: string = TEST_USER_ID, overrides: Record<string, any> = {}) {
  const repo = new PersonRepository(db);
  return repo.createOne({
    id: userId,
    firstName: 'Seed',
    lastName: 'Person',
    createdBy: userId,
    updatedBy: userId,
    ...overrides,
  });
}

async function truncate() {
  await db.execute(sql`TRUNCATE TABLE person CASCADE`);
}

// =============================================================================
// createPerson
// =============================================================================

describe('createPerson handler', () => {
  afterEach(truncate);

  test('returns 401 when not authenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'John' }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 201 and persists person bound to the caller user id', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request('/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
        middleName: 'Q',
        gender: 'male',
        dateOfBirth: '1990-05-15',
        timezone: 'Asia/Manila',
        languagesSpoken: ['en', 'tl'],
        contactInfo: { email: 'john@test.com', phone: '+639123456789' },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    // person.id is forced to the authenticated user's id (1:1 relationship)
    expect(body.id).toBe(TEST_USER_ID);
    expect(body.firstName).toBe('John');
    expect(body.lastName).toBe('Doe');
    expect(body.middleName).toBe('Q');
    expect(body.gender).toBe('male');
    expect(body.contactInfo.email).toBe('john@test.com');
    expect(body.contactInfo.phone).toBe('+639123456789');
    expect(body.languagesSpoken).toEqual(['en', 'tl']);
    expect(body.timezone).toBe('Asia/Manila');
    expect(body.createdBy).toBe(TEST_USER_ID);

    // Verify it really landed in the DB
    const found = await new PersonRepository(db).findOneById(TEST_USER_ID);
    expect(found).not.toBeNull();
    expect(found!.firstName).toBe('John');
  });

  test('defaults optional collections sanely (languagesSpoken = [], nullable fields null)', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request('/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Solo' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.firstName).toBe('Solo');
    expect(body.lastName).toBeNull();
    expect(body.middleName).toBeNull();
    expect(body.gender).toBeNull();
    expect(body.contactInfo).toBeNull();
    expect(body.languagesSpoken).toEqual([]);
  });

  test('returns 409 when caller already has a person profile', async () => {
    await seedPerson(TEST_USER_ID);
    const app = buildTestApp(authedUser);

    const res = await app.request('/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Dup' }),
    });

    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.code).toBe('CONFLICT');
    expect(body.error).toMatch(/already has a person profile/i);
  });

  test('returns 400 when firstName missing (validator rejects)', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request('/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastName: 'NoFirst' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toBe('Validation failed');
  });

  test('returns 400 when dateOfBirth is in the future (handler-level DOB validation)', async () => {
    const app = buildTestApp(authedUser);
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const res = await app.request('/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Future', dateOfBirth: future }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

// =============================================================================
// getPerson
// =============================================================================

describe('getPerson handler', () => {
  afterEach(truncate);

  test('returns 401 when not authenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/persons/${TEST_USER_ID}`);
    expect(res.status).toBe(401);
  });

  test('returns 404 when person does not exist', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request(`/persons/${NONEXISTENT}`);
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 200 with full record for the owner', async () => {
    await seedPerson(TEST_USER_ID, {
      firstName: 'Owned',
      lastName: 'Record',
      gender: 'female',
      contactInfo: { email: 'owned@test.com' },
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/persons/${TEST_USER_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(TEST_USER_ID);
    expect(body.firstName).toBe('Owned');
    expect(body.gender).toBe('female');
    expect(body.contactInfo.email).toBe('owned@test.com');
  });

  test('resolves "me" to the caller\'s own record', async () => {
    await seedPerson(TEST_USER_ID, { firstName: 'MeUser' });
    const app = buildTestApp(authedUser);

    const res = await app.request('/persons/me');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(TEST_USER_ID);
    expect(body.firstName).toBe('MeUser');
  });

  test('returns 403 when a non-owner requests another person (PII safeguard)', async () => {
    // Target record belongs to OTHER_USER_ID; caller is authedUser (TEST_USER_ID)
    await seedPerson(OTHER_USER_ID, { firstName: 'NotYours' });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/persons/${OTHER_USER_ID}`);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('404 takes precedence over 403 — missing record is not found even for non-owner', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request(`/persons/${OTHER_USER_ID}`);
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// listPersons
// =============================================================================

describe('listPersons handler', () => {
  afterEach(truncate);

  test('returns 401 when not authenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/persons');
    expect(res.status).toBe(401);
  });

  test('returns 200 with empty data array and zero totalCount when none exist', async () => {
    const app = buildTestApp(adminUser);
    const res = await app.request('/persons');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
    expect(body.pagination.totalCount).toBe(0);
  });

  test('returns 200 with data + pagination metadata reflecting seeded rows', async () => {
    await seedPerson(TEST_USER_ID, { firstName: 'Alice' });
    await seedPerson(OTHER_USER_ID, { firstName: 'Bob' });
    const app = buildTestApp(adminUser);

    const res = await app.request('/persons');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(2);
    expect(body.pagination.totalCount).toBe(2);
    expect(typeof body.pagination.limit).toBe('number');
    expect(typeof body.pagination.offset).toBe('number');
  });

  test('applies q filter (case-insensitive name search)', async () => {
    await seedPerson(TEST_USER_ID, { firstName: 'Alice', lastName: 'Anderson' });
    await seedPerson(OTHER_USER_ID, { firstName: 'Bob', lastName: 'Brown' });
    const app = buildTestApp(adminUser);

    const res = await app.request('/persons?q=alice');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(1);
    expect(body.data[0].firstName).toBe('Alice');
  });

  test('honors limit pagination', async () => {
    await seedPerson(TEST_USER_ID, { firstName: 'Alice' });
    await seedPerson(OTHER_USER_ID, { firstName: 'Bob' });
    const app = buildTestApp(adminUser);

    const res = await app.request('/persons?limit=1');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(1);
    // totalCount reflects all matching rows, not just the page
    expect(body.pagination.totalCount).toBe(2);
  });

  test('returns 400 on out-of-range limit (validator)', async () => {
    const app = buildTestApp(adminUser);
    const res = await app.request('/persons?limit=9999');
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// updatePerson
// =============================================================================

describe('updatePerson handler', () => {
  afterEach(truncate);

  test('returns 401 when not authenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/persons/${TEST_USER_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'X' }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 403 when caller targets a person id other than their own', async () => {
    await seedPerson(OTHER_USER_ID);
    const app = buildTestApp(authedUser);

    const res = await app.request(`/persons/${OTHER_USER_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Hijack' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
    expect(body.error).toMatch(/only update your own profile/i);
  });

  test('returns 404 when own person record does not exist yet', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request(`/persons/${TEST_USER_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Ghost' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 200 and updates only the provided PII fields', async () => {
    await seedPerson(TEST_USER_ID, { firstName: 'Old', lastName: 'Name', gender: 'male' });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/persons/${TEST_USER_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'New',
        contactInfo: { email: 'new@test.com', phone: '+639987654321' },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(TEST_USER_ID);
    expect(body.firstName).toBe('New');
    // lastName not provided → unchanged
    expect(body.lastName).toBe('Name');
    expect(body.gender).toBe('male');
    expect(body.contactInfo.email).toBe('new@test.com');
    expect(body.contactInfo.phone).toBe('+639987654321');
    expect(body.updatedBy).toBe(TEST_USER_ID);

    // Persisted
    const found = await new PersonRepository(db).findOneById(TEST_USER_ID);
    expect(found!.firstName).toBe('New');
  });

  test('partial contactInfo merges — a phone-only edit keeps the stored email', async () => {
    // Mirrors the dental-patient PATCH contract (dental-patient.hurl step 5e):
    // contactInfo is a partial merge, so omitting a sub-field must NOT wipe it.
    await seedPerson(TEST_USER_ID, {
      firstName: 'Merge',
      contactInfo: { email: 'keep@test.com', phone: '+639111111111' },
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/persons/${TEST_USER_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactInfo: { phone: '+639222222222' } }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.contactInfo.phone).toBe('+639222222222');
    // Omitted email survives the partial update (no silent data loss).
    expect(body.contactInfo.email).toBe('keep@test.com');

    // Persisted, not just echoed.
    const found = await new PersonRepository(db).findOneById(TEST_USER_ID);
    expect((found!.contactInfo as any).email).toBe('keep@test.com');
    expect((found!.contactInfo as any).phone).toBe('+639222222222');
  });

  test('explicit null clears a nullable field', async () => {
    await seedPerson(TEST_USER_ID, { firstName: 'Keep', middleName: 'Clearme' });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/persons/${TEST_USER_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ middleName: null }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.firstName).toBe('Keep');
    expect(body.middleName).toBeNull();
  });

  test('returns 400 when updating with a pre-1900 dateOfBirth (handler DOB validation)', async () => {
    await seedPerson(TEST_USER_ID);
    const app = buildTestApp(authedUser);

    const res = await app.request(`/persons/${TEST_USER_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateOfBirth: '1850-01-01' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when body contains an invalid gender value (validator)', async () => {
    await seedPerson(TEST_USER_ID);
    const app = buildTestApp(authedUser);

    const res = await app.request(`/persons/${TEST_USER_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gender: 'not-a-gender' }),
    });
    expect(res.status).toBe(400);
  });
});
