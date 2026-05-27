/**
 * dental-patient-recall.test.ts — Recall Entity (P0-B)
 *
 * AC-001  POST returns 201 with recall object (status defaults to 'pending')
 * AC-002  GET returns 200 with array of recalls
 * AC-003  PATCH returns 200 with updated recall (notes, dueDate, type)
 * AC-004  PATCH status transitions: pending→sent, sent→completed, sent→cancelled, pending→cancelled
 * AC-005  401 without auth
 * AC-006  404 for non-existent patient
 * AC-007  400 when required fields missing (type, dueDate)
 * AC-008  400 for invalid recall type enum
 * AC-009  404 for non-existent recallId on PATCH
 * BR-001  recall type must be: cleaning | checkup | treatment | other
 * BR-002  dueDate must be ISO date string (YYYY-MM-DD)
 * BR-003  FSM: invalid transitions rejected with 422
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  RecallParams,
  RecallRecallParams,
  CreateRecallBody,
  UpdateRecallBody,
} from './recall-validators';
import { createRecall } from './createRecall';
import { listPatientRecalls } from './listPatientRecalls';
import { updateRecall } from './updateRecall';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-000000000001', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000022';
const ORG_ID = 'c0000000-0000-1000-8000-000000000022';
const PATIENT_ID = 'd0000000-0000-1000-8000-000000000022';
const PERSON_ID = 'e0000000-0000-1000-8000-000000000022';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';

const ve = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Recall Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID,
    name: 'Main Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: 'a1000000-0000-1000-8000-000000000022',
    branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Staff Member', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Recall', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID,
    preferredBranchId: BRANCH_ID,
    status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

function buildTestApp(user?: typeof TEST_USER) {
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
    if (user) ctx.set('user', user);
    await next();
  });

  app.post(
    '/dental/patients/:patientId/recalls',
    zValidator('param', RecallParams, ve),
    zValidator('json', CreateRecallBody, ve),
    createRecall as any,
  );
  app.get(
    '/dental/patients/:patientId/recalls',
    zValidator('param', RecallParams, ve),
    listPatientRecalls as any,
  );
  app.patch(
    '/dental/patients/:patientId/recalls/:recallId',
    zValidator('param', RecallRecallParams, ve),
    zValidator('json', UpdateRecallBody, ve),
    updateRecall as any,
  );

  return app;
}

async function truncateRecalls() {
  const { dentalRecalls } = await import('./repos/recall.schema');
  await db.delete(dentalRecalls).where(eq(dentalRecalls.patientId, PATIENT_ID));
}

afterEach(async () => {
  await truncateRecalls();
});

// =============================================================================
// AC-001: POST returns 201 with recall object
// =============================================================================

describe('POST /dental/patients/:patientId/recalls (AC-001, AC-008, BR-001, BR-002)', () => {
  test('AC-001: creates recall and returns 201 with full object', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'cleaning',
        dueDate: '2026-09-01',
        notes: 'Regular 6-month cleaning',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeDefined();
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.type).toBe('cleaning');
    expect(body.dueDate).toBe('2026-09-01');
    expect(body.status).toBe('pending');
    expect(body.notes).toBe('Regular 6-month cleaning');
  });

  test('AC-001: status defaults to pending', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'checkup', dueDate: '2026-10-15' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.status).toBe('pending');
  });

  test('BR-001: accepts all valid recall types', async () => {
    const app = buildTestApp(TEST_USER);
    const types = ['cleaning', 'checkup', 'treatment', 'other'];

    for (const type of types) {
      await truncateRecalls();
      const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, dueDate: '2026-09-01' }),
      });
      expect(res.status).toBe(201);
    }
  });

  test('AC-008: rejects invalid recall type', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'xray', dueDate: '2026-09-01' }),
    });

    expect(res.status).toBe(400);
  });

  test('BR-002: rejects malformed dueDate', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cleaning', dueDate: 'next-month' }),
    });

    expect(res.status).toBe(400);
  });
});

// =============================================================================
// AC-002: GET returns 200 with array
// =============================================================================

describe('GET /dental/patients/:patientId/recalls (AC-002)', () => {
  test('AC-002: returns empty array when no recalls exist', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  test('AC-002: returns list of recalls for patient', async () => {
    const app = buildTestApp(TEST_USER);

    await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cleaning', dueDate: '2026-09-01' }),
    });
    await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'checkup', dueDate: '2026-12-01' }),
    });

    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.length).toBe(2);
  });
});

// =============================================================================
// AC-003: PATCH updates recall fields
// =============================================================================

describe('PATCH /dental/patients/:patientId/recalls/:recallId (AC-003, AC-009)', () => {
  test('AC-003: updates notes and returns 200', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cleaning', dueDate: '2026-09-01' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Needs deep cleaning' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.notes).toBe('Needs deep cleaning');
  });

  test('AC-009: PATCH returns 404 for non-existent recallId', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'test' }),
    });

    expect(res.status).toBe(404);
  });
});

// =============================================================================
// AC-004: FSM status transitions
// =============================================================================

describe('Recall FSM (AC-004, BR-003)', () => {
  test('AC-004: pending → sent transition succeeds', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cleaning', dueDate: '2026-09-01' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('sent');
  });

  test('AC-004: sent → completed transition succeeds', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cleaning', dueDate: '2026-09-01' }),
    });
    const created = await createRes.json() as any;

    await app.request(`/dental/patients/${PATIENT_ID}/recalls/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent' }),
    });

    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('completed');
  });

  test('AC-004: pending → cancelled is allowed', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'treatment', dueDate: '2026-09-01' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('cancelled');
  });

  test('BR-003: completed → sent is rejected with 422', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cleaning', dueDate: '2026-09-01' }),
    });
    const created = await createRes.json() as any;

    // pending → sent → completed
    await app.request(`/dental/patients/${PATIENT_ID}/recalls/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent' }),
    });
    await app.request(`/dental/patients/${PATIENT_ID}/recalls/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });

    // completed → sent is INVALID
    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent' }),
    });

    expect(res.status).toBe(422);
  });

  test('BR-003: cancelled → completed is rejected with 422', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cleaning', dueDate: '2026-09-01' }),
    });
    const created = await createRes.json() as any;

    await app.request(`/dental/patients/${PATIENT_ID}/recalls/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });

    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });

    expect(res.status).toBe(422);
  });
});

// =============================================================================
// AC-005: 401 without auth
// =============================================================================

describe('Auth (AC-005)', () => {
  test('POST returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cleaning', dueDate: '2026-09-01' }),
    });
    expect(res.status).toBe(401);
  });

  test('GET returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// AC-006: 404 for non-existent patient
// =============================================================================

describe('Patient not found (AC-006)', () => {
  test('POST returns 404 for non-existent patient', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cleaning', dueDate: '2026-09-01' }),
    });

    expect(res.status).toBe(404);
  });

  test('GET returns 404 for non-existent patient', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/recalls`);
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// AC-007: 400 when required fields missing
// =============================================================================

describe('Validation (AC-007, BR-001)', () => {
  test('AC-007: POST returns 400 when type is missing', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueDate: '2026-09-01' }),
    });

    expect(res.status).toBe(400);
  });

  test('AC-007: POST returns 400 when dueDate is missing', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cleaning' }),
    });

    expect(res.status).toBe(400);
  });
});
