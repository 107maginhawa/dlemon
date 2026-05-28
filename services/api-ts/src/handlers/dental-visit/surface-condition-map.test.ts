/**
 * P0.1 — surfaceConditionMap round-trip test
 *
 * Proves the bug: surfaceConditionMap is stripped by the Zod validator in
 * ToothChartStateSchema before reaching the DB upsert, and by UpdateToothInput
 * in the repo before reaching the per-tooth PATCH.
 *
 * Steps:
 *   1. Upsert a chart with surfaceConditionMap on a tooth.
 *   2. GET the chart and assert the map is present (RED until fix).
 *   3. PATCH the same tooth (state-only update) and assert the map is preserved.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  UpsertDentalChartBody, UpsertDentalChartParams,
  UpdateToothBody, UpdateToothParams,
} from '@/generated/openapi/validators';
import { VisitRepository } from './repos/visit.repo';
import { getDentalChart } from './chart/getDentalChart';
import { upsertDentalChart } from './chart/upsertDentalChart';
import { updateTooth } from './chart/updateTooth';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Unique IDs for this suite (tag a09 avoids collisions with other suites)
const TEST_USER      = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID     = 'a0000000-0000-1000-8000-000000000001';
const PERSON_ID      = 'e0000000-0000-1000-8000-000000000001';
const BRANCH_ID      = '7b000000-0000-4000-8000-000000000a09';
const ORG_ID         = 'da000000-0000-1000-8000-000000000002';
const DENTIST_MEMBER_ID = '7c000000-0000-4000-8000-000000000a09';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'SurfaceMap Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'SurfaceMap Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: DENTIST_MEMBER_ID, branchId: BRANCH_ID,
    personId: TEST_USER.id, displayName: 'SurfaceMap Dentist', role: 'dentist_owner',
    status: 'active', pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Surface', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const ChartBodyOnly = UpsertDentalChartBody.omit({ visitId: true });
const UpdateToothParamsCoerced = UpdateToothParams.extend({
  toothNumber: z.union([z.number().int(), z.string().transform(Number)]),
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
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.get('/dental/visits/:visitId/chart', getDentalChart as any);
  app.post('/dental/visits/:visitId/chart',
    zValidator('param', UpsertDentalChartParams, ve),
    zValidator('json', ChartBodyOnly, ve),
    upsertDentalChart as any,
  );
  app.patch('/dental/visits/:visitId/chart/teeth/:toothNumber',
    zValidator('param', UpdateToothParamsCoerced, ve),
    zValidator('json', UpdateToothBody, ve),
    updateTooth as any,
  );

  return app;
}

async function seedVisit() {
  const repo = new VisitRepository(db);
  return repo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: DENTIST_MEMBER_ID,
  });
}

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_chart`);
  await db.execute(sql`UPDATE imaging_finding SET visit_id = NULL WHERE visit_id IS NOT NULL`);
  await db.execute(sql`UPDATE dental_appointment SET visit_id = NULL WHERE visit_id IS NOT NULL`);
  await db.execute(sql`DELETE FROM dental_visit`);
});

// ---------------------------------------------------------------------------
// surfaceConditionMap round-trip
// ---------------------------------------------------------------------------

describe('surfaceConditionMap persistence (P0.1 Gap #9)', () => {
  test('upsert chart with surfaceConditionMap — GET returns map intact', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    // Upsert chart with a tooth that carries a surfaceConditionMap
    const upsertRes = await app.request(`/dental/visits/${visit.id}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        teeth: [
          {
            toothNumber: 16,
            state: 'caries',
            surfaces: ['occlusal', 'mesial'],
            surfaceConditionMap: { O: 'caries', M: 'restoration' },
          },
        ],
      }),
    });

    expect(upsertRes.status).toBe(201);

    // Independent GET — must see surfaceConditionMap
    const getRes = await app.request(`/dental/visits/${visit.id}/chart`);
    expect(getRes.status).toBe(200);

    const body = await getRes.json() as any;
    const tooth = body.teeth.find((t: any) => t.toothNumber === 16);
    expect(tooth).toBeDefined();
    expect(tooth.surfaceConditionMap).toEqual({ O: 'caries', M: 'restoration' });
  });

  test('per-tooth PATCH preserves existing surfaceConditionMap', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    // Seed chart with a tooth that has a surfaceConditionMap
    await app.request(`/dental/visits/${visit.id}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        teeth: [
          {
            toothNumber: 21,
            state: 'caries',
            surfaces: ['buccal'],
            surfaceConditionMap: { B: 'caries', O: 'watchlist' },
          },
        ],
      }),
    });

    // PATCH the tooth — update state only, do NOT send surfaceConditionMap
    const patchRes = await app.request(`/dental/visits/${visit.id}/chart/teeth/21`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'filled' }),
    });

    expect(patchRes.status).toBe(200);

    // GET and verify map still present
    const getRes = await app.request(`/dental/visits/${visit.id}/chart`);
    expect(getRes.status).toBe(200);

    const body = await getRes.json() as any;
    const tooth = body.teeth.find((t: any) => t.toothNumber === 21);
    expect(tooth).toBeDefined();
    expect(tooth.state).toBe('filled');                             // update applied
    expect(tooth.surfaceConditionMap).toEqual({ B: 'caries', O: 'watchlist' }); // map preserved
  });
});
