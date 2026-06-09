/**
 * dental-treatment handler tests
 *
 * Covers: createDentalTreatment, listDentalTreatments, updateDentalTreatment
 *
 * Tests HTTP-level behavior: auth, validation, success on seeded data.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateDentalTreatmentBody, CreateDentalTreatmentParams,
  UpdateDentalTreatmentBody, UpdateDentalTreatmentParams,
  CarryOverTreatmentsBody, CarryOverTreatmentsParams,
} from '@/generated/openapi/validators';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { VisitRepository } from './repos/visit.repo';
import { TreatmentRepository } from './repos/treatment.repo';
import { createDentalTreatment } from './treatments/createDentalTreatment';
import { listDentalTreatments } from './treatments/listDentalTreatments';
import { updateDentalTreatment } from './treatments/updateDentalTreatment';
import { carryOverTreatments } from './treatments/carryOverTreatments';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const STAFF_USER = { id: '00000000-0000-0000-0000-000000000099', email: 'staff@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const PERSON_ID  = 'e0000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000002';
const ORG_ID = 'db000000-0000-1000-8000-000000000002';
const DENTIST_MEMBER_ID = 'c0000000-0000-1000-8000-000000000003';
const STAFF_MEMBER_ID = 'c0000000-0000-1000-8000-000000000099';
const SCHEDULING_USER = { id: '00000000-0000-0000-0000-000000000098', email: 'scheduling@clinic.com' };
const SCHEDULING_MEMBER_ID = 'c0000000-0000-1000-8000-000000000098';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Treatment Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  // Delete stale membership for this person+branch, then insert with DENTIST_MEMBER_ID
  // so the seedVisit dentistMemberId FK is valid regardless of prior DB state.
  await db.execute(sql`DELETE FROM dental_membership WHERE person_id = ${TEST_USER.id} AND branch_id = ${BRANCH_ID} AND id != ${DENTIST_MEMBER_ID}`);
  await db.insert(dentalMemberships).values({ id: DENTIST_MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Test Dentist', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: STAFF_MEMBER_ID, branchId: BRANCH_ID, personId: STAFF_USER.id, displayName: 'Test Staff', role: 'staff_full', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: SCHEDULING_MEMBER_ID, branchId: BRANCH_ID, personId: SCHEDULING_USER.id, displayName: 'Scheduling Staff', role: 'staff_scheduling', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Treatment', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const TreatmentBodyOnly = CreateDentalTreatmentBody.omit({ visitId: true });

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
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

  app.post('/dental/visits/:visitId/treatments', zValidator('param', CreateDentalTreatmentParams, ve), zValidator('json', TreatmentBodyOnly, ve), createDentalTreatment as any);
  app.get('/dental/visits/:visitId/treatments', listDentalTreatments as any);
  app.patch('/dental/visits/:visitId/treatments/:treatmentId', zValidator('param', UpdateDentalTreatmentParams, ve), zValidator('json', UpdateDentalTreatmentBody, ve), updateDentalTreatment as any);
  app.post('/dental/visits/:visitId/carry-over', zValidator('param', CarryOverTreatmentsParams, ve), zValidator('json', CarryOverTreatmentsBody, ve), carryOverTreatments as any);

  return app;
}

async function seedVisit() {
  const repo = new VisitRepository(db);
  return repo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: DENTIST_MEMBER_ID,
  });
}

async function seedTreatment(visitId: string) {
  const repo = new TreatmentRepository(db);
  return repo.createOne({
    visitId,
    patientId: PATIENT_ID,
    cdtCode: 'D0120',
    description: 'Periodic oral evaluation',
    priceCents: 5000,
    carriedOver: false,
  });
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE dental_treatment, dental_chart, visit_notes, dental_visit CASCADE`,
  );
  // dental_audit_log is append-only (DB trigger denies row UPDATE/DELETE, V-AUD-IMM-001).
  // Reset via table-level TRUNCATE, which the BEFORE ROW trigger does not block.
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
});

// V-VIS-006: helper to read audit rows written for a treatment transition.
async function auditRowsFor(treatmentId: string, action: string) {
  const { dentalAuditLog } = await import('@/handlers/dental-audit/repos/audit-log.schema');
  const { eq, and } = await import('drizzle-orm');
  return db
    .select()
    .from(dentalAuditLog)
    .where(and(eq(dentalAuditLog.targetId, treatmentId), eq(dentalAuditLog.action, action)));
}

// ---------------------------------------------------------------------------
// createDentalTreatment
// ---------------------------------------------------------------------------

describe('createDentalTreatment handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        cdtCode: 'D0120',
        description: 'Periodic oral evaluation',
        priceCents: 5000,
      }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId is missing', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cdtCode: 'D0120', description: 'Eval', priceCents: 5000 }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when cdtCode is missing', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, description: 'Eval', priceCents: 5000 }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when description is missing', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, cdtCode: 'D0120', priceCents: 5000 }),
    });
    expect(res.status).toBe(400);
  });

  // dental-org G2 (decision §5): priceCents is now OPTIONAL — when omitted the
  // handler defaults it from the branch fee schedule (override ?? catalog default
  // ?? 0). No catalog/override is seeded in this suite, so the default is 0.
  // (Drive-pricing behaviour with a populated catalog is covered in
  // dental-treatment.fee-default.test.ts.)
  test('returns 201 and defaults priceCents from the fee schedule when omitted', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, cdtCode: 'D0120', description: 'Eval' }),
    });
    expect(res.status).toBe(201);
    const created = await res.json() as { priceCents: number };
    expect(created.priceCents).toBe(0);
  });

  test('returns 400 when priceCents is not a number', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, cdtCode: 'D0120', description: 'Eval', priceCents: 'free' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 201 with created treatment on valid input', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        cdtCode: 'D1110',
        description: 'Adult prophylaxis',
        priceCents: 8500,
        toothNumber: 11,
        surfaces: ['mesial', 'distal'],
        conditionCode: 'K02.1',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.visitId).toBe(visit.id);
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.cdtCode).toBe('D1110');
    expect(body.priceCents).toBe(8500);
    expect(body.status).toBe('diagnosed');
    expect(body.toothNumber).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// listDentalTreatments
// ---------------------------------------------------------------------------

describe('listDentalTreatments handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/treatments`);
    expect(res.status).toBe(401);
  });

  test('returns 200 with empty list when visit has no treatments', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toEqual([]);
    expect(body.pagination.totalCount).toBe(0);
  });

  test('returns 200 with seeded treatments for visit', async () => {
    const visit = await seedVisit();
    await seedTreatment(visit.id);
    await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(2);
    expect(body.pagination.totalCount).toBe(2);
    expect(body.data[0].visitId).toBe(visit.id);
  });

  test('returns only treatments for the specified visit', async () => {
    const visit1 = await seedVisit();
    const visit2 = await seedVisit();
    await seedTreatment(visit1.id);
    await seedTreatment(visit2.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit1.id}/treatments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(1);
    expect(body.data[0].visitId).toBe(visit1.id);
  });
});

// ---------------------------------------------------------------------------
// updateDentalTreatment
// ---------------------------------------------------------------------------

describe('updateDentalTreatment handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/treatments/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when treatment does not exist', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });
    expect(res.status).toBe(404);
  });

  test('returns 400 when status is invalid', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 200 and advances treatment to planned', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('planned');
  });

  test('returns 422 when advancing diagnosis directly to performed (skipping planned)', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id); // starts at 'diagnosed'
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'performed' }),
    });
    expect(res.status).toBe(422);
  });

  test('returns 200 and dismisses treatment with reason', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed', dismissReason: 'Patient refused' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('dismissed');
    expect(body.dismissReason).toBe('Patient refused');
  });

  test('V-VIS-006: dismiss writes a treatment.dismissed audit row', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed', dismissReason: 'Patient refused' }),
    });
    expect(res.status).toBe(200);

    const rows = await auditRowsFor(treatment.id, 'treatment.dismissed');
    expect(rows.length).toBe(1);
    expect(rows[0]!.targetType).toBe('dental_treatment');
    expect((rows[0]!.metadata as any).reason).toBe('Patient refused');
  });

  test('V-VIS-006: decline (patient refusal) writes a treatment.declined audit row', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'declined', refusalReason: 'Cannot afford treatment' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('declined');

    const rows = await auditRowsFor(treatment.id, 'treatment.declined');
    expect(rows.length).toBe(1);
    expect((rows[0]!.metadata as any).refusalReason).toBe('Cannot afford treatment');
  });

  test('returns 200 and updates tooth and CDT fields', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toothNumber: 22,
        surfaces: ['buccal'],
        cdtCode: 'D2140',
        description: 'Amalgam restoration',
        conditionCode: 'K02.9',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.toothNumber).toBe(22);
    expect(body.cdtCode).toBe('D2140');
    expect(body.conditionCode).toBe('K02.9');
  });

  // --- Status transition validation ---

  test('returns 422 on invalid reverse transition (planned → diagnosed)', async () => {
    const visit = await seedVisit();
    const repo = new TreatmentRepository(db);
    const treatment = await repo.createOne({
      visitId: visit.id,
      patientId: PATIENT_ID,
      cdtCode: 'D0120',
      description: 'Eval',
      priceCents: 5000,
      carriedOver: false,
      status: 'planned',
    });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'diagnosed' }),
    });
    expect(res.status).toBe(422);
  });

  test('returns 422 when transitioning out of terminal dismissed state', async () => {
    const visit = await seedVisit();
    const repo = new TreatmentRepository(db);
    const treatment = await repo.createOne({
      visitId: visit.id,
      patientId: PATIENT_ID,
      cdtCode: 'D0120',
      description: 'Eval',
      priceCents: 5000,
      carriedOver: false,
      status: 'dismissed',
    });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });
    expect(res.status).toBe(422);
  });

  test('returns 200 dismissing from planned (dismissed reachable from any non-terminal state)', async () => {
    const visit = await seedVisit();
    const repo = new TreatmentRepository(db);
    const treatment = await repo.createOne({
      visitId: visit.id,
      patientId: PATIENT_ID,
      cdtCode: 'D0120',
      description: 'Eval',
      priceCents: 5000,
      carriedOver: false,
      status: 'planned',
    });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed', dismissReason: 'Changed plan' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('dismissed');
    expect(body.dismissReason).toBe('Changed plan');
  });

  test('EC4: priceCents is locked at creation — update cannot change fee', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);

    // Attempt to change price in update
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceCents: 99999 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // priceCents must remain at original value — EC4 locks it
    expect(body.priceCents).toBe(treatment.priceCents);
    expect(body.priceCents).not.toBe(99999);
  });
});

// ---------------------------------------------------------------------------
// BR-008: Carried-over treatments have visual indicator; not auto-charged
// ---------------------------------------------------------------------------

describe('BR-008: carry-over treatments', () => {
  test('carried-over treatments have carriedOver=true flag', async () => {
    // Seed a "previous" visit with a pending treatment
    const prevVisit = await seedVisit();
    const prevTreatment = await seedTreatment(prevVisit.id);

    // Seed a new visit for the same patient
    const repo = new VisitRepository(db);
    const newVisit = await repo.createOne({
      patientId: PATIENT_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DENTIST_MEMBER_ID,
    });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${newVisit.id}/carry-over`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.carriedOver)).toBe(true);
    // All carried-over treatments must have carriedOver=true
    for (const t of body.carriedOver) {
      expect(t.carriedOver).toBe(true);
    }
    // Suppress unused warning — prevTreatment was seeded so carry-over has source data
    expect(prevTreatment.carriedOver).toBe(false);
  });

  test('carry-over returns 401 without auth', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(); // no user
    const res = await app.request(`/dental/visits/${visit.id}/carry-over`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// EM-VIS-002: carry-over with explicit source_visit_id
// API_CONTRACTS §POST /carry-over requires source_visit_id in body
// ---------------------------------------------------------------------------

describe('EM-VIS-002: carry-over with explicit sourceVisitId', () => {
  test('uses only treatments from the specified source visit when sourceVisitId provided', async () => {
    const visitRepo = new VisitRepository(db);
    const treatmentRepo = new TreatmentRepository(db);

    // Two prior visits — only source visit has the treatment we want
    const sourceVisit = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID });
    const otherVisit  = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID });

    // Treatment in the source visit
    const sourceTreatment = await treatmentRepo.createOne({ visitId: sourceVisit.id, patientId: PATIENT_ID, cdtCode: 'D1110', description: 'Adult prophylaxis', priceCents: 8500, carriedOver: false });
    // Treatment in the other visit — must NOT be carried over
    const _otherTreatment = await treatmentRepo.createOne({ visitId: otherVisit.id, patientId: PATIENT_ID, cdtCode: 'D0330', description: 'Panoramic image', priceCents: 15000, carriedOver: false });

    const newVisit = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${newVisit.id}/carry-over`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceVisitId: sourceVisit.id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.carriedOver)).toBe(true);
    // Exactly the one treatment from sourceVisit
    expect(body.carriedOver.length).toBe(1);
    expect(body.carriedOver[0].cdtCode).toBe(sourceTreatment.cdtCode);
    expect(body.carriedOver[0].carriedOver).toBe(true);
    expect(body.carriedOver[0].sourceVisitId).toBe(sourceVisit.id);
    // Suppress unused warning
    void _otherTreatment;
  });

  test('returns 404 when sourceVisitId does not exist', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/carry-over`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceVisitId: NONEXISTENT_ID }),
    });
    expect(res.status).toBe(404);
  });

  test('returns 422 when sourceVisitId belongs to a different patient', async () => {
    const visitRepo = new VisitRepository(db);

    // Create a second patient visit (reuse PATIENT_2_ID seeded in beforeAll via shared person seed)
    // We need PATIENT_2_ID to exist — seed it inline
    const { persons: personsTable } = await import('@/handlers/person/repos/person.schema');
    const { patients: patientsTable } = await import('@/handlers/patient/repos/patient.schema');
    const PERSON_2_ID_LOCAL = 'e0000000-0000-1000-8000-000000000a02';
    const PATIENT_2_ID_LOCAL = 'a0000000-0000-1000-8000-000000000a02';
    await db.insert(personsTable).values({ id: PERSON_2_ID_LOCAL, firstName: 'Other', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
    await db.insert(patientsTable).values({ id: PATIENT_2_ID_LOCAL, person: PERSON_2_ID_LOCAL, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();

    const patient2Visit = await visitRepo.createOne({ patientId: PATIENT_2_ID_LOCAL, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID });
    const patient1NewVisit = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${patient1NewVisit.id}/carry-over`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceVisitId: patient2Visit.id }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVALID_SOURCE_VISIT');
  });

  test('sourceVisitId returns empty carriedOver when source visit has no pending treatments', async () => {
    const visitRepo = new VisitRepository(db);

    // Source visit exists but has no treatments
    const sourceVisit = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID });
    const newVisit    = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${newVisit.id}/carry-over`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceVisitId: sourceVisit.id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.carriedOver.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Role gate — createDentalTreatment (CIMG note: tests assertBranchRole)
// staff_full is blocked; dentist_owner is allowed through the gate
// ---------------------------------------------------------------------------

describe('createDentalTreatment role gate', () => {
  test('staff_full → 403', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(STAFF_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, cdtCode: 'D0120', description: 'Eval', priceCents: 5000, carriedOver: false }),
    });
    expect(res.status).toBe(403);
  });

  test('staff_scheduling → 403', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(SCHEDULING_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, cdtCode: 'D0120', description: 'Eval', priceCents: 5000, carriedOver: false }),
    });
    expect(res.status).toBe(403);
  });

  test('dentist_owner → passes role gate (not 403)', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, cdtCode: 'D0120', description: 'Eval', priceCents: 5000, carriedOver: false }),
    });
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Role gate — updateDentalTreatment (FIX-05: assertBranchAccess → assertBranchRole)
// staff_full is blocked; dentist_owner is allowed through the gate
// ---------------------------------------------------------------------------

describe('updateDentalTreatment role gate', () => {
  test('staff_full → 403', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(STAFF_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });
    expect(res.status).toBe(403);
  });

  test('staff_scheduling → 403', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(SCHEDULING_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });
    expect(res.status).toBe(403);
  });

  test('dentist_owner → passes role gate (not 403)', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// FIX-02 — clinicalNotes persistence (P0-004)
// ---------------------------------------------------------------------------

describe('clinicalNotes persistence', () => {
  test('PATCH with clinicalNotes persists and returns it', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicalNotes: 'Sensitivity on cold stimulus, likely reversible pulpitis' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.clinicalNotes).toBe('Sensitivity on cold stimulus, likely reversible pulpitis');
  });

  test('POST create with clinicalNotes persists and returns it', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        cdtCode: 'D2391',
        description: 'Resin restoration',
        priceCents: 12000,
        clinicalNotes: 'Prep completed, composite placed',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.clinicalNotes).toBe('Prep completed, composite placed');
  });

  test('clinicalNotes is null when not provided', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.clinicalNotes === null || body.clinicalNotes === undefined).toBe(true);
  });
});
