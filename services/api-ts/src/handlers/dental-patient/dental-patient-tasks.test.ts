/**
 * dental-patient-tasks.test.ts — Task Entity (P2-003)
 *
 * AC-001  POST returns 201 with task object (status defaults to 'open')
 * AC-002  GET returns 200 with array of tasks
 * AC-003  PATCH returns 200 with updated task
 * AC-004  PATCH status transitions: open→in_progress, in_progress→done, open→cancelled, in_progress→cancelled
 * AC-005  401 without auth
 * AC-006  404 for non-existent patient
 * AC-007  400 when required fields missing (title, taskType)
 * AC-008  400 for invalid taskType enum
 * AC-009  404 for non-existent taskId on PATCH
 * BR-001  taskType must be: follow_up | lab_order | referral | prescription | other
 * BR-002  dueDate when provided must be ISO date string (YYYY-MM-DD)
 * BR-003  FSM: invalid transitions rejected with 422
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  TaskParams,
  TaskTaskParams,
  CreateTaskBody,
  UpdateTaskBody,
} from './task-validators';
import { createTask } from './createTask';
import { listPatientTasks } from './listPatientTasks';
import { updateTask } from './updateTask';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-000000000033', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000033';
const ORG_ID = 'c0000000-0000-1000-8000-000000000033';
const PATIENT_ID = 'd0000000-0000-1000-8000-000000000033';
const PERSON_ID = 'e0000000-0000-1000-8000-000000000033';
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
    id: ORG_ID, name: 'Task Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID,
    name: 'Main Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: 'a1000000-0000-1000-8000-000000000033',
    branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Staff Member', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Task', lastName: 'Patient',
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
    '/dental/patients/:patientId/tasks',
    zValidator('param', TaskParams, ve),
    zValidator('json', CreateTaskBody, ve),
    createTask as any,
  );
  app.get(
    '/dental/patients/:patientId/tasks',
    zValidator('param', TaskParams, ve),
    listPatientTasks as any,
  );
  app.patch(
    '/dental/patients/:patientId/tasks/:taskId',
    zValidator('param', TaskTaskParams, ve),
    zValidator('json', UpdateTaskBody, ve),
    updateTask as any,
  );

  return app;
}

async function truncateTasks() {
  const { dentalTasks } = await import('./repos/task.schema');
  await db.delete(dentalTasks).where(eq(dentalTasks.patientId, PATIENT_ID));
}

afterEach(async () => {
  await truncateTasks();
});

// =============================================================================
// AC-001: POST returns 201 with task object
// =============================================================================

describe('POST /dental/patients/:patientId/tasks (AC-001, AC-008, BR-001, BR-002)', () => {
  test('AC-001: creates task and returns 201 with full object', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Order crown lab work',
        taskType: 'lab_order',
        description: 'Ceramic crown for #19',
        dueDate: '2026-09-15',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeDefined();
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.title).toBe('Order crown lab work');
    expect(body.taskType).toBe('lab_order');
    expect(body.dueDate).toBe('2026-09-15');
    expect(body.status).toBe('open');
    expect(body.description).toBe('Ceramic crown for #19');
  });

  test('AC-001: status defaults to open', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Follow up call', taskType: 'follow_up' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.status).toBe('open');
  });

  test('BR-001: accepts all valid task types', async () => {
    const app = buildTestApp(TEST_USER);
    const types = ['follow_up', 'lab_order', 'referral', 'prescription', 'other'];

    for (const taskType of types) {
      await truncateTasks();
      const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `T-${taskType}`, taskType }),
      });
      expect(res.status).toBe(201);
    }
  });

  test('AC-008: rejects invalid task type', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'X', taskType: 'banana' }),
    });

    expect(res.status).toBe(400);
  });

  test('BR-002: rejects malformed dueDate', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'X', taskType: 'follow_up', dueDate: 'tomorrow' }),
    });

    expect(res.status).toBe(400);
  });
});

// =============================================================================
// AC-002: GET returns 200 with array
// =============================================================================

describe('GET /dental/patients/:patientId/tasks (AC-002)', () => {
  test('AC-002: returns empty array when no tasks exist', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  test('AC-002: returns list of tasks for patient', async () => {
    const app = buildTestApp(TEST_USER);

    await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T1', taskType: 'follow_up' }),
    });
    await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T2', taskType: 'referral' }),
    });

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.length).toBe(2);
  });
});

// =============================================================================
// AC-003: PATCH updates task fields
// =============================================================================

describe('PATCH /dental/patients/:patientId/tasks/:taskId (AC-003, AC-009)', () => {
  test('AC-003: updates description and returns 200', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', taskType: 'follow_up' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Updated note' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.description).toBe('Updated note');
  });

  test('AC-009: PATCH returns 404 for non-existent taskId', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'test' }),
    });

    expect(res.status).toBe(404);
  });
});

// =============================================================================
// AC-004: FSM status transitions
// =============================================================================

describe('Task FSM (AC-004, BR-003)', () => {
  test('AC-004: open → in_progress transition succeeds', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', taskType: 'follow_up' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('in_progress');
  });

  test('AC-004: in_progress → done transition succeeds and sets completedAt', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', taskType: 'follow_up' }),
    });
    const created = await createRes.json() as any;

    await app.request(`/dental/patients/${PATIENT_ID}/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('done');
    expect(body.completedAt).toBeDefined();
    expect(body.completedAt).not.toBeNull();
  });

  test('AC-004: open → cancelled is allowed', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', taskType: 'other' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('cancelled');
  });

  test('AC-004: in_progress → cancelled is allowed', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', taskType: 'other' }),
    });
    const created = await createRes.json() as any;

    await app.request(`/dental/patients/${PATIENT_ID}/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('cancelled');
  });

  test('BR-003: open → done is rejected with 422 (must go through in_progress)', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', taskType: 'follow_up' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });

    expect(res.status).toBe(422);
  });

  test('BR-003: done → in_progress is rejected with 422 (terminal)', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', taskType: 'follow_up' }),
    });
    const created = await createRes.json() as any;

    // open → in_progress → done
    await app.request(`/dental/patients/${PATIENT_ID}/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    await app.request(`/dental/patients/${PATIENT_ID}/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });

    // done → in_progress is INVALID
    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    expect(res.status).toBe(422);
  });

  test('BR-003: cancelled → done is rejected with 422 (terminal)', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', taskType: 'follow_up' }),
    });
    const created = await createRes.json() as any;

    await app.request(`/dental/patients/${PATIENT_ID}/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
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
    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', taskType: 'follow_up' }),
    });
    expect(res.status).toBe(401);
  });

  test('GET returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// AC-006: 404 for non-existent patient
// =============================================================================

describe('Patient not found (AC-006)', () => {
  test('POST returns 404 for non-existent patient', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', taskType: 'follow_up' }),
    });

    expect(res.status).toBe(404);
  });

  test('GET returns 404 for non-existent patient', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/tasks`);
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// AC-007: 400 when required fields missing
// =============================================================================

describe('Validation (AC-007, BR-001)', () => {
  test('AC-007: POST returns 400 when title is missing', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskType: 'follow_up' }),
    });

    expect(res.status).toBe(400);
  });

  test('AC-007: POST returns 400 when taskType is missing', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T' }),
    });

    expect(res.status).toBe(400);
  });

  test('AC-007: POST returns 400 when title is empty string', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '', taskType: 'follow_up' }),
    });

    expect(res.status).toBe(400);
  });
});
