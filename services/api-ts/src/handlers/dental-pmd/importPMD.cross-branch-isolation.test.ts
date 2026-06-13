/**
 * importPMD.cross-branch-isolation.test.ts — SL-08 / F-G06 (cross-tenant sweep)
 *
 * F-G06 carry-forward: the EM-BIL-002 optional-branch-omission leak class was
 * swept clean for the 8 clinical modules + billing, but external-records-import
 * was flagged un-swept. `importPMD` ingests PHI for a patient; its branch guard
 * derives the branch from the PATIENT's `preferredBranchId` and asserts the
 * caller holds a clinical role THERE (`importPMD.ts:62-65`). This pins that a
 * caller from another org/branch CANNOT import a PMD against a patient they do
 * not own — closing the import write-side half of the sweep (the read/list half
 * for portal/emr/importPatients is already pinned in their own suites:
 * dental-portal.test.ts, emr/emr-coverage.test.ts §449/463,
 * dental-patient.bulk-import.test.ts cross-tenant isolation).
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { ImportPMDBody } from '@/generated/openapi/validators';
import { AppError } from '@/core/errors';
import { importPMD } from './importPMD';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: f06 — avoids cross-suite membership/branch collisions.
// Org A owns PATIENT_A in BRANCH_A. Org B's owner is NOT a member of BRANCH_A.
const OWNER_A = { id: '00000000-0000-4000-8000-000000f06001', email: 'ownerA@clinic-a.com' };
const OWNER_B = { id: '00000000-0000-4000-8000-000000f06002', email: 'ownerB@clinic-b.com' };
const ORG_A = 'ea000000-0000-4000-8000-000000f06001';
const ORG_B = 'ea000000-0000-4000-8000-000000f06002';
const BRANCH_A = 'ba000000-0000-4000-8000-000000f06001';
const BRANCH_B = 'ba000000-0000-4000-8000-000000f06002';
const MEMBER_A = 'ca000000-0000-4000-8000-000000f06001';
const MEMBER_B = 'ca000000-0000-4000-8000-000000f06002';
const PERSON_A = 'fa000000-0000-4000-8000-000000f06001';
const PATIENT_A = 'aa000000-0000-4000-8000-000000f06001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values([
    { id: ORG_A, name: 'Clinic A', tier: 'solo', ownerPersonId: OWNER_A.id, countryCode: 'PH', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: ORG_B, name: 'Clinic B', tier: 'solo', ownerPersonId: OWNER_B.id, countryCode: 'PH', createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(dentalBranches).values([
    { id: BRANCH_A, organizationId: ORG_A, name: 'A Main', timezone: 'Asia/Manila', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: BRANCH_B, organizationId: ORG_B, name: 'B Main', timezone: 'Asia/Manila', createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(dentalMemberships).values([
    { id: MEMBER_A, branchId: BRANCH_A, personId: OWNER_A.id, displayName: 'Owner A', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    // OWNER_B is ONLY a member of BRANCH_B — never of BRANCH_A.
    { id: MEMBER_B, branchId: BRANCH_B, personId: OWNER_B.id, displayName: 'Owner B', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_A, firstName: 'Alpha', lastName: 'Patient', createdBy: OWNER_A.id, updatedBy: OWNER_A.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_A, person: PERSON_A, preferredBranchId: BRANCH_A, createdBy: OWNER_A.id, updatedBy: OWNER_A.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM imported_pmd`);
});

const ve = (r: any, c: any) => { if (!r.success) return c.json({ error: 'Validation failed', issues: r.error.issues }, 400); };

function buildApp(user?: { id: string; email: string }) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    if (user) { ctx.set('user', user); ctx.set('session', { id: 'sess', userId: user.id }); }
    await next();
  });
  app.post('/dental/pmd/import', zValidator('json', ImportPMDBody, ve), importPMD as any);
  return app;
}

const importBody = () => ({
  patientId: PATIENT_A,
  sourceFacility: 'Rival General Hospital',
  sourceDescription: 'Open Dental v21.1',
  content: JSON.stringify({ allergies: ['penicillin'] }),
});

describe('SL-08 / F-G06 — importPMD cross-branch isolation', () => {
  async function countImportedFor(patientId: string): Promise<number> {
    const rows = await db.execute(sql`SELECT count(*)::int AS n FROM imported_pmd WHERE patient_id = ${patientId}`);
    return ((rows as unknown as { rows?: Array<{ n: number }> }).rows?.[0]?.n)
      ?? (rows as unknown as Array<{ n: number }>)[0]?.n
      ?? 0;
  }

  test("a foreign-org caller cannot import a PMD for another org's patient (403, no row written)", async () => {
    const res = await buildApp(OWNER_B).request('/dental/pmd/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(importBody()),
    });
    expect(res.status).toBe(403);
    expect(await countImportedFor(PATIENT_A)).toBe(0);
  });

  test('the patient-owning org CAN import the PMD (positive control, 201)', async () => {
    const res = await buildApp(OWNER_A).request('/dental/pmd/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(importBody()),
    });
    expect(res.status).toBe(201);
    expect(await countImportedFor(PATIENT_A)).toBe(1);
  });

  test('unauthenticated → 401', async () => {
    const res = await buildApp(undefined).request('/dental/pmd/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(importBody()),
    });
    expect(res.status).toBe(401);
  });
});
