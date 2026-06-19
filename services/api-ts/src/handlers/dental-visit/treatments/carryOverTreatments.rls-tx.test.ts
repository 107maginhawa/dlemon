/**
 * carryOverTreatments — atomic-write activation (withTenantTx).
 *
 * carryOverTreatments copies N pending treatments from a prior visit into the
 * current visit. Before this change the copies were issued as independent
 * auto-committed INSERTs (Promise.all of repo.createOne on the bypassing `db`),
 * so a partial failure left some carried rows committed. The fix routes BOTH
 * write loops (carry-over + restore-from-dismissed) through a single
 * withTenantTx({branchIds:[currentVisit.branchId]}) per ADR-010 — atomicity plus
 * the RLS second wall. Reads + assertBranchRole stay on `db`.
 *
 * Contract (RED before activation): the carry-over write opens a tenant tx
 * (db.transaction is otherwise un-called on this path), and the happy path still
 * returns the carried treatments into the current visit (proving the scope is the
 * right branch — a wrong/empty scope would make the app_rls INSERT touch zero rows).
 */

import { describe, test, expect, beforeAll, afterEach, spyOn } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { CarryOverTreatmentsParams, CarryOverTreatmentsBody } from '@/generated/openapi/validators';
import { carryOverTreatments } from './carryOverTreatments';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// File-unique ids (own clone, prefix c0a = carry-over atomic).
const USER_A = 'c0a00000-0000-4000-8000-00000000a001';
const ORG_A = 'c0a00000-0000-4000-8000-00000000a002';
const BRANCH_A = 'c0a00000-0000-4000-8000-00000000a003';
const MEMBER_A = 'c0a00000-0000-4000-8000-00000000a004';
const PERSON_A = 'c0a00000-0000-4000-8000-00000000a005';
const PATIENT_A = 'c0a00000-0000-4000-8000-00000000a006';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_A, name: 'CarryOver Clinic', tier: 'solo', ownerPersonId: USER_A, countryCode: 'PH', createdBy: USER_A, updatedBy: USER_A }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_A, organizationId: ORG_A, name: 'Main', timezone: 'Asia/Manila', createdBy: USER_A, updatedBy: USER_A }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_A, branchId: BRANCH_A, personId: USER_A, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER_A, updatedBy: USER_A }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_A, firstName: 'Carry', lastName: 'Over', createdBy: USER_A, updatedBy: USER_A }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_A, person: PERSON_A, preferredBranchId: BRANCH_A, createdBy: USER_A, updatedBy: USER_A }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_treatment WHERE patient_id = ${PATIENT_A}`);
  await db.execute(sql`DELETE FROM dental_visit WHERE patient_id = ${PATIENT_A}`);
});

async function seedVisit(status: 'draft' | 'completed' = 'draft'): Promise<string> {
  const id = crypto.randomUUID();
  const { dentalVisits } = await import('../repos/visit.schema');
  await db.insert(dentalVisits).values({ id, patientId: PATIENT_A, branchId: BRANCH_A, dentistMemberId: MEMBER_A, status, createdBy: USER_A, updatedBy: USER_A });
  return id;
}

async function seedPendingTreatment(visitId: string): Promise<string> {
  const id = crypto.randomUUID();
  const { dentalTreatments } = await import('../repos/treatment.schema');
  await db.insert(dentalTreatments).values({
    id, visitId, patientId: PATIENT_A,
    cdtCode: 'D2740', description: 'Crown - porcelain',
    priceCents: 50000, status: 'planned',
    createdBy: USER_A, updatedBy: USER_A,
  });
  return id;
}

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
    ctx.set('user', { id: USER_A, email: 'owner@a.com' });
    ctx.set('requestId', 'test-req');
    await next();
  });
  // Mount through the generated validators (param + json), same as the production
  // route, so this exercises the real validator chain (test-harness ratchet).
  const ve = (r: any, c: any) => { if (!r.success) return c.json({ error: 'Validation failed', issues: r.error.issues }, 400); };
  app.post(
    '/dental/visits/:visitId/carry-over',
    zValidator('param', CarryOverTreatmentsParams, ve),
    zValidator('json', CarryOverTreatmentsBody, ve),
    carryOverTreatments as any,
  );
  return app;
}

describe('carryOverTreatments routes its writes through withTenantTx (activation)', () => {
  test('opens a tenant tx for the carry-over write and returns the carried treatments', async () => {
    const sourceVisit = await seedVisit('draft');
    await seedPendingTreatment(sourceVisit);
    const currentVisit = await seedVisit('draft');

    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/visits/${currentVisit}/carry-over`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceVisitId: sourceVisit }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { carriedOver: Array<{ visitId: string; carriedOver: boolean; sourceVisitId: string }> };
      // CORRECT SCOPE: the INSERT under app_rls hit the current branch.
      expect(body.carriedOver).toHaveLength(1);
      expect(body.carriedOver[0]!.visitId).toBe(currentVisit);
      expect(body.carriedOver[0]!.carriedOver).toBe(true);
      expect(body.carriedOver[0]!.sourceVisitId).toBe(sourceVisit);
      // ROUTING (RED before activation): writes go straight to `db` today.
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('the carried treatment is actually persisted in the current visit', async () => {
    const sourceVisit = await seedVisit('draft');
    await seedPendingTreatment(sourceVisit);
    const currentVisit = await seedVisit('draft');

    const res = await buildApp().request(`/dental/visits/${currentVisit}/carry-over`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceVisitId: sourceVisit }),
    });
    expect(res.status).toBe(200);

    const { dentalTreatments } = await import('../repos/treatment.schema');
    const persisted = await db.select().from(dentalTreatments).where(sql`visit_id = ${currentVisit}`);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.carriedOver).toBe(true);
  });
});
