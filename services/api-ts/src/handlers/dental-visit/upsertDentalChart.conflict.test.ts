/**
 * upsertDentalChart.conflict.test.ts — SL-12 / F-G04 (P2 data-loss)
 *
 * SL-02 made the patient-baseline merge clock-aware: a stale offline tooth (lower
 * clock) is rejected so it can't clobber a newer one. But the rejected write was
 * SILENTLY DROPPED — the conflictPayload column was orphaned (never written/read),
 * so a losing offline edit vanished with no durable record (F-G04).
 *
 * SL-12: when the baseline merge rejects a stale tooth, persist it. The chart row
 * (dental_chart carries syncableEntityFields) is flagged syncStatus='conflict' and
 * its conflictPayload records the rejected teeth — a durable conflict record a
 * future UI can surface. A clean write leaves syncStatus untouched ('synced').
 *
 * RED-proof: a stale write leaves the chart syncStatus='synced' / conflictPayload
 * null before the fix.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { upsertDentalChart } from './chart/upsertDentalChart';
import { DentalChartBaselineRepository } from './repos/dental-chart-baseline.repo';
import { UpsertDentalChartBody, UpsertDentalChartParams } from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 107.
const USER = { id: '00000000-0000-4000-8000-000000107001', email: 'owner@conflict.com' };
const ORG = 'ea000000-0000-4000-8000-000000107001';
const BRANCH = 'ba000000-0000-4000-8000-000000107001';
const MEMBER = 'ca000000-0000-4000-8000-000000107001';
const PERSON = 'fa000000-0000-4000-8000-000000107001';
const PATIENT = 'aa000000-0000-4000-8000-000000107001';
const VISIT = 'da000000-0000-4000-8000-000000107001';
const PRIOR_VISIT = 'da000000-0000-4000-8000-000000107009';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('./repos/visit.schema');
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'Conflict Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'Conflict', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT, patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER, status: 'active', chiefComplaint: 'Checkup', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_chart WHERE visit_id = ${VISIT}`);
  await db.execute(sql`DELETE FROM dental_patient_chart_baseline WHERE patient_id = ${PATIENT}`);
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

async function upsertChart(teeth: Array<Record<string, unknown>>) {
  return buildApp().request(`/dental/visits/${VISIT}/chart`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitId: VISIT, patientId: PATIENT, teeth }),
  });
}

describe('SL-12 / F-G04 — a rejected stale write is persisted as a chart sync conflict', () => {
  test('a stale tooth (loses the baseline clock) flags the chart syncStatus=conflict + records conflictPayload', async () => {
    // Baseline already has tooth #14 = crown at clock 10 (a newer edit).
    const baselineRepo = new DentalChartBaselineRepository(db);
    await baselineRepo.mergeVisitChart(PATIENT, PRIOR_VISIT, [{ toothNumber: 14, state: 'crown', clock: 10 }], USER.id);

    // This visit syncs a STALE tooth #14 (clock 3) — it loses the baseline merge.
    const res = await upsertChart([{ toothNumber: 14, state: 'caries', clock: 3 }]);
    expect(res.status).toBe(201);
    const chart = await res.json() as { id: string; syncStatus: string; conflictPayload: any };

    expect(chart.syncStatus).toBe('conflict');                       // RED before: 'synced'
    expect(chart.conflictPayload).toBeTruthy();                      // RED before: null
    const rejected = chart.conflictPayload?.rejectedTeeth as Array<{ toothNumber: number }> | undefined;
    expect(rejected?.some(t => t.toothNumber === 14)).toBe(true);
  });

  test('a clean (non-conflicting) write leaves syncStatus synced', async () => {
    const res = await upsertChart([{ toothNumber: 21, state: 'caries', clock: 5 }]);
    expect(res.status).toBe(201);
    const chart = await res.json() as { syncStatus: string; conflictPayload: any };
    expect(chart.syncStatus).toBe('synced');
    expect(chart.conflictPayload == null).toBe(true);
  });
});
