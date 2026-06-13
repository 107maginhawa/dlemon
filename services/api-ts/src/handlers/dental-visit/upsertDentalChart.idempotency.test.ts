/**
 * upsertDentalChart.idempotency.test.ts — SL-01 / B-G3 (chart installment)
 *
 * The chart is keyed on visitId (one chart per visit), so a replay never inserts a
 * duplicate ROW. But `localId` (the client-generated, offline-stable id of the
 * create op) was not an idempotency key: a retried offline create (same localId,
 * dropped ACK) re-ran saveVersion, appending a REDUNDANT version snapshot (and
 * re-merging the baseline). Mirrors the visit/treatment/invoice installments: a
 * create carrying a previously-seen localId MUST short-circuit to the existing row.
 *
 * Chart localId is set once on first insert and scoped to the visit, so dedup is on
 * (visitId, localId) and only catches a replay of THAT create op — a distinct edit
 * op (different localId) still applies normally (no edit-drop).
 *
 * RED-proof: a second POST with the same localId appends a 2nd version snapshot
 * before the fix; exactly one snapshot exists after.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { upsertDentalChart } from './chart/upsertDentalChart';
import { UpsertDentalChartBody, UpsertDentalChartParams } from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 104.
const USER = { id: '00000000-0000-4000-8000-000000104001', email: 'owner@idemch.com' };
const ORG = 'ea000000-0000-4000-8000-000000104001';
const BRANCH = 'ba000000-0000-4000-8000-000000104001';
const MEMBER = 'ca000000-0000-4000-8000-000000104001';
const PERSON = 'fa000000-0000-4000-8000-000000104001';
const PATIENT = 'aa000000-0000-4000-8000-000000104001';
const VISIT = 'da000000-0000-4000-8000-000000104001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('./repos/visit.schema');
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'IdemCh Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'IdemCh', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT, patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER, status: 'active', chiefComplaint: 'Checkup', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  // dental_chart_version cascades from dental_chart (onDelete: cascade).
  await db.execute(sql`DELETE FROM dental_chart WHERE visit_id = ${VISIT}`);
});

const ve = (r: any, c: any) => { if (!r.success) return c.json({ error: 'Validation failed', issues: r.error.issues }, 400); };

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    ctx.set('user', USER);
    ctx.set('session', { id: 'sess', userId: USER.id });
    await next();
  });
  app.post('/dental/visits/:visitId/chart',
    zValidator('param', UpsertDentalChartParams, ve),
    zValidator('json', UpsertDentalChartBody, ve),
    upsertDentalChart as any);
  return app;
}

async function upsertChart(localId?: string) {
  const body: Record<string, unknown> = { visitId: VISIT, patientId: PATIENT, teeth: [{ toothNumber: 14, state: 'caries' }] };
  if (localId !== undefined) body['localId'] = localId;
  return buildApp().request(`/dental/visits/${VISIT}/chart`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

async function countVersions(chartId: string): Promise<number> {
  const rows = await db.execute(sql`SELECT count(*)::int AS n FROM dental_chart_version WHERE chart_id = ${chartId}`);
  return ((rows as unknown as { rows?: Array<{ n: number }> }).rows?.[0]?.n) ?? (rows as unknown as Array<{ n: number }>)[0]?.n ?? 0;
}

async function countCharts(): Promise<number> {
  const rows = await db.execute(sql`SELECT count(*)::int AS n FROM dental_chart WHERE visit_id = ${VISIT}`);
  return ((rows as unknown as { rows?: Array<{ n: number }> }).rows?.[0]?.n) ?? (rows as unknown as Array<{ n: number }>)[0]?.n ?? 0;
}

describe('SL-01 / B-G3 — upsertDentalChart is idempotent on a replayed localId', () => {
  test('a retried create with the same localId does NOT append a second version snapshot', async () => {
    const localId = 'local-chart-aaaa-1111';

    const first = await upsertChart(localId);
    expect(first.status).toBe(201);
    const c1 = await first.json() as { id: string };

    const second = await upsertChart(localId);
    expect([200, 201]).toContain(second.status);
    const c2 = await second.json() as { id: string };

    expect(c2.id).toBe(c1.id);              // same chart row (one-per-visit)
    expect(await countCharts()).toBe(1);
    expect(await countVersions(c1.id)).toBe(1); // RED before: 2 snapshots
  });

  test('a distinct edit op (different localId) still applies — appends a version', async () => {
    const first = await upsertChart('local-chart-bbbb-1');
    expect(first.status).toBe(201);
    const c1 = await first.json() as { id: string };

    const second = await upsertChart('local-chart-bbbb-2');
    expect(second.status).toBe(201);
    expect(await countVersions(c1.id)).toBe(2); // edit op is NOT deduped
  });

  test('no-localId upserts always apply (each appends a version)', async () => {
    const first = await upsertChart(undefined);
    expect(first.status).toBe(201);
    const c1 = await first.json() as { id: string };
    const second = await upsertChart(undefined);
    expect(second.status).toBe(201);
    expect(await countVersions(c1.id)).toBe(2);
  });
});
