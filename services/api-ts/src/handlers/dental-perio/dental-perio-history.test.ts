/**
 * dental-perio-history.test.ts — listPerioChartsForPatient (multi-exam comparison)
 *
 * Covers:
 *   listPerioChartsForPatient  GET /dental/perio-charts?patientId=  → 200
 *     - returns the patient's completed/locked charts, most-recent first
 *     - excludes draft (in-progress) charts
 *     - each chart includes its readings (with computed CAL)
 *     - 401 unauthenticated; 403 non-member; empty for a patient with no charts
 *
 * Fixture IDs use the `ef` UUID prefix to avoid collisions with other suites.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { ListPerioChartsForPatientQuery } from '@/generated/openapi/validators';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { dentalPerioCharts } from './repos/perio-chart.schema';
import { dentalPerioToothReadings } from './repos/perio-reading.schema';
import { listPerioChartsForPatient } from './listPerioChartsForPatient';

const DB_URL = process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test';
const db = createDatabase({ url: DB_URL });

const TEST_USER  = { id: 'ef000000-0000-1000-8000-000000000001', email: 'dentist@periohist.test' };
const GHOST_USER = { id: 'ef000000-0000-1000-8000-000000000002', email: 'ghost@periohist.test' };
const ORG_ID     = 'ef000000-0000-1000-8000-000000000010';
const BRANCH_ID  = 'ef000000-0000-1000-8000-000000000011';
const MEMBER_ID  = 'ef000000-0000-1000-8000-000000000020';
const PERSON_ID  = 'ef000000-0000-1000-8000-000000000030';
const PATIENT_ID = 'ef000000-0000-1000-8000-000000000040';   // has 2 completed + 1 draft chart
const PERSON2_ID  = 'ef000000-0000-1000-8000-000000000031';
const PATIENT2_ID = 'ef000000-0000-1000-8000-000000000041';  // has no charts
const VISIT_OLD   = 'ef000000-0000-1000-8000-000000000050';
const VISIT_NEW   = 'ef000000-0000-1000-8000-000000000051';
const VISIT_DRAFT = 'ef000000-0000-1000-8000-000000000052';
const CHART_OLD   = 'ef000000-0000-1000-8000-000000000070'; // completed, older
const CHART_NEW   = 'ef000000-0000-1000-8000-000000000071'; // completed, newer
const CHART_DRAFT = 'ef000000-0000-1000-8000-000000000072'; // draft → excluded

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
    if (user) { ctx.set('user', user); ctx.set('session', { id: 'test-session' }); }
    await next();
  });
  app.get('/dental/perio-charts', zValidator('query', ListPerioChartsForPatientQuery, ve), listPerioChartsForPatient as any);
  return app;
}

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Perio History Clinic', tier: 'solo', ownerPersonId: TEST_USER.id,
    countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Hist Dentist',
    role: 'dentist_owner', status: 'active', pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values([
    { id: PERSON_ID, firstName: 'Hist', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: PERSON2_ID, firstName: 'NoChart', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
  ]).onConflictDoNothing();
  await db.insert(patients).values([
    { id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: PATIENT2_ID, person: PERSON2_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
  ]).onConflictDoNothing();
  await db.insert(dentalVisits).values([
    { id: VISIT_OLD, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'locked', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: VISIT_NEW, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: VISIT_DRAFT, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
  ]).onConflictDoNothing();
  await db.insert(dentalPerioCharts).values([
    { id: CHART_OLD, visitId: VISIT_OLD, patientId: PATIENT_ID, branchId: BRANCH_ID, examinerMemberId: MEMBER_ID,
      status: 'locked', completedAt: new Date('2026-01-10T10:00:00Z'),
      summaryBopPercent: '40.00', summaryMeanDepth: '3.50', summaryDeepPocketCount: 5,
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: CHART_NEW, visitId: VISIT_NEW, patientId: PATIENT_ID, branchId: BRANCH_ID, examinerMemberId: MEMBER_ID,
      status: 'completed', completedAt: new Date('2026-05-20T10:00:00Z'),
      summaryBopPercent: '18.00', summaryMeanDepth: '2.80', summaryDeepPocketCount: 1,
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: CHART_DRAFT, visitId: VISIT_DRAFT, patientId: PATIENT_ID, branchId: BRANCH_ID, examinerMemberId: MEMBER_ID,
      status: 'draft', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
  ]).onConflictDoNothing();
  // one reading on the newest chart, to assert readings are included
  await db.insert(dentalPerioToothReadings).values({
    chartId: CHART_NEW, toothNumber: 16, depthBM: 3, depthBC: 2, depthBD: 4,
    gmBM: 1, gmBC: 0, gmBD: 1,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(dentalPerioToothReadings).execute().catch(() => {});
  await db.delete(dentalPerioCharts).execute().catch(() => {});
  await db.delete(dentalVisits).execute().catch(() => {});
});

describe('listPerioChartsForPatient', () => {
  test('returns completed/locked charts most-recent first, excluding drafts', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    const ids = body.data.map((c: any) => c.id);
    expect(ids).toEqual([CHART_NEW, CHART_OLD]); // desc by completedAt; draft excluded
  });

  test('summary stats are numbers (float64 contract), not numeric strings', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts?patientId=${PATIENT_ID}`);
    const body = await res.json() as any;
    const newest = body.data.find((c: any) => c.id === CHART_NEW);
    expect(typeof newest.summaryBopPercent).toBe('number');
    expect(typeof newest.summaryMeanDepth).toBe('number');
    expect(newest.summaryBopPercent).toBe(18);
    expect(newest.summaryMeanDepth).toBe(2.8);
  });

  test('includes per-chart readings (with computed CAL)', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts?patientId=${PATIENT_ID}`);
    const body = await res.json() as any;
    const newest = body.data.find((c: any) => c.id === CHART_NEW);
    expect(Array.isArray(newest.readings)).toBe(true);
    const r16 = newest.readings.find((r: any) => r.toothNumber === 16);
    expect(r16).toBeTruthy();
    expect(r16.calBM).toBe(4); // CAL = PD(3) + GM(1)
  });

  test('returns empty data for a patient with no charts', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/perio-charts?patientId=${PATIENT2_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toEqual([]);
  });

  test('returns 401 when unauthenticated', async () => {
    const app = buildApp(undefined);
    const res = await app.request(`/dental/perio-charts?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(401);
  });

  test('returns 403 for a non-member user', async () => {
    const app = buildApp(GHOST_USER);
    const res = await app.request(`/dental/perio-charts?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(403);
  });
});
