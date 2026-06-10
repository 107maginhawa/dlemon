/**
 * createDentalVisit.idempotency.test.ts — SL-01 / F-G02 (P1 data-loss)
 *
 * `localId` is the client-generated, offline-stable id for a create. GAP-001
 * persists + echoes it, but it was NOT an idempotency key: a retried offline
 * create (same localId, dropped ACK) inserted a DUPLICATE visit. F-G02 (BR):
 * "a create carrying a previously-seen localId MUST return the existing row
 * (idempotent), not a duplicate."
 *
 * RED-proof: before the guard, two POSTs with the same localId create two visit
 * rows with different ids.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { createDentalVisit } from './visits/createDentalVisit';
import { CreateDentalVisitBody } from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 101 (SL-01).
const USER = { id: '00000000-0000-4000-8000-000000101001', email: 'owner@idem.com' };
const ORG = 'ea000000-0000-4000-8000-000000101001';
const BRANCH = 'ba000000-0000-4000-8000-000000101001';
const MEMBER = 'ca000000-0000-4000-8000-000000101001';
const PERSON = 'fa000000-0000-4000-8000-000000101001';
const PATIENT = 'aa000000-0000-4000-8000-000000101001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'Idem Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'Idem', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  // visit_notes / visit_note_version cascade from dental_visit (onDelete: cascade).
  await db.execute(sql`DELETE FROM dental_visit WHERE patient_id = ${PATIENT}`);
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
  app.post('/dental/visits', zValidator('json', CreateDentalVisitBody, ve), createDentalVisit as any);
  return app;
}

async function createWith(localId?: string) {
  const body: Record<string, unknown> = { patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER, chiefComplaint: 'Checkup' };
  if (localId !== undefined) body['localId'] = localId;
  const res = await buildApp().request('/dental/visits', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return res;
}

async function countVisits(): Promise<number> {
  const rows = await db.execute(sql`SELECT count(*)::int AS n FROM dental_visit WHERE patient_id = ${PATIENT}`);
  return ((rows as unknown as { rows?: Array<{ n: number }> }).rows?.[0]?.n) ?? (rows as unknown as Array<{ n: number }>)[0]?.n ?? 0;
}

describe('SL-01 / F-G02 — createDentalVisit is idempotent on localId', () => {
  test('a retried create with the same localId returns the SAME visit (no duplicate row)', async () => {
    const localId = 'local-visit-aaaa-1111';

    const first = await createWith(localId);
    expect(first.status).toBe(201);
    const v1 = await first.json() as { id: string };

    const second = await createWith(localId);
    expect([200, 201]).toContain(second.status);
    const v2 = await second.json() as { id: string };

    expect(v2.id).toBe(v1.id);        // same row echoed
    expect(await countVisits()).toBe(1); // RED before: 2 rows
  });

  test('different localIds create distinct visits (no false dedup)', async () => {
    const a = await createWith('local-visit-bbbb-1');
    expect(a.status).toBe(201);
    const va = await a.json() as { id: string };
    // The first visit is draft (not active), so a second create is allowed.
    const b = await createWith('local-visit-bbbb-2');
    expect(b.status).toBe(201);
    const vb = await b.json() as { id: string };
    expect(vb.id).not.toBe(va.id);
    expect(await countVisits()).toBe(2);
  });

  test('a create with NO localId is unaffected (always inserts)', async () => {
    const a = await createWith(undefined);
    expect(a.status).toBe(201);
    expect(await countVisits()).toBe(1);
  });
});
