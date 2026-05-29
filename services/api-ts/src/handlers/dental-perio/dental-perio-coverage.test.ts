/**
 * dental-perio-coverage.test.ts — Handler coverage for dental-perio module (P2-001)
 *
 * Covers:
 *   createPerioChart       POST /dental/perio-charts           → 201
 *   upsertToothReading     PUT  /dental/perio-charts/:id/readings/:tooth → 200
 *   completePerioChart     POST /dental/perio-charts/:id/complete         → 200
 *   getVisitPerioChart     GET  /dental/visits/:visitId/perio-chart       → 200 / 204
 *   getPerioChart          GET  /dental/perio-charts/:chartId             → 200
 *   RBAC                   non-dentist → 403; staff_scheduling → 403 on read (EF-PER-002)
 *
 * All fixture IDs use `ee` UUID prefix to avoid collisions with other suites.
 * Routes registered inline — not yet wired in app.ts.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreatePerioChartBody,
  UpsertToothReadingBody,
  UpsertToothReadingParams,
  CompletePerioChartParams,
  GetVisitPerioChartParams,
  GetPerioChartParams,
} from '@/generated/openapi/validators';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { dentalPerioCharts } from './repos/perio-chart.schema';
import { createPerioChart } from './createPerioChart';
import { upsertToothReading } from './upsertToothReading';
import { completePerioChart } from './completePerioChart';
import { getVisitPerioChart } from './getVisitPerioChart';
import { getPerioChart } from './getPerioChart';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const DB_URL = process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test';
const db = createDatabase({ url: DB_URL });

// ee-prefix = perio-coverage suite namespace (all valid hex)
const TEST_USER    = { id: 'ee000000-0000-1000-8000-000000000001', email: 'dentist@perio.test' };
const NON_DENTIST  = { id: 'ee000000-0000-1000-8000-000000000002', email: 'staff@perio.test' };
const ORG_ID       = 'ee000000-0000-1000-8000-000000000010';
const BRANCH_ID    = 'ee000000-0000-1000-8000-000000000011';
const MEMBER_ID    = 'ee000000-0000-1000-8000-000000000020';
const STAFF_MEM_ID = 'ee000000-0000-1000-8000-000000000021';
const PERSON_ID    = 'ee000000-0000-1000-8000-000000000030';
const PATIENT_ID   = 'ee000000-0000-1000-8000-000000000040';
const VISIT_ID          = 'ee000000-0000-1000-8000-000000000050';
const COMPLETED_VISIT_ID      = 'ee000000-0000-1000-8000-000000000060';
const LOCKED_VISIT_ID         = 'ee000000-0000-1000-8000-000000000061';
const COMPLETED_CHART_ID      = 'ee000000-0000-1000-8000-000000000070';
const LOCKED_CHART_ID         = 'ee000000-0000-1000-8000-000000000071';

// ─── App builders ──────────────────────────────────────────────────────────────

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

function buildApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    if (err instanceof z.ZodError) return c.json({ error: err.issues.map(i => i.message).join('; ') }, 400);
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.post('/dental/perio-charts', zValidator('json', CreatePerioChartBody, ve), createPerioChart as any);
  app.put('/dental/perio-charts/:chartId/readings/:toothNumber', zValidator('param', UpsertToothReadingParams, ve), zValidator('json', UpsertToothReadingBody, ve), upsertToothReading as any);
  app.post('/dental/perio-charts/:chartId/complete', zValidator('param', CompletePerioChartParams, ve), completePerioChart as any);
  app.get('/dental/visits/:visitId/perio-chart', zValidator('param', GetVisitPerioChartParams, ve), getVisitPerioChart as any);
  app.get('/dental/perio-charts/:chartId', zValidator('param', GetPerioChartParams, ve), getPerioChart as any);

  return app;
}

// ─── Seed / cleanup ────────────────────────────────────────────────────────────

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Perio Coverage Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  // dentist_owner membership
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Perio Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  // staff_scheduling membership for RBAC test
  await db.insert(dentalMemberships).values({
    id: STAFF_MEM_ID, branchId: BRANCH_ID, personId: NON_DENTIST.id,
    displayName: 'Scheduling Staff', role: 'staff_scheduling', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Perio', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalVisits).values({
    id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  // EF-PER-001 fixtures: visits in completed/locked states with draft perio charts
  await db.insert(dentalVisits).values({
    id: COMPLETED_VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, status: 'completed',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalVisits).values({
    id: LOCKED_VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, status: 'locked',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  // Seed draft perio charts for the sealed visits directly — createPerioChart
  // blocks on completed/locked visits so we insert via DB to set up EF-PER-001 tests.
  await db.insert(dentalPerioCharts).values({
    id: COMPLETED_CHART_ID, visitId: COMPLETED_VISIT_ID, patientId: PATIENT_ID,
    branchId: BRANCH_ID, examinerMemberId: MEMBER_ID, status: 'draft',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalPerioCharts).values({
    id: LOCKED_CHART_ID, visitId: LOCKED_VISIT_ID, patientId: PATIENT_ID,
    branchId: BRANCH_ID, examinerMemberId: MEMBER_ID, status: 'draft',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterAll(async () => {
  // Clean up in dependency order — charts cascade to readings
  await db.delete(dentalPerioCharts).execute().catch(() => {});
  await db.delete(dentalVisits).execute().catch(() => {});
  // Leave org/branch/membership/person/patient — created with onConflictDoNothing so idempotent
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createPerioChart', () => {
  test('returns 201 with chart in draft status', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request('/dental/perio-charts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId: VISIT_ID, patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.status).toBe('draft');
    expect(body.visitId).toBe(VISIT_ID);
    expect(Array.isArray(body.readings)).toBe(true);
  });

  test('returns 409 CHART_EXISTS on duplicate chart for same visit', async () => {
    const app = buildApp(TEST_USER);
    const post = () =>
      app.request('/dental/perio-charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId: VISIT_ID, patientId: PATIENT_ID }),
      });
    // Self-contained: ensure a chart exists for VISIT_ID (201 if first, 409 if a
    // prior test already created it), then assert the next POST conflicts.
    // BR-P01 (AC-P02): one chart per visit → 409 CHART_EXISTS, not 422.
    await post();
    const res = await post();
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.code).toBe('CHART_EXISTS');
  });

  test('returns 403 when user has no membership', async () => {
    const app = buildApp({ id: 'ffffffff-0000-1000-8000-000000000000', email: 'ghost@test.com' });
    const res = await app.request('/dental/perio-charts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId: VISIT_ID, patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(403);
  });
});

// We need a shared chartId across the reading and complete tests.
// Retrieve it via getVisitPerioChart since it was created above.
async function getChartId(): Promise<string> {
  const app = buildApp(TEST_USER);
  const res = await app.request(`/dental/visits/${VISIT_ID}/perio-chart`);
  expect(res.status).toBe(200);
  const body = await res.json() as any;
  return body.id as string;
}

describe('upsertToothReading', () => {
  test('returns 200 inserting a reading for tooth 11', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${chartId}/readings/11`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depthBM: 3, depthBC: 2, depthBD: 4, bopBM: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.toothNumber).toBe(11);
    expect(body.depthBM).toBe(3);
  });

  test('returns 200 updating an existing reading (upsert path)', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${chartId}/readings/11`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depthBM: 6 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.depthBM).toBe(6);
  });

  test('returns 403 for staff_scheduling role', async () => {
    const chartId = await getChartId();
    const app = buildApp(NON_DENTIST);
    const res = await app.request(`/dental/perio-charts/${chartId}/readings/12`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depthBM: 2 }),
    });
    expect(res.status).toBe(403);
  });

  // EF-PER-001: parent visit lock propagation
  test('returns 422 VISIT_IMMUTABLE when parent visit is completed', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${COMPLETED_CHART_ID}/readings/11`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depthBM: 3 }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_IMMUTABLE');
  });

  test('returns 422 VISIT_IMMUTABLE when parent visit is locked', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${LOCKED_CHART_ID}/readings/11`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depthBM: 3 }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_IMMUTABLE');
  });
});

describe('completePerioChart', () => {
  test('returns 422 when fewer than 16 readings exist', async () => {
    // Only 1 reading seeded so far (tooth 11)
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${chartId}/complete`, { method: 'POST' });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('PERIO_INSUFFICIENT_READINGS');
  });

  test('returns 200 with summary stats after 16+ readings', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);

    // Seed 15 more readings using valid FDI numbers (12-18 = 7, 21-28 = 8 → 15 more, 16 total with tooth 11)
    const extraTeeth = [12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28];
    for (const tooth of extraTeeth) {
      const r = await app.request(`/dental/perio-charts/${chartId}/readings/${tooth}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depthBM: 3, bopBM: false }),
      });
      expect(r.status).toBe(200);
    }

    const res = await app.request(`/dental/perio-charts/${chartId}/complete`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('completed');
    expect(body.completedAt).toBeTruthy();
    expect(typeof body.summaryBopPercent).toBe('number');
    expect(typeof body.summaryMeanDepth).toBe('number');
    expect(typeof body.summaryDeepPocketCount).toBe('number');
  });

  test('returns 422 attempting to complete an already-completed chart', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${chartId}/complete`, { method: 'POST' });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('PERIO_CHART_ALREADY_COMPLETE');
  });

  // BR-P02 / AC-P08: cannot complete a draft chart whose parent visit is locked/completed
  test('returns 422 VISIT_LOCKED when parent visit is completed', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${COMPLETED_CHART_ID}/complete`, { method: 'POST' });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_LOCKED');
  });

  test('returns 422 VISIT_LOCKED when parent visit is locked', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${LOCKED_CHART_ID}/complete`, { method: 'POST' });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_LOCKED');
  });
});

describe('getVisitPerioChart', () => {
  test('returns 200 with chart and readings', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/perio-chart`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.visitId).toBe(VISIT_ID);
    expect(Array.isArray(body.readings)).toBe(true);
    expect(body.readings.length).toBeGreaterThan(0);
  });

  test('returns 204 when no chart exists for the visit', async () => {
    const emptyVisitId = 'ee000000-0000-1000-8000-000000000051';
    // Insert a visit with no chart
    // Use 'draft' — PATIENT_ID already has an active visit (partial unique index blocks two actives)
    await db.insert(dentalVisits).values({
      id: emptyVisitId, patientId: PATIENT_ID, branchId: BRANCH_ID,
      dentistMemberId: MEMBER_ID, status: 'draft',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    }).onConflictDoNothing();

    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/visits/${emptyVisitId}/perio-chart`);
    expect(res.status).toBe(204);
  });

  test('returns 403 when user is unauthenticated', async () => {
    const app = buildApp(); // no user
    const res = await app.request(`/dental/visits/${VISIT_ID}/perio-chart`);
    expect(res.status).toBe(401);
  });

  // EF-PER-002: staff_scheduling must not read perio data
  test('returns 403 for staff_scheduling role', async () => {
    const app = buildApp(NON_DENTIST);
    const res = await app.request(`/dental/visits/${VISIT_ID}/perio-chart`);
    expect(res.status).toBe(403);
  });
});

describe('getPerioChart', () => {
  test('returns 200 with chart and readings for dentist', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${chartId}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(chartId);
    expect(Array.isArray(body.readings)).toBe(true);
  });

  // EF-PER-002: staff_scheduling must not read perio data via direct chart endpoint
  test('returns 403 for staff_scheduling role', async () => {
    const chartId = await getChartId();
    const app = buildApp(NON_DENTIST);
    const res = await app.request(`/dental/perio-charts/${chartId}`);
    expect(res.status).toBe(403);
  });
});
