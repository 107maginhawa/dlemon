/**
 * P2-18 — whole-patient continuity-of-care export
 *
 * GET /dental/pmd/patient/:patientId/care-record
 *   - Returns a FHIR R4 document Bundle as a downloadable attachment
 *   - Aggregates ALL of a patient's (non-superseded) per-visit PMD snapshots
 *   - Includes Patient demographics + per-visit Encounter/Procedure/Condition/Medication
 *   - 404 for unknown patient
 *   - 401 without auth
 *   - 403 for staff at a different branch
 *   - Patient may export their own record (self-download)
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { GeneratePMDBody, GeneratePMDParams, ExportPatientCareRecordParams } from '@/generated/openapi/validators';
import { AppError } from '@/core/errors';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { generatePMD } from './generatePMD';
import { exportPatientCareRecord } from './exportPatientCareRecord';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-0000000000a1', email: 'ccd@clinic.com' };
const OTHER_USER = { id: '00000000-0000-0000-0000-0000000000a2', email: 'other@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000000c1';
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000c2';
const OTHER_BRANCH_ID = 'b0000000-0000-1000-8000-0000000000c9';
const DENTIST_MEMBER_ID = 'c0000000-0000-1000-8000-0000000000c3';
const ORG_ID = 'ee000000-0000-1000-8000-0000000000c1';
const PERSON_ID = 'f2000000-0000-1000-8000-0000000000c1';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-0000000000c9';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'CCD Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'CCD Main', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: OTHER_BRANCH_ID, organizationId: ORG_ID, name: 'CCD Other', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: DENTIST_MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Dr. CCD', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Jane', lastName: 'Doe', dateOfBirth: '1990-04-01', gender: 'female', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) { ctx.set('user', user); ctx.set('session', { id: 'test-session' }); }
    await next();
  });
  const ve = (r: any, c: any) => { if (!r.success) return c.json({ error: r.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400); };
  const GeneratePMDBodyOnly = GeneratePMDBody.omit({ visitId: true });
  app.post('/dental/visits/:visitId/pmd', zValidator('param', GeneratePMDParams, ve), zValidator('json', GeneratePMDBodyOnly, ve), generatePMD as any);
  app.get('/dental/pmd/patient/:patientId/care-record', zValidator('param', ExportPatientCareRecordParams, ve), exportPatientCareRecord as any);
  return app;
}

async function seedCompletedVisitWithPMD(app: ReturnType<typeof buildTestApp>) {
  const repo = new VisitRepository(db);
  const visit = await repo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID });
  await repo.complete(visit.id);
  await app.request(`/dental/visits/${visit.id}/pmd`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId: PATIENT_ID }),
  });
  return visit;
}

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE pmd_document, imported_pmd, dental_treatment, dental_visit CASCADE`);
});

describe('GET /dental/pmd/patient/:patientId/care-record (P2-18)', () => {
  test('returns a FHIR R4 document Bundle as a downloadable attachment', async () => {
    const app = buildTestApp(TEST_USER);
    await seedCompletedVisitWithPMD(app);

    const res = await app.request(`/dental/pmd/patient/${PATIENT_ID}/care-record`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/application\/fhir\+json/);
    expect(res.headers.get('Content-Disposition')).toMatch(/attachment/);
    expect(res.headers.get('Content-Disposition')).toMatch(/\.json/);

    const bundle = JSON.parse(await res.text());
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('document');
    const types = bundle.entry.map((e: any) => e.resource.resourceType);
    expect(types[0]).toBe('Composition');
    expect(types).toContain('Patient');
    const patientRes = bundle.entry.find((e: any) => e.resource.resourceType === 'Patient').resource;
    expect(patientRes.name[0].family).toBe('Doe');
  });

  test('aggregates multiple visits into one bundle', async () => {
    const app = buildTestApp(TEST_USER);
    await seedCompletedVisitWithPMD(app);
    await seedCompletedVisitWithPMD(app);

    const res = await app.request(`/dental/pmd/patient/${PATIENT_ID}/care-record`);
    expect(res.status).toBe(200);
    const bundle = JSON.parse(await res.text());
    const encounters = bundle.entry.filter((e: any) => e.resource.resourceType === 'Encounter');
    expect(encounters.length).toBe(2);
    const comp = bundle.entry[0].resource;
    expect(comp.extension[0].extension.length).toBe(2);
  });

  test('empty record (no PMDs) still returns a valid document', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/pmd/patient/${PATIENT_ID}/care-record`);
    expect(res.status).toBe(200);
    const bundle = JSON.parse(await res.text());
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.entry.map((e: any) => e.resource.resourceType)).toEqual(['Composition', 'Patient']);
  });

  test('404 for unknown patient', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/pmd/patient/${NONEXISTENT_ID}/care-record`);
    expect(res.status).toBe(404);
  });

  test('401 without auth', async () => {
    const app = buildTestApp();
    const res = await app.request(`/dental/pmd/patient/${PATIENT_ID}/care-record`);
    expect(res.status).toBe(401);
  });

  test('403 for staff at a different branch', async () => {
    // OTHER_USER has no membership at the patient's preferred branch.
    const app = buildTestApp(OTHER_USER);
    const res = await app.request(`/dental/pmd/patient/${PATIENT_ID}/care-record`);
    expect(res.status).toBe(403);
  });

  test('patient may export their own record (self-download)', async () => {
    // The patient's linked person is PERSON_ID; authenticate as that person.
    const app = buildTestApp({ id: PERSON_ID, email: 'jane@patient.com' });
    const res = await app.request(`/dental/pmd/patient/${PATIENT_ID}/care-record`);
    expect(res.status).toBe(200);
    const bundle = JSON.parse(await res.text());
    expect(bundle.resourceType).toBe('Bundle');
  });
});
