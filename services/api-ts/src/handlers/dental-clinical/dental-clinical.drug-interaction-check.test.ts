/**
 * P1-2: Drug-drug interaction check
 *
 * Tests verify that createPrescription returns warnings.drugInteractions
 * when the prescribed drug is known to interact with an active medication
 * in the patient's medical history.
 *
 * NOTE: The interaction table is a curated reference (not a full drug DB).
 * See drug-interactions.ts for scope/limitation comments.
 */

import { describe, test, expect, afterEach, beforeAll, beforeEach } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreatePrescriptionBody, CreatePrescriptionParams,
  CreateMedicalHistoryEntryBody,
} from '@/generated/openapi/validators';
import { createPrescription } from './prescriptions/createPrescription';
import { createMedicalHistoryEntry } from './medical-history/createMedicalHistoryEntry';
import { medicalHistoryEntries } from './repos/medical-history.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000021', email: 'ddi@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000021';
const BRANCH_ID = 'b9000000-0000-1000-8000-000000000021';
const ORG_ID = 'd9000000-0000-1000-8000-000000000021';
const PERSON_ID = 'f9000000-0000-1000-8000-000000000021';
const VISIT_ID = 'ee000000-0000-1000-8000-000000000021';
const MEMBER_ID = 'c0000000-0000-1000-8000-000000000023';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');

  await db.execute(sql`DELETE FROM dental_visit WHERE id = ${VISIT_ID}`);
  await db.delete(dentalMemberships).where(
    and(eq(dentalMemberships.personId, TEST_USER.id), eq(dentalMemberships.branchId, BRANCH_ID))
  );

  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'DDI Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'DDI Dentist', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'DDI', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const PrescriptionBodyOnly = CreatePrescriptionBody.omit({ visitId: true });

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
    if (user) ctx.set('user', user);
    await next();
  });
  app.post('/dental/visits/:visitId/prescriptions',
    zValidator('param', CreatePrescriptionParams, ve),
    zValidator('json', PrescriptionBodyOnly, ve),
    createPrescription as any,
  );
  app.post('/dental/clinical/medical-history',
    zValidator('json', CreateMedicalHistoryEntryBody, ve),
    createMedicalHistoryEntry as any,
  );
  return app;
}

async function seedMedication(name: string) {
  await db.insert(medicalHistoryEntries).values({
    patientId: PATIENT_ID,
    entryType: 'medication',
    displayName: name,
    active: true,
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  });
}

function prescriptionBody(drugName: string) {
  return JSON.stringify({
    patientId: PATIENT_ID,
    prescriberMemberId: MEMBER_ID,
    drugName,
    dosage: '500mg',
    frequency: 'twice daily',
  });
}

beforeEach(async () => {
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE medical_history_entry, prescription, dental_treatment, dental_visit CASCADE
  `);
});

describe('P1-2: Drug-drug interaction check', () => {
  test('no drugInteractions warning when patient has no medications', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: prescriptionBody('Warfarin'),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.warnings?.drugInteractions).toBeUndefined();
  });

  test('no drugInteractions warning when no known interaction exists', async () => {
    await seedMedication('Vitamin C');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: prescriptionBody('Amoxicillin'),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.warnings?.drugInteractions).toBeUndefined();
  });

  test('drugInteractions warning when Warfarin + Aspirin interaction is known', async () => {
    await seedMedication('Warfarin');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: prescriptionBody('Aspirin'),
    });
    expect(res.status).toBe(201); // non-blocking — still 201
    const body = await res.json() as any;
    expect(body.warnings?.drugInteractions).toBeDefined();
    expect(body.warnings.drugInteractions.length).toBeGreaterThan(0);
    const interaction = body.warnings.drugInteractions[0];
    expect(interaction.interactingDrug).toBeTruthy();
    expect(interaction.severity).toBeTruthy();
    expect(interaction.description).toBeTruthy();
  });

  test('drugInteractions warning is case-insensitive', async () => {
    await seedMedication('warfarin'); // lowercase in DB
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: prescriptionBody('ASPIRIN'),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.warnings?.drugInteractions).toBeDefined();
    expect(body.warnings.drugInteractions.length).toBeGreaterThan(0);
  });

  test('prescription is still created despite drug interaction (non-blocking)', async () => {
    await seedMedication('Warfarin');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: prescriptionBody('Aspirin'),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.drugName).toBe('Aspirin');
  });

  test('only active medications trigger interaction check', async () => {
    await db.insert(medicalHistoryEntries).values({
      patientId: PATIENT_ID,
      entryType: 'medication',
      displayName: 'Warfarin',
      active: false, // inactive — should not trigger interaction
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: prescriptionBody('Aspirin'),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.warnings?.drugInteractions).toBeUndefined();
  });

  test('Metronidazole + Warfarin interaction detected', async () => {
    await seedMedication('Warfarin');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: prescriptionBody('Metronidazole'),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.warnings?.drugInteractions).toBeDefined();
    expect(body.warnings.drugInteractions.length).toBeGreaterThan(0);
  });

  test('both allergyConflicts and drugInteractions can be present simultaneously', async () => {
    // Seed both an allergy to Aspirin AND Warfarin as a medication
    await db.insert(medicalHistoryEntries).values([
      {
        patientId: PATIENT_ID,
        entryType: 'allergy',
        displayName: 'Aspirin',
        active: true,
        createdBy: TEST_USER.id,
        updatedBy: TEST_USER.id,
      },
      {
        patientId: PATIENT_ID,
        entryType: 'medication',
        displayName: 'Warfarin',
        active: true,
        createdBy: TEST_USER.id,
        updatedBy: TEST_USER.id,
      },
    ]);
    const app = buildTestApp(TEST_USER);
    // Prescribing Aspirin: allergy conflict (Aspirin allergy) + drug interaction (Warfarin)
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: prescriptionBody('Aspirin'),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.warnings?.allergyConflicts).toBeDefined();
    expect(body.warnings?.drugInteractions).toBeDefined();
  });
});
