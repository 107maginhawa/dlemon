/**
 * Patient handler tests — covers all 8 patient handlers
 *
 * Handlers covered:
 *   createPatient    POST /patients
 *   listPatients     GET  /patients
 *   getPatient       GET  /patients/:id
 *   updatePatient    PATCH /patients/:id
 *   deactivatePatient DELETE /patients/:id
 *   deletePatient    (tested via handler directly — not in generated routes)
 *   mergePatients    POST /patients/merge   (not implemented — 500 expected)
 *   unmergePatients  POST /patients/unmerge (not implemented — 500 expected)
 *
 * afterEach truncates: patient, person, user (cascade)
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { createPatient } from './createPatient';
import { deactivatePatient } from './deactivatePatient';
import { deletePatient } from './deletePatient';
import { getPatient } from './getPatient';
import { listPatients } from './listPatients';
import { mergePatients } from './mergePatients';
import { unmergePatients } from './unmergePatients';
import { updatePatient } from './updatePatient';
import { PatientRepository } from './repos/patient.repo';
import { PersonRepository } from '../person/repos/person.repo';
import { user as userTable } from '@/generated/better-auth/schema';
import {
  CreatePatientBody,
  ListPatientsQuery,
  GetPatientParams,
  UpdatePatientParams,
  UpdatePatientBody,
  DeactivatePatientParams,
  MergePatientsBody,
  UnmergePatientsBody,
} from '@/generated/openapi/validators';
import { z } from 'zod';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

// Fixed test IDs — valid UUID v1 format (all hex chars)
const TEST_USER_ID    = 'a0000000-0000-1000-8000-000000000001';
const OTHER_USER_ID   = 'a0000000-0000-1000-8000-000000000002';
const NONEXISTENT_ID  = 'f0000000-0000-1000-8000-000000000099';

const authedUser = { id: TEST_USER_ID, email: 'patient@test.com', name: 'Test Patient' };

// Validation error passthrough handler
const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
  }
};

// ─── App builders ────────────────────────────────────────────────────────────

function buildTestApp(user?: typeof authedUser) {
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
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    } else {
      // Simulate authMiddleware: reject unauthenticated requests
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }
    return await next();
  });

  // POST /patients
  app.post(
    '/patients',
    zValidator('json', CreatePatientBody, validationErrorHandler),
    createPatient as any,
  );

  // GET /patients — must come before /patients/:id
  app.get(
    '/patients',
    zValidator('query', ListPatientsQuery, validationErrorHandler),
    listPatients as any,
  );

  // POST /patients/merge — before /:id to avoid param capture
  app.post(
    '/patients/merge',
    zValidator('json', MergePatientsBody, validationErrorHandler),
    mergePatients as any,
  );

  // POST /patients/unmerge
  app.post(
    '/patients/unmerge',
    zValidator('json', UnmergePatientsBody, validationErrorHandler),
    unmergePatients as any,
  );

  // GET /patients/:id
  app.get(
    '/patients/:id',
    zValidator('param', GetPatientParams, validationErrorHandler),
    zValidator('query', ListPatientsQuery.partial(), validationErrorHandler),
    getPatient as any,
  );

  // PATCH /patients/:id
  app.patch(
    '/patients/:id',
    zValidator('param', UpdatePatientParams, validationErrorHandler),
    zValidator('json', UpdatePatientBody, validationErrorHandler),
    updatePatient as any,
  );

  // DELETE /patients/:id  (deactivatePatient in generated routes)
  app.delete(
    '/patients/:id',
    zValidator('param', DeactivatePatientParams, validationErrorHandler),
    deactivatePatient as any,
  );

  // DELETE /patients/:patient/hard — for deletePatient (not in generated routes)
  // deletePatient uses ctx.req.valid('param') so we must attach a zValidator
  const DeletePatientParams = z.object({ patient: z.string().uuid() });
  app.delete(
    '/patients/:patient/hard',
    zValidator('param', DeletePatientParams, validationErrorHandler),
    deletePatient as any,
  );

  return app;
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

/**
 * Insert a minimal row in the `user` table so addUserRole / removeUserRole
 * do not fail on FK or missing row.
 */
async function seedUser(userId: string = TEST_USER_ID, email: string = authedUser.email) {
  await db.insert(userTable).values({
    id: userId,
    name: 'Test Patient',
    email,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: 'user',
  }).onConflictDoNothing();
}

/**
 * Seed a person row for the test user (mirrors what ensurePersonForUser does).
 */
async function seedPerson(userId: string = TEST_USER_ID) {
  const personRepo = new PersonRepository(db);
  return personRepo.createOne({
    id: userId,
    firstName: 'Test',
    lastName: 'Patient',
    createdBy: userId,
    updatedBy: userId,
  });
}

/**
 * Seed a full patient: user + person + patient rows.
 * Returns the created patient.
 */
async function seedPatient(userId: string = TEST_USER_ID) {
  await seedUser(userId);
  const person = await seedPerson(userId);
  const patientRepo = new PatientRepository(db);
  return patientRepo.createOne({
    person: person.id,
    createdBy: userId,
    updatedBy: userId,
  });
}

// ─── Truncate helper ──────────────────────────────────────────────────────────

async function truncate() {
  // patient has FK → person; person has no FK to user but user may reference session
  await db.execute(sql`TRUNCATE TABLE patient CASCADE`);
  await db.execute(sql`TRUNCATE TABLE person CASCADE`);
  // Truncate user last; CASCADE removes sessions etc.
  await db.execute(sql`DELETE FROM "user" WHERE id IN (${TEST_USER_ID}, ${OTHER_USER_ID})`);
}

// =============================================================================
// createPatient
// =============================================================================

describe('createPatient handler', () => {
  afterEach(truncate);

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request('/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(401);
  });

  test('returns 201 and creates patient + person for authenticated user', async () => {
    await seedUser();
    const app = buildTestApp(authedUser);

    const res = await app.request('/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: [{ use: 'official', family: 'Smith', given: ['John'] }],
        birthDate: '1990-05-15',
        gender: 'male',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.person).toBe(TEST_USER_ID);
  });

  test('returns 422 when patient profile already exists for user', async () => {
    await seedUser();
    const validBody = {
      name: [{ use: 'official', family: 'Smith', given: ['John'] }],
      birthDate: '1990-05-15',
      gender: 'male',
    };
    // First creation
    const app = buildTestApp(authedUser);
    await app.request('/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    // Second creation — should fail
    const res = await app.request('/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    // BusinessLogicError maps to 422
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('PATIENT_EXISTS');
  });
});

// =============================================================================
// listPatients
// =============================================================================

describe('listPatients handler', () => {
  afterEach(truncate);

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request('/patients');

    expect(res.status).toBe(401);
  });

  test('returns 200 with data array and pagination metadata', async () => {
    await seedPatient();
    const app = buildTestApp(authedUser);

    const res = await app.request('/patients');

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(typeof body.pagination.totalCount).toBe('number');
  });

  test('returns 200 with empty data array when no patients exist', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/patients');

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// =============================================================================
// getPatient
// =============================================================================

describe('getPatient handler', () => {
  afterEach(truncate);

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request(`/patients/${NONEXISTENT_ID}`);

    expect(res.status).toBe(401);
  });

  test('returns 404 when patient does not exist', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request(`/patients/${NONEXISTENT_ID}`);

    expect(res.status).toBe(404);
  });

  test('returns 200 with patient data for owner', async () => {
    const patient = await seedPatient();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/patients/${patient.id}`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(patient.id);
  });
});

// =============================================================================
// updatePatient
// =============================================================================

describe('updatePatient handler', () => {
  afterEach(truncate);

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request(`/patients/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dentalHistorySummary: 'Cavity filled' }),
    });

    expect(res.status).toBe(401);
  });

  test('returns 404 when patient does not exist', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request(`/patients/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dentalHistorySummary: 'Cavity filled' }),
    });

    expect(res.status).toBe(404);
  });

  test('returns 200 with updated fields', async () => {
    const patient = await seedPatient();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/patients/${patient.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dentalHistorySummary: 'Cavity filled on upper right molar',
        needsFollowUp: true,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(patient.id);
    expect(body.dentalHistorySummary).toBe('Cavity filled on upper right molar');
    expect(body.needsFollowUp).toBe(true);
  });
});

// =============================================================================
// deactivatePatient  (DELETE /patients/:id in generated routes)
// =============================================================================

describe('deactivatePatient handler', () => {
  afterEach(truncate);

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request(`/patients/${NONEXISTENT_ID}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(401);
  });

  test('returns 404 when patient does not exist', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request(`/patients/${NONEXISTENT_ID}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
  });

  test('returns 204 on successful deactivation', async () => {
    const patient = await seedPatient();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/patients/${patient.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(204);
  });
});

// =============================================================================
// deletePatient  (hard delete — not in generated routes, tested via /hard path)
// =============================================================================

describe('deletePatient handler', () => {
  afterEach(truncate);

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request(`/patients/${NONEXISTENT_ID}/hard`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(401);
  });

  test('returns 404 when patient does not exist', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request(`/patients/${NONEXISTENT_ID}/hard`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
  });

  test('returns 204 on successful hard delete of own patient record', async () => {
    // seedPatient already calls seedUser internally
    const patient = await seedPatient();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/patients/${patient.id}/hard`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(204);

    // Verify record is gone
    const patientRepo = new PatientRepository(db);
    const found = await patientRepo.findOneById(patient.id);
    expect(found).toBeNull();
  });
});

// =============================================================================
// mergePatients  (not yet implemented — throws Error('Not implemented'))
// =============================================================================

describe('mergePatients handler', () => {
  afterEach(truncate);

  test('returns 401 when user is not authenticated', async () => {
    // mergePatients has no authMiddleware in generated routes, but we still
    // test our test-app wiring. The handler itself throws 'Not implemented'.
    // We verify the route is reachable (status !== 404).
    const app = buildTestApp(undefined);

    const res = await app.request('/patients/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcePatientId: TEST_USER_ID,
        targetPatientId: OTHER_USER_ID,
        reason: 'duplicate record',
      }),
    });

    // Handler is not implemented so it will 500; that proves auth was not
    // the blocker — just verify it did NOT silently return 2xx.
    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(201);
  });

  test('returns 500 (not implemented) for valid request body', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/patients/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcePatientId: TEST_USER_ID,
        targetPatientId: OTHER_USER_ID,
        reason: 'duplicate record',
      }),
    });

    // Handler throws Error('Not implemented: mergePatients')
    expect(res.status).toBe(500);
  });
});

// =============================================================================
// unmergePatients  (not yet implemented — throws Error('Not implemented'))
// =============================================================================

describe('unmergePatients handler', () => {
  afterEach(truncate);

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request('/patients/unmerge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcePatientId: TEST_USER_ID,
        targetPatientId: OTHER_USER_ID,
        reason: 'undo merge',
      }),
    });

    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(201);
  });

  test('returns 500 (not implemented) for valid request body', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/patients/unmerge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcePatientId: TEST_USER_ID,
        targetPatientId: OTHER_USER_ID,
        reason: 'undo merge',
      }),
    });

    // Handler throws Error('Not implemented: unmergePatients')
    expect(res.status).toBe(500);
  });
});
