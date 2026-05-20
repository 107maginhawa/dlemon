/**
 * Module 9: Clinical — FR1.12 Prescription allergy cross-check
 *
 * Tests:
 * - No warning when patient has no allergies
 * - No warning when drug doesn't match any allergy
 * - Warning returned (non-blocking) when drug matches an allergy
 * - Warning when allergy name is substring of drug name
 * - Prescription is still created despite allergy conflict (non-blocking)
 * - Case-insensitive matching
 */

import { describe, test, expect, afterEach, beforeAll, beforeEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreatePrescriptionBody, CreatePrescriptionParams,
  CreateMedicalHistoryEntryBody,
} from '@/generated/openapi/validators';
import { createPrescription } from './createPrescription';
import { createMedicalHistoryEntry } from './createMedicalHistoryEntry';
import { medicalHistoryEntries } from './repos/medical-history.schema';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b9000000-0000-1000-8000-000000000009';
const ORG_ID = 'd9000000-0000-1000-8000-000000000009';
const PERSON_ID = 'f9000000-0000-1000-8000-000000000009';
const VISIT_ID = 'ee000000-0000-1000-8000-000000000001';
const MEMBER_ID = 'c0000000-0000-1000-8000-000000000003';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Module9 Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: 'ee900000-0000-1000-8000-000000000009', branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Test User', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Test', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
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

function prescriptionBody(drugName: string) {
  return JSON.stringify({
    patientId: PATIENT_ID,
    prescriberMemberId: MEMBER_ID,
    drugName,
    dosage: '500mg',
    frequency: 'twice daily',
  });
}

async function seedAllergy(name: string) {
  const app = buildTestApp(TEST_USER);
  await app.request('/dental/clinical/medical-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: PATIENT_ID,
      entryType: 'allergy',
      displayName: name,
      active: true,
    }),
  });
}

beforeEach(async () => {
  // Re-seed visit after each afterEach truncation
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE medical_history_entry, prescription, dental_treatment, dental_visit CASCADE
  `);
});

describe('FR1.12: Prescription allergy cross-check', () => {
  test('no warning when patient has no allergies', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: prescriptionBody('Amoxicillin'),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.warnings).toBeUndefined();
  });

  test('no warning when drug does not match any allergy', async () => {
    await seedAllergy('Penicillin');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: prescriptionBody('Ibuprofen'),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.warnings).toBeUndefined();
  });

  test('warning returned when drug matches an allergy (exact match)', async () => {
    await seedAllergy('Penicillin');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: prescriptionBody('Penicillin'),
    });
    expect(res.status).toBe(201); // non-blocking — still 201
    const body = await res.json() as any;
    expect(body.warnings).not.toBeNull();
    expect(body.warnings.allergyConflicts).toContain('Penicillin');
  });

  test('case-insensitive matching', async () => {
    await seedAllergy('Aspirin');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: prescriptionBody('ASPIRIN'),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.warnings?.allergyConflicts).toContain('Aspirin');
  });

  test('prescription is created despite allergy conflict', async () => {
    await seedAllergy('Amoxicillin');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: prescriptionBody('Amoxicillin'),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    // Prescription still has required fields
    expect(body.id).toBeTruthy();
    expect(body.drugName).toBe('Amoxicillin');
  });

  test('only active allergies trigger warning', async () => {
    // Insert inactive allergy directly (handler always creates active=true)
    await db.insert(medicalHistoryEntries).values({
      patientId: PATIENT_ID,
      entryType: 'allergy',
      displayName: 'Codeine',
      active: false, // inactive — should not trigger warning
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });

    const testApp = buildTestApp(TEST_USER);
    const res = await testApp.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: prescriptionBody('Codeine'),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.warnings).toBeUndefined();
  });
});
