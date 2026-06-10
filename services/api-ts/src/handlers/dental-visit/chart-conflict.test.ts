/**
 * chart-conflict.test.ts — P0-A: offline conflict visibility & resolution
 *
 * The server already rejects stale offline chart writes (clock-aware baseline
 * merge) and persists the loser to dental_chart.conflictPayload with
 * syncStatus='conflict' (SL-12 / F-G04). But nothing could READ or RESOLVE
 * them, so dropped clinical edits accumulated invisibly — a data-integrity hole.
 *
 * P0-A adds:
 *   - GET  /dental/visits/chart-conflicts/{patientId}  → list open conflicts
 *   - POST /dental/visits/{visitId}/chart/resolve-conflict → accept | dismiss
 *
 * Integrity rule: 'accept' re-applies the rejected write as a NEW change with a
 * NEW (higher) clock — never mutates history. 'dismiss' requires a reason.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { upsertDentalChart } from './chart/upsertDentalChart';
import { listChartConflicts } from './listChartConflicts';
import { resolveChartConflict } from './resolveChartConflict';
import { DentalChartBaselineRepository } from './repos/dental-chart-baseline.repo';
import type { ToothChartState } from './repos/dental-chart.schema';
import {
  UpsertDentalChartBody, UpsertDentalChartParams,
  ListChartConflictsParams,
  ResolveChartConflictBody, ResolveChartConflictParams,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 108.
const USER = { id: '00000000-0000-4000-8000-000000108001', email: 'owner@conflict-resolve.com' };
const ORG = 'ea000000-0000-4000-8000-000000108001';
const BRANCH = 'ba000000-0000-4000-8000-000000108001';
const MEMBER = 'ca000000-0000-4000-8000-000000108001';
const PERSON = 'fa000000-0000-4000-8000-000000108001';
const PATIENT = 'aa000000-0000-4000-8000-000000108001';
const VISIT = 'da000000-0000-4000-8000-000000108001';
const PRIOR_VISIT = 'da000000-0000-4000-8000-000000108009';
// A dental_assistant may WRITE chart conditions but must NOT adjudicate a conflict.
const ASSISTANT = { id: '00000000-0000-4000-8000-000000108002', email: 'assistant@conflict-resolve.com' };
const ASSISTANT_MEMBER = 'ca000000-0000-4000-8000-000000108002';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('./repos/visit.schema');
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'Resolve Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: ASSISTANT_MEMBER, branchId: BRANCH, personId: ASSISTANT.id, displayName: 'Assistant', role: 'dental_assistant', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'Resolve', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT, patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER, status: 'active', chiefComplaint: 'Checkup', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_chart WHERE visit_id = ${VISIT}`);
  await db.execute(sql`DELETE FROM dental_patient_chart_baseline WHERE patient_id = ${PATIENT}`);
});

const ve = (r: any, c: any) => { if (!r.success) return c.json({ error: 'Validation failed', issues: r.error.issues }, 400); };

function buildApp(actor: { id: string; email: string } = USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    ctx.set('user', actor);
    ctx.set('session', { id: 'sess', userId: actor.id });
    await next();
  });
  app.post('/dental/visits/:visitId/chart',
    zValidator('param', UpsertDentalChartParams, ve),
    zValidator('json', UpsertDentalChartBody, ve),
    upsertDentalChart as any);
  app.get('/dental/visits/chart-conflicts/:patientId',
    zValidator('param', ListChartConflictsParams, ve),
    listChartConflicts as any);
  app.post('/dental/visits/:visitId/chart/resolve-conflict',
    zValidator('param', ResolveChartConflictParams, ve),
    zValidator('json', ResolveChartConflictBody, ve),
    resolveChartConflict as any);
  return app;
}

/** Seed an open conflict: baseline #14 crown@clock10, then sync stale #14 caries@clock3. */
async function seedConflict(): Promise<void> {
  const baselineRepo = new DentalChartBaselineRepository(db);
  await baselineRepo.mergeVisitChart(PATIENT, PRIOR_VISIT, [{ toothNumber: 14, state: 'crown', clock: 10 }], USER.id);
  const res = await buildApp().request(`/dental/visits/${VISIT}/chart`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitId: VISIT, patientId: PATIENT, teeth: [{ toothNumber: 14, state: 'caries', clock: 3 }] }),
  });
  expect(res.status).toBe(201);
  expect((await res.json() as { syncStatus: string }).syncStatus).toBe('conflict');
}

async function listConflicts() {
  return buildApp().request(`/dental/visits/chart-conflicts/${PATIENT}`);
}

async function resolve(body: Record<string, unknown>, actor: { id: string; email: string } = USER) {
  return buildApp(actor).request(`/dental/visits/${VISIT}/chart/resolve-conflict`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function baselineTooth(toothNumber: number): Promise<ToothChartState | undefined> {
  const baseline = await new DentalChartBaselineRepository(db).findByPatient(PATIENT);
  return baseline?.teeth.find(t => t.toothNumber === toothNumber);
}

describe('P0-A — listChartConflicts', () => {
  test('returns the open conflict for a patient with the rejected teeth + metadata', async () => {
    await seedConflict();
    const res = await listConflicts();
    expect(res.status).toBe(200);
    const conflicts = await res.json() as Array<{
      chartId: string; visitId: string; patientId: string; reason: string;
      rejectedTeeth: Array<{ toothNumber: number; state: string }>; detectedAt: string;
    }>;
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]!.visitId).toBe(VISIT);
    expect(conflicts[0]!.patientId).toBe(PATIENT);
    expect(conflicts[0]!.reason).toBe('stale_clock_rejected');
    expect(conflicts[0]!.rejectedTeeth.some(t => t.toothNumber === 14 && t.state === 'caries')).toBe(true);
    expect(conflicts[0]!.detectedAt).toBeTruthy();
  });

  test('returns an empty array when the patient has no conflicts', async () => {
    const res = await listConflicts();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe('P0-A — resolveChartConflict (accept)', () => {
  test('accept re-applies the rejected write to the baseline with a NEW higher clock and clears the conflict', async () => {
    await seedConflict();
    // Before: baseline tooth #14 is the winning crown@clock10.
    expect((await baselineTooth(14))?.state).toBe('crown');

    const res = await resolve({ resolution: 'accept' });
    expect(res.status).toBe(200);
    const chart = await res.json() as { syncStatus: string; conflictPayload: unknown };
    expect(chart.syncStatus).toBe('synced');
    expect(chart.conflictPayload == null).toBe(true);

    // After accept: the offline caries reading becomes truth with a clock > 10 (new change).
    const tooth = await baselineTooth(14);
    expect(tooth?.state).toBe('caries');
    expect(typeof tooth?.clock).toBe('number');
    expect(tooth!.clock!).toBeGreaterThan(10);

    // The conflict is gone from the list.
    expect(await (await listConflicts()).json()).toEqual([]);
  });
});

describe('P0-A — resolveChartConflict (dismiss)', () => {
  test('dismiss without a reason is rejected (400)', async () => {
    await seedConflict();
    const res = await resolve({ resolution: 'dismiss' });
    expect(res.status).toBe(400);
    // The conflict is still open (not cleared by an invalid request).
    expect((await (await listConflicts()).json() as unknown[]).length).toBe(1);
  });

  test('dismiss with a reason keeps the current value and clears the conflict', async () => {
    await seedConflict();
    const res = await resolve({ resolution: 'dismiss', reason: 'Duplicate offline edit; crown is correct.' });
    expect(res.status).toBe(200);
    const chart = await res.json() as { syncStatus: string };
    expect(chart.syncStatus).toBe('synced');

    // Current (crown) is unchanged — the stale caries write was discarded.
    expect((await baselineTooth(14))?.state).toBe('crown');
    expect(await (await listConflicts()).json()).toEqual([]);
  });
});

describe('P0-A — resolveChartConflict (guards)', () => {
  test('a dismiss reason shorter than 5 chars is rejected (400)', async () => {
    await seedConflict();
    const res = await resolve({ resolution: 'dismiss', reason: 'no' });
    expect(res.status).toBe(400);
    // still open — an invalid request never clears the conflict
    expect((await (await listConflicts()).json() as unknown[]).length).toBe(1);
  });

  test('a dental_assistant may not resolve a conflict (403) — clinical judgment only', async () => {
    await seedConflict();
    const res = await resolve({ resolution: 'accept' }, ASSISTANT);
    expect(res.status).toBe(403);
    // conflict stays open
    expect((await (await listConflicts()).json() as unknown[]).length).toBe(1);
  });

  test('resolving a chart with no open conflict returns 404', async () => {
    // Seed a clean (non-conflicting) chart so the chart row exists but syncStatus='synced'.
    const seed = await buildApp().request(`/dental/visits/${VISIT}/chart`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId: VISIT, patientId: PATIENT, teeth: [{ toothNumber: 21, state: 'caries', clock: 5 }] }),
    });
    expect((await seed.json() as { syncStatus: string }).syncStatus).toBe('synced');

    const res = await resolve({ resolution: 'accept' });
    expect(res.status).toBe(404);
  });
});
