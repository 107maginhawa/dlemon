/**
 * dental-finding.test.ts — P0-C condition-vocabulary findings + finding→treatment
 *
 * `state` stays the visual odontogram layer; a curated findings vocabulary lets
 * common diagnoses be recorded as structured findings (tooth- or surface-level),
 * resolved (so they stop rendering as active), and converted into a treatment.
 */
import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { createDentalFinding } from './createDentalFinding';
import { listDentalFindings } from './listDentalFindings';
import { updateDentalFinding } from './updateDentalFinding';
import { convertFindingToTreatment } from './convertFindingToTreatment';
import {
  CreateDentalFindingBody, CreateDentalFindingParams,
  ListDentalFindingsParams,
  UpdateDentalFindingBody, UpdateDentalFindingParams,
  ConvertFindingToTreatmentBody, ConvertFindingToTreatmentParams,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 109.
const USER = { id: '00000000-0000-4000-8000-000000109001', email: 'owner@finding.com' };
const ORG = 'ea000000-0000-4000-8000-000000109001';
const BRANCH = 'ba000000-0000-4000-8000-000000109001';
const MEMBER = 'ca000000-0000-4000-8000-000000109001';
const PERSON = 'fa000000-0000-4000-8000-000000109001';
const PATIENT = 'aa000000-0000-4000-8000-000000109001';
const VISIT = 'da000000-0000-4000-8000-000000109001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('./repos/visit.schema');
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'Finding Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'Finding', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT, patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER, status: 'active', chiefComplaint: 'Checkup', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_finding WHERE visit_id = ${VISIT}`);
  await db.execute(sql`DELETE FROM dental_treatment WHERE visit_id = ${VISIT}`);
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
  app.post('/dental/visits/:visitId/findings',
    zValidator('param', CreateDentalFindingParams, ve), zValidator('json', CreateDentalFindingBody, ve), createDentalFinding as any);
  app.get('/dental/visits/:visitId/findings',
    zValidator('param', ListDentalFindingsParams, ve), listDentalFindings as any);
  app.patch('/dental/visits/:visitId/findings/:findingId',
    zValidator('param', UpdateDentalFindingParams, ve), zValidator('json', UpdateDentalFindingBody, ve), updateDentalFinding as any);
  app.post('/dental/visits/:visitId/findings/:findingId/treatment',
    zValidator('param', ConvertFindingToTreatmentParams, ve), zValidator('json', ConvertFindingToTreatmentBody, ve), convertFindingToTreatment as any);
  return app;
}

const post = (path: string, body: unknown) => buildApp().request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (path: string, body: unknown) => buildApp().request(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const get = (path: string) => buildApp().request(path);

describe('P0-C — createFinding', () => {
  test('records a structured tooth/surface finding from the curated vocabulary', async () => {
    const res = await post(`/dental/visits/${VISIT}/findings`, { toothNumber: 16, surface: 'occlusal', conditionCode: 'caries' });
    expect(res.status).toBe(201);
    const f = await res.json() as { id: string; toothNumber: number; surface: string; conditionCode: string; status: string };
    expect(f.toothNumber).toBe(16);
    expect(f.surface).toBe('occlusal');
    expect(f.conditionCode).toBe('caries');
    expect(f.status).toBe('active');
  });

  test("conditionCode 'other' requires a note (400 without one)", async () => {
    const res = await post(`/dental/visits/${VISIT}/findings`, { toothNumber: 21, conditionCode: 'other' });
    expect(res.status).toBe(400);
  });

  test("conditionCode 'other' with a note is accepted", async () => {
    const res = await post(`/dental/visits/${VISIT}/findings`, { toothNumber: 21, conditionCode: 'other', note: 'Enamel pearl, distolingual' });
    expect(res.status).toBe(201);
    expect((await res.json() as { note: string }).note).toBe('Enamel pearl, distolingual');
  });
});

describe('P0-C — listFindings', () => {
  test('returns the visit findings', async () => {
    await post(`/dental/visits/${VISIT}/findings`, { toothNumber: 16, conditionCode: 'caries' });
    await post(`/dental/visits/${VISIT}/findings`, { toothNumber: 36, conditionCode: 'calculus' });
    const res = await get(`/dental/visits/${VISIT}/findings`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ conditionCode: string }> };
    expect(body.data.length).toBe(2);
    expect(body.data.map(f => f.conditionCode).sort()).toEqual(['calculus', 'caries']);
  });
});

describe('P0-C — updateFinding (resolve / edit)', () => {
  test('resolving a finding sets status=resolved (so it stops rendering as active)', async () => {
    const created = await (await post(`/dental/visits/${VISIT}/findings`, { toothNumber: 46, conditionCode: 'sensitive_dentin' })).json() as { id: string };
    const res = await patch(`/dental/visits/${VISIT}/findings/${created.id}`, { status: 'resolved' });
    expect(res.status).toBe(200);
    expect((await res.json() as { status: string }).status).toBe('resolved');
  });

  test("the 'other'-needs-note rule is enforced on UPDATE too (changing code to 'other' without a note → 400)", async () => {
    const created = await (await post(`/dental/visits/${VISIT}/findings`, { toothNumber: 37, conditionCode: 'caries' })).json() as { id: string };
    const res = await patch(`/dental/visits/${VISIT}/findings/${created.id}`, { conditionCode: 'other' });
    expect(res.status).toBe(400);
  });

  test("updating code to 'other' WITH a note is accepted", async () => {
    const created = await (await post(`/dental/visits/${VISIT}/findings`, { toothNumber: 38, conditionCode: 'caries' })).json() as { id: string };
    const res = await patch(`/dental/visits/${VISIT}/findings/${created.id}`, { conditionCode: 'other', note: 'Atypical lesion' });
    expect(res.status).toBe(200);
    const f = await res.json() as { conditionCode: string; note: string };
    expect(f.conditionCode).toBe('other');
    expect(f.note).toBe('Atypical lesion');
  });
});

describe('P0-C — convertFindingToTreatment', () => {
  test('creates a treatment carrying the finding tooth/surface and links them', async () => {
    const finding = await (await post(`/dental/visits/${VISIT}/findings`, { toothNumber: 26, surface: 'mesial', conditionCode: 'caries' })).json() as { id: string };

    const res = await post(`/dental/visits/${VISIT}/findings/${finding.id}/treatment`, {
      cdtCode: 'D2391', description: 'Resin composite — one surface', priceCents: 15000,
    });
    expect(res.status).toBe(201);
    const treatment = await res.json() as { id: string; toothNumber: number; surfaces: string[]; cdtCode: string; status: string };
    expect(treatment.toothNumber).toBe(26);
    expect(treatment.surfaces).toContain('mesial');
    expect(treatment.cdtCode).toBe('D2391');
    expect(treatment.status).toBe('diagnosed');

    // the finding now links to the created treatment
    const list = await (await get(`/dental/visits/${VISIT}/findings`)).json() as { data: Array<{ id: string; linkedTreatmentId: string | null }> };
    const linked = list.data.find(f => f.id === finding.id);
    expect(linked?.linkedTreatmentId).toBe(treatment.id);
  });
});
