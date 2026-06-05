/**
 * createMedicalHistoryEntry.test.ts — safety-floor regression
 *
 * Medical-history entries are immutable, so an entry recorded with a
 * `resolvedDate` is, by definition, already resolved and must NOT surface as an
 * active safety-floor alert. The handler derives `active = !resolvedDate` at
 * creation time. Previously `active` defaulted to true even when a resolution
 * date was supplied, so an already-resolved condition lit up the safety floor.
 *
 * Revert the fix (drop `active: !body.resolvedDate`) → an entry created with a
 * resolvedDate comes back `active: true` → the first test fails.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { CreateMedicalHistoryEntryBody } from '@/generated/openapi/validators';
import { createMedicalHistoryEntry } from './createMedicalHistoryEntry';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-0000000000d1', email: 'mh@clinic.com' };
const PERSON_ID = 'f9000000-0000-1000-8000-0000000000d1';
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000000d1';
const BRANCH_ID = 'b9000000-0000-1000-8000-0000000000d1';
const ORG_ID = 'd9000000-0000-1000-8000-0000000000d1';
const MEMBER_ID = 'c0000000-0000-1000-8000-0000000000d1';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'MH Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'MH Dentist', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'MH', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

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
  app.post('/dental/clinical/medical-history',
    zValidator('json', CreateMedicalHistoryEntryBody, ve),
    createMedicalHistoryEntry as any,
  );
  return app;
}

async function post(body: Record<string, unknown>) {
  return buildTestApp(TEST_USER).request('/dental/clinical/medical-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('createMedicalHistoryEntry — safety-floor active derivation', () => {
  test('an entry recorded WITH a resolvedDate is created inactive (active=false)', async () => {
    const res = await post({
      patientId: PATIENT_ID,
      entryType: 'condition',
      displayName: 'Resolved hypertension',
      resolvedDate: '2021-06-01',
    });
    expect(res.status).toBe(201);
    const entry = await res.json() as any;
    expect(entry.resolvedDate).toBe('2021-06-01');
    // CRITICAL: already-resolved entry must NOT light up the active safety floor.
    expect(entry.active).toBe(false);
  });

  test('an entry recorded WITHOUT a resolvedDate is created active (active=true)', async () => {
    const res = await post({
      patientId: PATIENT_ID,
      entryType: 'allergy',
      displayName: 'Penicillin allergy',
    });
    expect(res.status).toBe(201);
    const entry = await res.json() as any;
    expect(entry.active).toBe(true);
  });
});
