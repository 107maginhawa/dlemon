/**
 * duplicate-detection.test.ts — P2-16 duplicate-patient detection
 *
 * P2-16-AC1  two patients with same name + DOB → one 'strong' group
 * P2-16-AC2  same name, different DOB → a 'name' group
 * P2-16-AC3  same name, no DOB, shared phone → promoted to 'strong'
 * P2-16-AC4  unique patients produce no groups
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { detectDuplicatePatients } from './identity/detectDuplicatePatients';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-0000000000dd', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000dd';
const ORG_ID = 'c0000000-0000-1000-8000-0000000000dd';
const MEMBER_ID = 'a1000000-0000-1000-8000-0000000000dd';

// Two exact dups (Maria Santos 1990-04-22)
const DUP_A = 'd0000000-0000-1000-8000-0000000000d1';
const DUP_B = 'd0000000-0000-1000-8000-0000000000d2';
// Same name different DOB (name-only group)
const NAME_A = 'd0000000-0000-1000-8000-0000000000d3';
const NAME_B = 'd0000000-0000-1000-8000-0000000000d4';
// Same name, no DOB, shared phone (contact-promoted strong)
const CONTACT_A = 'd0000000-0000-1000-8000-0000000000d5';
const CONTACT_B = 'd0000000-0000-1000-8000-0000000000d6';
// Unique
const UNIQUE = 'd0000000-0000-1000-8000-0000000000d7';

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Dedup Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Dentist',
    role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

async function seed() {
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const personId = (pid: string) => `e${pid.slice(1)}`;
  const mk = (pid: string, first: string, last: string, dob: string | null, phone: string | null) => ({
    person: { id: personId(pid), firstName: first, lastName: last, dateOfBirth: dob,
      contactInfo: phone ? { phone } : null, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    patient: { id: pid, person: personId(pid), preferredBranchId: BRANCH_ID, status: 'active' as const,
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
  });
  const rows = [
    mk(DUP_A, 'Maria', 'Santos', '1990-04-22', null),
    mk(DUP_B, 'maria', 'santos', '1990-04-22', null),
    mk(NAME_A, 'Jose', 'Reyes', '1980-01-01', null),
    mk(NAME_B, 'Jose', 'Reyes', '1981-02-02', null),
    mk(CONTACT_A, 'Ana', 'Cruz', null, '+639170000001'),
    mk(CONTACT_B, 'Ana', 'Cruz', null, '+639170000001'),
    mk(UNIQUE, 'Solo', 'Person', '1975-05-05', null),
  ];
  await db.insert(persons).values(rows.map((r) => r.person) as any).onConflictDoNothing();
  await db.insert(patients).values(rows.map((r) => r.patient) as any).onConflictDoNothing();
}

afterEach(async () => {
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const ids = [DUP_A, DUP_B, NAME_A, NAME_B, CONTACT_A, CONTACT_B, UNIQUE];
  for (const id of ids) await db.delete(patients).where(eq(patients.id, id));
  for (const id of ids) await db.delete(persons).where(eq(persons.id, `e${id.slice(1)}`));
});

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', TEST_USER);
    await next();
  });
  app.get('/dental/patients/duplicates',
    zValidator('query', z.object({ branchId: z.string().uuid() }), ve), detectDuplicatePatients as any);
  return app;
}

describe('P2-16 — duplicate detection', () => {
  test('AC1/AC2/AC3/AC4: clusters by name+DOB, name-only, and shared contact', async () => {
    await seed();
    const app = buildApp();
    const res = await app.request(`/dental/patients/duplicates?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    const findGroup = (id: string) => body.groups.find((g: any) => g.patients.some((p: any) => p.id === id));

    // Maria Santos x2 — strong (name + DOB), case-insensitive
    const mariaGroup = findGroup(DUP_A);
    expect(mariaGroup).toBeDefined();
    expect(mariaGroup.matchType).toBe('strong');
    expect(mariaGroup.patients.length).toBe(2);

    // Jose Reyes x2, different DOB — name-only
    const joseGroup = findGroup(NAME_A);
    expect(joseGroup).toBeDefined();
    expect(joseGroup.matchType).toBe('name');

    // Ana Cruz x2, shared phone, no DOB — promoted to strong
    const anaGroup = findGroup(CONTACT_A);
    expect(anaGroup).toBeDefined();
    expect(anaGroup.matchType).toBe('strong');

    // Unique patient — no group
    expect(findGroup(UNIQUE)).toBeUndefined();
  });

  test('AC5: returns groupCount matching groups length', async () => {
    await seed();
    const app = buildApp();
    const res = await app.request(`/dental/patients/duplicates?branchId=${BRANCH_ID}`);
    const body = (await res.json()) as any;
    expect(body.groupCount).toBe(body.groups.length);
    expect(body.groupCount).toBe(3);
  });
});
