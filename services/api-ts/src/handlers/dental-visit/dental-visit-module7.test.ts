/**
 * dental-visit-module7.test.ts — B1 + B2: visit-note persistence
 *
 * FRs covered:
 *   J02  visit-note round-trip persists (B1)
 *   J10  signed note + addendum visible via GET notes (B2)
 *
 * Written RED — createDentalVisit does not auto-create notes; getVisitNotes
 * does not include addendum history. Tests pass after GREEN impl.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  UpsertVisitNotesParams,
  UpsertVisitNotesBody,
  SignVisitNotesParams,
  SignVisitNotesBody,
  CreateVisitNoteAddendumParams,
  CreateVisitNoteAddendumBody,
  CreateDentalVisitBody,
} from '@/generated/openapi/validators';
import { upsertVisitNotes } from './upsertVisitNotes';
import { getVisitNotes } from './getVisitNotes';
import { signVisitNotes } from './signVisitNotes';
import { createVisitNoteAddendum } from './createVisitNoteAddendum';
import { createDentalVisit } from './createDentalVisit';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

// Suite-unique IDs — b700 namespace
const TEST_USER  = { id: 'e7000000-0000-1000-8000-000000000001', email: 'dentist7@clinic.com' };
const ORG_ID     = 'a7000000-0000-1000-8000-000000000007';
const BRANCH_ID  = '7b700000-0000-4000-8000-000000000007';
const MEMBER_ID  = '7c700000-0000-4000-8000-000000000007';
const PERSON_ID  = 'f7000000-0000-1000-8000-000000000002';
const PATIENT_ID = 'f7000000-0000-1000-8000-000000000001';
const VISIT_ID   = 'f7000000-0000-1000-8000-000000000003'; // B1 round-trip
const VISIT_B2   = 'f7000000-0000-1000-8000-000000000004'; // B2 signed+addendum

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons }             = await import('@/handlers/person/repos/person.schema');
  const { patients }            = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits }        = await import('./repos/visit.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Module7 Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Module7 Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Module7 Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Module7', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalVisits).values({
    id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalVisits).values({
    id: VISIT_B2, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    if (err instanceof z.ZodError) return c.json({ error: err.issues.map((i: any) => i.message).join('; ') }, 400);
    console.error('Unhandled test error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('user', user ?? TEST_USER);
    ctx.set('database', db);
    ctx.set('logger', null);
    await next();
  });

  // B1: create visit auto-creates notes
  app.post('/dental/visits',
    zValidator('json', CreateDentalVisitBody, ve),
    (c) => createDentalVisit(c as any),
  );

  // upsert notes
  app.post('/dental/visits/:visitId/notes',
    zValidator('param', UpsertVisitNotesParams, ve),
    zValidator('json', UpsertVisitNotesBody, ve),
    (c) => upsertVisitNotes(c as any),
  );

  // get notes
  app.get('/dental/visits/:visitId/notes',
    (c) => getVisitNotes(c as any),
  );

  // sign notes
  app.post('/dental/visits/:visitId/notes/sign',
    zValidator('param', SignVisitNotesParams, ve),
    zValidator('json', SignVisitNotesBody, ve),
    (c) => signVisitNotes(c as any),
  );

  // addendum
  app.post('/dental/visits/:visitId/notes/addendum',
    zValidator('param', CreateVisitNoteAddendumParams, ve),
    zValidator('json', CreateVisitNoteAddendumBody, ve),
    (c) => createVisitNoteAddendum(c as any),
  );

  return app;
}

afterEach(async () => {
  const { visitNotes, visitNoteVersions } = await import('./repos/treatment.schema');
  await db.delete(visitNoteVersions).where(
    sql`note_id IN (SELECT id FROM visit_notes WHERE visit_id IN (${VISIT_ID}::uuid, ${VISIT_B2}::uuid))`,
  );
  await db.delete(visitNotes).where(
    sql`visit_id IN (${VISIT_ID}::uuid, ${VISIT_B2}::uuid)`,
  );
});

// ─── B1 — visit-note round-trip ────────────────────────────────────────────────

describe('B1 — visit-note round-trip (J02)', () => {
  test('upsert then GET returns non-empty notes object with correct content', async () => {
    const app = buildTestApp();

    const upsertRes = await app.request(`/dental/visits/${VISIT_ID}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId: VISIT_ID, subjective: 'Gum pain', objective: 'Inflammation noted' }),
    });
    expect(upsertRes.status).toBe(201);

    const getRes = await app.request(`/dental/visits/${VISIT_ID}/notes`);
    expect(getRes.status).toBe(200);
    const body = await getRes.json() as any;
    expect(Object.keys(body).length).toBeGreaterThan(0);
    expect(body.subjective).toBe('Gum pain');
    expect(body.signed).toBe(false);
  });

  test('RED→GREEN: createDentalVisit auto-creates notes row so GET returns 200 not 404', async () => {
    const app = buildTestApp();

    const createRes = await app.request('/dental/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        dentistMemberId: MEMBER_ID,
        chiefComplaint: 'D0120 periodic recall',
      }),
    });
    expect(createRes.status).toBe(201);
    const visitData = await createRes.json() as any;
    const newVisitId: string = visitData.id;

    // J02 contract: GET notes must return non-empty object (notesPersisted = true)
    const notesRes = await app.request(`/dental/visits/${newVisitId}/notes`);
    expect(notesRes.status).toBe(200);
    const notesBody = await notesRes.json() as any;
    expect(Object.keys(notesBody).length).toBeGreaterThan(0);
    expect(notesBody.signed).toBe(false);

    // cleanup new visit
    const { dentalVisits } = await import('./repos/visit.schema');
    const { visitNotes, visitNoteVersions } = await import('./repos/treatment.schema');
    await db.delete(visitNoteVersions).where(sql`note_id IN (SELECT id FROM visit_notes WHERE visit_id = ${newVisitId}::uuid)`);
    await db.delete(visitNotes).where(sql`visit_id = ${newVisitId}::uuid`);
    await db.delete(dentalVisits).where(eq(dentalVisits.id, newVisitId));
  });
});

// ─── B2 — signed note + addendum (J10) ────────────────────────────────────────

describe('B2 — signed note + addendum (J10)', () => {
  test('signed field is true after signVisitNotes', async () => {
    const app = buildTestApp();

    await app.request(`/dental/visits/${VISIT_B2}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId: VISIT_B2, subjective: 'RCT visit', objective: 'Canals instrumented' }),
    });

    const signRes = await app.request(`/dental/visits/${VISIT_B2}/notes/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(signRes.status).toBe(200);

    const notesRes = await app.request(`/dental/visits/${VISIT_B2}/notes`);
    expect(notesRes.status).toBe(200);
    const body = await notesRes.json() as any;
    expect(body.signed).toBe(true);
  });

  test('RED→GREEN: GET notes after addendum contains "addendum" string (J10 hasAddendumRow)', async () => {
    const app = buildTestApp();

    // Upsert + sign
    await app.request(`/dental/visits/${VISIT_B2}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId: VISIT_B2, subjective: 'RCT visit', objective: 'Canals instrumented' }),
    });
    await app.request(`/dental/visits/${VISIT_B2}/notes/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    // Add addendum
    const addendumRes = await app.request(`/dental/visits/${VISIT_B2}/notes/addendum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Clinical correction', content: 'Addendum: clarified anesthetic dosage.' }),
    });
    expect(addendumRes.status).toBe(201);

    // J10 contract: GET notes JSON must contain "addendum"
    const afterRes = await app.request(`/dental/visits/${VISIT_B2}/notes`);
    expect(afterRes.status).toBe(200);
    const afterStr = JSON.stringify(await afterRes.json());
    expect(/addendum/i.test(afterStr)).toBe(true);
  });
});
