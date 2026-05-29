/**
 * V-CLI-002: createMedicalHistoryEntry — assertBranchRole([dentist_owner, dentist_associate, staff_full])
 *
 * Per MODULE_SPEC §6, "Add medical history" is allowed for dentist_owner,
 * dentist_associate, and staff_full ONLY. hygienist is NOT in the permission
 * matrix. The prior implementation incorrectly granted hygienist; this suite
 * pins the deny.
 *
 * Tests:
 *   (a) dentist_owner succeeds (201)
 *   (b) staff_full succeeds (201)
 *   (c) hygienist is rejected (403)
 *   (d) unauthenticated is rejected (401)
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { CreateMedicalHistoryEntryBody } from '@/generated/openapi/validators';
import { createMedicalHistoryEntry } from './medical-history/createMedicalHistoryEntry';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// ─── Fixed IDs (namespace: v-cli-002) ───────────────────────────────────────
const ORG_ID     = 'd0000000-0000-1000-8000-0000000c1002';
const BRANCH_ID  = 'b0000000-0000-1000-8000-0000000c1002';
const PERSON_ID  = 'f0000000-0000-1000-8000-0000000c1002';
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000c1002';

const DENTIST_OWNER_USER = { id: '00000000-0000-0000-0000-c10201000000', email: 'owner.c1002@clinic.com' };
const STAFF_FULL_USER    = { id: '00000000-0000-0000-0000-c10203000000', email: 'staff.c1002@clinic.com' };
const HYGIENIST_USER     = { id: '00000000-0000-0000-0000-c10204000000', email: 'hyg.c1002@clinic.com' };

const OWNER_MEMBER_ID     = 'c0000000-0000-1000-8000-c10201000000';
const STAFF_MEMBER_ID     = 'c0000000-0000-1000-8000-c10203000000';
const HYGIENIST_MEMBER_ID = 'c0000000-0000-1000-8000-c10204000000';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons }             = await import('@/handlers/person/repos/person.schema');
  const { patients }            = await import('@/handlers/patient/repos/patient.schema');

  for (const userId of [DENTIST_OWNER_USER.id, STAFF_FULL_USER.id, HYGIENIST_USER.id]) {
    await db.delete(dentalMemberships).where(
      and(eq(dentalMemberships.personId, userId), eq(dentalMemberships.branchId, BRANCH_ID)),
    );
  }

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'V-CLI-002 Clinic', tier: 'solo',
    ownerPersonId: DENTIST_OWNER_USER.id,
    countryCode: 'PH', createdBy: DENTIST_OWNER_USER.id, updatedBy: DENTIST_OWNER_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: DENTIST_OWNER_USER.id, updatedBy: DENTIST_OWNER_USER.id,
  }).onConflictDoNothing();

  const memberValues = [
    { id: OWNER_MEMBER_ID,     personId: DENTIST_OWNER_USER.id, role: 'dentist_owner' },
    { id: STAFF_MEMBER_ID,     personId: STAFF_FULL_USER.id,    role: 'staff_full'    },
    { id: HYGIENIST_MEMBER_ID, personId: HYGIENIST_USER.id,     role: 'hygienist'     },
  ] as const;

  for (const m of memberValues) {
    await db.insert(dentalMemberships as any).values({
      id: m.id, branchId: BRANCH_ID, personId: m.personId,
      displayName: m.role, role: m.role, status: 'active',
      pinFailedAttempts: 0,
      createdBy: DENTIST_OWNER_USER.id, updatedBy: DENTIST_OWNER_USER.id,
    }).onConflictDoNothing();
  }

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Test', lastName: 'Patient',
    createdBy: DENTIST_OWNER_USER.id, updatedBy: DENTIST_OWNER_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: DENTIST_OWNER_USER.id, updatedBy: DENTIST_OWNER_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE medical_history_entry CASCADE`);
});

const ve = (result: any, c: any) => {
  if (!result.success)
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

function buildTestApp(user?: { id: string; email: string }) {
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
    '/dental/clinical/medical-history',
    zValidator('json', CreateMedicalHistoryEntryBody, ve),
    createMedicalHistoryEntry as any,
  );
  return app;
}

function entryBody() {
  return JSON.stringify({
    patientId: PATIENT_ID,
    entryType: 'condition',
    displayName: 'Hypertension',
    codeSystem: 'ICD-10',
    code: 'I10',
  });
}

describe('V-CLI-002: createMedicalHistoryEntry role guard — spec §6', () => {
  test('201 — dentist_owner can add medical history', async () => {
    const app = buildTestApp(DENTIST_OWNER_USER);
    const res = await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: entryBody(),
    });
    expect(res.status).toBe(201);
  });

  test('201 — staff_full can add medical history', async () => {
    const app = buildTestApp(STAFF_FULL_USER);
    const res = await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: entryBody(),
    });
    expect(res.status).toBe(201);
  });

  test('403 — hygienist cannot add medical history (not in spec §6)', async () => {
    const app = buildTestApp(HYGIENIST_USER);
    const res = await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: entryBody(),
    });
    expect(res.status).toBe(403);
  });

  test('401 — unauthenticated request is rejected', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: entryBody(),
    });
    expect(res.status).toBe(401);
  });
});
