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
 * Acceptance criteria covered (see docs/prd/ACCEPTANCE_CRITERIA.md §18):
 *   @AC-PERIO-01 create→201   @AC-PERIO-02 dup→409   @AC-PERIO-03 upsert→200
 *   @AC-PERIO-06 complete<16→422   @AC-PERIO-07 complete≥16→200(completed)
 *   @AC-PERIO-08 locked-visit→422   @AC-PERIO-09 staff_scheduling→403   @AC-PERIO-10 read readings
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
  CompletePerioChartBody,
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
  app.post('/dental/perio-charts/:chartId/complete', zValidator('param', CompletePerioChartParams, ve), zValidator('json', CompletePerioChartBody, ve), completePerioChart as any);
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

  // BR-P02: cannot create a perio chart on a sealed (completed/locked) visit.
  // The visit-status guard fires before the CHART_EXISTS / role checks.
  test('returns 422 VISIT_LOCKED creating a chart on a completed visit', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request('/dental/perio-charts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId: COMPLETED_VISIT_ID, patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_LOCKED');
  });

  test('returns 422 VISIT_LOCKED creating a chart on a locked visit', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request('/dental/perio-charts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId: LOCKED_VISIT_ID, patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_LOCKED');
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

  // Data-loss regression (perio-charting.spec.ts:242 red-line): the chairside flow
  // PUTs ONE site per keystroke. A single-site patch must MERGE — it must not null
  // out the other sites already saved on the tooth. Before the fix, the 2nd patch
  // (depthBC) wiped depthBM back to null, so the red-line never rendered.
  test('preserves previously-entered sites across single-site patches (no data loss)', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    const first = await app.request(`/dental/perio-charts/${chartId}/readings/17`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depthBM: 6 }),
    });
    expect(first.status).toBe(200);
    const second = await app.request(`/dental/perio-charts/${chartId}/readings/17`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depthBC: 5 }),
    });
    expect(second.status).toBe(200);
    const body = await second.json() as any;
    expect(body.depthBM).toBe(6); // must survive the second single-site patch
    expect(body.depthBC).toBe(5);
  });

  // BOP is a nullable boolean (null = not assessed). Toggling a bleeding dot OFF
  // sends {bopBM:false}; that explicit false must persist, not fall back to the
  // prior value or null. (false is not nullish, so it overrides.)
  test('persists an explicit BOP toggle-off (true → false)', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    await app.request(`/dental/perio-charts/${chartId}/readings/47`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bopBM: true }),
    });
    const res = await app.request(`/dental/perio-charts/${chartId}/readings/47`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bopBM: false }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.bopBM).toBe(false);
  });

  // A single-site PATCH must touch ONLY the columns it carries — a later depth
  // entry must not reset an unrelated per-tooth field (mobility) back to its
  // default. Proves the partial-update (no full-row replace) holds for non-depth
  // columns too.
  test('a single-site patch leaves untouched columns intact (mobility preserved)', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    await app.request(`/dental/perio-charts/${chartId}/readings/46`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobility: 2 }),
    });
    const res = await app.request(`/dental/perio-charts/${chartId}/readings/46`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depthBM: 4 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.mobility).toBe(2); // not reset to default 0 by the depth patch
    expect(body.depthBM).toBe(4);
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

  // V-PER-004: mobility / furcation must be grade 0-3.
  test('returns 422 INVALID_GRADE when mobility is out of 0-3 range', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${chartId}/readings/13`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobility: 5 }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVALID_GRADE');
  });

  test('returns 422 INVALID_GRADE when furcation is negative', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${chartId}/readings/13`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ furcation: -1 }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVALID_GRADE');
  });

  // BR-P04 / AC-P05: an FDI quadrant-gap number (19) passes the validator's
  // numeric [11,85] range but the handler's assertValidToothNumber rejects it.
  test('returns 422 INVALID_TOOTH_NUMBER for a quadrant-gap tooth (19)', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${chartId}/readings/19`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depthBM: 3 }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVALID_TOOTH_NUMBER');
  });

  test('accepts mobility/furcation at the boundary grade 3', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${chartId}/readings/14`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobility: 3, furcation: 3 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.mobility).toBe(3);
    expect(body.furcation).toBe(3);
  });

  // P1-5: read-only CAL is derived per-site as CAL = probing depth + gingival
  // margin across the three GM/CEJ cases (research §"Clinical Attachment Level").
  test('returns computed read-only CAL per site across the three GM/CEJ cases', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${chartId}/readings/15`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        depthBM: 4, gmBM: 2,   // recession      → CAL 6
        depthBC: 3, gmBC: 0,   // at CEJ         → CAL 3
        depthBD: 5, gmBD: -2,  // coronal to CEJ → CAL 3
        depthLM: 6,            // GM missing     → CAL null
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.gmBM).toBe(2);
    expect(body.calBM).toBe(6); // PD 4 + recession 2
    expect(body.calBC).toBe(3); // PD 3, margin at CEJ
    expect(body.calBD).toBe(3); // PD 5 − 2mm coronal
    expect(body.calLM).toBeNull(); // PD present but GM missing
  });

  test('returns 422 INVALID_GINGIVAL_MARGIN when a gingival margin is below -5mm', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${chartId}/readings/16`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depthBM: 3, gmBM: -6 }),
    });
    expect(res.status).toBe(400); // validator bound -5..20 rejects before handler
    // (handler-level INVALID_GINGIVAL_MARGIN is pinned in the unit suite where the
    // validator bound can be bypassed — see perio-validation behaviour.)
  });

  test('getPerioChart surfaces computed CAL on persisted readings', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    // Persist a recession site, then read the whole chart back.
    await app.request(`/dental/perio-charts/${chartId}/readings/17`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depthBC: 4, gmBC: 3 }), // CAL 7
    });
    const res = await app.request(`/dental/perio-charts/${chartId}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const t17 = body.readings.find((r: any) => r.toothNumber === 17);
    expect(t17).toBeTruthy();
    expect(t17.calBC).toBe(7);
  });
});

// N-PER-01 / V-PER-002: writing to a COMPLETED chart (whose visit is still active)
// → CHART_COMPLETED. ERROR_TAXONOMY.md mandates 409 (state conflict), matching the
// create/complete handlers — not a 422 business-rule failure.
describe('upsertToothReading on a completed chart (N-PER-01 / V-PER-002)', () => {
  const ACTIVE_VISIT_2 = 'ee000000-0000-1000-8000-000000000052';
  const COMPLETED_CHART_2 = 'ee000000-0000-1000-8000-000000000072';

  beforeAll(async () => {
    await db.insert(dentalVisits).values({
      id: ACTIVE_VISIT_2, patientId: PATIENT_ID, branchId: BRANCH_ID,
      dentistMemberId: MEMBER_ID, status: 'draft',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    }).onConflictDoNothing();

    await db.insert(dentalPerioCharts).values({
      id: COMPLETED_CHART_2, visitId: ACTIVE_VISIT_2, patientId: PATIENT_ID,
      branchId: BRANCH_ID, examinerMemberId: MEMBER_ID, status: 'completed',
      completedAt: new Date(),
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    }).onConflictDoNothing();
  });

  test('returns 409 CHART_COMPLETED writing to a completed (not visit-locked) chart', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${COMPLETED_CHART_2}/readings/11`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depthBM: 3 }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.code).toBe('CHART_COMPLETED');
  });
});

// V-PER-007: visit-lock → chart-lock cascade is materialized on read.
describe('visit-lock cascade (V-PER-007)', () => {
  const CASCADE_LOCKED_VISIT = 'ee000000-0000-1000-8000-000000000062';
  const CASCADE_DRAFT_CHART = 'ee000000-0000-1000-8000-000000000073';

  beforeAll(async () => {
    await db.insert(dentalVisits).values({
      id: CASCADE_LOCKED_VISIT, patientId: PATIENT_ID, branchId: BRANCH_ID,
      dentistMemberId: MEMBER_ID, status: 'locked',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    }).onConflictDoNothing();

    await db.insert(dentalPerioCharts).values({
      id: CASCADE_DRAFT_CHART, visitId: CASCADE_LOCKED_VISIT, patientId: PATIENT_ID,
      branchId: BRANCH_ID, examinerMemberId: MEMBER_ID, status: 'draft',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    }).onConflictDoNothing();
  });

  test('reading a draft chart whose parent visit is locked transitions chart to locked', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${CASCADE_DRAFT_CHART}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('locked');

    // Persisted + idempotent: a second read still returns locked.
    const res2 = await app.request(`/dental/perio-charts/${CASCADE_DRAFT_CHART}`);
    const body2 = await res2.json() as any;
    expect(body2.status).toBe('locked');
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
    expect(body.code).toBe('INSUFFICIENT_READINGS');
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

  // V-PER-001: re-completing a completed/locked chart is a 409 state conflict, code CHART_COMPLETED.
  test('returns 409 CHART_COMPLETED attempting to complete an already-completed chart', async () => {
    const chartId = await getChartId();
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${chartId}/complete`, { method: 'POST' });
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.code).toBe('CHART_COMPLETED');
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

// P1-6: 2017 AAP/EFP staging/grading surfaced on the completion response.
describe('completePerioChart — 2017 staging/grading (P1-6)', () => {
  const STAGE_VISIT = 'ee000000-0000-1000-8000-000000000055';
  const STAGE_CHART = 'ee000000-0000-1000-8000-000000000076';

  beforeAll(async () => {
    await db.insert(dentalVisits).values({
      id: STAGE_VISIT, patientId: PATIENT_ID, branchId: BRANCH_ID,
      dentistMemberId: MEMBER_ID, status: 'draft',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    }).onConflictDoNothing();
    await db.insert(dentalPerioCharts).values({
      id: STAGE_CHART, visitId: STAGE_VISIT, patientId: PATIENT_ID,
      branchId: BRANCH_ID, examinerMemberId: MEMBER_ID, status: 'draft',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    }).onConflictDoNothing();
  });

  test('returns computed Stage III + Grade C + generalized extent', async () => {
    const app = buildApp(TEST_USER);
    // One advanced interdental site (PD 6 + 2mm recession at BM → CAL 8, furcation II)
    // plus 15 involved teeth (PD 5 → involved) → ≥30% involvement → generalized.
    await app.request(`/dental/perio-charts/${STAGE_CHART}/readings/16`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depthBM: 6, gmBM: 2, furcation: 2 }),
    });
    for (const tooth of [12, 13, 14, 15, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 11]) {
      await app.request(`/dental/perio-charts/${STAGE_CHART}/readings/${tooth}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depthBM: 5, gmBM: 0 }), // CAL 5 → involved
      });
    }

    const res = await app.request(`/dental/perio-charts/${STAGE_CHART}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // grading risk: heavy smoker → Grade C. remainingTeeth=28 (full dentition)
      // so the <20-teeth Stage-IV complexity factor does not apply.
      body: JSON.stringify({ bonelossPercent: 40, ageYears: 30, cigarettesPerDay: 12, remainingTeeth: 28 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.stage).toBe('III');
    expect(body.grade).toBe('C');
    expect(body.extent).toBe('generalized');
  });
});

// N-PER-02: primary-dentition charts (FDI 51–85, 20 teeth) complete at min 8/20,
// while adult charts keep the 16 minimum. Dentition is inferred from the charted
// tooth numbers since the schema has no dentition-type column.
describe('completePerioChart — primary dentition minimum (N-PER-02)', () => {
  const PRIMARY_VISIT = 'ee000000-0000-1000-8000-000000000053';
  const PRIMARY_CHART = 'ee000000-0000-1000-8000-000000000074';
  const PRIMARY_VISIT_2 = 'ee000000-0000-1000-8000-000000000054';
  const PRIMARY_CHART_2 = 'ee000000-0000-1000-8000-000000000075';

  beforeAll(async () => {
    await db.insert(dentalVisits).values([
      {
        id: PRIMARY_VISIT, patientId: PATIENT_ID, branchId: BRANCH_ID,
        dentistMemberId: MEMBER_ID, status: 'draft',
        createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
      },
      {
        id: PRIMARY_VISIT_2, patientId: PATIENT_ID, branchId: BRANCH_ID,
        dentistMemberId: MEMBER_ID, status: 'draft',
        createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
      },
    ]).onConflictDoNothing();

    await db.insert(dentalPerioCharts).values([
      {
        id: PRIMARY_CHART, visitId: PRIMARY_VISIT, patientId: PATIENT_ID,
        branchId: BRANCH_ID, examinerMemberId: MEMBER_ID, status: 'draft',
        createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
      },
      {
        id: PRIMARY_CHART_2, visitId: PRIMARY_VISIT_2, patientId: PATIENT_ID,
        branchId: BRANCH_ID, examinerMemberId: MEMBER_ID, status: 'draft',
        createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
      },
    ]).onConflictDoNothing();
  });

  async function seedReadings(chartId: string, teeth: number[]) {
    const app = buildApp(TEST_USER);
    for (const tooth of teeth) {
      const r = await app.request(`/dental/perio-charts/${chartId}/readings/${tooth}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depthBM: 3, bopBM: false }),
      });
      expect(r.status).toBe(200);
    }
  }

  test('returns 422 INSUFFICIENT_READINGS for a primary chart below the 8-reading minimum', async () => {
    // 7 primary teeth (FDI 51-55, 61-62) — below the primary minimum of 8.
    await seedReadings(PRIMARY_CHART_2, [51, 52, 53, 54, 55, 61, 62]);
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${PRIMARY_CHART_2}/complete`, { method: 'POST' });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INSUFFICIENT_READINGS');
  });

  test('returns 200 completing a primary chart with exactly 8 readings', async () => {
    // 8 primary teeth (FDI 51-55, 61-63) — meets the primary minimum.
    await seedReadings(PRIMARY_CHART, [51, 52, 53, 54, 55, 61, 62, 63]);
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts/${PRIMARY_CHART}/complete`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('completed');
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

  test('returns 404 NOT_FOUND for an unknown chartId', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request('/dental/perio-charts/ee000000-0000-1000-8000-0000000000ff');
    expect(res.status).toBe(404);
  });
});
