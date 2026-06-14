/**
 * RLS P1b activation — dental_visit WRITE handlers (update + discard).
 *
 * Companion to dental-visit.rls-activation.test.ts (list + create). Finishes the
 * dental_visit module's Tier-1 activation by routing the mutating handlers'
 * write paths through withTenantTx({branchIds:[visit.branchId]}) so the visit
 * (and any visit-anchored Tier-2a child it touches, e.g. dental_treatment) is
 * written under app_rls.
 *
 * Per ADR-010: the entity-resolution fetch + authz (assertBranchRole) + the
 * facade guard reads + the audit write + the failure-isolated PMD generation all
 * stay on the bypassing `db` connection — only the terminal writes are scoped.
 * (getDentalVisit is deliberately NOT wrapped: a single by-PK read followed by an
 * explicit assertBranchAccess is not the EM-BIL-002 leak class, and scoping it
 * would flip its cross-tenant 403 into an RLS-induced 404.)
 *
 * Contract (RED before activation): each handler opens a tenant tx for its write
 * (db.transaction is otherwise un-called — logAuditEvent/facade reads/PMD use no
 * tx), and the happy path still returns the mutated row (proving the scope is
 * the right branch — a wrong/empty scope would make the app_rls UPDATE touch
 * zero rows).
 */

import { describe, test, expect, beforeAll, afterEach, spyOn } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { updateDentalVisit } from './visits/updateDentalVisit';
import { discardVisit } from './visits/discardVisit';
import {
  UpdateDentalVisitBody,
  UpdateDentalVisitParams,
  DiscardVisitBody,
  DiscardVisitParams,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// File-unique ids (own clone, prefix 1b1 = P1b writes).
const USER_A = '1b100000-0000-4000-8000-00000000a001';
const ORG_A = '1b100000-0000-4000-8000-00000000a002';
const BRANCH_A = '1b100000-0000-4000-8000-00000000a003';
const MEMBER_A = '1b100000-0000-4000-8000-00000000a004';
const PERSON_A = '1b100000-0000-4000-8000-00000000a005';
const PATIENT_A = '1b100000-0000-4000-8000-00000000a006';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_A, name: 'P1b-W Clinic', tier: 'solo', ownerPersonId: USER_A, countryCode: 'PH', createdBy: USER_A, updatedBy: USER_A }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_A, organizationId: ORG_A, name: 'Main', timezone: 'Asia/Manila', createdBy: USER_A, updatedBy: USER_A }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_A, branchId: BRANCH_A, personId: USER_A, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER_A, updatedBy: USER_A }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_A, firstName: 'Pat', lastName: 'A', createdBy: USER_A, updatedBy: USER_A }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_A, person: PERSON_A, preferredBranchId: BRANCH_A, createdBy: USER_A, updatedBy: USER_A }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_visit WHERE patient_id = ${PATIENT_A}`);
});

async function seedDraftVisit(): Promise<string> {
  const id = crypto.randomUUID();
  const { dentalVisits } = await import('./repos/visit.schema');
  await db.insert(dentalVisits).values({ id, patientId: PATIENT_A, branchId: BRANCH_A, dentistMemberId: MEMBER_A, status: 'draft', createdBy: USER_A, updatedBy: USER_A });
  return id;
}

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
  app.patch('/dental/visits/:visitId', zValidator('param', UpdateDentalVisitParams, ve), zValidator('json', UpdateDentalVisitBody, ve), updateDentalVisit as any);
  app.post('/dental/visits/:visitId/discard', zValidator('param', DiscardVisitParams, ve), zValidator('json', DiscardVisitBody, ve), discardVisit as any);
  return app;
}

describe('RLS P1b — dental_visit write handlers route through withTenantTx (activation)', () => {
  test('updateDentalVisit opens a tenant tx for the write and returns the mutated visit', async () => {
    const visitId = await seedDraftVisit();
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/visits/${visitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chiefComplaint: 'Updated complaint' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { id: string; chiefComplaint: string };
      expect(body.chiefComplaint).toBe('Updated complaint'); // CORRECT SCOPE: UPDATE hit the row under app_rls
      expect(txSpy).toHaveBeenCalled();                       // ROUTING (RED before activation)
    } finally {
      txSpy.mockRestore();
    }
  });

  test('discardVisit opens a tenant tx for the write and returns the discarded visit', async () => {
    const visitId = await seedDraftVisit();
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/visits/${visitId}/discard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Abandoned — nothing recorded' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { id: string; status: string };
      expect(body.status).toBe('discarded'); // CORRECT SCOPE: UPDATE hit the row under app_rls
      expect(txSpy).toHaveBeenCalled();       // ROUTING (RED before activation)
    } finally {
      txSpy.mockRestore();
    }
  });
});
