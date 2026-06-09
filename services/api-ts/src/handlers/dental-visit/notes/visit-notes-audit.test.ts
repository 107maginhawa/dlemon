/**
 * visit-notes-audit.test.ts — dental-audit P1-B (Batch 2)
 *
 * Signing and amending a clinical visit note are sensitive, immutable clinical
 * transitions (sign freezes a v1 snapshot; an addendum appends an immutable
 * correction). Both MUST be written to the audit log so an owner can see who
 * signed / corrected a note and when. Before this fix they emitted only a Pino
 * `log.info` and wrote NO `dental_audit_log` row.
 *
 * RED-proof: with the `logAuditEvent` call absent from each handler, the
 * audit-row assertions find no row.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { signVisitNotes } from './signVisitNotes';
import { createVisitNoteAddendum } from './createVisitNoteAddendum';
import { VisitNotesRepository } from '../repos/treatment.repo';
import {
  SignVisitNotesParams,
  SignVisitNotesBody,
  CreateVisitNoteAddendumParams,
  CreateVisitNoteAddendumBody,
} from '@/generated/openapi/validators';
import { dentalVisits } from '../repos/visit.schema';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: a47 (vna suite)
const TEST_USER  = { id: 'd1000000-0000-1000-8000-000000000a47', email: 'vna@clinic.com' };
const PATIENT_ID = 'd2000000-0000-1000-8000-000000000a47';
const PERSON_ID  = 'd3000000-0000-1000-8000-000000000a47';
const BRANCH_ID  = 'd4000000-0000-1000-8000-000000000a47';
const MEMBER_ID  = 'd5000000-0000-1000-8000-000000000a47';
const ORG_ID     = 'd6000000-0000-1000-8000-000000000a47';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons }             = await import('@/handlers/person/repos/person.schema');
  const { patients }            = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'VNA Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'VNA Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'VNA Dentist', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'VNA', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`);
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

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
    ctx.set('session', { id: 'vna-session', userId: TEST_USER.id });
    await next();
  });
  app.post('/dental/visits/:visitId/notes/sign',
    zValidator('param', SignVisitNotesParams, ve), zValidator('json', SignVisitNotesBody, ve), signVisitNotes as any);
  app.post('/dental/visits/:visitId/notes/addendum',
    zValidator('param', CreateVisitNoteAddendumParams, ve), zValidator('json', CreateVisitNoteAddendumBody, ve), createVisitNoteAddendum as any);
  return app;
}

async function seedVisitWithNote(): Promise<string> {
  const visitId = crypto.randomUUID();
  await db.insert(dentalVisits).values({ id: visitId, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id });
  const notesRepo = new VisitNotesRepository(db);
  await notesRepo.upsert({ visitId, authorMemberId: MEMBER_ID, subjective: 'CC: pain', objective: 'exam', assessment: 'caries', plan: 'restore', createdBy: TEST_USER.id, updatedBy: TEST_USER.id } as any);
  return visitId;
}

describe('visit-notes audit coverage (dental-audit P1-B)', () => {
  test('[P1-B] signing a visit note writes a visit_note.signed audit row', async () => {
    const app = buildApp();
    const visitId = await seedVisitWithNote();

    const res = await app.request(`/dental/visits/${visitId}/notes/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);

    const [row] = await db
      .select()
      .from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.action, 'visit_note.signed'), eq(dentalAuditLog.branchId, BRANCH_ID)));
    expect(row).toBeTruthy();
    expect(row!.actorId).toBe(TEST_USER.id);
    expect(row!.targetType).toBe('dental_visit_note');
  });

  test('[P1-B] amending (addendum) a signed note writes a visit_note.amended audit row', async () => {
    const app = buildApp();
    const visitId = await seedVisitWithNote();

    // Sign first (so an addendum is legal).
    await app.request(`/dental/visits/${visitId}/notes/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    await db.execute(sql`TRUNCATE TABLE dental_audit_log`); // isolate the addendum row

    const res = await app.request(`/dental/visits/${visitId}/notes/addendum`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Corrected tooth number', content: 'Tooth #14, not #15' }),
    });
    expect(res.status).toBe(201);

    const [row] = await db
      .select()
      .from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.action, 'visit_note.amended'), eq(dentalAuditLog.branchId, BRANCH_ID)));
    expect(row).toBeTruthy();
    expect(row!.actorId).toBe(TEST_USER.id);
    expect(row!.reason).toBe('Corrected tooth number');
  });
});
