/**
 * FIX-003 / decision #20 — append-only safety-floor merge.
 *
 * An imported PMD's safety-critical items (conditions / medications / allergies)
 * must be surfaced into the patient's living medical history as APPEND-ONLY
 * entries so they actually appear in the clinical Safety Floor. The imported PMD
 * row itself is never mutated (BR-022); the merge is recorded as an append-only
 * event and is idempotent (second merge → 409 SAFETY_FLOOR_ALREADY_MERGED).
 *
 * Run via: DATABASE_URL=...monobase_test bun scripts/test-with-db.ts <thisfile>
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import {
  ImportPMDBody,
  MergeImportedPMDSafetyFloorParams,
  GetDentalPatientSafetyFloorParams,
} from '@/generated/openapi/validators';
import { AppError } from '@/core/errors';
import { importPMD } from './importPMD';
import { mergeImportedPMDSafetyFloor } from './mergeImportedPMDSafetyFloor';
import { getDentalPatientSafetyFloor } from '../dental-patient/identity/getDentalPatientSafetyFloor';
import { MedicalHistoryRepository } from '../dental-clinical/repos/medical-history.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-0000000000a1', email: 'merge@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000000a1';
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000a2';
const DENTIST_MEMBER_ID = 'c0000000-0000-1000-8000-0000000000a3';
const ORG_ID = 'ee000000-0000-1000-8000-0000000000a1';
const PERSON_ID = 'f2000000-0000-1000-8000-0000000000a1';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-0000000000a9';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Merge Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: DENTIST_MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Dr. Merge', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Merge', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as never);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as never as { set: (k: string, v: unknown) => void };
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) { ctx.set('user', user); ctx.set('session', { id: 'test-session' }); }
    await next();
  });
  const ve = (r: { success: boolean; error?: { issues: Array<{ path: (string | number)[]; message: string }> } }, c: { json: (b: unknown, s: number) => Response }): Response | undefined => {
    if (!r.success) return c.json({ error: r.error!.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400);
    return undefined;
  };
  app.post('/dental/pmd/import', zValidator('json', ImportPMDBody, ve as never), importPMD as never);
  app.post('/dental/pmd/imported/:id/merge-safety-floor', zValidator('param', MergeImportedPMDSafetyFloorParams, ve as never), mergeImportedPMDSafetyFloor as never);
  app.get('/dental/patients/:id/safety-floor', zValidator('param', GetDentalPatientSafetyFloorParams, ve as never), getDentalPatientSafetyFloor as never);
  return app;
}

async function importPmd(app: Hono, content: unknown): Promise<string> {
  const res = await app.request('/dental/pmd/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: PATIENT_ID,
      sourceFacility: 'External Clinic',
      sourceDescription: 'Open Dental v21.1',
      content: typeof content === 'string' ? content : JSON.stringify(content),
    }),
  });
  if (res.status !== 201) throw new Error(`import failed: ${res.status} ${await res.text()}`);
  const body = await res.json() as { id: string };
  return body.id;
}

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE imported_pmd_safety_floor_events, imported_pmd, medical_history_entry CASCADE`);
});

describe('POST /dental/pmd/imported/:id/merge-safety-floor (FIX-003 / decision #20)', () => {
  test('merges imported conditions/medications/allergies into med-history and surfaces them in the Safety Floor', async () => {
    const app = buildTestApp(TEST_USER);
    const importedId = await importPmd(app, {
      conditions: ['Hypertension'],
      medications: ['Amoxicillin'],
      allergies: ['Penicillin'],
    });

    const res = await app.request(`/dental/pmd/imported/${importedId}/merge-safety-floor`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as { importedPmdId: string; safetyFloorMerged: boolean; mergedEntryCount: number };
    expect(body.importedPmdId).toBe(importedId);
    expect(body.safetyFloorMerged).toBe(true);
    expect(body.mergedEntryCount).toBe(3);

    // The imported allergy now protects the patient: it appears in the Safety Floor.
    const floorRes = await app.request(`/dental/patients/${PATIENT_ID}/safety-floor`);
    expect(floorRes.status).toBe(200);
    const floor = await floorRes.json() as {
      hasAlerts: boolean;
      allergies: Array<{ displayName: string }>;
      medications: Array<{ displayName: string }>;
      conditions: Array<{ displayName: string }>;
    };
    expect(floor.hasAlerts).toBe(true);
    expect(floor.allergies.map(a => a.displayName)).toContain('Penicillin');
    expect(floor.medications.map(m => m.displayName)).toContain('Amoxicillin');
    expect(floor.conditions.map(c => c.displayName)).toContain('Hypertension');
  });

  test('is append-only: an existing med-history entry is preserved, imported items added alongside', async () => {
    const app = buildTestApp(TEST_USER);
    // Pre-existing, clinician-entered allergy.
    const mhRepo = new MedicalHistoryRepository(db);
    await mhRepo.createOne({ patientId: PATIENT_ID, entryType: 'allergy', displayName: 'Latex', active: true });

    const importedId = await importPmd(app, { allergies: ['Penicillin'] });
    const res = await app.request(`/dental/pmd/imported/${importedId}/merge-safety-floor`, { method: 'POST' });
    expect(res.status).toBe(200);

    const allergies = (await mhRepo.findMany({ patientId: PATIENT_ID, entryType: 'allergy' })).map(e => e.displayName).sort();
    expect(allergies).toEqual(['Latex', 'Penicillin']);
  });

  test('is idempotent: a second merge returns 409 and does not double-insert', async () => {
    const app = buildTestApp(TEST_USER);
    const importedId = await importPmd(app, { allergies: ['Penicillin'] });

    const first = await app.request(`/dental/pmd/imported/${importedId}/merge-safety-floor`, { method: 'POST' });
    expect(first.status).toBe(200);

    const second = await app.request(`/dental/pmd/imported/${importedId}/merge-safety-floor`, { method: 'POST' });
    expect(second.status).toBe(409);
    const body = await second.json() as { code: string };
    expect(body.code).toBe('SAFETY_FLOOR_ALREADY_MERGED');

    const mhRepo = new MedicalHistoryRepository(db);
    const allergies = await mhRepo.findMany({ patientId: PATIENT_ID, entryType: 'allergy' });
    expect(allergies).toHaveLength(1);
  });

  test('a merge with no parseable safety-floor items succeeds as a no-op review (count 0, flag set)', async () => {
    const app = buildTestApp(TEST_USER);
    const importedId = await importPmd(app, { visitDate: '2026-04-01', note: 'no safety data here' });
    const res = await app.request(`/dental/pmd/imported/${importedId}/merge-safety-floor`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as { mergedEntryCount: number; safetyFloorMerged: boolean };
    expect(body.mergedEntryCount).toBe(0);
    expect(body.safetyFloorMerged).toBe(true);
  });

  test('404 for an unknown imported PMD', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/pmd/imported/${NONEXISTENT_ID}/merge-safety-floor`, { method: 'POST' });
    expect(res.status).toBe(404);
  });

  test('401 without auth', async () => {
    const app = buildTestApp();
    const res = await app.request(`/dental/pmd/imported/${NONEXISTENT_ID}/merge-safety-floor`, { method: 'POST' });
    expect(res.status).toBe(401);
  });
});
