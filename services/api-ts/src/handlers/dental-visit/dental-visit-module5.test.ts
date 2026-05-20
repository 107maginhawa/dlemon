/**
 * dental-visit-module5.test.ts — Phase 1.1: Signed/locked clinical notes
 *
 * FRs covered:
 *   J02  Visit notes signed and locked after signing
 *   J10  Addendum appended to signed note (immutable, append-only)
 *
 * Written RED — signVisitNotes, createVisitNoteAddendum, getVisitNoteHistory
 * stubs throw "Not implemented". Tests pass after GREEN impl below.
 *
 * NOTE_SIGNED guard: upsertVisitNotes on a signed note must return 422.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  UpsertVisitNotesBody,
  UpsertVisitNotesParams,
  SignVisitNotesBody,
  SignVisitNotesParams,
  CreateVisitNoteAddendumBody,
  CreateVisitNoteAddendumParams,
  GetVisitNoteHistoryParams,
} from '@/generated/openapi/validators';
import { upsertVisitNotes } from './upsertVisitNotes';
import { signVisitNotes } from './signVisitNotes';
import { createVisitNoteAddendum } from './createVisitNoteAddendum';
import { getVisitNoteHistory } from './getVisitNoteHistory';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

// Suite-unique IDs — b500 namespace, no collision with other test suites
const TEST_USER  = { id: 'e5000000-0000-1000-8000-000000000001', email: 'dentist5@clinic.com' };
const PATIENT_ID = 'f5000000-0000-1000-8000-000000000001';
const PERSON_ID  = 'f5000000-0000-1000-8000-000000000002';
const BRANCH_ID  = '7b500000-0000-4000-8000-000000000005';
const ORG_ID     = 'a5000000-0000-1000-8000-000000000005';
const MEMBER_ID  = '7c500000-0000-4000-8000-000000000005';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Module5 Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Module5 Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Module5 Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Module5', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

// ─── Validator error handler ──────────────────────────────────────────────────

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

// ─── App builder ─────────────────────────────────────────────────────────────

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    if (err instanceof z.ZodError) {
      return c.json({ error: err.issues.map((i: any) => i.message).join('; ') }, 400);
    }
    console.error('Unhandled test error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.post('/dental/visits/:visitId/notes',
    zValidator('param', UpsertVisitNotesParams, ve),
    zValidator('json', UpsertVisitNotesBody, ve),
    upsertVisitNotes as any,
  );
  app.post('/dental/visits/:visitId/notes/sign',
    zValidator('param', SignVisitNotesParams, ve),
    zValidator('json', SignVisitNotesBody, ve),
    signVisitNotes as any,
  );
  app.post('/dental/visits/:visitId/notes/addendum',
    zValidator('param', CreateVisitNoteAddendumParams, ve),
    zValidator('json', CreateVisitNoteAddendumBody, ve),
    createVisitNoteAddendum as any,
  );
  app.get('/dental/visits/:visitId/notes/history',
    zValidator('param', GetVisitNoteHistoryParams, ve),
    getVisitNoteHistory as any,
  );

  return app;
}

// ─── Teardown ────────────────────────────────────────────────────────────────

async function truncate() {
  // dental_visit CASCADE handles visit_notes and visit_note_version via FK
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`);
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedVisit(status = 'active') {
  const { dentalVisits } = await import('./repos/visit.schema');
  const [visit] = await db.insert(dentalVisits).values({
    id: crypto.randomUUID(), patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, status: status as any,
    ...(status === 'active' ? { activatedAt: new Date() } : {}),
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  return visit!;
}

async function seedNote(visitId: string, overrides?: Record<string, any>) {
  const { visitNotes } = await import('./repos/treatment.schema');
  const [note] = await db.insert(visitNotes).values({
    id: crypto.randomUUID(), visitId, authorMemberId: MEMBER_ID,
    subjective: 'Patient reports pain', objective: 'Swelling visible',
    assessment: 'Caries D#16', plan: 'Extraction D#16', notes: 'Allergic to penicillin',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    ...overrides,
  }).returning();
  return note!;
}

// =============================================================================
// signVisitNotes — POST /{visitId}/notes/sign
// =============================================================================

describe('signVisitNotes', () => {
  afterEach(truncate);

  test('signs an unsigned note — returns signed=true with signedAt and lockedAt', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    await seedNote(visit.id);

    const res = await app.request(`/dental/visits/${visit.id}/notes/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.signed).toBe(true);
    expect(body.signedAt).toBeTruthy();
    expect(body.lockedAt).toBeTruthy();
    expect(body.signedBy).toBe(TEST_USER.id);
  });

  test('creates version 1 snapshot on sign', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    const note = await seedNote(visit.id);

    await app.request(`/dental/visits/${visit.id}/notes/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Verify version row exists in DB
    const { visitNoteVersions } = await import('./repos/treatment.schema');
    const { eq } = await import('drizzle-orm');
    const versions = await db.select().from(visitNoteVersions).where(eq(visitNoteVersions.noteId, note.id));
    expect(versions).toHaveLength(1);
    expect(versions[0]!.version).toBe(1);
    expect(versions[0]!.snapshot).toMatchObject({
      subjective: 'Patient reports pain',
      assessment: 'Caries D#16',
    });
  });

  test('404 if note does not exist for the visit', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    // No note seeded

    const res = await app.request(`/dental/visits/${visit.id}/notes/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(404);
  });

  test('422 if note is already signed', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    await seedNote(visit.id, { signed: true, signedAt: new Date(), signedBy: TEST_USER.id, lockedAt: new Date() });

    const res = await app.request(`/dental/visits/${visit.id}/notes/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('NOTE_ALREADY_SIGNED');
  });

  test('401 if not authenticated', async () => {
    const app = buildTestApp(); // no user
    const visit = await seedVisit('active');
    await seedNote(visit.id);

    const res = await app.request(`/dental/visits/${visit.id}/notes/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(401);
  });
});

// =============================================================================
// NOTE_SIGNED guard — upsertVisitNotes on a signed note
// =============================================================================

describe('upsertVisitNotes — NOTE_SIGNED guard', () => {
  afterEach(truncate);

  test('422 NOTE_SIGNED when trying to edit a signed note', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    await seedNote(visit.id, { signed: true, signedAt: new Date(), signedBy: TEST_USER.id, lockedAt: new Date() });

    const res = await app.request(`/dental/visits/${visit.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId: visit.id, subjective: 'Attempt to modify signed note' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('NOTE_SIGNED');
  });

  test('allows upsert on an unsigned note', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    await seedNote(visit.id); // unsigned

    const res = await app.request(`/dental/visits/${visit.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId: visit.id, subjective: 'Updated pain level' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.subjective).toBe('Updated pain level');
  });
});

// =============================================================================
// createVisitNoteAddendum — POST /{visitId}/notes/addendum
// =============================================================================

describe('createVisitNoteAddendum', () => {
  afterEach(truncate);

  test('creates addendum (v2) on a signed note', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    const note = await seedNote(visit.id); // unsigned — will sign via handler to create v1

    // Sign via handler to create the v1 snapshot
    await app.request(`/dental/visits/${visit.id}/notes/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await app.request(`/dental/visits/${visit.id}/notes/addendum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Forgot to note allergy', content: 'Patient also allergic to sulfa drugs' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.noteId).toBe(note.id);
    expect(body.version).toBe(2);
    expect(body.snapshot).toMatchObject({ reason: 'Forgot to note allergy', content: 'Patient also allergic to sulfa drugs' });
  });

  test('sequentially increments version for multiple addenda', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    const note = await seedNote(visit.id, { signed: true, signedAt: new Date(), signedBy: TEST_USER.id, lockedAt: new Date() });

    // Seed v1 (sign snapshot)
    const { visitNoteVersions } = await import('./repos/treatment.schema');
    await db.insert(visitNoteVersions).values({
      noteId: note.id, version: 1,
      snapshot: { type: 'sign', subjective: 'Patient reports pain' },
      createdBy: TEST_USER.id,
    });

    const res = await app.request(`/dental/visits/${visit.id}/notes/addendum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Correction', content: 'Additional detail' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.version).toBe(2);
  });

  test('422 if note is not yet signed', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    await seedNote(visit.id); // unsigned

    const res = await app.request(`/dental/visits/${visit.id}/notes/addendum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Correction', content: 'More detail' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('NOTE_NOT_SIGNED');
  });

  test('400 if reason is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    await seedNote(visit.id, { signed: true, signedAt: new Date(), signedBy: TEST_USER.id, lockedAt: new Date() });

    const res = await app.request(`/dental/visits/${visit.id}/notes/addendum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'No reason provided' }),
    });

    expect(res.status).toBe(400);
  });

  test('404 if note does not exist', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    // No note seeded

    const res = await app.request(`/dental/visits/${visit.id}/notes/addendum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Correction', content: 'Detail' }),
    });

    expect(res.status).toBe(404);
  });
});

// =============================================================================
// getVisitNoteHistory — GET /{visitId}/notes/history
// =============================================================================

describe('getVisitNoteHistory', () => {
  afterEach(truncate);

  test('returns all version snapshots for a signed note', async () => {
    const visit = await seedVisit('active');
    const note = await seedNote(visit.id, { signed: true, signedAt: new Date(), signedBy: TEST_USER.id, lockedAt: new Date() });

    // Seed 2 versions directly
    const { visitNoteVersions } = await import('./repos/treatment.schema');
    await db.insert(visitNoteVersions).values([
      { noteId: note.id, version: 1, snapshot: { type: 'sign', subjective: 'Pain' }, createdBy: TEST_USER.id },
      { noteId: note.id, version: 2, snapshot: { type: 'addendum', reason: 'Fix', content: 'Correction' }, createdBy: TEST_USER.id },
    ]);

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/notes/history`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].version).toBe(1);
    expect(body[1].version).toBe(2);
    expect(body[0].noteId).toBe(note.id);
  });

  test('returns empty array if no versions exist', async () => {
    const visit = await seedVisit('active');
    await seedNote(visit.id); // unsigned, no versions

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/notes/history`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  test('404 if note does not exist for visit', async () => {
    const visit = await seedVisit('active');
    // No note seeded

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/notes/history`);

    expect(res.status).toBe(404);
  });

  test('401 if not authenticated', async () => {
    const visit = await seedVisit('active');
    await seedNote(visit.id);

    const app = buildTestApp(); // no user
    const res = await app.request(`/dental/visits/${visit.id}/notes/history`);

    expect(res.status).toBe(401);
  });
});
