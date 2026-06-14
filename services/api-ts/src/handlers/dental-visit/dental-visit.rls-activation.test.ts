/**
 * RLS P1b activation — dental_visit (ADR-010 pre-GA gate, Tier-1 activation).
 *
 * P0/P1a/P2 armed RLS on the DB but the app still connects as the postgres
 * superuser, which BYPASSES RLS — so the second wall is dormant. P1b ACTIVATES
 * it on the request path by routing each Tier-1 handler's payload data access
 * through `withTenantTx({branchIds:[resolvedBranch]})`, which opens a tx,
 * publishes the branch scope, and `SET LOCAL ROLE app_rls` so the query is
 * actually filtered by the policies.
 *
 * This file is the activation contract for the two clean BRANCH_UPFRONT visit
 * handlers (list + create). It asserts:
 *
 *   1. ROUTING (RED-first): the handler opens a tenant transaction — i.e. its
 *      data access goes through withTenantTx. Observable as a db.transaction()
 *      call (logAuditEvent does a plain insert, never a tx, so a tx is
 *      attributable to withTenantTx alone). Before activation the handler reads
 *      the pooled db directly → ZERO transactions → this assertion FAILS (RED).
 *   2. CORRECT SCOPE (behavioral): the happy path still returns the in-tenant
 *      row. Because the query now runs as app_rls, a wrong/empty branch scope
 *      would make RLS return ZERO rows and this would fail — so a green happy
 *      path proves the scope passed to withTenantTx was the right branch.
 *   3. ISOLATION: a cross-branch visit seeded as the superuser is NOT returned
 *      to a single-branch caller (the EM-BIL-002 leak class, now double-walled).
 *
 * Runs against its own cloned DB (scripts/test-with-db.ts), which carries
 * migrations 0104–0106 (app_rls + policies on dental_visit et al).
 */

import { describe, test, expect, beforeAll, afterEach, spyOn } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { listDentalVisits } from './visits/listDentalVisits';
import { createDentalVisit } from './visits/createDentalVisit';
import { CreateDentalVisitBody } from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// File-unique ids (own clone, distinct prefix 1b0 = P1b).
const USER_A = '1b000000-0000-4000-8000-00000000a001';
const ORG_A = '1b000000-0000-4000-8000-00000000a002';
const BRANCH_A = '1b000000-0000-4000-8000-00000000a003';
const MEMBER_A = '1b000000-0000-4000-8000-00000000a004';
const PERSON_A = '1b000000-0000-4000-8000-00000000a005';
const PATIENT_A = '1b000000-0000-4000-8000-00000000a006';

const OWNER_B = '1b000000-0000-4000-8000-00000000b001';
const ORG_B = '1b000000-0000-4000-8000-00000000b002';
const BRANCH_B = '1b000000-0000-4000-8000-00000000b003';
const MEMBER_B = '1b000000-0000-4000-8000-00000000b004';
const PERSON_B = '1b000000-0000-4000-8000-00000000b005';
const PATIENT_B = '1b000000-0000-4000-8000-00000000b006';
const VISIT_B = '1b000000-0000-4000-8000-00000000b007';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('./repos/visit.schema');

  await db.insert(dentalOrganizations).values([
    { id: ORG_A, name: 'P1b Clinic A', tier: 'solo', ownerPersonId: USER_A, countryCode: 'PH', createdBy: USER_A, updatedBy: USER_A },
    { id: ORG_B, name: 'P1b Clinic B', tier: 'solo', ownerPersonId: OWNER_B, countryCode: 'PH', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
  await db.insert(dentalBranches).values([
    { id: BRANCH_A, organizationId: ORG_A, name: 'A Main', timezone: 'Asia/Manila', createdBy: USER_A, updatedBy: USER_A },
    { id: BRANCH_B, organizationId: ORG_B, name: 'B Main', timezone: 'Asia/Manila', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
  await db.insert(dentalMemberships).values([
    { id: MEMBER_A, branchId: BRANCH_A, personId: USER_A, displayName: 'Owner A', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER_A, updatedBy: USER_A },
    { id: MEMBER_B, branchId: BRANCH_B, personId: OWNER_B, displayName: 'Owner B', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
  await db.insert(persons).values([
    { id: PERSON_A, firstName: 'Pat', lastName: 'A', createdBy: USER_A, updatedBy: USER_A },
    { id: PERSON_B, firstName: 'Pat', lastName: 'B', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
  await db.insert(patients).values([
    { id: PATIENT_A, person: PERSON_A, preferredBranchId: BRANCH_A, createdBy: USER_A, updatedBy: USER_A },
    { id: PATIENT_B, person: PERSON_B, preferredBranchId: BRANCH_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
  // Cross-branch visit (branch B), seeded AS POSTGRES (superuser bypasses RLS,
  // exactly the production write path today). It must stay invisible to a
  // branch-A-only caller once the list handler runs under app_rls.
  await db.insert(dentalVisits).values(
    { id: VISIT_B, patientId: PATIENT_B, branchId: BRANCH_B, dentistMemberId: MEMBER_B, status: 'draft', createdBy: OWNER_B, updatedBy: OWNER_B },
  ).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_visit WHERE patient_id = ${PATIENT_A}`);
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
    ctx.set('user', { id: USER_A, email: 'owner@a.com' });
    ctx.set('requestId', 'test-req');
    await next();
  });
  app.get('/dental/visits', listDentalVisits as any);
  app.post('/dental/visits', zValidator('json', CreateDentalVisitBody, ve), createDentalVisit as any);
  return app;
}

describe('RLS P1b — dental_visit handlers route through withTenantTx (activation)', () => {
  test('listDentalVisits opens a tenant tx and returns only the caller branch (not the cross-branch visit)', async () => {
    // Seed an in-branch (A) visit directly as superuser so the list has a row to return.
    const VISIT_A = '1b000000-0000-4000-8000-00000000a007';
    const { dentalVisits } = await import('./repos/visit.schema');
    await db.insert(dentalVisits).values(
      { id: VISIT_A, patientId: PATIENT_A, branchId: BRANCH_A, dentistMemberId: MEMBER_A, status: 'draft', createdBy: USER_A, updatedBy: USER_A },
    ).onConflictDoNothing();

    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/visits?branchId=${BRANCH_A}`);
      expect(res.status).toBe(200);
      const body = await res.json() as { data: Array<{ id: string; branchId: string }> };
      const ids = body.data.map((v) => v.id);
      expect(ids).toContain(VISIT_A);          // CORRECT SCOPE: in-tenant row visible under app_rls
      expect(ids).not.toContain(VISIT_B);      // ISOLATION: cross-branch row excluded
      expect(txSpy).toHaveBeenCalled();        // ROUTING (RED before activation)
    } finally {
      txSpy.mockRestore();
    }
  });

  test('createDentalVisit opens a tenant tx and writes the visit under app_rls scope', async () => {
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request('/dental/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: PATIENT_A, branchId: BRANCH_A, dentistMemberId: MEMBER_A, chiefComplaint: 'Checkup' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { id: string; branchId: string };
      expect(body.branchId).toBe(BRANCH_A);    // CORRECT SCOPE: WITH CHECK passed under app_rls
      expect(txSpy).toHaveBeenCalled();        // ROUTING (RED before activation)
    } finally {
      txSpy.mockRestore();
    }
  });
});
