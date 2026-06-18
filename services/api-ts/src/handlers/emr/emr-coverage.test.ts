/**
 * emr-coverage.test.ts
 *
 * Coverage-targeted handler sweep for all 6 EMR handlers.
 * Pattern: real Postgres via openTestTx (auto-rollback) + Hono buildTestApp.
 * Target: push EMR module line coverage to ≥70%.
 *
 * Handlers covered:
 *   - createConsultation    POST /emr/consultations
 *   - finalizeConsultation  POST /emr/consultations/:consultation/finalize
 *   - getConsultation       GET  /emr/consultations/:consultation
 *   - listConsultations     GET  /emr/consultations
 *   - listEMRPatients       GET  /emr/patients
 *   - updateConsultation    PATCH /emr/consultations/:consultation
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { openTestTx } from '@/core/test-tx';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { providers } from '@/handlers/provider/repos/provider.schema';
import {
  CreateConsultationRequestSchema,
  UpdateConsultationRequestSchema,
  ListConsultationsQuery,
  ListEMRPatientsQuery,
} from '@/generated/openapi/validators';
import { createConsultation } from './createConsultation';
import { finalizeConsultation } from './finalizeConsultation';
import { getConsultation } from './getConsultation';
import { listConsultations } from './listConsultations';
import { listEMRPatients } from './listEMRPatients';
import { updateConsultation } from './updateConsultation';
import { ConsultationNoteRepository } from './repos/emr.repo';

// ---------------------------------------------------------------------------
// Shared IDs — use range far from existing seed data
// ---------------------------------------------------------------------------

const PROVIDER_PERSON_ID = 'ec000000-0000-4000-8000-000000000001';
const PATIENT_PERSON_ID  = 'ec000000-0000-4000-8000-000000000002';
const OTHER_PERSON_ID    = 'ec000000-0000-4000-8000-000000000003';
const PROVIDER_ID        = 'ec000000-0000-4000-8000-000000000004';
const PATIENT_ID         = 'ec000000-0000-4000-8000-000000000005';
const OTHER_PROVIDER_ID  = 'ec000000-0000-4000-8000-000000000006';
const NONEXISTENT_ID     = 'ffffffff-ffff-4000-8000-000000000099';

const PROVIDER_USER  = { id: PROVIDER_PERSON_ID, email: 'provider@clinic.com', role: 'provider' };
const PATIENT_USER   = { id: PATIENT_PERSON_ID,  email: 'patient@clinic.com',  role: 'patient' };
const ADMIN_USER     = { id: OTHER_PERSON_ID,     email: 'admin@clinic.com',    role: 'admin' };

const noop = () => {};
const logger = { debug: noop, info: noop, warn: noop, error: noop };

// ---------------------------------------------------------------------------
// DB + teardown lifecycle — openTestTx rolls back automatically
// ---------------------------------------------------------------------------

let db: NodePgDatabase;
let teardown: () => Promise<void>;

beforeEach(async () => {
  const tx = await openTestTx();
  db = tx.db;
  teardown = tx.rollback;

  // Seed FK dependencies: persons → providers + patient
  await db.insert(persons).values([
    { id: PROVIDER_PERSON_ID, firstName: 'Provider', lastName: 'Test' },
    { id: PATIENT_PERSON_ID,  firstName: 'Patient',  lastName: 'Test' },
    { id: OTHER_PERSON_ID,    firstName: 'Admin',    lastName: 'Test' },
  ]).onConflictDoNothing();

  await db.insert(providers).values([
    { id: PROVIDER_ID,       person: PROVIDER_PERSON_ID, providerType: 'dentist' },
    { id: OTHER_PROVIDER_ID, person: OTHER_PERSON_ID,    providerType: 'dentist' },
  ]).onConflictDoNothing();

  await db.insert(patients).values([
    { id: PATIENT_ID, person: PATIENT_PERSON_ID },
  ]).onConflictDoNothing();
});

afterEach(() => teardown());

// ---------------------------------------------------------------------------
// Shared Hono app factory
// ---------------------------------------------------------------------------

type AppOptions = {
  user?: typeof PROVIDER_USER | typeof PATIENT_USER | typeof ADMIN_USER;
};

function buildTestApp(options: AppOptions = {}) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: (err as any).code ?? null }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', logger);
    if (options.user) {
      ctx.set('user', options.user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  const ve = (result: any, c: any) => {
    if (!result.success) {
      return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
    }
  };

  // Routes
  app.post(
    '/emr/consultations',
    zValidator('json', CreateConsultationRequestSchema, ve),
    createConsultation as any,
  );
  app.get(
    '/emr/consultations',
    zValidator('query', ListConsultationsQuery, ve),
    listConsultations as any,
  );
  app.get('/emr/consultations/:consultation', getConsultation as any);
  app.patch(
    '/emr/consultations/:consultation',
    zValidator('json', UpdateConsultationRequestSchema, ve),
    updateConsultation as any,
  );
  app.post('/emr/consultations/:consultation/finalize', finalizeConsultation as any);
  app.get(
    '/emr/patients',
    zValidator('query', ListEMRPatientsQuery, ve),
    listEMRPatients as any,
  );

  return app;
}

// ---------------------------------------------------------------------------
// Helper: seed a draft consultation directly via repo
// ---------------------------------------------------------------------------

async function seedDraftConsultation(overrides: { context?: string } = {}) {
  const repo = new ConsultationNoteRepository(db, logger as any);
  return await repo.createDirect({
    patient: PATIENT_ID,
    provider: PROVIDER_ID,
    chiefComplaint: 'Test complaint',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// createConsultation
// ---------------------------------------------------------------------------

describe('createConsultation handler', () => {
  test('unauthenticated → 401', async () => {
    const app = buildTestApp();
    const res = await app.request('/emr/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient: PATIENT_ID, provider: PROVIDER_ID }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('missing required fields → 400', async () => {
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiefComplaint: 'pain' }), // missing patient + provider
    });
    expect(res.status).toBe(400);
  });

  test('invalid UUID fields → 400', async () => {
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient: 'not-a-uuid', provider: 'also-not-a-uuid' }),
    });
    expect(res.status).toBe(400);
  });

  test('V-EMR-AUTH: caller with no provider profile → ≥400 (PROVIDER_NOT_FOUND)', async () => {
    // V-EMR-AUTH: only a provider may create, and only as themselves. A caller
    // whose person has NO linked provider record → getProviderByPersonIdForEMR
    // returns null → BusinessLogicError('PROVIDER_NOT_FOUND'). Someone who is not
    // a provider can never author a consultation note. (ADMIN_USER's person IS
    // linked to a provider here, so we use a person with no provider profile.)
    const noProfileUser = { id: NONEXISTENT_ID, email: 'noprofile@clinic.com', role: 'provider' };
    const app = buildTestApp({ user: noProfileUser as any });
    const res = await app.request('/emr/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient: PATIENT_ID, provider: PROVIDER_ID }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json() as any;
    // The negative-path error code is the PROVIDER_NOT_FOUND guard, not a generic 500.
    expect(body.code).toBe('PROVIDER_NOT_FOUND');
  });

  test('V-EMR-AUTH: wrong provider in body → 403 (can only author as self)', async () => {
    // V-EMR-AUTH: body.provider must resolve to the caller's OWN provider profile.
    // PROVIDER_USER is linked to PROVIDER_ID but body says OTHER_PROVIDER_ID →
    // ForbiddenError. A provider cannot author a note attributed to a different
    // provider (no impersonation / no scope widening via the body).
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient: PATIENT_ID, provider: OTHER_PROVIDER_ID }),
    });
    expect(res.status).toBe(403);
  });

  test('patient not found → 404', async () => {
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient: NONEXISTENT_ID, provider: PROVIDER_ID }),
    });
    expect(res.status).toBe(404);
  });

  test('happy path — creates draft consultation → 201', async () => {
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient: PATIENT_ID,
        provider: PROVIDER_ID,
        chiefComplaint: 'Tooth pain',
        assessment: 'Possible cavity',
        plan: 'Fill cavity',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.status).toBe('draft');
    expect(body.patient).toBe(PATIENT_ID);
    expect(body.provider).toBe(PROVIDER_ID);
  });

  test('duplicate context → ≥400 (CONSULTATION_EXISTS)', async () => {
    await seedDraftConsultation({ context: 'unique-context-abc' });
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient: PATIENT_ID,
        provider: PROVIDER_ID,
        context: 'unique-context-abc',
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// getConsultation
// ---------------------------------------------------------------------------

describe('getConsultation handler', () => {
  test('unauthenticated → ≥400', async () => {
    const app = buildTestApp();
    const consultation = await seedDraftConsultation();
    const res = await app.request(`/emr/consultations/${consultation.id}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('consultation not found → 404', async () => {
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request(`/emr/consultations/${NONEXISTENT_ID}`);
    expect(res.status).toBe(404);
  });

  test('V-EMR-OWN: non-owning provider reading another provider\'s note → 403', async () => {
    // V-EMR-OWN: getConsultation grants admin OR owning-provider OR owning-patient,
    // else 403. `stranger` (role=provider, but NOT the note's provider and not an
    // admin) is a non-owner → ForbiddenError. Ownership is the entire isolation
    // boundary (no branch/tenant), so a non-owner read MUST be refused.
    const consultation = await seedDraftConsultation();
    const stranger = { id: OTHER_PERSON_ID, email: 'stranger@clinic.com', role: 'provider' };
    const app = buildTestApp({ user: stranger as any });
    const res = await app.request(`/emr/consultations/${consultation.id}`);
    expect(res.status).toBe(403);
  });

  test('V-EMR-OWN: admin → 200 reads any consultation (MODULE_SPEC §6 admin grant, V-EMR-C-003)', async () => {
    const consultation = await seedDraftConsultation();
    // ADMIN_USER is neither the owning provider nor patient, but §6 grants admin read-one.
    const app = buildTestApp({ user: ADMIN_USER });
    const res = await app.request(`/emr/consultations/${consultation.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(consultation.id);
  });

  test('owning provider → 200', async () => {
    const consultation = await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request(`/emr/consultations/${consultation.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(consultation.id);
  });

  test('owning patient → 200', async () => {
    const consultation = await seedDraftConsultation();
    const app = buildTestApp({ user: PATIENT_USER });
    const res = await app.request(`/emr/consultations/${consultation.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(consultation.id);
  });
});

// ---------------------------------------------------------------------------
// listConsultations
// ---------------------------------------------------------------------------

describe('listConsultations handler', () => {
  test('unauthenticated → ≥400', async () => {
    const app = buildTestApp();
    const res = await app.request('/emr/consultations');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('provider with no profile → 403', async () => {
    // ADMIN_USER has role=admin but findByPersonId returns null (no provider profile linked)
    // Use a fake user with role=provider but no provider record
    const fakeProviderUser = { id: NONEXISTENT_ID, email: 'fake@clinic.com', role: 'provider' };
    const app = buildTestApp({ user: fakeProviderUser as any });
    const res = await app.request('/emr/consultations');
    expect(res.status).toBe(403);
  });

  test('provider → 200 with empty list', async () => {
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/consultations');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('provider → 200 with consultations list', async () => {
    await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/consultations');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.pagination).toBeDefined();
  });

  test('admin → 200 sees all consultations', async () => {
    await seedDraftConsultation();
    const app = buildTestApp({ user: ADMIN_USER });
    const res = await app.request('/emr/consultations');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('patient → 200 sees own consultations', async () => {
    await seedDraftConsultation();
    const app = buildTestApp({ user: PATIENT_USER });
    const res = await app.request('/emr/consultations');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('status filter — draft', async () => {
    await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/consultations?status=draft');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.every((c: any) => c.status === 'draft')).toBe(true);
  });

  test('patient filter passed → 200', async () => {
    await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request(`/emr/consultations?patient=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listConsultations — ADVERSARIAL cross-owner self-scoping (IDOR via list)
//
// The happy-path tests above only assert `Array.isArray(data)`. They do NOT
// prove a provider's list EXCLUDES another provider's notes, nor that a patient
// cannot see another patient's notes via the list. Because the EMR module has
// NO branch/tenant boundary (isolation is purely by provider/patient ownership
// resolved server-side from the session), the list-scoping IS the entire
// cross-tenant isolation surface for bulk reads — so it must be pinned that
// foreign-owner rows never appear, and that a patient cannot widen scope by
// passing another patient's id in `?patient=`.
// ---------------------------------------------------------------------------

describe('listConsultations — V-EMR-OWN cross-owner self-scoping (adversarial)', () => {
  const SECOND_PATIENT_PERSON_ID = 'ec000000-0000-4000-8000-0000000000a1';
  const SECOND_PATIENT_ID = 'ec000000-0000-4000-8000-0000000000a2';

  // OTHER_PROVIDER_ID is linked to OTHER_PERSON_ID. Acting as that provider with
  // role=provider lets us seed/own a note authored by a DIFFERENT provider.
  const OTHER_PROVIDER_USER = { id: OTHER_PERSON_ID, email: 'otherprov@clinic.com', role: 'provider' };

  async function seedForeignOwnerData() {
    // A second patient (person already seeded as OTHER_PERSON? no — use a fresh person).
    await db.insert(persons).values([
      { id: SECOND_PATIENT_PERSON_ID, firstName: 'Second', lastName: 'Patient' },
    ]).onConflictDoNothing();
    await db.insert(patients).values([
      { id: SECOND_PATIENT_ID, person: SECOND_PATIENT_PERSON_ID },
    ]).onConflictDoNothing();

    const repo = new ConsultationNoteRepository(db, logger as any);
    // Note A: authored by PROVIDER_ID for PATIENT_ID (the "own" note).
    const ownNote = await repo.createDirect({
      patient: PATIENT_ID,
      provider: PROVIDER_ID,
      chiefComplaint: 'Provider-A note',
      context: 'ctx-own',
    });
    // Note B: authored by OTHER_PROVIDER_ID for SECOND_PATIENT_ID (the "foreign" note).
    const foreignNote = await repo.createDirect({
      patient: SECOND_PATIENT_ID,
      provider: OTHER_PROVIDER_ID,
      chiefComplaint: 'Provider-B note',
      context: 'ctx-foreign',
    });
    return { ownNote, foreignNote };
  }

  test("provider list returns ONLY own notes — another provider's note is ABSENT", async () => {
    const { ownNote, foreignNote } = await seedForeignOwnerData();
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/consultations?limit=100');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const ids = body.data.map((c: any) => c.id);
    expect(ids).toContain(ownNote.id);
    // The other provider's note must NOT appear in provider A's list.
    expect(ids).not.toContain(foreignNote.id);
    // Every returned row is authored by provider A (no cross-provider leak).
    expect(body.data.every((c: any) => c.provider === PROVIDER_ID)).toBe(true);
  });

  test("the OTHER provider sees ONLY their own note (isolation holds both directions)", async () => {
    const { ownNote, foreignNote } = await seedForeignOwnerData();
    const app = buildTestApp({ user: OTHER_PROVIDER_USER as any });
    const res = await app.request('/emr/consultations?limit=100');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const ids = body.data.map((c: any) => c.id);
    expect(ids).toContain(foreignNote.id);
    expect(ids).not.toContain(ownNote.id);
    expect(body.data.every((c: any) => c.provider === OTHER_PROVIDER_ID)).toBe(true);
  });

  test("patient list returns ONLY own notes — another patient's note is ABSENT", async () => {
    const { ownNote, foreignNote } = await seedForeignOwnerData();
    // PATIENT_USER owns PATIENT_ID; foreignNote belongs to SECOND_PATIENT_ID.
    const app = buildTestApp({ user: PATIENT_USER });
    const res = await app.request('/emr/consultations?limit=100');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const ids = body.data.map((c: any) => c.id);
    expect(ids).toContain(ownNote.id);
    expect(ids).not.toContain(foreignNote.id);
    expect(body.data.every((c: any) => c.patient === PATIENT_ID)).toBe(true);
  });

  test("V-EMR-OWN: patient passing ANOTHER patient's id in ?patient= is rejected → 403 (cannot widen scope)", async () => {
    await seedForeignOwnerData();
    const app = buildTestApp({ user: PATIENT_USER });
    // PATIENT_USER tries to scope the list to SECOND_PATIENT_ID's records.
    const res = await app.request(`/emr/consultations?patient=${SECOND_PATIENT_ID}`);
    expect(res.status).toBe(403);
  });

  test("patient passing their OWN id in ?patient= is allowed → 200, own rows only", async () => {
    const { ownNote, foreignNote } = await seedForeignOwnerData();
    const app = buildTestApp({ user: PATIENT_USER });
    const res = await app.request(`/emr/consultations?patient=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const ids = body.data.map((c: any) => c.id);
    expect(ids).toContain(ownNote.id);
    expect(ids).not.toContain(foreignNote.id);
  });
});

// ---------------------------------------------------------------------------
// listEMRPatients
// ---------------------------------------------------------------------------

describe('listEMRPatients handler', () => {
  test('unauthenticated → ≥400', async () => {
    const app = buildTestApp();
    const res = await app.request('/emr/patients');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('user with no provider profile → 403', async () => {
    const fakeUser = { id: NONEXISTENT_ID, email: 'noprovider@clinic.com', role: 'provider' };
    const app = buildTestApp({ user: fakeUser as any });
    const res = await app.request('/emr/patients');
    expect(res.status).toBe(403);
  });

  test('provider with no consultations → 200 empty', async () => {
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/patients');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(0);
  });

  test('provider with consultations → 200 with patient list', async () => {
    await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/patients');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].consultationStats).toBeDefined();
    expect(body.pagination).toBeDefined();
  });

  test('admin (no provider profile) → 200 lists EMR patients across providers (MODULE_SPEC §6 admin grant, V-EMR-C-002)', async () => {
    await seedDraftConsultation();
    // ADMIN_USER has no provider profile; §6 grants admin "List EMR patients".
    const app = buildTestApp({ user: ADMIN_USER });
    const res = await app.request('/emr/patients');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    // The seeded patient appears regardless of which provider authored the note.
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].consultationStats).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// updateConsultation
// ---------------------------------------------------------------------------

describe('updateConsultation handler', () => {
  test('unauthenticated → ≥400', async () => {
    const consultation = await seedDraftConsultation();
    const app = buildTestApp();
    const res = await app.request(`/emr/consultations/${consultation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiefComplaint: 'Updated' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('consultation not found → 404', async () => {
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request(`/emr/consultations/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiefComplaint: 'Updated' }),
    });
    expect(res.status).toBe(404);
  });

  test('V-EMR-OWN / V-EMR-AUTH: non-owning provider update → 403', async () => {
    // V-EMR-OWN + V-EMR-AUTH: update is provider:owner — a provider who does NOT
    // own the note cannot edit it. OTHER_PROVIDER_ID's person is OTHER_PERSON_ID,
    // not the consultation's authoring provider → ForbiddenError.
    const consultation = await seedDraftConsultation();
    const otherProviderUser = { id: OTHER_PERSON_ID, email: 'other@clinic.com', role: 'provider' };
    const app = buildTestApp({ user: otherProviderUser as any });
    const res = await app.request(`/emr/consultations/${consultation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiefComplaint: 'Hijack' }),
    });
    expect(res.status).toBe(403);
  });

  test('empty body → ≥400 (NO_UPDATE_FIELDS)', async () => {
    const consultation = await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request(`/emr/consultations/${consultation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('happy path — update draft consultation → 200', async () => {
    const consultation = await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request(`/emr/consultations/${consultation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiefComplaint: 'Updated complaint', assessment: 'Cavity confirmed' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.chiefComplaint).toBe('Updated complaint');
  });

  test('clear field with null → 200', async () => {
    const consultation = await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request(`/emr/consultations/${consultation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessment: null }),
    });
    expect(res.status).toBe(200);
  });

  test('cannot update finalized consultation → ≥400 (CONSULTATION_NOT_DRAFT)', async () => {
    const consultation = await seedDraftConsultation();
    // Finalize it first
    const repo = new ConsultationNoteRepository(db, logger as any);
    await repo.finalizeNote(consultation.id, PROVIDER_PERSON_ID);

    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request(`/emr/consultations/${consultation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiefComplaint: 'Should fail' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// finalizeConsultation
// ---------------------------------------------------------------------------

describe('finalizeConsultation handler', () => {
  test('unauthenticated → ≥400', async () => {
    const consultation = await seedDraftConsultation();
    const app = buildTestApp();
    const res = await app.request(`/emr/consultations/${consultation.id}/finalize`, {
      method: 'POST',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('consultation not found → 404', async () => {
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request(`/emr/consultations/${NONEXISTENT_ID}/finalize`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });

  test('V-EMR-OWN / V-EMR-AUTH: non-owning provider finalize → 403', async () => {
    // V-EMR-OWN + V-EMR-AUTH: finalize is provider:owner — only the authoring
    // provider may finalize. A different provider → ForbiddenError.
    const consultation = await seedDraftConsultation();
    const otherProviderUser = { id: OTHER_PERSON_ID, email: 'other@clinic.com', role: 'provider' };
    const app = buildTestApp({ user: otherProviderUser as any });
    const res = await app.request(`/emr/consultations/${consultation.id}/finalize`, {
      method: 'POST',
    });
    expect(res.status).toBe(403);
  });

  test('happy path — finalize draft → 200 with finalizedAt', async () => {
    const consultation = await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request(`/emr/consultations/${consultation.id}/finalize`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('finalized');
    expect(body.finalizedAt).toBeTruthy();
    expect(body.finalizedBy).toBeTruthy();
  });

  test('finalize already-finalized → ≥400 (CONSULTATION_NOT_DRAFT)', async () => {
    const consultation = await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });
    // First finalize
    await app.request(`/emr/consultations/${consultation.id}/finalize`, { method: 'POST' });
    // Second finalize — must fail
    const res = await app.request(`/emr/consultations/${consultation.id}/finalize`, {
      method: 'POST',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// FSM: draft → finalized is TERMINAL (V-EMR-001 / V-EMR-C-001)
// ---------------------------------------------------------------------------

describe('FSM state machine — terminal draft→finalized', () => {
  test('repo REJECTS the struck finalized→amended transition', async () => {
    const repo = new ConsultationNoteRepository(db, logger as any);
    const consultation = await seedDraftConsultation();
    expect(consultation.status).toBe('draft');

    // Step 1: draft → finalized via handler
    const app = buildTestApp({ user: PROVIDER_USER });
    const finalizeRes = await app.request(`/emr/consultations/${consultation.id}/finalize`, {
      method: 'POST',
    });
    expect(finalizeRes.status).toBe(200);
    const finalized = await finalizeRes.json() as any;
    expect(finalized.status).toBe('finalized');

    // Step 2: the repo's transition guard must REJECT finalized→amended — the
    // struck re-finalizable machine (V-EMR-C-001) is no longer encoded. The spec
    // machine is terminal at `finalized`, so updateStatus must throw.
    await expect(repo.updateStatus(consultation.id, 'amended')).rejects.toThrow(
      /Invalid status transition from finalized to amended/,
    );

    // Step 3: and re-finalizing a non-draft note via the handler is rejected too.
    const refinalized = await app.request(`/emr/consultations/${consultation.id}/finalize`, {
      method: 'POST',
    });
    expect(refinalized.status).toBeGreaterThanOrEqual(400);
  });

  test('draft → finalized blocks further updates', async () => {
    const consultation = await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });

    // Finalize
    await app.request(`/emr/consultations/${consultation.id}/finalize`, { method: 'POST' });

    // Try update → must fail
    const updateRes = await app.request(`/emr/consultations/${consultation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiefComplaint: 'Post-finalize edit' }),
    });
    expect(updateRes.status).toBeGreaterThanOrEqual(400);
    const body = await updateRes.json() as any;
    expect(body.code).toBe('CONSULTATION_NOT_DRAFT');
  });
});
