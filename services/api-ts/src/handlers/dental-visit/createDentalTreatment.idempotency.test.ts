/**
 * createDentalTreatment.idempotency.test.ts — SL-01 (folded B-G3/E-NEW-05 sibling)
 *
 * `localId` is the client-generated, offline-stable id for a create. It was
 * persisted + echoed but NOT an idempotency key: a retried offline create (same
 * localId, dropped ACK) inserted a DUPLICATE treatment row. Mirrors the visit
 * installment (createDentalVisit.idempotency.test.ts / F-G02): a create carrying
 * a previously-seen localId MUST return the existing row, not a duplicate.
 *
 * Treatment localId is scoped to the VISIT (the create's parent), so dedup is on
 * (visitId, localId).
 *
 * RED-proof: before the guard, two POSTs with the same localId create two rows.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { createDentalTreatment } from './treatments/createDentalTreatment';
import { CreateDentalTreatmentBody, CreateDentalTreatmentParams } from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 102.
const USER = { id: '00000000-0000-4000-8000-000000102001', email: 'owner@idemtx.com' };
const ORG = 'ea000000-0000-4000-8000-000000102001';
const BRANCH = 'ba000000-0000-4000-8000-000000102001';
const MEMBER = 'ca000000-0000-4000-8000-000000102001';
const PERSON = 'fa000000-0000-4000-8000-000000102001';
const PATIENT = 'aa000000-0000-4000-8000-000000102001';
const VISIT = 'da000000-0000-4000-8000-000000102001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('./repos/visit.schema');
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'IdemTx Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'IdemTx', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT, patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER, status: 'active', chiefComplaint: 'Checkup', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_treatment WHERE visit_id = ${VISIT}`);
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
  app.post('/dental/visits/:visitId/treatments',
    zValidator('param', CreateDentalTreatmentParams, ve),
    zValidator('json', CreateDentalTreatmentBody, ve),
    createDentalTreatment as any);
  return app;
}

async function createWith(localId?: string) {
  const body: Record<string, unknown> = { visitId: VISIT, patientId: PATIENT, cdtCode: 'D2150', description: 'Amalgam', toothNumber: 14, priceCents: 5000 };
  if (localId !== undefined) body['localId'] = localId;
  return buildApp().request(`/dental/visits/${VISIT}/treatments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

async function countTreatments(): Promise<number> {
  const rows = await db.execute(sql`SELECT count(*)::int AS n FROM dental_treatment WHERE visit_id = ${VISIT}`);
  return ((rows as unknown as { rows?: Array<{ n: number }> }).rows?.[0]?.n) ?? (rows as unknown as Array<{ n: number }>)[0]?.n ?? 0;
}

describe('SL-01 — createDentalTreatment is idempotent on localId', () => {
  test('a retried create with the same localId returns the SAME treatment (no duplicate row)', async () => {
    const localId = 'local-tx-aaaa-1111';

    const first = await createWith(localId);
    expect(first.status).toBe(201);
    const t1 = await first.json() as { id: string };

    const second = await createWith(localId);
    expect([200, 201]).toContain(second.status);
    const t2 = await second.json() as { id: string };

    expect(t2.id).toBe(t1.id);             // same row echoed
    expect(await countTreatments()).toBe(1); // RED before: 2 rows
  });

  test('different localIds create distinct treatments (no false dedup)', async () => {
    const a = await createWith('local-tx-bbbb-1');
    expect(a.status).toBe(201);
    const ta = await a.json() as { id: string };
    const b = await createWith('local-tx-bbbb-2');
    expect(b.status).toBe(201);
    const tb = await b.json() as { id: string };
    expect(tb.id).not.toBe(ta.id);
    expect(await countTreatments()).toBe(2);
  });

  test('a create with NO localId is unaffected (always inserts)', async () => {
    const a = await createWith(undefined);
    expect(a.status).toBe(201);
    const b = await createWith(undefined);
    expect(b.status).toBe(201);
    expect(await countTreatments()).toBe(2);
  });
});
