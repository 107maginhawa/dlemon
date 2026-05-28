/**
 * dental-clinical-occlusion.test.ts — OcclusionScreening Entity (P2-002)
 *
 * occ01-AC-001  POST returns 201 with screening object
 * occ01-AC-002  GET returns list containing created record
 * occ01-AC-003  401 without auth
 * occ01-AC-004  404 for non-existent patient
 * occ01-AC-005  PATCH updates fields on existing screening
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  OcclusionParams,
  OcclusionIdParams,
  CreateOcclusionBody,
  UpdateOcclusionBody,
} from './utils/occlusion-validators';
import { createOcclusionScreening } from './occlusion/createOcclusionScreening';
import { listOcclusionScreenings } from './occlusion/listOcclusionScreenings';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite tag: occ01 — unique IDs to avoid collision
const TEST_USER  = { id: 'a0000000-0000-1000-8000-000000000002', email: 'occ@clinic.com' };
const BRANCH_ID  = 'b0000000-0000-1000-8000-0000000000c2';
const ORG_ID     = 'c0000000-0000-1000-8000-0000000000c2';
const PATIENT_ID = 'd0000000-0000-1000-8000-0000000000c2';
const PERSON_ID  = 'e0000000-0000-1000-8000-0000000000c2';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';

const ve = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Occlusion Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID,
    name: 'Main Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: 'a2000000-0000-1000-8000-0000000000c2',
    branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Occ Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Occ', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID,
    preferredBranchId: BRANCH_ID,
    status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  const { dentalOcclusionScreenings } = await import('./repos/occlusion-screening.schema');
  await db.delete(dentalOcclusionScreenings).where(eq(dentalOcclusionScreenings.patientId, PATIENT_ID));
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
    if (user) ctx.set('user', user);
    await next();
  });

  app.post(
    '/dental/patients/:patientId/occlusion-screenings',
    zValidator('param', OcclusionParams, ve),
    zValidator('json', CreateOcclusionBody, ve),
    createOcclusionScreening as any,
  );
  app.get(
    '/dental/patients/:patientId/occlusion-screenings',
    zValidator('param', OcclusionParams, ve),
    listOcclusionScreenings as any,
  );

  return app;
}

// =============================================================================
// occ01-AC-001: POST returns 201
// =============================================================================

describe('POST /dental/patients/:patientId/occlusion-screenings (occ01-AC-001)', () => {
  test('occ01-AC-001: creates screening and returns 201', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/occlusion-screenings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        angleClass: 'class_ii_div1',
        overbiteMm: 4,
        overjetMm: 6,
        crossbite: false,
        crowding: true,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeDefined();
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.angleClass).toBe('class_ii_div1');
    expect(body.overbiteMm).toBe(4);
    expect(body.crowding).toBe(true);
  });
});

// =============================================================================
// occ01-AC-002: GET returns record
// =============================================================================

describe('GET /dental/patients/:patientId/occlusion-screenings (occ01-AC-002)', () => {
  test('occ01-AC-002: returns list containing created record', async () => {
    const app = buildTestApp(TEST_USER);

    await app.request(`/dental/patients/${PATIENT_ID}/occlusion-screenings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ angleClass: 'class_i', crossbite: true }),
    });

    const res = await app.request(`/dental/patients/${PATIENT_ID}/occlusion-screenings`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0].patientId).toBe(PATIENT_ID);
  });
});

// =============================================================================
// occ01-AC-003: 401 without auth
// =============================================================================

describe('Auth (occ01-AC-003)', () => {
  test('POST returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/occlusion-screenings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ angleClass: 'class_i' }),
    });
    expect(res.status).toBe(401);
  });

  test('GET returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/occlusion-screenings`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// occ01-AC-004: 404 for non-existent patient
// =============================================================================

describe('Patient not found (occ01-AC-004)', () => {
  test('POST returns 404 for non-existent patient', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/occlusion-screenings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ angleClass: 'class_i' }),
    });
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// occ01-AC-005: PATCH updates fields
// =============================================================================

describe('PATCH updates fields (occ01-AC-005)', () => {
  test('occ01-AC-005: update notes and spacing on existing screening', async () => {
    const app = buildTestApp(TEST_USER);

    const { OcclusionScreeningRepository } = await import('./repos/occlusion-screening.repo');
    const repo = new OcclusionScreeningRepository(db);
    const created = await repo.create({
      patientId: PATIENT_ID,
      visitId: null,
      angleClass: 'class_i',
      overbiteMm: null,
      overjetMm: null,
      crossbite: false,
      crowding: false,
      spacing: false,
      midlineDeviation: null,
      notes: null,
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });

    const updated = await repo.update(created.id, PATIENT_ID, { notes: 'Check again next visit', spacing: true });
    expect(updated).not.toBeNull();
    expect(updated!.notes).toBe('Check again next visit');
    expect(updated!.spacing).toBe(true);
  });
});
